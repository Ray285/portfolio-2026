"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { useTexture } from "@react-three/drei";
import { Mesh, OrthographicCamera, Plane, Quaternion, SRGBColorSpace, Vector3, type Texture } from "three";
import { useDeskPhysics, type DeskPhysicsEntry } from "./DeskPhysicsContext";
import {
  computeVisibleDeskBounds,
  DESK_BOUNDS_FALLBACK,
} from "./useWorkspaceDragBounds";

/** Web-friendly matcap: use PNG or JPEG. Browsers + Three.js `useTexture` do not load TIFF reliably. */
const DEFAULT_MATCAP_URL = "/desk/GrainBW_MatCap.png";

function configureMatcapTexture(texture: Texture) {
  texture.colorSpace = SRGBColorSpace;
  texture.needsUpdate = true;
}

type DeskBallProps = {
  /** XZ start position. Y is set automatically so the ball rests on the desk. */
  initialPosition?: [number, number];
  radius?: number;
  /** Tint multiplied with the matcap (sRGB hex). */
  color?: string;
  /** URL path (under `public/`) to a matcap image; loaded via `useTexture` (parent should wrap in `Suspense`). */
  matcapUrl?: string;
  /** Extra world units to inset the bounce rect beyond `radius` from the visible frustum edge (`0` = sphere tangent to the screen-edge workspace in XZ). */
  edgePadding?: number;
  /** Fires each frame with world X, Z (for persisting the ball in layout JSON together with other items). */
  onWorldXZFrame?: (xz: [number, number]) => void;
  /** Fires when the ball should be written as “at rest” (soft throw end or rolling stop). */
  onCommitWorldXZ?: (xz: [number, number]) => void;
};

/** Friction coefficient applied to linear velocity each second (exp decay). */
const LINEAR_DRAG = 0.95;
/** Energy preserved when bouncing off a viewport edge. */
const EDGE_RESTITUTION = 0.72;
/** Energy preserved when bouncing off another desk object. */
const OBJECT_RESTITUTION = 0.45;
/** Below this speed the ball stops drifting and snaps to rest. */
const MIN_SPEED = 0.05;
/** Above this speed the ball is treated as a “moving pusher” for nearby cards. */
const PUSH_VELOCITY_THRESHOLD = 0.6;
/** Hard ceiling on throw velocity so a flick can not launch the ball off-screen. */
const MAX_THROW_SPEED = 22;
/** How many ms of recent pointer samples we keep for computing release velocity. */
const SAMPLE_WINDOW_MS = 90;
/** How long the ball must stay under `MIN_SPEED` before we treat it as “resting” and commit layout. */
const REST_LAYOUT_COMMIT_DELAY_S = 0.38;
const DESK_BALL_ENTRY_ID = "ball";

const dragPlane = new Plane(new Vector3(0, 1, 0), 0);
const scratchQuat = new Quaternion();

type Sample = { x: number; z: number; t: number };

function clampNumber(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export function DeskBall({
  initialPosition = [4.4, 1.6],
  radius = 0.45,
  color = "#e0524a",
  matcapUrl = DEFAULT_MATCAP_URL,
  edgePadding = 0,
  onWorldXZFrame,
  onCommitWorldXZ,
}: DeskBallProps) {
  const [ix, iz] = initialPosition;
  const { camera, size } = useThree();
  const deskPhysics = useDeskPhysics();
  const meshRef = useRef<Mesh>(null);
  const matcap = useTexture(matcapUrl);
  useLayoutEffect(() => {
    configureMatcapTexture(matcap);
  }, [matcap]);
  const margin = radius + edgePadding;
  const getWorkspaceBounds = useCallback(() => {
    if (!(camera instanceof OrthographicCamera)) {
      return DESK_BOUNDS_FALLBACK;
    }
    camera.updateMatrixWorld(true);
    return computeVisibleDeskBounds(camera, size.width, size.height, margin);
  }, [camera, size.width, size.height, margin]);

  const positionRef = useRef(new Vector3(ix, radius, iz));
  const previousPositionRef = useRef(new Vector3(ix, radius, iz));
  const velocityRef = useRef(new Vector3());
  const quatRef = useRef(new Quaternion());
  const draggingRef = useRef(false);
  const hoveredRef = useRef(false);
  const dragOffsetRef = useRef(new Vector3());
  const samplesRef = useRef<Sample[]>([]);
  const intersection = useMemo(() => new Vector3(), []);

  const entryRef = useRef<DeskPhysicsEntry>({
    id: DESK_BALL_ENTRY_ID,
    position: new Vector3(ix, radius, iz),
    velocity: new Vector3(),
    radius,
    pushRadius: radius * 1.2,
    pushStrength: 1.15,
    tiltStrength: 0,
    isDragging: false,
    isHovered: false,
    pushWhileMoving: false,
  });

  const restBelowSpeedTRef = useRef(0);
  const restCommittedRef = useRef(false);

  useLayoutEffect(() => {
    positionRef.current.set(ix, radius, iz);
    previousPositionRef.current.set(ix, radius, iz);
    velocityRef.current.set(0, 0, 0);
    restBelowSpeedTRef.current = 0;
    restCommittedRef.current = true;
    entryRef.current.position.set(ix, radius, iz);
  }, [ix, iz, radius]);

  useEffect(() => {
    return deskPhysics?.register(entryRef.current);
  }, [deskPhysics]);

  function recordSample(point: Vector3) {
    const now = performance.now();
    const samples = samplesRef.current;
    samples.push({ x: point.x, z: point.z, t: now });
    while (samples.length > 0 && now - samples[0].t > SAMPLE_WINDOW_MS) {
      samples.shift();
    }
  }

  function getDeskPoint(event: ThreeEvent<PointerEvent>) {
    return event.ray.intersectPlane(dragPlane, intersection);
  }

  function handlePointerDown(event: ThreeEvent<PointerEvent>) {
    event.stopPropagation();
    const point = getDeskPoint(event);
    if (!point) {
      return;
    }
    const target = event.target as Element | null;
    target?.setPointerCapture(event.pointerId);
    draggingRef.current = true;
    velocityRef.current.set(0, 0, 0);
    dragOffsetRef.current.set(
      point.x - positionRef.current.x,
      0,
      point.z - positionRef.current.z,
    );
    samplesRef.current = [];
    recordSample(point);
    document.body.style.cursor = "grabbing";
  }

  function handlePointerMove(event: ThreeEvent<PointerEvent>) {
    if (!draggingRef.current) {
      return;
    }
    event.stopPropagation();
    const point = getDeskPoint(event);
    if (!point) {
      return;
    }
    const bounds = getWorkspaceBounds();
    const nextX = clampNumber(
      point.x - dragOffsetRef.current.x,
      bounds.x[0],
      bounds.x[1],
    );
    const nextZ = clampNumber(
      point.z - dragOffsetRef.current.z,
      bounds.z[0],
      bounds.z[1],
    );
    positionRef.current.set(nextX, radius, nextZ);
    recordSample(point);
  }

  function handlePointerUp(event: ThreeEvent<PointerEvent>) {
    event.stopPropagation();
    const target = event.target as Element | null;
    target?.releasePointerCapture(event.pointerId);
    draggingRef.current = false;

    const samples = samplesRef.current;
    if (samples.length >= 2) {
      const first = samples[0];
      const last = samples[samples.length - 1];
      const dt = (last.t - first.t) / 1000;
      if (dt > 0.001) {
        let vx = (last.x - first.x) / dt;
        let vz = (last.z - first.z) / dt;
        const speed = Math.hypot(vx, vz);
        if (speed > MAX_THROW_SPEED) {
          const k = MAX_THROW_SPEED / speed;
          vx *= k;
          vz *= k;
        }
        velocityRef.current.set(vx, 0, vz);
      }
    }
    samplesRef.current = [];
    document.body.style.cursor = hoveredRef.current ? "grab" : "auto";
    const sp = Math.hypot(velocityRef.current.x, velocityRef.current.z);
    if (onCommitWorldXZ && sp < 0.2) {
      onCommitWorldXZ([positionRef.current.x, positionRef.current.z]);
      restCommittedRef.current = true;
      restBelowSpeedTRef.current = 0;
    } else {
      restCommittedRef.current = false;
    }
  }

  useFrame((_, delta) => {
    const bounds = getWorkspaceBounds();
    const dt = Math.min(delta, 0.05);
    const pos = positionRef.current;
    const prev = previousPositionRef.current;
    const vel = velocityRef.current;

    if (!draggingRef.current) {
      pos.x += vel.x * dt;
      pos.z += vel.z * dt;

      const decay = Math.exp(-LINEAR_DRAG * dt);
      vel.x *= decay;
      vel.z *= decay;

      const [xMin, xMax] = bounds.x;
      const [zMin, zMax] = bounds.z;
      if (pos.x < xMin) {
        pos.x = xMin;
        if (vel.x < 0) vel.x = -vel.x * EDGE_RESTITUTION;
      } else if (pos.x > xMax) {
        pos.x = xMax;
        if (vel.x > 0) vel.x = -vel.x * EDGE_RESTITUTION;
      }
      if (pos.z < zMin) {
        pos.z = zMin;
        if (vel.z < 0) vel.z = -vel.z * EDGE_RESTITUTION;
      } else if (pos.z > zMax) {
        pos.z = zMax;
        if (vel.z > 0) vel.z = -vel.z * EDGE_RESTITUTION;
      }

      if (deskPhysics) {
        for (const other of deskPhysics.entriesRef.current.values()) {
          if (other.id === entryRef.current.id) {
            continue;
          }
          const dx = pos.x - other.position.x;
          const dz = pos.z - other.position.z;
          const dist = Math.hypot(dx, dz);
          const minDist = radius + Math.max(other.radius * 0.85, 0.2);
          if (dist >= minDist || dist < 1e-4) {
            continue;
          }
          const nx = dx / dist;
          const nz = dz / dist;
          const overlap = minDist - dist;
          pos.x += nx * overlap * 0.5;
          pos.z += nz * overlap * 0.5;
          const vn = vel.x * nx + vel.z * nz;
          if (vn < 0) {
            const k = (1 + OBJECT_RESTITUTION) * vn;
            vel.x -= k * nx;
            vel.z -= k * nz;
          }
        }
      }

      if (Math.hypot(vel.x, vel.z) < MIN_SPEED) {
        vel.x = 0;
        vel.z = 0;
      }

      if (onCommitWorldXZ) {
        const speed = Math.hypot(vel.x, vel.z);
        if (speed > MIN_SPEED * 1.2) {
          restBelowSpeedTRef.current = 0;
        } else {
          restBelowSpeedTRef.current += dt;
        }
        if (
          !restCommittedRef.current &&
          restBelowSpeedTRef.current >= REST_LAYOUT_COMMIT_DELAY_S &&
          speed < MIN_SPEED * 1.5
        ) {
          onCommitWorldXZ([pos.x, pos.z]);
          restCommittedRef.current = true;
        }
      }
    }

    /** Frame-rate-independent safety clamp so a viewport resize never traps the
     *  ball off-screen. */
    pos.x = clampNumber(pos.x, bounds.x[0], bounds.x[1]);
    pos.z = clampNumber(pos.z, bounds.z[0], bounds.z[1]);
    pos.y = radius;

    /** Roll based on the actual XZ delta this frame (works while dragged or
     *  while integrating). For a sphere of radius R rolling without slip,
     *  ω = (1/R) · (Y × Δp), so the rotation axis is perpendicular to motion
     *  in the XZ plane and the angle is Δdistance / R. */
    const fdx = pos.x - prev.x;
    const fdz = pos.z - prev.z;
    const fdist = Math.hypot(fdx, fdz);
    if (fdist > 1e-5) {
      const axisX = fdz;
      const axisZ = -fdx;
      const axisLen = Math.hypot(axisX, axisZ);
      if (axisLen > 1e-6) {
        const angle = fdist / radius;
        const half = angle * 0.5;
        const sin = Math.sin(half);
        const cos = Math.cos(half);
        scratchQuat.set(
          (axisX / axisLen) * sin,
          0,
          (axisZ / axisLen) * sin,
          cos,
        );
        quatRef.current.premultiply(scratchQuat).normalize();
      }
    }
    prev.copy(pos);

    const mesh = meshRef.current;
    if (mesh) {
      mesh.position.copy(pos);
      mesh.quaternion.copy(quatRef.current);
    }

    const entry = entryRef.current;
    entry.position.copy(pos);
    entry.velocity.copy(vel);
    entry.radius = radius;
    entry.pushRadius = radius * 1.2;
    entry.isDragging = draggingRef.current;
    entry.isHovered = hoveredRef.current;
    entry.pushWhileMoving =
      !draggingRef.current && Math.hypot(vel.x, vel.z) > PUSH_VELOCITY_THRESHOLD;

    onWorldXZFrame?.([pos.x, pos.z]);
  });

  return (
    <mesh
      ref={meshRef}
      castShadow
      receiveShadow
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onPointerOver={(event) => {
        event.stopPropagation();
        hoveredRef.current = true;
        if (!draggingRef.current) {
          document.body.style.cursor = "grab";
        }
      }}
      onPointerOut={() => {
        hoveredRef.current = false;
        if (!draggingRef.current) {
          document.body.style.cursor = "auto";
        }
      }}
    >
      <icosahedronGeometry args={[radius, 4]} />
      {/*
        MatCap (material capture) bakes lighting into a sphere map; the look does
        not follow scene key/fill lights like MeshStandardMaterial. Contact
        shadows under the mesh still read as a grounding cue.
      */}
      <meshMatcapMaterial matcap={matcap} color={color} />
    </mesh>
  );
}
