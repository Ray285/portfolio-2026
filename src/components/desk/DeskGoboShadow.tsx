"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { NormalBlending, PlaneGeometry, ShaderMaterial, Vector2, type Mesh } from "three";

/** Max opacity of shadow bands between light rays. */
const MAX_ALPHA  = 0.38;
/** How fast rays slowly rotate. Very low = majestic drift. */
const TIME_SCALE = 0.28;
/** Controls how many rays are visible. ~7–12 looks natural. */
const RAY_COUNT  = 9.0;
/** How quickly rays fade with distance from source. Lower = longer rays. */
const FALLOFF    = 1.5;

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

  uniform float  uTime;
  uniform float  uMaxAlpha;
  uniform float  uRayCount;
  uniform float  uFalloff;
  uniform vec2   uLightPos;   // UV-space position of the light source

  void main() {
    float t = uTime;

    // Polar coords centered on the light source
    vec2  delta = vUv - uLightPos;
    float dist  = length(delta);
    float angle = atan(delta.y, delta.x);

    // Angular shadow bands — three overlapping sine waves at the same angular
    // frequency create irregular ray widths (avoids a mechanical pinwheel look).
    // Negative regions become the shadow between rays; white desk shows through
    // the positive (bright) regions = the visible light shafts.
    float a = sin(angle * uRayCount        + t * 0.30);
    float b = sin(angle * uRayCount * 1.55 - t * 0.17);
    float c = sin(angle * uRayCount * 0.62 + t * 0.09);

    // Shadow sits in the "troughs" — where all three are low simultaneously.
    // Taking the min then pushing negative maximises dark-band contrast.
    float trough = -min(a, min(b, c));
    float shadow  = max(0.0, trough);
    shadow = pow(shadow, 0.65); // soften the bands so edges are smooth

    // Radial falloff: exponential from source + tiny hole at singularity.
    float radial = exp(-dist * uFalloff) * smoothstep(0.0, 0.07, dist);
    shadow *= radial;

    // Soft fade at geometry boundary so effect doesn't hard-clip.
    vec2 fade = smoothstep(0.0, 0.07, vUv) * smoothstep(1.0, 0.93, vUv);
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
      uTime:     { value: 0 },
      uMaxAlpha: { value: MAX_ALPHA },
      uRayCount: { value: RAY_COUNT },
      uFalloff:  { value: FALLOFF },
      // Upper-left area of the desk — light coming from a window in that corner
      uLightPos: { value: new Vector2(0.12, 0.14) },
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
