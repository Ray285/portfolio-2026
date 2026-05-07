# Caustic Light Effect — Replacing DeskGoboShadow

## Background

`DeskGoboShadow` currently renders a brownian motion / FBM dark-patch pattern to simulate leaf shadow dappling. The goal is to replace it with a **light refraction (caustic) effect** — the animated bright undulating lines that appear when sunlight passes through water or glass onto a surface below.

### Rendering constraint: why AdditiveBlending won't work

The desk surface is pure white (`color="#ffffff"`, `envMapIntensity={0}`). `AdditiveBlending` adds color to the framebuffer: white + any color = white (clamped). Adding light to white is invisible.

**The correct approach:** keep `NormalBlending` and output warm-colored semi-transparent patches (golden/amber tint). At alpha 0 the desk is untouched white; at higher alpha the desk warms toward gold — simulating focused light. This is physically correct: caustics look golden because they concentrate sunlight which carries warmth.

Output color target: `vec3(1.0, 0.82, 0.38)` — a warm amber.

---

## Option A: Wave Interference Caustics ✦ Recommended

**Look:** classic water/pool caustics — thin, bright, animated lines where wave crests constructively interfere. Very recognizable as "light through water."

**Cost:** 4 `cos` evaluations per fragment — cheapest option.

### How it works

Sum multiple sine waves traveling at different angles through the plane. Where waves overlap constructively, intensity peaks; elsewhere it falls to near-zero. Squaring the product sharpens peaks into thin lines. An exponent controls line width.

### Full GLSL

```glsl
// ——— Wave interference caustics ———
// p = world-proportional UV coords, centered at origin
// t = uTime

// Wave direction vectors (unit-ish; variety avoids grid artifacts)
vec2 k1 = vec2( 1.00,  0.30);
vec2 k2 = vec2(-0.40,  0.90);
vec2 k3 = vec2( 0.70, -0.60);
vec2 k4 = vec2(-0.90,  0.20);

// Wave frequencies (spatial) and time speeds
float freq = uCausticScale;        // ≈ 3.8 — world units per wave cycle
float w =
    cos(dot(k1, p) * freq * 2.8 + t        ) *
    cos(dot(k2, p) * freq * 2.1 + t * 1.27) *
    cos(dot(k3, p) * freq * 1.9 + t * 0.83) *
    cos(dot(k4, p) * freq * 2.4 + t * 1.11);

// w in [-1,1]; squaring -> [0,1] with peaks at constructive interference
float caustic = pow(w * w, uSharpness);   // uSharpness ≈ 3.5–5.0

// Optional: add a secondary fine layer for more complexity
// (half-amplitude, higher frequency, slightly different speed)
vec2 k5 = vec2(0.50, -0.85);
vec2 k6 = vec2(-0.65, 0.45);
float w2 = cos(dot(k5, p) * freq * 4.1 + t * 1.55) *
           cos(dot(k6, p) * freq * 3.7 + t * 0.91);
caustic = mix(caustic, caustic * 0.6 + pow(w2*w2, uSharpness) * 0.4, 0.35);
```

### Constants in DeskGoboShadow.tsx

```ts
const MAX_ALPHA      = 0.18;  // caustic brightness ceiling
const TIME_SCALE     = 0.9;   // wave drift speed (caustics move slowly)
const CAUSTIC_SCALE  = 3.8;   // spatial frequency — lower = larger cells
const SHARPNESS      = 3.5;   // line width — higher = thinner, more intense peaks
```

### Tuning guide

| Want…                        | Change…                                        |
|------------------------------|------------------------------------------------|
| Brighter caustics            | Increase `MAX_ALPHA` (try up to 0.28)          |
| Bigger / slower patterns     | Decrease `CAUSTIC_SCALE` (try 2.5)             |
| Thin, razor bright lines     | Increase `SHARPNESS` (try 6.0–8.0)             |
| Slower / more serene motion  | Decrease `TIME_SCALE` (try 0.5)                |
| Warmer golden tint           | Increase R channel of `uCausticColor`          |

---

## Option B: Domain-Warped FBM Caustics

**Look:** organic refracted-glass caustics — irregular, flowing bright streaks rather than the geometric lines of Option A. Closer to frosted glass or a shallow brook than an open pool.

**Cost:** 6 FBM evaluations per fragment (≈ 3× Option A). Noticeable on low-end GPUs.

### How it works

Sample FBM noise to generate a 2D warp vector. Use that warp to displace the sampling position of a second FBM pass. The displacement causes noise values to bunch near gradient edges, producing bright concentrated streaks.

### Full GLSL

Reuses the existing `hash`, `noise`, `fbm` functions in the current shader — no additions needed.

```glsl
// ——— Domain-warped FBM caustics ———
vec2 drift = vec2(t * 0.12, t * 0.07);

// First FBM pass: compute a 2D warp field
vec2 warp = vec2(
    fbm(p + vec2(0.0, t * 0.30)),
    fbm(p + vec2(5.2, t * 0.30 + 1.3))
);

// Second FBM pass: sample at warped position
// The warping creates bright streaks at noise gradient boundaries
float n = fbm(p + 2.8 * warp + drift);

// Isolate peaks — caustics are thin bright regions, not broad patches
float caustic = smoothstep(0.55, 0.82, n);
caustic = pow(caustic, 2.0); // optional extra sharpening
```

### Constants in DeskGoboShadow.tsx

```ts
const MAX_ALPHA    = 0.20;
const TIME_SCALE   = 0.6;   // organic caustics move very slowly
const CAUSTIC_SCALE = 1.8;  // lower scale for broader organic shapes
```

---

## Option C: Voronoi Edge Caustics

**Look:** crystalline / stained-glass caustics — precise bright lines at the edges of Voronoi cells. Each cell subtly animates its center, making the lines dance. Very structured; distinct from the random look of Options A/B.

**Cost:** 9 `hash` evaluations per fragment (3×3 neighbor loop) — heavier than A/B.

### How it works

Approximate Voronoi by hashing cell coordinates to get jittered cell centers, animated by time. Caustic intensity is inversely proportional to distance from the nearest cell boundary.

### GLSL (needs a `hash2` helper)

```glsl
// ——— hash2: vec2 → vec2 pseudo-random ———
vec2 hash2(vec2 p) {
    p = vec2(dot(p, vec2(127.1, 311.7)),
             dot(p, vec2(269.5, 183.3)));
    return fract(sin(p) * 43758.5453);
}

// ——— Voronoi edge caustics ———
float scale = uCausticScale;    // ≈ 1.2 — cell size in world units
vec2 cell   = floor(p * scale);
float minDist1 = 8.0;           // nearest cell distance
float minDist2 = 8.0;           // second nearest

for (int y = -1; y <= 1; y++) {
    for (int x = -1; x <= 1; x++) {
        vec2 nb     = cell + vec2(float(x), float(y));
        vec2 jitter = hash2(nb);
        // Animate each cell center slightly
        jitter += 0.18 * sin(t * 0.6 + jitter * 6.28);
        float d = length(p * scale - nb - jitter);
        if (d < minDist1) { minDist2 = minDist1; minDist1 = d; }
        else if (d < minDist2) { minDist2 = d; }
    }
}

// Bright lines at cell boundaries (where minDist1 ≈ minDist2)
float edge    = minDist2 - minDist1;
float caustic = 1.0 - smoothstep(0.0, 0.18, edge);
caustic       = pow(caustic, 2.5);
```

### Constants in DeskGoboShadow.tsx

```ts
const MAX_ALPHA    = 0.22;
const TIME_SCALE   = 0.7;
const CAUSTIC_SCALE = 1.2;  // Voronoi cell size; 1.0–2.0 looks best
```

---

## Recommended Implementation Plan

**Start with Option A.** It produces the most instantly-recognizable caustic look, is the cheapest to run, and gives the most control via a small set of independent constants. Option B can be layered on top later as a subtle domain-warp to add organic variation without rebuilding the approach.

### Changes to `src/components/desk/DeskGoboShadow.tsx`

1. **Replace the four module-level constants:**

```ts
// before
const MAX_ALPHA       = 0.1;
const TIME_SCALE      = 1.7;
const SHADOW_SCALE    = 29.0;
const SECONDARY_ALPHA = 10;

// after
const MAX_ALPHA      = 0.18;
const TIME_SCALE     = 0.9;
const CAUSTIC_SCALE  = 3.8;
const SHARPNESS      = 3.5;
```

2. **Replace the fragment shader** — swap the existing FBM dark-patch shader for the wave-interference shader. Keep `hash`, `noise`, `fbm` for a potential Option B layer later.

3. **Update the `gl_FragColor` output line:**

```glsl
// before
gl_FragColor = vec4(0.0, 0.0, 0.0, shadow * uMaxAlpha);

// after
gl_FragColor = vec4(uCausticColor, caustic * fade.x * fade.y * uMaxAlpha);
```

4. **Add `uCausticColor` and `uSharpness` uniforms**, remove `uShadowScale`/`uSecondary`:

```ts
uniforms: {
  uTime:         { value: 0 },
  uMaxAlpha:     { value: MAX_ALPHA },
  uCausticScale: { value: CAUSTIC_SCALE },
  uSharpness:    { value: SHARPNESS },
  uCausticColor: { value: new THREE.Color(1.0, 0.82, 0.38) },
},
```

5. `NormalBlending`, `transparent`, `depthWrite: false`, `polygonOffset` — **unchanged**.

6. Geometry and mesh position/rotation — **unchanged**.

---

## Verification

1. Run `npm run dev`
2. The desk surface should show gently animated warm golden shimmer — thin bright lines moving like light through water
3. The effect should be subtle: at default `MAX_ALPHA = 0.18`, the desk is mostly white with soft warm glints
4. Adjusting `SHARPNESS` from 2 to 8 should visibly control line width (thin/wide)
5. No dark artifacts — any area with `caustic ≈ 0` renders fully transparent (desk stays white)
6. The effect should loop seamlessly with no discontinuous jumps
