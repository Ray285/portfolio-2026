"use client";

import { useFrame, useThree } from "@react-three/fiber";
import {
  type ReactNode,
  useEffect,
  useMemo,
  useRef,
} from "react";
import { type ThreeEvent } from "@react-three/fiber";
import { Group, Plane, Vector2, Vector3, Raycaster } from "three";
import { useDeskLayout } from "@/context/DeskLayoutContext";
import { useDeskPhysics, type DeskPhysicsEntry } from "./DeskPhysicsContext";
import { useWorkspaceDragBounds } from "./useWorkspaceDragBounds";

type DraggablePhysicsOptions = {
  radius?: number;
  pushRadius?: number;
  pushStrength?: number;
  tiltStrength?: number;
  tiltLimit?: number;
  lift?: number;
  focusLift?: number;
  focusScale?: number;
  focusCenterStrength?: number;
};

type DraggableObjectProps = {
  children: ReactNode;
  /** Used for localStorage JSON keys; must be unique on the desk. */
  layoutId: string;
  position: [number, number, number];
  rotation?: [number, number, number];
  bounds?: {
    x: [number, number];
    z: [number, number];
  };
  physics?: DraggablePhysicsOptions;
};

function clamp(value: number, [min, max]: [number, number]) {
  const lo = Math.min(min, max);
  const hi = Math.max(min, max);
  return Math.min(Math.max(value, lo), hi);
}

const INTERACTIVE_LIFT = 0.06;
/** Per-second rate for exponential smoothing. Lower = slower, creamier
 *  in/out (focus press vs release) without snappy snap-back. */
const FOCUS_LIFT_SMOOTH = 5.2;
const FOCUS_PAN_SMOOTH = 4.2;
const FOCUS_SCALE_SMOOTH = 4.8;
const PUSH_SMOOTH = 10;
const TILT_SMOOTH = 12;
const DRAG_TILT_STRENGTH = 0.28;
/** World-space distance (on the desk plane) the pointer must move after
 *  `pointerdown` before we treat the gesture as a drag (avoids tiny moves
 *  from counting as drags). Zoom / “modal” focus is toggled by **double
 *  click**, not by holding. */
const PRESS_TO_DRAG_THRESHOLD = 0.18;
const DEFAULT_PHYSICS = {
  radius: 0.78,
  pushRadius: 1.35,
  pushStrength: 0.26,
  tiltStrength: 0.16,
  tiltLimit: 0.12,
  focusLift: 0.55,
  focusScale: 1.3,
  focusCenterStrength: 0.86,
} as const;
const scratchPush = new Vector3();
const scratchFocus = new Vector3();

export function DraggableObject({
  children,
  layoutId,
  position,
  rotation = [0, 0, 0],
  bounds: boundsOverride,
  physics,
}: DraggableObjectProps) {
  const [px, py, pz] = position;
  const [rx, ry, rz] = rotation;

  const { camera, gl } = useThree();
  const { recordItem } = useDeskLayout();
  const deskPhysics = useDeskPhysics();
  const fromCamera = useWorkspaceDragBounds(1.1);
  const clickAwayNdc = useMemo(() => new Vector2(), []);
  const clickAwayRaycaster = useMemo(() => new Raycaster(), []);
  const bounds = boundsOverride ?? fromCamera;
  const dragPlane = useMemo(() => new Plane(new Vector3(0, 1, 0), 0), []);
  const intersection = useMemo(() => new Vector3(), []);
  const offset = useRef(new Vector3());
  const groupRef = useRef<Group>(null);
  const liftRef = useRef(0);
  const basePositionRef = useRef(new Vector3(px, py, pz));
  const previousPositionRef = useRef(new Vector3(px, py, pz));
  const pushOffsetRef = useRef(new Vector3());
  const focusOffsetRef = useRef(new Vector3());
  const velocityRef = useRef(new Vector3());
  const tiltRef = useRef({ x: 0, z: 0 });
  const scaleRef = useRef(1);
  /** True from `pointerdown` until `pointerup`/cancel (drag affordance). */
  const pointerDownRef = useRef(false);
  /** Toggled by **double click**; drives lift + scale + recenter when true. */
  const zoomedByDoubleClickRef = useRef(false);
  /** Becomes true once movement passes `PRESS_TO_DRAG_THRESHOLD`. */
  const draggingRef = useRef(false);
  /** World XZ at the start of the current press (drag threshold). */
  const pressStartRef = useRef<{ x: number; z: number } | null>(null);
  /** True while the cursor is over the object; only used to set the css
   *  cursor as a hover affordance, not to trigger any 3D animation. */
  const hoveredRef = useRef(false);

  const config = {
    ...DEFAULT_PHYSICS,
    ...physics,
  };
  const entryRef = useRef<DeskPhysicsEntry>({
    id: layoutId,
    position: new Vector3(px, py, pz),
    velocity: new Vector3(),
    radius: config.radius,
    pushRadius: config.pushRadius,
    pushStrength: config.pushStrength,
    tiltStrength: config.tiltStrength,
    isDragging: false,
    isHovered: false,
  });

  useEffect(() => {
    basePositionRef.current.set(px, py, pz);
    previousPositionRef.current.copy(basePositionRef.current);
  }, [px, py, pz]);

  useEffect(() => {
    entryRef.current.id = layoutId;
  }, [layoutId]);

  useEffect(() => {
    return deskPhysics?.register(entryRef.current);
  }, [deskPhysics]);

  /** While zoomed, any pointer down **outside** this object dismisses the zoom. */
  useEffect(() => {
    function onPointerDownCapture(e: PointerEvent) {
      if (!zoomedByDoubleClickRef.current) {
        return;
      }
      const canvas = gl.domElement;
      if (!canvas.contains(e.target as Node)) {
        zoomedByDoubleClickRef.current = false;
        return;
      }
      const group = groupRef.current;
      if (!group) {
        return;
      }
      const r = canvas.getBoundingClientRect();
      const w = r.width;
      const h = r.height;
      if (w <= 0 || h <= 0) {
        return;
      }
      const ndcX = ((e.clientX - r.left) / w) * 2 - 1;
      const ndcY = -((e.clientY - r.top) / h) * 2 + 1;
      clickAwayNdc.set(ndcX, ndcY);
      clickAwayRaycaster.setFromCamera(clickAwayNdc, camera);
      const hits = clickAwayRaycaster.intersectObject(group, true);
      if (hits.length === 0) {
        zoomedByDoubleClickRef.current = false;
      }
    }
    document.addEventListener("pointerdown", onPointerDownCapture, true);
    return () => {
      document.removeEventListener("pointerdown", onPointerDownCapture, true);
    };
  }, [camera, gl, clickAwayNdc, clickAwayRaycaster]);

  useFrame(({ camera }, delta) => {
    const dt = Math.min(delta, 0.1);
    const base = basePositionRef.current;
    const prev = previousPositionRef.current;
    velocityRef.current.set(
      (base.x - prev.x) / Math.max(dt, 0.001),
      0,
      (base.z - prev.z) / Math.max(dt, 0.001),
    );
    prev.copy(base);

    /** Zoom/focus: double click toggles `zoomedByDoubleClickRef`; it eases out
     *  while dragging so the object can be moved, then can return if still zoomed. */
    const isFocused = zoomedByDoubleClickRef.current && !draggingRef.current;
    const targetLift = isFocused
      ? config.focusLift
      : draggingRef.current
        ? (physics?.lift ?? INTERACTIVE_LIFT)
        : 0;
    const liftT = 1 - Math.exp(-FOCUS_LIFT_SMOOTH * dt);
    liftRef.current += (targetLift - liftRef.current) * liftT;

    if (isFocused) {
      scratchFocus.set(
        (camera.position.x - base.x) * config.focusCenterStrength,
        0,
        (camera.position.z - base.z) * config.focusCenterStrength,
      );
    } else {
      scratchFocus.set(0, 0, 0);
    }
    const focusT = 1 - Math.exp(-FOCUS_PAN_SMOOTH * dt);
    focusOffsetRef.current.lerp(scratchFocus, focusT);

    const targetScale = isFocused ? config.focusScale : 1;
    const scaleT = 1 - Math.exp(-FOCUS_SCALE_SMOOTH * dt);
    scaleRef.current += (targetScale - scaleRef.current) * scaleT;

    scratchPush.set(0, 0, 0);
    if (!draggingRef.current && deskPhysics) {
      for (const other of deskPhysics.entriesRef.current.values()) {
        if (other.id === layoutId) {
          continue;
        }
        /** Push-receivers (cards, photos, nameplate, pencil) react to two
         *  kinds of push-sources: anything actively dragged by the user, and
         *  free-flying entries that opt in via `pushWhileMoving` (e.g. the
         *  rolling DeskBall). Stationary neighbours never push each other. */
        if (!other.isDragging && !other.pushWhileMoving) {
          continue;
        }

        const dx = base.x - other.position.x;
        const dz = base.z - other.position.z;
        const dist = Math.hypot(dx, dz);
        const influence = config.radius + other.pushRadius;
        if (dist >= influence) {
          continue;
        }

        const nx = dist > 0.001 ? dx / dist : 1;
        const nz = dist > 0.001 ? dz / dist : 0;
        const proximity = 1 - dist / influence;
        const strength =
          proximity * proximity * config.pushStrength * other.pushStrength;
        scratchPush.x += nx * strength;
        scratchPush.z += nz * strength;
      }
    }

    const pushT = 1 - Math.exp(-PUSH_SMOOTH * dt);
    pushOffsetRef.current.lerp(scratchPush, pushT);

    const push = pushOffsetRef.current;
    const focus = focusOffsetRef.current;
    const tiltLimit = config.tiltLimit;
    let targetTiltX = clamp(-push.z * config.tiltStrength, [-tiltLimit, tiltLimit]);
    let targetTiltZ = clamp(push.x * config.tiltStrength, [-tiltLimit, tiltLimit]);
    if (draggingRef.current) {
      targetTiltX += clamp(velocityRef.current.z * DRAG_TILT_STRENGTH, [
        -tiltLimit,
        tiltLimit,
      ]);
      targetTiltZ += clamp(-velocityRef.current.x * DRAG_TILT_STRENGTH, [
        -tiltLimit,
        tiltLimit,
      ]);
    }
    const tiltT = 1 - Math.exp(-TILT_SMOOTH * dt);
    tiltRef.current.x += (targetTiltX - tiltRef.current.x) * tiltT;
    tiltRef.current.z += (targetTiltZ - tiltRef.current.z) * tiltT;

    const renderedX = base.x + push.x + focus.x;
    const renderedY = base.y + liftRef.current;
    const renderedZ = base.z + push.z + focus.z;
    groupRef.current?.position.set(renderedX, renderedY, renderedZ);
    groupRef.current?.rotation.set(
      rx + tiltRef.current.x,
      ry,
      rz + tiltRef.current.z,
    );
    groupRef.current?.scale.setScalar(scaleRef.current);

    const entry = entryRef.current;
    entry.position.set(renderedX, base.y, renderedZ);
    entry.velocity.copy(velocityRef.current);
    entry.radius = config.radius;
    entry.pushRadius = config.pushRadius;
    entry.pushStrength = config.pushStrength;
    entry.tiltStrength = config.tiltStrength;
    entry.isDragging = draggingRef.current;
    entry.isHovered = hoveredRef.current;
  });

  function setBasePosition(next: [number, number, number]) {
    basePositionRef.current.set(next[0], next[1], next[2]);
  }

  function getCurrentPosition() {
    if (groupRef.current) {
      const p = groupRef.current.position;
      return [p.x, basePositionRef.current.y, p.z] as [
        number,
        number,
        number,
      ];
    }
    const p = basePositionRef.current;
    return [p.x, p.y, p.z] as [number, number, number];
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

    const currentPosition = getCurrentPosition();
    basePositionRef.current.set(currentPosition[0], py, pz);
    pushOffsetRef.current.set(0, 0, 0);
    offset.current.set(
      point.x - currentPosition[0],
      0,
      point.z - currentPosition[2],
    );
    pressStartRef.current = { x: point.x, z: point.z };
    pointerDownRef.current = true;
    draggingRef.current = false;
    const target = event.target as Element | null;
    target?.setPointerCapture(event.pointerId);
    document.body.style.cursor = "grabbing";
  }

  function handlePointerMove(event: ThreeEvent<PointerEvent>) {
    if (!pointerDownRef.current) {
      return;
    }

    event.stopPropagation();
    const point = getDeskPoint(event);

    if (!point) {
      return;
    }

    if (!draggingRef.current) {
      const start = pressStartRef.current;
      if (!start) {
        return;
      }
      const dx = point.x - start.x;
      const dz = point.z - start.z;
      if (Math.hypot(dx, dz) < PRESS_TO_DRAG_THRESHOLD) {
        return;
      }
      draggingRef.current = true;
    }

    setBasePosition([
      clamp(point.x - offset.current.x, bounds.x),
      py,
      clamp(point.z - offset.current.z, bounds.z),
    ]);
  }

  function handlePointerUp(event: ThreeEvent<PointerEvent>) {
    event.stopPropagation();
    const wasDrag = draggingRef.current;
    const target = event.target as Element | null;
    target?.releasePointerCapture(event.pointerId);
    pointerDownRef.current = false;
    draggingRef.current = false;
    pressStartRef.current = null;
    document.body.style.cursor = hoveredRef.current ? "grab" : "auto";
    if (wasDrag) {
      const b = basePositionRef.current;
      recordItem(layoutId, {
        position: [b.x, b.y, b.z],
        rotation: [rx, ry, rz],
      });
    }
  }

  function handleDoubleClick(event: ThreeEvent<MouseEvent>) {
    event.stopPropagation();
    zoomedByDoubleClickRef.current = !zoomedByDoubleClickRef.current;
  }

  return (
    <group
      ref={groupRef}
      position={[px, py, pz]}
      rotation={[rx, ry, rz]}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onDoubleClick={handleDoubleClick}
      onPointerOver={(event) => {
        event.stopPropagation();
        hoveredRef.current = true;
        if (!pointerDownRef.current) {
          document.body.style.cursor = "grab";
        }
      }}
      onPointerOut={() => {
        hoveredRef.current = false;
        if (!pointerDownRef.current) {
          document.body.style.cursor = "auto";
        }
      }}
    >
      {children}
    </group>
  );
}
