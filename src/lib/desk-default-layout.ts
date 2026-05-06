import defaultJson from "@/data/desk-layout.json";
import aboutJson from "@/data/desk-layout-about.json";
import { HOME_DESK_PROPS_INTRO_MOUNT_STYLE } from "@/lib/desk-intro-timelines/desk-intro-imperative";
import { HOME_DESK_INTRO_ZOOM_OUT } from "@/lib/desk-intro-timelines/zoom-config";
import { DESK_SCENE_ABOUT, type DeskSceneId } from "@/lib/desk-scene-id";
import {
  isDeskLayoutFileV1,
  type DeskCameraState,
  type DeskItemLayout,
  type DeskIntroZoomOutFromItem,
  type DeskItemIntroConfig,
  type DeskStaggerAfterCamera,
} from "./desk-layout";

const FALLBACK_BALL: [number, number] = [4.4, 1.6];

export type BundledDeskData = {
  items: Record<string, DeskItemLayout>;
  ball: [number, number];
  camera: Partial<DeskCameraState> | null;
  intro: DeskIntroZoomOutFromItem | null;
  itemIntros: Record<string, DeskItemIntroConfig>;
  staggerAfterCamera: DeskStaggerAfterCamera | null;
};

function loadBundledFromJson(raw: unknown): BundledDeskData {
  if (!isDeskLayoutFileV1(raw)) {
    return {
      items: {},
      ball: FALLBACK_BALL,
      camera: null,
      intro: null,
      itemIntros: {},
      staggerAfterCamera: null,
    };
  }
  return {
    items: { ...raw.items },
    ball: raw.ball != null ? [raw.ball[0], raw.ball[1]] : FALLBACK_BALL,
    camera: raw.camera != null ? { ...raw.camera } : null,
    intro: raw.intro ?? null,
    itemIntros: raw.itemIntros != null ? { ...raw.itemIntros } : {},
    staggerAfterCamera: raw.intro?.staggerAfterCamera ?? null,
  };
}

const loadedHome = loadBundledFromJson(defaultJson);
const loadedAbout = loadBundledFromJson(aboutJson);

export function getBundledDataForScene(scene: DeskSceneId): BundledDeskData {
  return scene === DESK_SCENE_ABOUT ? loadedAbout : loadedHome;
}

/** Home scene only (backward compatible). */
export const BUNDLED_DESK_LAYOUT_ITEMS: Record<string, DeskItemLayout> =
  loadedHome.items;

/** Home scene only. */
export const BUNDLED_DESK_BALL: [number, number] = loadedHome.ball;

/** Home scene only. */
export const BUNDLED_DESK_CAMERA: Partial<DeskCameraState> | null =
  loadedHome.camera;

/** Home zoom-out intro — edit `desk-intro-timelines/home-desk-choreography.ts`. */
export const BUNDLED_DESK_INTRO: DeskIntroZoomOutFromItem | null =
  HOME_DESK_INTRO_ZOOM_OUT;

/** Home scene only. */
export const BUNDLED_ITEM_INTROS: Record<string, DeskItemIntroConfig> =
  loadedHome.itemIntros;

/** Home stagger-after-camera mount style — mirrors [`HOME_DESK_PROPS_INTRO_MOUNT_STYLE`](@/lib/desk-intro-timelines/desk-intro-imperative.ts). */
export const BUNDLED_STAGGER_AFTER: DeskStaggerAfterCamera | null =
  HOME_DESK_PROPS_INTRO_MOUNT_STYLE;
