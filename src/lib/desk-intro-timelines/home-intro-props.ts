/**
 * Home desk — **props** segment of the shared GSAP master timeline (after camera).
 *
 * ## Orchestration
 * **`home-desk-choreography.ts`** — stagger order, camera zoom, slug→layoutId.
 * **`home-desk-intro-motion-builders.ts`** — **`deskIntroMotion_*`** per slug (`HOME_DESK_INTRO_MOTION_BY_DESK_SLUG`).
 *
 * ## Runtime timeline shape (home)
 * 1. **Camera** — `appendHomeDeskIntroTimeline` in `home.ts`.
 * 2. Label **`afterCamera`** — end of camera segment (GSDevTools scrub).
 * 3. **Props** — readiness-gated **`appendDeskPropsIntroImperative`** in `desk-intro-imperative.ts`
 *    (single timeline at **`afterCamera`**). Legacy **`appendHomeDeskPropsIntroBatch`** still uses overrides/specs.
 *
 * Edit **`HOME_PROP_INTRO_DEFAULTS`** below for wave-wide defaults.
 */

import gsap from "gsap";
import type { Object3D } from "three";
import { setObject3DTreeOpacity } from "@/lib/three-object-opacity";
import type { DeskIntroMasterTimeline } from "@/lib/desk-intro-timelines/types";
import {
  getOrderedPendingPropIds,
  HOME_DESK_PROP_INTRO_ORDER,
} from "@/lib/desk-intro-timelines/home-desk-choreography";
import {
  isPolaroid3IntroDebug,
  logPolaroid3Intro,
  snapshotObject3D,
} from "@/lib/polaroid-3-intro-debug";
import type {
  HomePropIntroOverride,
  HomePropIntroPositionPartial,
  HomePropIntroSegment,
  HomePropIntroSequencePlan,
  HomePropIntroSpec,
} from "@/lib/desk-intro-timelines/home-intro-prop-types";

export type {
  HomePropIntroSpec,
  HomePropIntroPositionPartial,
  HomePropIntroSegment,
  HomePropIntroSequencePlan,
  HomePropIntroOverride,
} from "@/lib/desk-intro-timelines/home-intro-prop-types";

/** Global defaults — tweak once for the whole desk props wave */
export const HOME_PROP_INTRO_DEFAULTS: HomePropIntroSpec = {
  staggerGapSec: 0.2,
  durationSec: 0.6,
  ease: "power2.out",
  fromX: 0,
  /** Keep 0 so legacy intro tweens scale + fade without drifting the shell on X/Y (straight-on). */
  fromY: 0,
  fromZ: 0,
  fromScale: 0.9,
  fromOpacity: 0,
};

function isHomePropIntroSequencePlan(
  o: HomePropIntroOverride,
): o is HomePropIntroSequencePlan {
  return (
    typeof o === "object" &&
    o !== null &&
    "sequence" in o &&
    Array.isArray((o as HomePropIntroSequencePlan).sequence)
  );
}

/** Prop-intro overrides — empty on home imperative path; legacy batch still reads this map. */
export const HOME_PROP_INTRO_OVERRIDES: Partial<
  Record<string, HomePropIntroOverride>
> = {};

export function getHomePropIntroSpec(layoutId: string): HomePropIntroSpec {
  const o = HOME_PROP_INTRO_OVERRIDES[layoutId];
  if (!o) {
    return { ...HOME_PROP_INTRO_DEFAULTS };
  }
  if (isHomePropIntroSequencePlan(o)) {
    return { ...HOME_PROP_INTRO_DEFAULTS, ...o.initial };
  }
  return { ...HOME_PROP_INTRO_DEFAULTS, ...o };
}

function applyHomePropIntroInitialPose(
  o: Object3D,
  spec: HomePropIntroSpec,
  layoutId?: string,
): void {
  o.position.set(spec.fromX ?? 0, spec.fromY, spec.fromZ ?? 0);
  o.scale.setScalar(spec.fromScale);
  setObject3DTreeOpacity(o, spec.fromOpacity);
  if (layoutId && isPolaroid3IntroDebug(layoutId)) {
    logPolaroid3Intro("gsap.applyInitialPose", {
      spec: {
        fromX: spec.fromX,
        fromY: spec.fromY,
        fromZ: spec.fromZ,
        fromScale: spec.fromScale,
        fromOpacity: spec.fromOpacity,
        introScaleAnchor: spec.introScaleAnchor,
      },
      shell: snapshotObject3D("tweenRoot", o),
    });
  }
}

/** End position for a segment given current tuple and optional partial overrides. */
function mergePositionTuple(
  cx: number,
  cy: number,
  cz: number,
  pt: HomePropIntroPositionPartial,
): { x: number; y: number; z: number } {
  return {
    x: pt.x !== undefined ? pt.x : cx,
    y: pt.y !== undefined ? pt.y : cy,
    z: pt.z !== undefined ? pt.z : cz,
  };
}

/** Mutable intro pose for building explicit from→to tweens (scrub / reverse friendly). */
type HomePropPoseTrack = {
  px: number;
  py: number;
  pz: number;
  scale: number;
};

function segmentHasTargets(seg: HomePropIntroSegment): boolean {
  const pt = seg.position;
  const hasPos =
    pt !== undefined &&
    (pt.x !== undefined || pt.y !== undefined || pt.z !== undefined);
  return (
    seg.opacity !== undefined || hasPos || seg.scale !== undefined
  );
}

/**
 * Adds one parallel step to `parent` using **`fromTo`** with explicit starts/ends derived from
 * `poseTrack` so GSDevTools scrub / reverse updates position and scale correctly
 * (lazy `timeline.add(() => …)` breaks scrubbing).
 */
function appendHomePropIntroSegmentParallel(
  parent: gsap.core.Timeline,
  o: Object3D,
  seg: HomePropIntroSegment,
  opacityProxy: { v: number },
  /** Opacity value at the start of this segment (scrub-safe; `opacityProxy.v` is not updated until tweens run). */
  opacityChain: { end: number },
  poseTrack: HomePropPoseTrack,
  layoutId?: string,
): void {
  const dur = seg.durationSec;
  const ease = seg.ease;
  const pt = seg.position;
  const hasPos =
    pt !== undefined &&
    (pt.x !== undefined || pt.y !== undefined || pt.z !== undefined);
  const hasOp = seg.opacity !== undefined;
  const hasScale = seg.scale !== undefined;

  if (!segmentHasTargets(seg)) {
    if (layoutId && isPolaroid3IntroDebug(layoutId)) {
      logPolaroid3Intro("gsap.segment.hold", {
        durationSec: dur,
        ease,
        poseTrack: { ...poseTrack },
      });
    }
    parent.to({}, { duration: dur, ease });
    return;
  }

  const sx = poseTrack.px;
  const sy = poseTrack.py;
  const sz = poseTrack.pz;
  const sScale = poseTrack.scale;

  if (layoutId && isPolaroid3IntroDebug(layoutId)) {
    logPolaroid3Intro("gsap.segment.start", {
      seg: {
        durationSec: dur,
        ease,
        opacity: seg.opacity,
        position: seg.position,
        scale: seg.scale,
      },
      poseTrackFrom: { px: sx, py: sy, pz: sz, scale: sScale },
      opacityChainEnd: opacityChain.end,
    });
  }

  const inner = gsap.timeline();
  let placed = false;
  const slot = (): number | "<" => {
    if (!placed) {
      placed = true;
      return 0;
    }
    return "<";
  };

  if (hasOp) {
    const opacityFrom = opacityChain.end;
    inner.fromTo(
      opacityProxy,
      { v: opacityFrom },
      {
        v: seg.opacity!,
        duration: dur,
        ease,
        immediateRender: false,
        onUpdate: () => setObject3DTreeOpacity(o, opacityProxy.v),
      },
      slot(),
    );
    opacityChain.end = seg.opacity!;
  }
  if (hasPos) {
    const end = mergePositionTuple(sx, sy, sz, pt!);
    inner.fromTo(
      o.position,
      { x: sx, y: sy, z: sz },
      { x: end.x, y: end.y, z: end.z, duration: dur, ease },
      slot(),
    );
    poseTrack.px = end.x;
    poseTrack.py = end.y;
    poseTrack.pz = end.z;
  }
  if (hasScale) {
    const endS = seg.scale!;
    inner.fromTo(
      o.scale,
      { x: sScale, y: sScale, z: sScale },
      { x: endS, y: endS, z: endS, duration: dur, ease },
      slot(),
    );
    poseTrack.scale = endS;
  }
  if (layoutId && isPolaroid3IntroDebug(layoutId)) {
    logPolaroid3Intro("gsap.segment.endPoseTrack", {
      poseTrackAfter: { ...poseTrack },
      note: "Tween applies from poseTrackFrom→targets next tick; scrub-safe bookkeeping above.",
    });
  }
  parent.add(inner);
}

function appendHomePropIntroLegacyFlatItem(
  itemTl: gsap.core.Timeline,
  o: Object3D,
  spec: HomePropIntroSpec,
): void {
  const dur = spec.durationSec;
  const ease = spec.ease;
  const fx = spec.fromX ?? 0;
  const fy = spec.fromY;
  const fz = spec.fromZ ?? 0;
  const fs = spec.fromScale;
  const fo = spec.fromOpacity;
  const opProxy = { v: fo };
  itemTl.fromTo(
    o.position,
    { x: fx, y: fy, z: fz },
    { x: 0, y: 0, z: 0, duration: dur, ease },
    0,
  );
  itemTl.fromTo(
    o.scale,
    { x: fs, y: fs, z: fs },
    { x: 1, y: 1, z: 1, duration: dur, ease },
    "<",
  );
  itemTl.fromTo(
    opProxy,
    { v: fo },
    {
      v: 1,
      duration: dur,
      ease,
      immediateRender: false,
      onUpdate: () => setObject3DTreeOpacity(o, opProxy.v),
    },
    "<",
  );
}

function appendHomePropIntroSequenceItem(
  itemTl: gsap.core.Timeline,
  o: Object3D,
  plan: HomePropIntroSequencePlan,
  initialSpec: HomePropIntroSpec,
  layoutId: string,
): void {
  const opacityProxy = { v: initialSpec.fromOpacity };
  const opacityChain = { end: initialSpec.fromOpacity };
  const poseTrack: HomePropPoseTrack = {
    px: initialSpec.fromX ?? 0,
    py: initialSpec.fromY,
    pz: initialSpec.fromZ ?? 0,
    scale: initialSpec.fromScale,
  };
  if (isPolaroid3IntroDebug(layoutId)) {
    logPolaroid3Intro("gsap.sequence.registered", {
      segmentCount: plan.sequence.length,
      initialPoseTrack: { ...poseTrack },
    });
  }
  for (const seg of plan.sequence) {
    appendHomePropIntroSegmentParallel(
      itemTl,
      o,
      seg,
      opacityProxy,
      opacityChain,
      poseTrack,
      layoutId,
    );
  }
}

/**
 * Builds a single-item timeline from choreography overrides (**flat** or **`sequence`**).
 * Applies initial pose first — matches **`appendHomeDeskPropsIntroBatch`** per-item behavior.
 */
export function createHomeDeskPropIntroItemTimeline(
  layoutId: string,
  o: Object3D,
): gsap.core.Timeline {
  const spec = getHomePropIntroSpec(layoutId);
  applyHomePropIntroInitialPose(o, spec, layoutId);
  const itemTl = gsap.timeline();
  const rawOverride = HOME_PROP_INTRO_OVERRIDES[layoutId];
  if (rawOverride != null && isHomePropIntroSequencePlan(rawOverride)) {
    appendHomePropIntroSequenceItem(itemTl, o, rawOverride, spec, layoutId);
  } else {
    appendHomePropIntroLegacyFlatItem(itemTl, o, spec);
  }
  return itemTl;
}

/**
 * Append one props wave to `master`: tweens every **newly registered** non-focus target.
 * Order follows **`HOME_DESK_PROP_INTRO_ORDER`** (alphabetical fallback for ids missing from the sheet).
 *
 * @returns `true` if at least one tween was added.
 */
export function appendHomeDeskPropsIntroBatch(
  master: DeskIntroMasterTimeline,
  targets: Map<string, Object3D>,
  focusItemId: string,
  animatedIds: Set<string>,
  placement: "afterCamera" | "tail",
): boolean {
  const pendingIds = getOrderedPendingPropIds(
    [...targets.keys()].filter(
      (id) => id !== focusItemId && !animatedIds.has(id),
    ),
  );

  if (pendingIds.length === 0) {
    return false;
  }

  const sub = gsap.timeline();

  pendingIds.forEach((layoutId, batchIndex) => {
    const o = targets.get(layoutId);
    if (o == null) {
      return;
    }
    const spec = getHomePropIntroSpec(layoutId);
    const t0 = batchIndex * spec.staggerGapSec;
    animatedIds.add(layoutId);

    applyHomePropIntroInitialPose(o, spec, layoutId);

    const itemTl = gsap.timeline();
    const rawOverride = HOME_PROP_INTRO_OVERRIDES[layoutId];

    if (
      rawOverride != null &&
      isHomePropIntroSequencePlan(rawOverride)
    ) {
      appendHomePropIntroSequenceItem(itemTl, o, rawOverride, spec, layoutId);
    } else {
      appendHomePropIntroLegacyFlatItem(itemTl, o, spec);
    }

    sub.add(itemTl, t0);
  });

  const labelMap = (
    master as { labels?: Record<string, number> }
  ).labels;
  const hasAfterCameraLabel =
    labelMap != null &&
    Object.prototype.hasOwnProperty.call(labelMap, "afterCamera");

  const at: number | string =
    placement === "afterCamera"
      ? hasAfterCameraLabel
        ? "afterCamera"
        : 0
      : ">";

  master.add(sub, at);
  return true;
}

/** Desk ids aligned with choreography order (`HOME_DESK_PROP_INTRO_ORDER`), plus the static welcome header. */
export const HOME_DESK_LAYOUT_IDS = [
  ...HOME_DESK_PROP_INTRO_ORDER.map((r) => r.layoutId),
  "welcome-header",
];
