# Plan: DeskGoboShadow — Diagonal Ray Overlay

## Context
The user wants a subtle, slowly-moving shadow pattern on the desk surface resembling light shafts filtering through venetian blinds or a window frame — diagonal rays drifting slowly across the surface. The effect should be atmospheric and barely noticeable, adding life without distracting from desk objects.

The approach is a **fake shadow overlay**: a `PlaneGeometry` mesh just above the desk surface using a custom `ShaderMaterial`. This is preferable to real shadow-map projection because:
- The KeyLight's 4096px shadow map covers a 56×44 world-unit ortho frustum (~73px/world-unit) — too coarse for fine stripe detail
- A shader overlay gives full control over softness, opacity, and speed with zero render-pass overhead

---

## Files to Modify

| File | Change |
|---|---|
| `src/components/desk/DeskGoboShadow.tsx` | **New file** — full component |
| `src/components/desk/DeskScene.tsx` | Add import + one JSX line after `<DeskSurface />` (line 720) |

---

## Tuning Constants (top of `DeskGoboShadow.tsx`)

```ts
const PLANE_W = 36;          // slightly oversize vs 32×22 DeskSurface to avoid hard edge
const PLANE_H = 26;
const OVERLAY_Y = -0.038;    // 2mm above DeskSurface at y=-0.04

const MAX_ALPHA  = 0.08;     // master opacity cap — start here, push to 0.12 if too subtle
const TIME_SCALE = 0.014;    // drift speed; 0.008 = barely moves, 0.025 = "flowing curtain"
const BAND_ANGLE = 0.52;     // ray direction in radians (~30°); 0 = horizontal, PI/4 = 45°
const BAND_FREQ  = 0.38;     // bands per world unit; lower = wider shafts
const BAND_WARP  = 0.18;     // subtle organic warp strength; 0 = perfectly straight lines
const SECONDARY_ALPHA = 0.4; // secondary layer opacity relative to primary (0–1)
```

---

## Shader Design

**Pattern**: Two layers of soft diagonal bands at slightly different angles and drift speeds. Domain-warping with a low-frequency sin along the perpendicular axis breaks up straight-line rigidity without becoming "blobs".

**Vertex shader** — standard passthrough, declares `vUv`:
```glsl
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
```

**Fragment shader**:
```glsl
precision mediump float;
varying vec2 vUv;

uniform float uTime;
uniform float uMaxAlpha;
uniform float uBandAngle;   // primary ray angle (radians)
uniform float uBandFreq;    // spatial frequency
uniform float uBandWarp;    // domain-warp strength
uniform float uSecondary;   // secondary layer weight

// Project world-space point onto direction perpendicular to ray angle,
// add slow drift, apply a soft band function.
float rays(vec2 p, float angle, float freq, float speed, float warp) {
  float ca = cos(angle), sa = sin(angle);
  // Axis perpendicular to ray direction (drift axis)
  float proj = ca * p.x + sa * p.y;
  // Axis along ray direction (used for organic warp)
  float perp = -sa * p.x + ca * p.y;
  // Domain warp: nudge drift axis slightly with a slow perpendicular wave
  proj += sin(perp * 0.6 + uTime * 0.007) * warp;
  // Soft band: sin → smoothstep for soft edges
  float raw = sin((proj + uTime * speed) * freq * 6.2832) * 0.5 + 0.5;
  return smoothstep(0.30, 0.70, raw);
}

void main() {
  // Convert UV to world-proportional coords, centered at origin
  vec2 p = (vUv - 0.5) * vec2(36.0, 26.0);

  // Primary layer
  float r0 = rays(p, uBandAngle, uBandFreq, 1.0, uBandWarp);
  // Secondary layer: slightly different angle + slower drift
  float r1 = rays(p, uBandAngle + 0.25, uBandFreq * 0.72, 0.62, uBandWarp * 0.6);

  // Shadow = areas between light shafts (invert light mask)
  float shadow = (1.0 - r0) + (1.0 - r1) * uSecondary;
  shadow /= (1.0 + uSecondary); // normalise back to [0, 1]

  // Soft fade at plane boundary to avoid hard rectangle edge
  vec2 fade = smoothstep(0.0, 0.08, vUv) * smoothstep(1.0, 0.92, vUv);
  shadow *= fade.x * fade.y;

  gl_FragColor = vec4(0.0, 0.0, 0.0, shadow * uMaxAlpha);
}
```

---

## Component Structure (`DeskGoboShadow.tsx`)

```tsx
"use client";
import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { PlaneGeometry, ShaderMaterial, NormalBlending } from "three";

// ... constants ...
// ... VERTEX_SHADER / FRAGMENT_SHADER strings ...

export function DeskGoboShadow() {
  const matRef = useRef<ShaderMaterial | null>(null);

  const geometry = useMemo(() => new PlaneGeometry(PLANE_W, PLANE_H), []);

  const material = useMemo(() => {
    const mat = new ShaderMaterial({
      vertexShader: VERTEX_SHADER,
      fragmentShader: FRAGMENT_SHADER,
      uniforms: {
        uTime:       { value: 0 },
        uMaxAlpha:   { value: MAX_ALPHA },
        uBandAngle:  { value: BAND_ANGLE },
        uBandFreq:   { value: BAND_FREQ },
        uBandWarp:   { value: BAND_WARP },
        uSecondary:  { value: SECONDARY_ALPHA },
      },
      transparent: true,
      depthWrite: false,
      blending: NormalBlending,
    });
    matRef.current = mat;
    return mat;
  }, []);

  useEffect(() => () => { geometry.dispose(); material.dispose(); }, [geometry, material]);

  useFrame((_, delta) => {
    if (matRef.current)
      matRef.current.uniforms.uTime.value += Math.min(delta, 0.1) * TIME_SCALE;
  });

  return (
    <mesh
      geometry={geometry}
      material={material}
      position={[0, OVERLAY_Y, 0]}
      rotation={[-Math.PI / 2, 0, 0]}
      castShadow={false}
      receiveShadow={false}
    />
  );
}
```

---

## DeskScene.tsx Changes

**Import** — add after line 12 (`import { DeskSurface }`):
```ts
import { DeskGoboShadow } from "./DeskGoboShadow";
```

**JSX** — insert between lines 720–721:
```tsx
<DeskSurface />
<DeskGoboShadow />   {/* ← add this line */}
<WelcomeHeaderGate />
```

---

## Verification

1. `npx tsc --noEmit` — no type errors
2. `npm run dev` — open the home desk scene
3. The desk surface should show very faint diagonal shadow bands slowly drifting across it
4. Desk objects, polaroids, and contact shadows should all render correctly on top
5. Tune `MAX_ALPHA` up/down to confirm the intensity lever works
