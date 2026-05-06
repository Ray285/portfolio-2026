/**
 * Desk intro choreography entrypoints:
 *
 * | File | Purpose |
 * |------|---------|
 * | **`home-desk-intro-motion-builders.ts`** | **Per-item motion** — `deskIntroMotion_*` functions + registry |
 * | **`home-desk-choreography.ts`** | Camera zoom, focus slug, stagger order, slug→layout expansion |
 * | `zoom-config.ts` | Re-exports camera helpers for SSR paths (`getDeskIntroZoomOutConfig`) |
 * | `home.ts` | **`appendHomeDeskIntroTimeline`** — camera tween |
 * | `home-intro-props.ts` | **`createHomeDeskPropIntroItemTimeline`**, legacy `appendHomeDeskPropsIntroBatch` |
 * | `desk-intro-imperative.ts` | Readiness-gated home props (**`appendDeskPropsIntroImperative`**, **`HOME_DESK_PROPS_INTRO_MOUNT_STYLE`**) |
 * | `about.ts` | **`appendAboutDeskIntroTimeline`** — `/about` beats |
 */

import {
  DESK_SCENE_ABOUT,
  DESK_SCENE_HOME,
  type DeskSceneId,
} from "@/lib/desk-scene-id";
import type { DeskStaggerAfterCamera } from "@/lib/desk-layout";
import { appendAboutDeskIntroTimeline } from "@/lib/desk-intro-timelines/about";
import {
  buildDeskIntroMotionByDeskSlug,
  DESK_INTRO_MOTION_BUILDER_REGISTRY,
  HOME_DESK_INTRO_MOTION_BY_DESK_SLUG,
  HOME_DESK_PROP_INTRO_ORDER,
  HOME_DESK_INTRO_SEQUENCE_SLOTS,
  HOME_FOCUS_POLAROID_DESK_SLUG,
  INTRO_KEYFRAME_STUB_FLAT,
  INTRO_KEYFRAME_STUB_SEQUENCE,
  POLAROID_LAUNCH_NOTES_INTRO_SEQUENCE,
  getOrderedPendingPropIds,
} from "@/lib/desk-intro-timelines/home-desk-choreography";
import { appendHomeDeskIntroTimeline } from "@/lib/desk-intro-timelines/home";
import {
  appendDeskPropsIntroImperative,
  HOME_DESK_INTRO_READINESS_TIMEOUT_MS,
  HOME_DESK_PROPS_INTRO_MOUNT_STYLE,
} from "@/lib/desk-intro-timelines/desk-intro-imperative";
import {
  appendHomeDeskPropsIntroBatch,
  createHomeDeskPropIntroItemTimeline,
  HOME_PROP_INTRO_DEFAULTS,
  HOME_PROP_INTRO_OVERRIDES,
  getHomePropIntroSpec,
} from "@/lib/desk-intro-timelines/home-intro-props";
import type {
  DeskIntroMasterTimeline,
  DeskIntroTimelineAppendContext,
} from "@/lib/desk-intro-timelines/types";
import {
  getDeskIntroZoomOutConfig,
  HOME_DESK_INTRO_ZOOM_OUT,
  HOME_FOCUS_ITEM_ID,
} from "@/lib/desk-intro-timelines/zoom-config";

export type {
  DeskIntroCamProxy,
  DeskIntroMasterTimeline,
  DeskIntroTimelineAppendContext,
} from "@/lib/desk-intro-timelines/types";
export type {
  HomePropIntroOverride,
  HomePropIntroPositionPartial,
  HomePropIntroSegment,
  HomePropIntroSequencePlan,
  HomePropIntroSpec,
} from "@/lib/desk-intro-timelines/home-intro-prop-types";

export {
  appendAboutDeskIntroTimeline,
  appendDeskPropsIntroImperative,
  appendHomeDeskIntroTimeline,
  appendHomeDeskPropsIntroBatch,
  HOME_DESK_INTRO_READINESS_TIMEOUT_MS,
  HOME_DESK_PROPS_INTRO_MOUNT_STYLE,
  buildDeskIntroMotionByDeskSlug,
  createHomeDeskPropIntroItemTimeline,
  DESK_INTRO_MOTION_BUILDER_REGISTRY,
  HOME_DESK_INTRO_ZOOM_OUT,
  HOME_DESK_PROP_INTRO_ORDER,
  HOME_FOCUS_POLAROID_DESK_SLUG,
  HOME_FOCUS_ITEM_ID,
  HOME_PROP_INTRO_DEFAULTS,
  HOME_PROP_INTRO_OVERRIDES,
  getDeskIntroZoomOutConfig,
  getHomePropIntroSpec,
  getOrderedPendingPropIds,
  HOME_DESK_INTRO_MOTION_BY_DESK_SLUG,
  HOME_DESK_INTRO_SEQUENCE_SLOTS,
  INTRO_KEYFRAME_STUB_FLAT,
  INTRO_KEYFRAME_STUB_SEQUENCE,
  POLAROID_LAUNCH_NOTES_INTRO_SEQUENCE,
};

/** Dispatch camera segment onto the shared GSAP master timeline (GSDevTools scrub). */
export function appendDeskSceneIntroTimeline(
  master: DeskIntroMasterTimeline,
  ctx: DeskIntroTimelineAppendContext,
): void {
  const { scene } = ctx;
  if (scene === DESK_SCENE_ABOUT) {
    appendAboutDeskIntroTimeline(master, ctx);
    return;
  }
  appendHomeDeskIntroTimeline(master, ctx);
}

export function getDeskIntroStaggerAfterCamera(
  scene: DeskSceneId,
): DeskStaggerAfterCamera | null {
  return scene === DESK_SCENE_HOME ? HOME_DESK_PROPS_INTRO_MOUNT_STYLE : null;
}

export function getDeskIntroFocusItemId(scene: DeskSceneId): string | null {
  return scene === DESK_SCENE_HOME ? HOME_FOCUS_ITEM_ID : null;
}

export function deskSceneHasAnimatedCameraIntro(scene: DeskSceneId): boolean {
  return getDeskIntroZoomOutConfig(scene) != null;
}
