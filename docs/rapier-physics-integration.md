# Plan: Rapier Physics Integration

## Context
The hand-rolled ball physics in `DeskBall.tsx` uses a manual JS integration loop (`useFrame`). Observed problems:
- **Abrupt stop** — velocity exponentially decays, then snaps hard to zero at `MIN_SPEED = 0.05`. The last few frames of slow roll then sudden freeze reads as "odd slowing."
- **O(N) JS collision** — ball checks every registered desk entry per frame; no spatial hashing.
- **Manual bounce math** — viewport-edge reflection is correct but separate from any object collision, making multi-body interactions brittle.

`@dimforge/rapier3d-compat` is already in `package.json`. The remaining work is adding `@react-three/rapier` (the ergonomic R3F wrapper) and wiring the scene.

The user wants **per-object physics mode** on `DraggableObject`:
- `"kinematic"` — object is a solid Rapier obstacle; its position is driven by the existing drag/GSAP system each frame; ball bounces off it accurately.
- `"dynamic"` — Rapier is the source of truth for position; drag applies a `setLinvel` impulse and releases control; ball physically pushes the object.
- `"none"` (default) — no Rapier body (labels, loop videos, other non-collidable items).

---

## Immediate Quick Fix (no Rapier required)
**File:** `src/components/desk/DeskBall.tsx`

Replace the hard snap-to-zero with a soft ramp so the ball glides to rest:
```diff
- if (Math.hypot(vel.x, vel.z) < MIN_SPEED) {
-   vel.x = 0;
-   vel.z = 0;
- }
+ const speed = Math.hypot(vel.x, vel.z);
+ if (speed < MIN_SPEED && speed > 0) {
+   const ramp = speed / MIN_SPEED;
+   vel.x *= ramp;
+   vel.z *= ramp;
+ }
```
This replaces the sudden stop with a brief smooth fade to zero.

---

## Rapier Integration — Phase Plan

### Phase 1 — Install
```bash
npm install @react-three/rapier
```
`@dimforge/rapier3d-compat` is already present; `@react-three/rapier` will re-use or update it.

---

### Phase 2 — Physics Provider in DeskScene
**File:** `src/components/desk/DeskScene.tsx`

Wrap the inner scene (inside `<Canvas>`) with Rapier's `<Physics>`:

```tsx
import { Physics } from "@react-three/rapier";

// Inside Canvas, above DeskPhysicsProvider:
<Physics gravity={[0, -30, 0]} timeStep="vary">
  {/* Static desk floor */}
  <RigidBody type="fixed" position={[0, 0, 0]}>
    <CuboidCollider args={[30, 0.01, 30]} />
  </RigidBody>
  <BoundaryWalls />          {/* see Phase 3 */}
  <DeskPhysicsProvider>
    ...existing scene content...
  </DeskPhysicsProvider>
</Physics>
```

Use `gravity={[0, -30, 0]}` (stronger than real gravity so the ball feels snappy on the desk surface, not floaty). `timeStep="vary"` lets Rapier match R3F's delta time.

---

### Phase 3 — Dynamic Viewport Boundary Walls
**New file:** `src/components/desk/RapierBoundaryWalls.tsx`

A component that reads `computeVisibleDeskBounds` each frame and updates 4 kinematic `CuboidCollider` wall bodies to match the visible frustum. Replaces the manual `pos.x = clampNumber(...)` and velocity reflection in `DeskBall`.

```tsx
// 4 thin slab rigid bodies, positioned at frustum edges
// Updated via setNextKinematicTranslation when bounds change
// Restitution = EDGE_RESTITUTION (0.72) set on the collider
```

---

### Phase 4 — Refactor DeskBall
**File:** `src/components/desk/DeskBall.tsx`

Replace the manual integration with a Rapier `RigidBody`:

```tsx
import { RigidBody, BallCollider, type RapierRigidBody } from "@react-three/rapier";

const rigidBodyRef = useRef<RapierRigidBody>(null);

// During drag: switch body to kinematicPosition, call setNextKinematicTranslation(targetPos)
// On pointer up: switch back to dynamic, call setLinvel(throwVelocity)
// Remove: manual vel integration, bounds clamping, object collision loop
// Keep: pointer event handlers, sample-based throw velocity, matcap mesh
```

Collider config:
```tsx
<BallCollider args={[radius]} restitution={0.45} friction={0.5} />
```

The `useFrame` shrinks to just: sync `entryRef` position/velocity from `rigidBodyRef.current.translation()` / `linvel()` so `DeskPhysicsContext` (which drives tilt/push visuals in `DraggableObject`) still works unchanged.

---

### Phase 5 — Per-Object Physics Mode in DraggableObject
**File:** `src/components/desk/DraggableObject.tsx`

Add a prop:
```tsx
rapierMode?: "kinematic" | "dynamic" | "none"  // default "none"
```

**`"kinematic"` path:**
Wrap children in:
```tsx
<RigidBody type="kinematicPosition" ref={physicsBodyRef} colliders={false}>
  <BallCollider args={[physics.radius]} />
  {children}
</RigidBody>
```
In the existing `useFrame` (after computing animated position), call:
```tsx
physicsBodyRef.current?.setNextKinematicTranslation(animatedPos);
physicsBodyRef.current?.setNextKinematicRotation(animatedQuat);
```

**`"dynamic"` path:**
```tsx
<RigidBody type="dynamic" ref={physicsBodyRef} colliders={false}
           restitution={0.3} friction={0.6} linearDamping={2} angularDamping={4}>
  <BallCollider args={[physics.radius]} />
  {children}
</RigidBody>
```
- While dragging: switch to `kinematicPosition`, track pointer exactly (same UX as today).
- On release: switch back to `dynamic`, apply `setLinvel(throwVelocity)`.
- Animated states (focus-zoom, GSAP intro): hold body as `kinematicPosition` for the duration, switch to `dynamic` when the animation settles.
- Read position from `rigidBodyRef.current.translation()` each frame and write back to the Three.js `Group` so the mesh follows.

**`"none"` path:** renders children as-is, no Rapier body. Labels, videos, etc.

---

### Phase 6 — Simplify DeskPhysicsContext
**File:** `src/components/desk/DeskPhysicsContext.tsx`

The manual JS collision loop in `DeskBall` is removed (Rapier handles it). `DeskPhysicsContext` retains its role as the **visual-push bus** — it tells `DraggableObject` when the ball is close so cards tilt and lift. No changes needed to the context itself; the tilt/push effects remain JS-driven and read from `entryRef` (now sourced from Rapier position each frame).

---

## Critical Files
| File | Change |
|---|---|
| `package.json` | add `@react-three/rapier` |
| `src/components/desk/DeskScene.tsx` | `<Physics>` wrapper, static floor |
| `src/components/desk/DeskBall.tsx` | major refactor → `RigidBody` dynamic |
| `src/components/desk/DraggableObject.tsx` | add `rapierMode` prop + `RigidBody` |
| `src/components/desk/RapierBoundaryWalls.tsx` | new — kinematic viewport walls |
| `src/lib/desk-ball-constants.ts` | possibly new restitution/friction constants |

`DeskPhysicsContext.tsx` — no changes needed.

---

## Usage in DeskScene (after integration)
```tsx
// Ball bounces off cards, cards stay put:
<DraggableObject rapierMode="kinematic" physics={CARD_PHYSICS} ...>
  <PortfolioCard3D />
</DraggableObject>

// Card can be knocked around by ball:
<DraggableObject rapierMode="dynamic" physics={CARD_PHYSICS} ...>
  <PortfolioCard3D />
</DraggableObject>

// Label — no collision:
<DraggableObject rapierMode="none" physics={HANDWRITING_LABEL_PHYSICS} ...>
  <DeskHandwritingLabel />
</DraggableObject>
```

---

## Verification
1. Ball rolls, bounces off viewport edges with EDGE_RESTITUTION (≈0.72) feel — no manual clamp needed.
2. Ball collides with `rapierMode="kinematic"` cards — bounces correctly, card doesn't move.
3. Ball collides with `rapierMode="dynamic"` card — card slides on desk, settles via linearDamping.
4. Drag a `"dynamic"` card, throw it — it slides to rest (same feel as ball).
5. Card tilt/push visual effects still respond (DeskPhysicsContext still synced from Rapier positions).
6. No regression on GSAP intros, focus-zoom, or arrange-mode multi-select.
7. DevTools timeline shows no JS frame budget exceeded during ball roll.
