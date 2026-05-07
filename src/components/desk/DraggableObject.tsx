"use client";

import { useRouter } from "next/navigation";
import { useFrame, useThree } from "@react-three/fiber";
import {
  type ReactNode,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
} from "react";
import { type ThreeEvent } from "@react-three/fiber";
import {
  type Object3D,
  Box3,
  Group,
  OrthographicCamera,
  Plane,
  Vector2,
  Vector3,
  Raycaster,
  DoubleSide,
} from "three";
import { IntroStaggerFromOpacityContext } from "@/context/IntroStaggerFromOpacityContext";
import { useDeskLayout } from "@/context/DeskLayoutContext";
import { useDeskControls } from "@/context/DeskControlsContext";
import { useDeskPhysics, type DeskPhysicsEntry } from "./DeskPhysicsContext";
import { DeskItemRotateRing } from "./DeskItemRotateRing";
import {
  computeVisibleDeskBounds,
  DESK_BOUNDS_FALLBACK,
} from "./useWorkspaceDragBounds";
import { navigateToHref } from "@/lib/navigate-href";
import { worldGroundPixelsPerUnit } from "@/lib/ortho-ground-screen-scale";
import { capturedPointers } from "@/lib/touch-capture-registry";
import { useDeskSceneId } from "@/context/DeskSceneContext";
import { useItemIntroTime } from "@/context/DeskItemIntroContext";
import { useStaggerGsapOptional } from "@/context/StaggerGsapContext";
import { RigidBody, BallCollider, type RapierRigidBody } from "@react-three/rapier";
import {
  getDeskIntroFocusItemId,
  getDeskIntroStaggerAfterCamera,
  getHomePropIntroSpec,
} from "@/lib/desk-intro-timelines";
import { getBundledDataForScene } from "@/lib/desk-default-layout";
import { getEasing } from "@/lib/easing";
import { setObject3DTreeOpacity } from "@/lib/three-object-opacity";
import {
  DESK_BALL_CREST_Y,
  DESK_BALL_ENTRY_ID,
  FOCUS_CLEARANCE_ABOVE_DESK_BALL,
} from "@/lib/desk-ball-constants";
import type { DeskItemLayout } from "@/lib/desk-layout";
import { MARQUEE_PICK_RADIUS_SCALE } from "@/lib/desk-marquee-pick";
import { getArrangePeer, registerArrangePeer } from "@/lib/desk-arrange-registry";

type DraggablePhysicsOptions = {
  radius?: number;
  pushRadius?: number;
  pushStrength?: number;
  tiltStrength?: number;
  tiltLimit?: number;
  lift?: number;
  focusLift?: number;
  /**
   * Used when `focusModalWidthWorld` is unset. When modal sizing is on,
   * `focusScale` is a floor: the computed viewport-aware scale is at least
   * this (after clamping).
   */
  focusScale?: number;
  focusCenterStrength?: number;
  /**
   * Approximate world width (X or Z) of the mesh on the table — e.g. card long
   * edge, polaroid max dimension. Enables modal-style focus scale from
   * `focusTargetMinAxisFill` and screen size. Omit to use fixed `focusScale` only.
   */
  focusModalWidthWorld?: number;
  /**
   * Target: `focusModalWidthWorld` in **pixels** = this fraction of
   * `min(viewportW, viewportH)` when double-tap focused. Default 0.44.
   */
  focusTargetMinAxisFill?: number;
  /** Min/max clamp for viewport-derived focus scale. Defaults 1.35 / 2.25. */
  focusModalScaleMin?: number;
  focusModalScaleMax?: number;
  /**
   * Extra Y lift (world) so bottom corners stay above the desk under Tx/Tz tilt.
   * `tiltClearanceScale * (|tiltX| + |tiltZ|)` (radians), clamped to `tiltClearanceMax`.
   */
  tiltClearanceScale?: number;
  tiltClearanceMax?: number;
  /**
   * Local +Y half-extent of the mesh (from group origin) for focus: scaled
   * objects need a higher min Y so the bottom edge clears the desk ball
   * (uniform scale pulls the bottom back toward the table).
   */
  focusApproxHalfHeight?: number;
  /**
   * When false, the rolling desk ball ignores this item for collision and does not push it.
   * Defaults to true when omitted.
   */
  participatesInBallPhysics?: boolean;
};

type DraggableObjectProps = {
  children: ReactNode;
  /** Used for localStorage JSON keys; must be unique on the desk. */
  layoutId: string;
  position: [number, number, number];
  rotation?: [number, number, number];
  /** Uniform persisted layout scale (1 = default); composed with double‑click focus scale. */
  layoutScale?: number;
  bounds?: {
    x: [number, number];
    z: [number, number];
  };
  physics?: DraggablePhysicsOptions;
  /**
   * Rapier physics mode for this object.
   * `"kinematic"` — solid obstacle driven by the drag/GSAP system; ball bounces off it.
   * `"dynamic"`   — Rapier is the source of truth; drag applies impulse, release throws it.
   * `"none"`      — default; no Rapier body (labels, loop videos, other non-collidable items).
   */
  rapierMode?: "kinematic" | "dynamic" | "none";
  /**
   * Single click / tap (without drag) navigates. Double click keeps "modal" focus.
   * See `navigateToHref` for supported schemes.
   */
  href?: string;
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
/** Match lift/ball-blend decay so focus pan XZ doesn’t lag behind vertical unfocus (shadow tail). */
const FOCUS_PAN_SMOOTH = FOCUS_LIFT_SMOOTH;
const FOCUS_SCALE_SMOOTH = 4.8;
const PUSH_SMOOTH = 10;
const TILT_SMOOTH = 12;
const TILT_CLEARANCE_SMOOTH = 14;
const DRAG_TILT_STRENGTH = 0.28;
/**
 * Desk-ball clearance blends via {@link ballFloorBlendRef} — same rate as lift keeps unfocus vertical motion continuous (no binary ε gates).
 */
const FOCUS_BALL_BLEND_SMOOTH = FOCUS_LIFT_SMOOTH;
/** World-space distance (on the desk plane) the pointer must move after
 *  `pointerdown` before we treat the gesture as a drag (avoids tiny moves
 *  from counting as drags). Zoom / “modal” focus is toggled by **double
 *  click**, not by holding. */
const PRESS_TO_DRAG_THRESHOLD = 0.18;
/** Defer `href` navigation so double click can cancel (modal focus on double). */
const NAVIGATE_HREF_MS = 400;
/** Inset from the visible frustum edge (world units), matching prior `useWorkspaceDragBounds(1.1)`. */
const DRAG_BOUNDS_MARGIN = 1.1;
const FOCUS_MODAL_MIN_AXIS_FILL = 0.95;
const FOCUS_MODAL_SCALE_MIN = 1.35;
const FOCUS_MODAL_SCALE_MAX = 25;
const DEFAULT_PHYSICS = {
  radius: 0.78,
  pushRadius: 1.35,
  pushStrength: 0.26,
  tiltStrength: 0.16,
  tiltLimit: 0.12,
  tiltClearanceScale: 0.45,
  tiltClearanceMax: 0.04,
  focusApproxHalfHeight: 0.04,
  focusLift: 0.55,
  focusScale: 1.3,
  focusCenterStrength: 0.86,
} as const;
const scratchPush = new Vector3();
const scratchFocus = new Vector3();
const scratchDeskIntroPivotCenter = new Vector3();

function measureDeskIntroScalePivot(outerShell: Group, pivot: Group): boolean {
  const content = pivot.children[0];
  if (content == null) {
    return false;
  }
  outerShell.updateWorldMatrix(true, false);
  content.updateWorldMatrix(true, true);
  const box = new Box3().setFromObject(content);
  if (box.isEmpty()) {
    return false;
  }
  box.getCenter(scratchDeskIntroPivotCenter);
  outerShell.worldToLocal(scratchDeskIntroPivotCenter);
  pivot.position.set(
    -scratchDeskIntroPivotCenter.x,
    -scratchDeskIntroPivotCenter.y,
    -scratchDeskIntroPivotCenter.z,
  );
  return true;
}

function legacyDeskIntroLerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

export function DraggableObject({
  children,
  layoutId,
  position,
  rotation = [0, 0, 0],
  layoutScale = 1,
  bounds: boundsOverride,
  physics,
  rapierMode,
  href,
}: DraggableObjectProps) {
  const [px, py, pz] = position;
  const [rx, ry, rz] = rotation;

  const router = useRouter();
  const { camera, gl, size, scene: threeScene } = useThree();
  const { recordItem, recordItems } = useDeskLayout();
  const {
    controls,
    arrangeMode,
    selectedLayoutIds,
    primarySelectionId,
    selectExclusiveLayout,
    toggleLayoutInArrangeSelection,
  } = useDeskControls();
  const itemElevationRef = useRef(controls.itemElevation);
  useLayoutEffect(() => {
    itemElevationRef.current = controls.itemElevation;
  }, [controls.itemElevation]);
  const isArrangeSelected = arrangeMode && selectedLayoutIds.includes(layoutId);
  const showArrangeRotateRing =
    arrangeMode &&
    primarySelectionId === layoutId &&
    selectedLayoutIds.includes(layoutId);
  const deskPhysics = useDeskPhysics();
  const scene = useDeskSceneId();
  const staggerAfterCam = getDeskIntroStaggerAfterCamera(scene);
  const deskIntroFocusItemId = getDeskIntroFocusItemId(scene);
  const useDeskLoadIntroStagger =
    staggerAfterCam != null &&
    deskIntroFocusItemId != null;

  const bundledSceneData = getBundledDataForScene(scene);
  const legacyBundledIntro = bundledSceneData.itemIntros[layoutId];
  const legacyIntroTimeCtx = useItemIntroTime();
  const staggerGsapOptional = useStaggerGsapOptional();

  const homePropIntroSpecForDesk = getHomePropIntroSpec(layoutId);
  const scalePivotAnchorMode =
    homePropIntroSpecForDesk.introScaleAnchor ?? "none";
  const manualScalePivot = homePropIntroSpecForDesk.scalePivot;
  const needsDeskIntroScalePivot =
    useDeskLoadIntroStagger &&
    (scalePivotAnchorMode === "boundsCenter" ||
      scalePivotAnchorMode === "manual");

  const deskIntroTweenRootRef = useRef<Group>(null);
  /** Rapier rigid body for `"kinematic"` mode. `"dynamic"` uses {@link rapierBodyRef}. */
  const rapierKinematicBodyRef = useRef<RapierRigidBody>(null);
  const deskIntroScalePivotRef = useRef<Group>(null);
  const deskIntroBoundsMeasureShellRef = useRef<Group>(null);
  const legacyDeskIntroOuterRef = useRef<Group>(null);

  const clickAwayNdc = useMemo(() => new Vector2(), []);
  const clickAwayRaycaster = useMemo(() => new Raycaster(), []);
  /**
   * Must use the *current* ortho frustum (zoom, pan) every drag move — same
   * pattern as `DeskBall.getWorkspaceBounds`. A memoized hook cannot track
   * `camera.zoom` / position without a re-render, so drags were clamped to a
   * stale rectangle during intro and after view changes.
   */
  const getDragBounds = useCallback(() => {
    if (boundsOverride) {
      return boundsOverride;
    }
    if (!(camera instanceof OrthographicCamera)) {
      return DESK_BOUNDS_FALLBACK;
    }
    camera.updateMatrixWorld(true);
    return computeVisibleDeskBounds(
      camera,
      size.width,
      size.height,
      DRAG_BOUNDS_MARGIN,
    );
  }, [camera, size.width, size.height, boundsOverride]);
  const dragPlane = useMemo(() => new Plane(new Vector3(0, 1, 0), 0), []);
  const intersection = useMemo(() => new Vector3(), []);
  const offset = useRef(new Vector3());
  const groupRef = useRef<Group>(null);
  /** Rapier rigid body for `"dynamic"` mode. `"kinematic"` uses its own ref (set below). */
  const rapierBodyRef = useRef<RapierRigidBody>(null);
  const liftRef = useRef(0);
  const basePositionRef = useRef(new Vector3(px, py, pz));
  const previousPositionRef = useRef(new Vector3(px, py, pz));
  const pushOffsetRef = useRef(new Vector3());
  const focusOffsetRef = useRef(new Vector3());
  const velocityRef = useRef(new Vector3());
  const tiltRef = useRef({ x: 0, z: 0 });
  const tiltClearanceRef = useRef(0);
  const scaleRef = useRef(1);
  /** Blends desk-ball floor into `renderedY` (0 = physics only, 1 = full `max(physicsY, minYForBall)`). */
  const ballFloorBlendRef = useRef(0);
  const layoutScaleRef = useRef(layoutScale);
  /** True from `pointerdown` until `pointerup`/cancel (drag affordance). */
  const pointerDownRef = useRef(false);
  /** Toggled by **double click**; drives lift + scale + recenter when true. */
  const zoomedByDoubleClickRef = useRef(false);
  /** Yaw drag from the selection ring; excluded from `dragging` for XZ move. */
  const rotatingRef = useRef(false);
  /** At pointer down: this item was not yet selected, arrange mode on — click without drag selects. */
  const beganUnselectedInArrangeRef = useRef(false);
  const rotateLastAngleRef = useRef(0);
  const ringWorldCenter = useMemo(() => new Vector3(), []);
  const baseRotationRef = useRef(new Vector3(rx, ry, rz));
  /** Becomes true once movement passes `PRESS_TO_DRAG_THRESHOLD`. */
  const draggingRef = useRef(false);
  /** World XZ at the start of the current press (drag threshold). */
  const pressStartRef = useRef<{ x: number; z: number } | null>(null);
  /** True while the cursor is over the object; only used to set the css
   *  cursor as a hover affordance, not to trigger any 3D animation. */
  const hoveredRef = useRef(false);
  /** Single-click `href` navigation; cleared on double click / second pointer down. */
  const navigateHrefTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  function clearNavigateHrefTimeout() {
    if (navigateHrefTimeoutRef.current != null) {
      clearTimeout(navigateHrefTimeoutRef.current);
      navigateHrefTimeoutRef.current = null;
    }
  }

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
    participatesInBallPhysics: config.participatesInBallPhysics ?? true,
  });

  useLayoutEffect(() => {
    basePositionRef.current.set(px, py, pz);
    previousPositionRef.current.copy(basePositionRef.current);
    baseRotationRef.current.set(rx, ry, rz);
    layoutScaleRef.current = layoutScale;
    const g = groupRef.current;
    if (g) {
      g.position.set(px, py, pz);
      g.rotation.set(rx, ry, rz);
    }
  }, [px, py, pz, rx, ry, rz, layoutScale]);

  /** Set initial position for the dynamic-mode Rapier body once it mounts. */
  useLayoutEffect(() => {
    if (rapierMode !== "dynamic") return;
    const body = rapierBodyRef.current;
    if (!body) return;
    body.setTranslation({ x: px, y: py, z: pz }, true);
  }, [rapierMode, px, py, pz]);

  useEffect(() => {
    entryRef.current.id = layoutId;
  }, [layoutId]);

  useEffect(() => {
    return deskPhysics?.register(entryRef.current);
  }, [deskPhysics]);

  useEffect(
    () => () => {
      clearNavigateHrefTimeout();
    },
    [],
  );

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
      const allHits = clickAwayRaycaster.intersectObject(threeScene, true);
      if (allHits.length === 0) {
        zoomedByDoubleClickRef.current = false;
        return;
      }
      let o: Object3D | null = allHits[0].object;
      let hitOurs = false;
      while (o) {
        if (o === group) {
          hitOurs = true;
          break;
        }
        o = o.parent;
      }
      if (!hitOurs) {
        zoomedByDoubleClickRef.current = false;
      }
    }
    document.addEventListener("pointerdown", onPointerDownCapture, true);
    return () => {
      document.removeEventListener("pointerdown", onPointerDownCapture, true);
    };
  }, [camera, gl, threeScene, clickAwayNdc, clickAwayRaycaster]);

  useLayoutEffect(() => {
    return registerArrangePeer(layoutId, {
      snapshotLayout: (): DeskItemLayout => ({
        position: [
          basePositionRef.current.x,
          basePositionRef.current.y,
          basePositionRef.current.z,
        ],
        rotation: [
          baseRotationRef.current.x,
          baseRotationRef.current.y,
          baseRotationRef.current.z,
        ],
        scale: layoutScaleRef.current,
      }),
      addBaseXZ(dx: number, dz: number) {
        basePositionRef.current.x += dx;
        basePositionRef.current.z += dz;
      },
      applyYawDelta(d: number) {
        baseRotationRef.current.y += d;
      },
      getMarqueeRadius() {
        return config.radius * layoutScaleRef.current;
      },
    });
  }, [layoutId, config.radius]);

  useLayoutEffect(() => {
    if (
      !useDeskLoadIntroStagger ||
      staggerGsapOptional == null ||
      staggerAfterCam == null
    ) {
      return;
    }
    const tgt = deskIntroTweenRootRef.current;
    if (tgt == null) {
      return;
    }
    // Skip opacity zeroing for the hero focus item — it starts fully visible
    // and the camera zoom itself reveals it (desk-intro-imperative sets HERO_FROM_OPACITY).
    if (staggerAfterCam.from.opacity != null && layoutId !== deskIntroFocusItemId) {
      setObject3DTreeOpacity(tgt, staggerAfterCam.from.opacity);
    }
    staggerGsapOptional.registerStaggerTarget(layoutId, tgt);
    return () => {
      staggerGsapOptional.unregisterStaggerTarget(layoutId);
    };
  }, [
    useDeskLoadIntroStagger,
    staggerGsapOptional,
    staggerAfterCam,
    layoutId,
    deskIntroFocusItemId,
  ]);

  useLayoutEffect(() => {
    if (!useDeskLoadIntroStagger || !needsDeskIntroScalePivot) {
      return;
    }
    const shell = deskIntroBoundsMeasureShellRef.current;
    const pivot = deskIntroScalePivotRef.current;
    if (shell == null || pivot == null) {
      return;
    }

    if (scalePivotAnchorMode === "manual") {
      if (manualScalePivot != null) {
        pivot.position.set(
          -manualScalePivot[0],
          -manualScalePivot[1],
          -manualScalePivot[2],
        );
      }
      return;
    }

    if (scalePivotAnchorMode !== "boundsCenter") {
      return;
    }

    let cancelled = false;
    function measure() {
      if (cancelled) {
        return;
      }
      const sh = deskIntroBoundsMeasureShellRef.current;
      const pv = deskIntroScalePivotRef.current;
      if (sh == null || pv == null || sh.parent == null) {
        return;
      }
      measureDeskIntroScalePivot(sh, pv);
    }
    measure();
    const raf1 = requestAnimationFrame(measure);
    const raf2 = requestAnimationFrame(() => measure());
    const t1 = window.setTimeout(measure, 90);
    const t2 = window.setTimeout(measure, 380);

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, [
    useDeskLoadIntroStagger,
    layoutId,
    needsDeskIntroScalePivot,
    scalePivotAnchorMode,
    manualScalePivot,
  ]);

  useFrame(() => {
    if (useDeskLoadIntroStagger || legacyBundledIntro == null) {
      return;
    }
    const g = legacyDeskIntroOuterRef.current;
    if (g == null) {
      return;
    }
    if (legacyIntroTimeCtx == null) {
      g.position.set(0, 0, 0);
      g.scale.set(1, 1, 1);
      return;
    }
    const t = legacyIntroTimeCtx.timeSec.current;
    const t0 = legacyBundledIntro.delayMs / 1000;
    const t1 = t0 + legacyBundledIntro.durationMs / 1000;
    let p = 0;
    if (t <= t0) {
      p = 0;
    } else if (t >= t1) {
      p = 1;
    } else {
      p = (t - t0) / (t1 - t0);
    }
    p = getEasing(legacyBundledIntro.easing)(p);
    const fy = legacyBundledIntro.from.y ?? 0;
    g.position.set(0, (1 - p) * fy, 0);
    const fScale = legacyBundledIntro.from.scale;
    const sc =
      fScale !== undefined ? legacyDeskIntroLerp(fScale, 1, p) : 1;
    g.scale.set(sc, sc, sc);
  });

  /** Negative priority runs before default useFrames (e.g. ContactShadows depth) so the scene matches this frame. */
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
    const isFocused =
      zoomedByDoubleClickRef.current &&
      !draggingRef.current &&
      !rotatingRef.current;
    const isMovingOrRotating = draggingRef.current || rotatingRef.current;
    const targetLift = isFocused
      ? config.focusLift
      : isMovingOrRotating
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

    let targetScale = 1;
    if (isFocused) {
      const modalW = physics?.focusModalWidthWorld;
      if (
        modalW != null &&
        modalW > 0.001 &&
        size.width > 0 &&
        size.height > 0 &&
        camera instanceof OrthographicCamera
      ) {
        const k = worldGroundPixelsPerUnit(
          camera,
          size.width,
          size.height,
          base.y,
        );
        if (k > 1e-6) {
          const fill =
            physics?.focusTargetMinAxisFill ?? FOCUS_MODAL_MIN_AXIS_FILL;
          const minEdge = Math.min(size.width, size.height);
          const targetPx = minEdge * fill;
          const adaptive = targetPx / (modalW * k);
          const sMin = physics?.focusModalScaleMin ?? FOCUS_MODAL_SCALE_MIN;
          const sMax = physics?.focusModalScaleMax ?? FOCUS_MODAL_SCALE_MAX;
          targetScale = Math.min(
            sMax,
            Math.max(sMin, Math.max(adaptive, config.focusScale)),
          );
        } else {
          targetScale = config.focusScale;
        }
      } else {
        targetScale = config.focusScale;
      }
    }
    const scaleT = 1 - Math.exp(-FOCUS_SCALE_SMOOTH * dt);
    scaleRef.current += (targetScale - scaleRef.current) * scaleT;

    const blendT = 1 - Math.exp(-FOCUS_BALL_BLEND_SMOOTH * dt);
    const targetBallBlend = isFocused ? 1 : 0;
    ballFloorBlendRef.current +=
      (targetBallBlend - ballFloorBlendRef.current) * blendT;

    scratchPush.set(0, 0, 0);
    if (!isMovingOrRotating && deskPhysics) {
      for (const other of deskPhysics.entriesRef.current.values()) {
        if (other.id === layoutId) {
          continue;
        }
        if (
          (config.participatesInBallPhysics ?? true) === false &&
          other.id === DESK_BALL_ENTRY_ID
        ) {
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
    if (draggingRef.current || rotatingRef.current) {
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

    const tScale = config.tiltClearanceScale ?? 0.45;
    const tMax = config.tiltClearanceMax ?? 0.04;
    const targetTiltClearance = Math.min(
      tMax,
      tScale *
        (Math.abs(tiltRef.current.x) + Math.abs(tiltRef.current.z)),
    );
    const clearT = 1 - Math.exp(-TILT_CLEARANCE_SMOOTH * dt);
    tiltClearanceRef.current +=
      (targetTiltClearance - tiltClearanceRef.current) * clearT;

    const layoutMul = layoutScaleRef.current;
    const totalUniformScale = scaleRef.current * layoutMul;
    const physicsY = base.y + liftRef.current + tiltClearanceRef.current + itemElevationRef.current;
    const halfH = config.focusApproxHalfHeight ?? 0.04;
    const minYForBall =
      DESK_BALL_CREST_Y +
      FOCUS_CLEARANCE_ABOVE_DESK_BALL +
      halfH * totalUniformScale;
    const clampedY = Math.max(physicsY, minYForBall);
    const b = Math.min(1, Math.max(0, ballFloorBlendRef.current));
    const renderedY = physicsY + b * (clampedY - physicsY);
    const renderedZ = base.z + push.z + focus.z;
    const renderedX = base.x + push.x + focus.x;

    /** Rapier dynamic mode: read the body position → group; skip JS push offset. */
    if (rapierMode === "dynamic") {
      const body = rapierBodyRef.current;
      if (body) {
        const t = body.translation();
        const v = body.linvel();
        basePositionRef.current.set(t.x, t.y, t.z);
        velocityRef.current.set(v.x, v.y, v.z);
        groupRef.current?.position.set(t.x, t.y, t.z);
        /** Keep tilt rotation in dynamic mode. */
        const br = baseRotationRef.current;
        groupRef.current?.rotation.set(
          br.x + tiltRef.current.x,
          br.y,
          br.z + tiltRef.current.z,
        );
        entryRef.current.position.set(t.x, t.y, t.z);
        entryRef.current.velocity.copy(velocityRef.current);
        entryRef.current.radius = config.radius * layoutMul;
        entryRef.current.pushRadius = config.pushRadius * layoutMul;
        entryRef.current.pushStrength = config.pushStrength;
        entryRef.current.tiltStrength = config.tiltStrength;
        entryRef.current.isDragging = isMovingOrRotating;
        entryRef.current.isHovered = hoveredRef.current;
        entryRef.current.participatesInBallPhysics = config.participatesInBallPhysics ?? true;
      }
      /** Skip the rest of the useFrame for non-Rapier paths. */
      return;
    }

    /** Rapier kinematic mode: drive the body to the rendered position each frame.
     *  The group position mirrors this so visual tilt/lift still applies. */
    if (rapierMode === "kinematic") {
      const body = rapierKinematicBodyRef.current;
      if (body) {
        body.setTranslation(
          { x: renderedX, y: renderedY, z: renderedZ },
          true,
        );
      }
    }

    groupRef.current?.position.set(renderedX, renderedY, renderedZ);
    const br = baseRotationRef.current;
    groupRef.current?.rotation.set(
      br.x + tiltRef.current.x,
      br.y,
      br.z + tiltRef.current.z,
    );
    groupRef.current?.scale.setScalar(totalUniformScale);

    const entry = entryRef.current;
    entry.position.set(renderedX, base.y, renderedZ);
    entry.velocity.copy(velocityRef.current);
    entry.radius = config.radius * layoutMul;
    entry.pushRadius = config.pushRadius * layoutMul;
    entry.pushStrength = config.pushStrength;
    entry.tiltStrength = config.tiltStrength;
    entry.isDragging = isMovingOrRotating;
    entry.isHovered = hoveredRef.current;
    entry.participatesInBallPhysics = config.participatesInBallPhysics ?? true;
  }, -1);

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

  function getYawAngleOnDeskAtPoint(p: Vector3) {
    const g = groupRef.current;
    if (g) {
      g.getWorldPosition(ringWorldCenter);
    } else {
      const b = basePositionRef.current;
      ringWorldCenter.set(b.x, b.y, b.z);
    }
    return Math.atan2(p.z - ringWorldCenter.z, p.x - ringWorldCenter.x);
  }

  function recordLayoutFromRefs() {
    const b = basePositionRef.current;
    const r = baseRotationRef.current;
    const selfLayout: DeskItemLayout = {
      position: [b.x, b.y, b.z],
      rotation: [r.x, r.y, r.z],
      scale: layoutScaleRef.current,
    };
    const groupMove =
      arrangeMode &&
      selectedLayoutIds.includes(layoutId) &&
      selectedLayoutIds.length > 1;

    if (!groupMove) {
      recordItem(layoutId, selfLayout);
      return;
    }
    const patch: Record<string, DeskItemLayout> = {};
    const ids = [...selectedLayoutIds];
    for (let i = 0; i < ids.length; i++) {
      const id = ids[i];
      if (id === layoutId) {
        patch[id] = selfLayout;
        continue;
      }
      const peer = getArrangePeer(id);
      if (peer != null) {
        patch[id] = peer.snapshotLayout();
      }
    }
    recordItems(patch);
  }

  function handleRingPointerDown(event: ThreeEvent<PointerEvent>) {
    event.stopPropagation();
    clearNavigateHrefTimeout();
    const p = getDeskPoint(event);
    if (!p) {
      return;
    }
    rotatingRef.current = true;
    const angle = getYawAngleOnDeskAtPoint(p);
    rotateLastAngleRef.current = angle;
    const el = event.target as Element | null;
    el?.setPointerCapture(event.pointerId);
    capturedPointers.add(event.pointerId);
    document.body.style.cursor = "grabbing";
  }

  function handleRingPointerMove(event: ThreeEvent<PointerEvent>) {
    event.stopPropagation();
    if (!rotatingRef.current) {
      return;
    }
    const p = getDeskPoint(event);
    if (!p) {
      return;
    }
    const next = getYawAngleOnDeskAtPoint(p);
    let d = next - rotateLastAngleRef.current;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    baseRotationRef.current.y += d;
    if (
      arrangeMode &&
      primarySelectionId === layoutId &&
      selectedLayoutIds.length > 1
    ) {
      for (let i = 0; i < selectedLayoutIds.length; i++) {
        const id = selectedLayoutIds[i];
        if (id === layoutId) {
          continue;
        }
        getArrangePeer(id)?.applyYawDelta(d);
      }
    }
    rotateLastAngleRef.current = next;
  }

  function handleRingPointerUp(event: ThreeEvent<PointerEvent>) {
    event.stopPropagation();
    if (!rotatingRef.current) {
      return;
    }
    const el = event.target as Element | null;
    el?.releasePointerCapture(event.pointerId);
    capturedPointers.delete(event.pointerId);
    rotatingRef.current = false;
    document.body.style.cursor = hoveredRef.current ? "grab" : "auto";
    recordLayoutFromRefs();
  }

  function handlePointerDown(event: ThreeEvent<PointerEvent>) {
    clearNavigateHrefTimeout();

    const ne = event.nativeEvent as PointerEvent;
    if (arrangeMode && ne.shiftKey) {
      toggleLayoutInArrangeSelection(layoutId);
      return;
    }

    event.stopPropagation();
    const point = getDeskPoint(event);

    if (!point) {
      return;
    }

    beganUnselectedInArrangeRef.current =
      Boolean(arrangeMode) && !selectedLayoutIds.includes(layoutId);

    const currentPosition = getCurrentPosition();
    basePositionRef.current.set(currentPosition[0], py, pz);
    pushOffsetRef.current.set(0, 0, 0);
    if (!arrangeMode || isArrangeSelected) {
      offset.current.set(
        point.x - currentPosition[0],
        0,
        point.z - currentPosition[2],
      );
    } else {
      offset.current.set(0, 0, 0);
    }
    pressStartRef.current = { x: point.x, z: point.z };
    pointerDownRef.current = true;
    draggingRef.current = false;
    const target = event.target as Element | null;
    target?.setPointerCapture(event.pointerId);
    capturedPointers.add(event.pointerId);
    document.body.style.cursor = "grabbing";

    /** Dynamic mode: switch to kinematic so the body follows the pointer exactly. */
    if (rapierMode === "dynamic") {
      const body = rapierBodyRef.current;
      if (body) {
        // 2 = KinematicPositionBased (rapier3d-compat enum)
        body.setBodyType(2 /* KinematicPositionBased */, true);
        /** Apply drag offset to the base position so the body tracks the pointer. */
        basePositionRef.current.x += offset.current.x;
        basePositionRef.current.z += offset.current.z;
      }
    }
  }

  function handlePointerMove(event: ThreeEvent<PointerEvent>) {
    if (!pointerDownRef.current || rotatingRef.current) {
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
      if (arrangeMode && !selectedLayoutIds.includes(layoutId)) {
        selectExclusiveLayout(layoutId);
        const pos = getCurrentPosition();
        offset.current.set(
          point.x - pos[0],
          0,
          point.z - pos[2],
        );
      }
      draggingRef.current = true;
    }

    const b = getDragBounds();
    const prevX = basePositionRef.current.x;
    const prevZ = basePositionRef.current.z;
    setBasePosition([
      clamp(point.x - offset.current.x, b.x),
      py,
      clamp(point.z - offset.current.z, b.z),
    ]);
    const rdx = basePositionRef.current.x - prevX;
    const rdz = basePositionRef.current.z - prevZ;
    if (
      draggingRef.current &&
      arrangeMode &&
      selectedLayoutIds.length > 1 &&
      selectedLayoutIds.includes(layoutId) &&
      rdx * rdx + rdz * rdz > 1e-14
    ) {
      for (let i = 0; i < selectedLayoutIds.length; i++) {
        const id = selectedLayoutIds[i];
        if (id === layoutId) {
          continue;
        }
        const peer = getArrangePeer(id);
        peer?.addBaseXZ(rdx, rdz);
      }
    }
  }

  function handlePointerUp(event: ThreeEvent<PointerEvent>) {
    event.stopPropagation();
    const wasDrag = draggingRef.current;
    const target = event.target as Element | null;
    target?.releasePointerCapture(event.pointerId);
    capturedPointers.delete(event.pointerId);
    pointerDownRef.current = false;
    draggingRef.current = false;
    pressStartRef.current = null;
    document.body.style.cursor = hoveredRef.current ? "grab" : "auto";

    /** Dynamic mode: switch back to dynamic and apply throw velocity. */
    if (rapierMode === "dynamic" && wasDrag) {
      const body = rapierBodyRef.current;
      if (body) {
        // 0 = Dynamic (rapier3d-compat enum)
        body.setBodyType(0 /* Dynamic */, true);
        body.setLinvel(
          { x: velocityRef.current.x, y: 0, z: velocityRef.current.z },
          true,
        );
      }
    }

    const beganUn = beganUnselectedInArrangeRef.current;
    beganUnselectedInArrangeRef.current = false;
    if (wasDrag) {
      recordLayoutFromRefs();
    } else if (beganUn && arrangeMode) {
      selectExclusiveLayout(layoutId);
    } else if (href && !arrangeMode) {
      clearNavigateHrefTimeout();
      navigateHrefTimeoutRef.current = setTimeout(() => {
        navigateHrefTimeoutRef.current = null;
        navigateToHref(router, href);
      }, NAVIGATE_HREF_MS);
    }
  }

  function handleDoubleClick(event: ThreeEvent<MouseEvent>) {
    event.stopPropagation();
    clearNavigateHrefTimeout();
    zoomedByDoubleClickRef.current = !zoomedByDoubleClickRef.current;
  }

  const staggerSceneOpacity =
    useDeskLoadIntroStagger && staggerAfterCam?.from.opacity != null
      ? (layoutId === deskIntroFocusItemId ? 1 : staggerAfterCam.from.opacity)
      : null;

  function wrapDeskIntroSceneOpacity(inner: ReactNode) {
    if (staggerSceneOpacity == null) {
      return inner;
    }
    return (
      <IntroStaggerFromOpacityContext.Provider value={staggerSceneOpacity}>
        {inner}
      </IntroStaggerFromOpacityContext.Provider>
    );
  }

  useFrame(() => {
    if (
      !useDeskLoadIntroStagger ||
      staggerSceneOpacity == null ||
      staggerGsapOptional == null
    ) {
      return;
    }
    if (staggerGsapOptional.isStaggerItemAnimated(layoutId)) {
      return;
    }
    const root = deskIntroTweenRootRef.current;
    if (root != null) {
      setObject3DTreeOpacity(root, staggerSceneOpacity);
    }
  });

  const marqueeFootprintRadius =
    config.radius * layoutScale * MARQUEE_PICK_RADIUS_SCALE;
  const marqueeRingInnerMul = primarySelectionId === layoutId ? 0.935 : isArrangeSelected ? 0.93 : 0.925;

  const deskMarqueeAndChildren = (
    <>
      {arrangeMode ? (
        <mesh
          rotation={[-Math.PI / 2, 0, 0]}
          position={[0, 0.0015, 0]}
          renderOrder={4}
        >
          <ringGeometry
            args={[
              marqueeFootprintRadius * marqueeRingInnerMul,
              marqueeFootprintRadius,
              56,
            ]}
          />
          <meshBasicMaterial
            color={
              isArrangeSelected
                ? primarySelectionId === layoutId
                  ? "#2563eb"
                  : "#60a5fa"
                : "#94a3b8"
            }
            depthWrite={false}
            opacity={isArrangeSelected ? 0.58 : 0.36}
            polygonOffset
            polygonOffsetFactor={-1}
            polygonOffsetUnits={-1}
            side={DoubleSide}
            transparent
          />
        </mesh>
      ) : null}
      {children}
      {arrangeMode && showArrangeRotateRing ? (
        <DeskItemRotateRing
          outerRadius={config.radius * layoutScale}
          onPointerDown={handleRingPointerDown}
          onPointerMove={handleRingPointerMove}
          onPointerUp={handleRingPointerUp}
          onPointerCancel={handleRingPointerUp}
        />
      ) : null}
    </>
  );

  const physicsDragSurface = (
    <group
      ref={groupRef}
      userData={{ deskLayoutItem: layoutId }}
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
      {useDeskLoadIntroStagger ? (
        <group ref={deskIntroTweenRootRef}>{deskMarqueeAndChildren}</group>
      ) : (
        deskMarqueeAndChildren
      )}
    </group>
  );

  let renderedDeskItem: ReactNode = physicsDragSurface;

  /** Wrap with Rapier body for `"kinematic"` / `"dynamic"` modes. */
  if (rapierMode === "kinematic") {
    renderedDeskItem = (
      <RigidBody
        ref={rapierKinematicBodyRef}
        type="kinematicPosition"
        position={position}
        colliders={false}
      >
        <BallCollider args={[config.radius * layoutScaleRef.current]} />
        {physicsDragSurface}
      </RigidBody>
    );
  } else if (rapierMode === "dynamic") {
    renderedDeskItem = (
      <RigidBody
        ref={rapierBodyRef}
        type="dynamic"
        position={position}
        colliders={false}
        restitution={0.3}
        friction={0.6}
        linearDamping={2}
        angularDamping={4}
      >
        <BallCollider args={[config.radius * layoutScaleRef.current]} />
        {physicsDragSurface}
      </RigidBody>
    );
  }

  if (useDeskLoadIntroStagger && needsDeskIntroScalePivot) {
    renderedDeskItem = (
      <group ref={deskIntroBoundsMeasureShellRef}>
        <group ref={deskIntroScalePivotRef}>
          {wrapDeskIntroSceneOpacity(renderedDeskItem)}
        </group>
      </group>
    );
  } else if (useDeskLoadIntroStagger && staggerSceneOpacity != null) {
    renderedDeskItem = wrapDeskIntroSceneOpacity(renderedDeskItem);
  }

  if (!useDeskLoadIntroStagger && legacyBundledIntro != null) {
    renderedDeskItem = (
      <group ref={legacyDeskIntroOuterRef}>{renderedDeskItem}</group>
    );
  }

  return renderedDeskItem;
}
