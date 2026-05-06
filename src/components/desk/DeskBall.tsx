"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { Mesh, OrthographicCamera, Plane, Quaternion, SRGBColorSpace, TextureLoader, Vector3, type Texture } from "three";
import { useDeskPhysics, type DeskPhysicsEntry } from "./DeskPhysicsContext";
import {
  computeVisibleDeskBounds,
  DESK_BOUNDS_FALLBACK,
} from "./useWorkspaceDragBounds";
import { capturedPointers } from "@/lib/touch-capture-registry";
import { DESK_BALL_DEFAULT_RADIUS, DESK_BALL_ENTRY_ID } from "@/lib/desk-ball-constants";

/** Web-friendly matcap: use PNG or JPEG. Browsers + Three.js `useTexture` do not load TIFF reliably. */
const DEFAULT_MATCAP_URL = "/desk/7877EE_D87FC5_75D9C7_1C78C0.png";

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
  /** URL path (under `public/`) to a matcap image. */
  matcapUrl?: string;
  /** Extra world units to inset the bounce rect beyond `radius` from the visible frustum edge (`0` = sphere tangent to the screen-edge workspace in XZ). */
  edgePadding?: number;
  /** Fires each frame with world X, Z (for persisting the ball in layout JSON together with other items). */
  onWorldXZFrame?: (xz: [number, number]) => void;
  /** Fires when the ball should be written as "at rest" (soft throw end or rolling stop). */
  onCommitWorldXZ?: (xz: [number, number]) => void;
};

/** Friction coefficient applied to linear velocity each second (exp decay). */
const LINEAR_DRAG = 0.992;
/** Energy preserved when bouncing off a viewport edge. */
const EDGE_RESTITUTION = 0.85;
/** Energy preserved when bouncing off another desk object. */
const OBJECT_RESTITUTION = 0.45;
/** Below this speed the ball stops drifting and snaps to rest. */
const MIN_SPEED = 0.05;
/** Above this speed the ball is treated as a "moving pusher" for nearby cards. */
const PUSH_VELOCITY_THRESHOLD = 0.6;
/** Hard ceiling on throw velocity so a flick can not launch the ball off-screen. */
const MAX_THROW_SPEED = 22;
/** How many ms of recent pointer samples we keep for computing release velocity. */
const SAMPLE_WINDOW_MS = 90;
/** How long the ball must stay under `MIN_SPEED` before we treat it as "resting" and commit layout. */
const REST_LAYOUT_COMMIT_DELAY_S = 0.38;
const dragPlane = new Plane(new Vector3(0, 1, 0), 0);
const scratchQuat = new Quaternion();

type Sample = { x: number; z: number; t: number };

function clampNumber(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export function DeskBall({
  initialPosition = [4.4, 1.6],
  radius = DESK_BALL_DEFAULT_RADIUS,
  color = "#e0524a",
  matcapUrl = DEFAULT_MATCAP_URL,
  edgePadding = 0,
  onWorldXZFrame,
  onCommitWorldXZ,
}: DeskBallProps) {
  const [ix, iz] = initialPosition;
  const { camera, size } = useThree();
  const deskPhysics = useDeskPhysics();

  /** Load matcap without suspending. useTexture/useLoader from drei/R3F both throw a thenable
   *  which silently drops the component when there is no Suspense boundary to catch it.
   *  Using Three.js's native TextureLoader loads asynchronously — the mesh always renders,
   *  and the texture applies when loaded. */
  const matcapRef = useRef<Texture | null>(null);
  useEffect(() => {
    const loader = new TextureLoader();
    loader.load(
      matcapUrl,
      (tex) => {
        configureMatcapTexture(tex);
        matcapRef.current = tex;
      },
      undefined,
      () => {
        // On error, fall through with no matcap (mesh will use the color tint only)
        matcapRef.current = null;
      },
    );
  }, [matcapUrl]);

  const margin = radius + edgePadding;
  const getWorkspaceBounds = useCallback(() => {
    if (!(camera instanceof OrthographicCamera)) {
      return DESK_BOUNDS_FALLBACK;
    }
    camera.updateMatrixWorld(true);
    return computeVisibleDeskBounds(camera, size.width, size.height, margin);
  }, [camera, size.width, size.height, margin]);

  const meshRef = useRef<Mesh>(null);
  const positionRef = useRef(new Vector3(ix, radius, iz));
  const previousPositionRef = useRef(new Vector3(ix, radius, iz));
  const velocityRef = useRef(new Vector3());
  const quatRef = useRef(new Quaternion());
  const rotationAxisRef = useRef(new Vector3());
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
    capturedPointers.add(event.pointerId);
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

    /* Drive the ball to the clamped target. */
    positionRef.current.set(nextX, radius, nextZ);
    recordSample(point);
  }

  function handlePointerUp(event: ThreeEvent<PointerEvent>) {
    event.stopPropagation();
    const target = event.target as Element | null;
    target?.releasePointerCapture(event.pointerId);
    capturedPointers.delete(event.pointerId);
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

  /** Manual physics loop — no Rapier. */
  useFrame((_state, delta) => {
    if (draggingRef.current) {
      /* While dragging, just sync the entry and mesh. */
      const entry = entryRef.current;
      entry.position.copy(positionRef.current);
      entry.velocity.set(0, 0, 0);
      entry.isDragging = true;
      entry.isHovered = hoveredRef.current;
      entry.pushWhileMoving = false;
      onWorldXZFrame?.([positionRef.current.x, positionRef.current.z]);
      if (meshRef.current) {
        meshRef.current.position.copy(positionRef.current);
      }
      return;
    }

    /* Apply linear drag (frame-rate independent). */
    velocityRef.current.multiplyScalar(Math.pow(LINEAR_DRAG, delta * 60));

    /* Check if ball has stopped. */
    const speed = Math.hypot(velocityRef.current.x, velocityRef.current.z);
    if (speed < MIN_SPEED) {
      velocityRef.current.set(0, 0, 0);
    }

    /* Integrate position. */
    positionRef.current.x += velocityRef.current.x * delta;
    positionRef.current.z += velocityRef.current.z * delta;

    /* Bounce off viewport edges. */
    const bounds = getWorkspaceBounds();
    const vel = velocityRef.current;

    if (positionRef.current.x <= bounds.x[0]) {
      positionRef.current.x = bounds.x[0];
      vel.x = Math.abs(vel.x) * EDGE_RESTITUTION;
    } else if (positionRef.current.x >= bounds.x[1]) {
      positionRef.current.x = bounds.x[1];
      vel.x = -Math.abs(vel.x) * EDGE_RESTITUTION;
    }

    if (positionRef.current.z <= bounds.z[0]) {
      positionRef.current.z = bounds.z[0];
      vel.z = Math.abs(vel.z) * EDGE_RESTITUTION;
    } else if (positionRef.current.z >= bounds.z[1]) {
      positionRef.current.z = bounds.z[1];
      vel.z = -Math.abs(vel.z) * EDGE_RESTITUTION;
    }

    /* Roll the ball: incrementally compose this frame's delta rotation onto the existing quat. */
    if (speed > 0.001) {
      rotationAxisRef.current.set(-vel.z, 0, vel.x).normalize();
      scratchQuat.setFromAxisAngle(rotationAxisRef.current, (speed * delta) / radius);
      quatRef.current.premultiply(scratchQuat).normalize();
    }

    /* Update entry for DeskPhysicsContext. */
    const entry = entryRef.current;
    entry.position.copy(positionRef.current);
    entry.velocity.copy(velocityRef.current);
    entry.radius = radius;
    entry.pushRadius = radius * 1.2;
    entry.isDragging = false;
    entry.isHovered = hoveredRef.current;
    entry.pushWhileMoving = speed > PUSH_VELOCITY_THRESHOLD;

    onWorldXZFrame?.([positionRef.current.x, positionRef.current.z]);

    /* Commit to layout when resting. */
    if (speed < MIN_SPEED && restCommittedRef.current === false) {
      restBelowSpeedTRef.current += delta;
      if (restBelowSpeedTRef.current >= REST_LAYOUT_COMMIT_DELAY_S) {
        onCommitWorldXZ?.([positionRef.current.x, positionRef.current.z]);
        restCommittedRef.current = true;
      }
    } else if (speed >= MIN_SPEED) {
      restBelowSpeedTRef.current = 0;
      restCommittedRef.current = false;
    }

    /* Push updated transform to the mesh. */
    if (meshRef.current) {
      meshRef.current.position.copy(positionRef.current);
      meshRef.current.quaternion.copy(quatRef.current);
    }
  });

  return (
    <mesh
      ref={meshRef}
      position={[ix, radius, iz]}
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
        meshMatcapMaterial renders invisibly when matcap is undefined (async load).
        Use meshStandardMaterial with the matcap as a map so the ball is always
        visible, then swap to the proper matcap look once the texture loads.
      */}
      <meshStandardMaterial
        map={matcapRef.current}
        color={color}
        roughness={0.35}
        metalness={0.1}
      />
    </mesh>
  );
}
