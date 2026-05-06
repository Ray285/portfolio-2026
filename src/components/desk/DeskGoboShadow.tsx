"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { NormalBlending, PlaneGeometry, ShaderMaterial, type Mesh } from "three";

/** Master opacity — keep subtle; tree shadows should be barely noticeable. */
const MAX_ALPHA      = 0.1;
/** Drift speed through noise space (wind movement). Lower = slower. */
const TIME_SCALE     = 1.7;
/** Zoom level of the shadow pattern. Higher = tighter, more detail. */
const SHADOW_SCALE   = 29.0;
/** Secondary layer weight (fine leaf dappling vs thick branch shadows). */
const SECONDARY_ALPHA = 10;

const VERTEX_SHADER = /* glsl */`
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const FRAGMENT_SHADER = /* glsl */`
  precision mediump float;
  varying vec2 vUv;

  uniform float uTime;
  uniform float uMaxAlpha;
  uniform float uShadowScale;
  uniform float uSecondary;

  // ——— Hash-based 2D noise ———
  float hash(vec2 p) {
    p = fract(p * vec2(127.1, 311.7) + vec2(43.3, 89.1));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }

  // Smooth noise via bilinear interpolation
  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f); // smoothstep
    float a = hash(i);
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
  }

  // Fractal Brownian Motion — multi-octave organic detail
  float fbm(vec2 p) {
    float value = 0.0;
    float amplitude = 0.5;
    float frequency = 1.0;
    for (int i = 0; i < 3; i++) {
      value += amplitude * noise(p * frequency);
      frequency *= 2.02;
      amplitude *= 0.48;
    }
    return value;
  }

  void main() {
    // World-proportional coords, centered at origin
    vec2 p = (vUv - 0.5) * uShadowScale;

    // Drift coordinates for wind movement
    vec2 drift = vec2(uTime * 0.15, uTime * 0.08);

    // Primary layer: thick branch-like shadows
    float n0 = fbm(p * 0.5 + drift * 0.5);
    float shadow0 = smoothstep(0.42, 0.62, n0);

    // Secondary layer: fine leaf dappling on top
    float n1 = fbm(p * 1.8 + drift * 0.8);
    float shadow1 = smoothstep(0.45, 0.60, n1);

    // Combine: shadow = dark areas from both layers
    float shadow = (1.0 - shadow0) + (1.0 - shadow1) * uSecondary;
    shadow /= (1.0 + uSecondary);

    // Soft fade at plane boundary
    vec2 fade = smoothstep(0.0, 0.08, vUv) * smoothstep(1.0, 0.92, vUv);
    shadow *= fade.x * fade.y;

    gl_FragColor = vec4(0.0, 0.0, 0.0, shadow * uMaxAlpha);
  }
`;

export function DeskGoboShadow() {
  const meshRef = useRef<Mesh>(null);

  const geometry = useMemo(() => new PlaneGeometry(36, 26), []);

  const material = useMemo(() => new ShaderMaterial({
    vertexShader: VERTEX_SHADER,
    fragmentShader: FRAGMENT_SHADER,
    uniforms: {
      uTime:        { value: 0 },
      uMaxAlpha:    { value: MAX_ALPHA },
      uShadowScale: { value: SHADOW_SCALE },
      uSecondary:   { value: SECONDARY_ALPHA },
    },
    transparent: true,
    depthWrite: false,
    blending: NormalBlending,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  }), []);

  useEffect(() => () => {
    geometry.dispose();
    material.dispose();
  }, [geometry, material]);

  useFrame((_, delta) => {
    const mat = meshRef.current?.material as ShaderMaterial | undefined;
    if (mat) mat.uniforms.uTime.value += Math.min(delta, 0.1) * TIME_SCALE;
  });

  return (
    <mesh
      ref={meshRef}
      geometry={geometry}
      material={material}
      position={[0, -0.038, 0]}
      rotation={[-Math.PI / 2, 0, 0]}
      castShadow={false}
      receiveShadow={false}
    />
  );
}
