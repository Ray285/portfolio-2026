import { getBundledDataForScene } from "./desk-default-layout";
import { getDeskIntroZoomOutConfig } from "@/lib/desk-intro-timelines/zoom-config";
import {
  getDeskLayoutStorageKey,
  hasDeskLayoutInStorageForKey,
  mergeDeskCameraWithDefaults,
  readDeskLayoutFromStorageKey,
  type DeskCameraState,
  type DeskIntroZoomOutFromItem,
  type DeskItemLayout,
} from "./desk-layout";
import type { DeskSceneId } from "./desk-scene-id";

/**
 * Bundled JSON `camera` only — rest pose after intro (same source as layout defaults).
 */
export function getBundledRestCameraForIntro(scene: DeskSceneId): DeskCameraState {
  const b = getBundledDataForScene(scene);
  return mergeDeskCameraWithDefaults(b.camera ?? {});
}

/**
 * Focus item pose for the bundled intro — **same** resolution order as
 * `DeskLayoutContext.getItem` once storage exists: `items[id]` from
 * `localStorage`, else `BUNDLED_DESK_LAYOUT_ITEMS[id]`, else a fallback. Used so
 * the ortho camera’s X/Z (centered on the item) does not jump when React state
 * catches up to what’s already in `localStorage`.
 */
export function getFocusItemLayoutForZoomOutIntroSync(
  scene: DeskSceneId,
): DeskItemLayout | null {
  const bundled = getBundledDataForScene(scene);
  const intro = getDeskIntroZoomOutConfig(scene);
  if (intro == null || intro.mode !== "zoomOutFromItem") {
    return null;
  }
  const id = intro.focusItemId;
  const itemsBundled = bundled.items;
  const fallback: DeskItemLayout =
    itemsBundled[id] ?? {
      position: [0, 0.06, 0] as [number, number, number],
      rotation: [0, 0, 0] as [number, number, number],
    };

  if (typeof window === "undefined") {
    return { position: [...fallback.position], rotation: [...fallback.rotation] };
  }
  const key = getDeskLayoutStorageKey(scene);
  if (!hasDeskLayoutInStorageForKey(key)) {
    const b = itemsBundled[id];
    return b
      ? { position: [...b.position], rotation: [...b.rotation] }
      : { position: [...fallback.position], rotation: [...fallback.rotation] };
  }
  const { items } = readDeskLayoutFromStorageKey(key);
  const s = items[id] ?? itemsBundled[id];
  return s
    ? { position: s.position, rotation: s.rotation }
    : { position: [...fallback.position], rotation: [...fallback.rotation] };
}

/**
 * t=0 intro camera for `zoomOutFromItem`, using the **resolved** focus item X/Z
 * (bundled or `localStorage` when present). Seeds `DeskControls` before layout.
 */
export function getZoomOutIntroStartCameraForInitialControls(
  scene: DeskSceneId,
): {
  x: number;
  y: number;
  z: number;
  zoom: number;
} | null {
  const intro = getDeskIntroZoomOutConfig(scene);
  if (intro == null || intro.mode !== "zoomOutFromItem") {
    return null;
  }
  const rest = getBundledRestCameraForIntro(scene);
  const item = getFocusItemLayoutForZoomOutIntroSync(scene);
  if (item == null) {
    return null;
  }
  return buildZoomOutStartAndEndFromFocus(
    item.position[0],
    item.position[2],
    rest,
    intro,
  ).start;
}

type Cam4 = { x: number; y: number; z: number; zoom: number };

export function buildZoomOutStartAndEndFromFocus(
  focusX: number,
  focusZ: number,
  rest: DeskCameraState,
  intro: DeskIntroZoomOutFromItem,
): { start: Cam4; end: Cam4 } {
  const fromY = intro.from?.y ?? Math.min(rest.y * 0.52, 4.5);
  const fromZ = intro.from?.z ?? focusZ;
  /** Higher than `rest.zoom` = ortho starts tighter (closer) on the focus item. */
  const fromZoom = intro.from?.zoom ?? rest.zoom * 1.14;
  return {
    start: { x: focusX, y: fromY, z: fromZ, zoom: fromZoom },
    end: { x: focusX, y: rest.y, z: focusZ, zoom: rest.zoom },
  };
}

