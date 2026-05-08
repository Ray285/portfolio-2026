/**
 * desk layout: draggable positions/rotations/scales + ball XZ, persisted as JSON
 * in `localStorage` (see `STORAGE_KEY`). `version` bumps when the shape
 * changes so we can extend without silent corruption.
 */

import { clampCameraY } from "@/lib/desk-camera-y-bounds";
import { DEFAULT_CAMERA } from "@/lib/desk-scene-defaults";

import type { DeskSceneId } from "@/lib/desk-scene-id";
import { DESK_SCENE_ABOUT, DESK_SCENE_HOME } from "@/lib/desk-scene-id";

export const DESK_LAYOUT_VERSION = 1 as const;
/**
 * Home scene / legacy: saved layouts under this key. About uses `getDeskLayoutStorageKey("about")`.
 */
export const DESK_LAYOUT_STORAGE_KEY = "portfolio-2026:desk-layout-v1" as const;

export function getDeskLayoutStorageKey(scene: DeskSceneId): string {
  if (scene === DESK_SCENE_HOME) {
    return DESK_LAYOUT_STORAGE_KEY;
  }
  return `${DESK_LAYOUT_STORAGE_KEY}:${DESK_SCENE_ABOUT}` as const;
}

/** Uniform layout scale (1 = authored size). Composed with focus zoom in `DraggableObject`. */
export const DESK_ITEM_LAYOUT_SCALE_MIN = 0.25;
export const DESK_ITEM_LAYOUT_SCALE_MAX = 3;

/**
 * World-space **baseline Y** above the desk plane (`position[1]`): stacking / draw order
 * when items overlap in XZ. Larger Y is closer to the top-down ortho camera.
 */
export const DESK_ITEM_BASE_Y_MIN = 0.02;
export const DESK_ITEM_BASE_Y_MAX = 0.18;
/** One step for arrange panel +/− and `[` / `]` keyboard shortcuts. */
export const DESK_ITEM_BASE_Y_STEP = 0.005;

export function clampDeskItemBaseY(y: number): number {
  if (!Number.isFinite(y)) {
    return 0.08;
  }
  return Math.min(
    DESK_ITEM_BASE_Y_MAX,
    Math.max(DESK_ITEM_BASE_Y_MIN, y),
  );
}

export type DeskItemLayout = {
  position: [number, number, number];
  rotation: [number, number, number];
  /** Optional for older saves / bundled JSON; missing = 1. */
  scale?: number;
};

export function clampDeskItemLayoutScale(n: number): number {
  if (!Number.isFinite(n)) {
    return 1;
  }
  return Math.min(
    DESK_ITEM_LAYOUT_SCALE_MAX,
    Math.max(DESK_ITEM_LAYOUT_SCALE_MIN, n),
  );
}

/** Merge bundled or default item with optional storage; always returns clamped `scale`. */
export function mergeDeskItemLayout(
  fallback: DeskItemLayout,
  stored: DeskItemLayout | undefined,
): DeskItemLayout {
  if (!stored) {
    return {
      position: fallback.position,
      rotation: fallback.rotation,
      scale: clampDeskItemLayoutScale(fallback.scale ?? 1),
    };
  }
  return {
    position: stored.position,
    rotation: stored.rotation,
    scale: clampDeskItemLayoutScale(stored.scale ?? fallback.scale ?? 1),
  };
}

function sanitizeDeskItemLayout(x: DeskItemLayout): DeskItemLayout {
  return {
    position: x.position,
    rotation: x.rotation,
    scale: clampDeskItemLayoutScale(x.scale ?? 1),
  };
}

const LEGACY_DESK_HANDWRITING_KEY = "desk-handwriting";

/** Persisted layout key for draggable desk copy — matches `DESK_TEXT_OVERLAYS[].id`. */
export function deskTextLayoutId(id: string): string {
  return `desk-text-${id}`;
}

/** Migrate single-slot `desk-handwriting` → `desk-text-thats-me` from older saves. */
function migrateLegacyDeskHandwritingItems(
  items: Record<string, DeskItemLayout>,
): Record<string, DeskItemLayout> {
  const next = { ...items };
  const target = deskTextLayoutId("thats-me");
  if (next[target] == null && next[LEGACY_DESK_HANDWRITING_KEY] != null) {
    next[target] = next[LEGACY_DESK_HANDWRITING_KEY];
  }
  if (next[LEGACY_DESK_HANDWRITING_KEY] != null) {
    delete next[LEGACY_DESK_HANDWRITING_KEY];
  }
  return next;
}

/** Matches `DeskControls` camera fields: rest pose after load / intro. */
export type DeskCameraState = {
  x: number;
  y: number;
  z: number;
  zoom: number;
};

export type DeskIntroFromOverride = {
  y?: number;
  zoom?: number;
};

export type DeskIntroToOverride = {
  x?: number;
  y?: number;
  z?: number;
  zoom?: number;
};

export type DeskIntroZoomOutFromItem = {
  mode: "zoomOutFromItem";
  focusItemId: string;
  durationMs: number;
  /**
   * Milliseconds to hold the start pose (close on the focus item) before the
   * zoom-out tween runs. 0 = no pause.
   */
  holdBeforeZoomOutMs?: number;
  /** Named easing: see `easing.ts` / `EASING_NAMES` */
  easing: string;
  /** If set, used as the GSAP ease for the camera tween (e.g. `power2.inOut`). */
  easingGsap?: string;
  from?: DeskIntroFromOverride;
  to?: DeskIntroToOverride;
  staggerAfterCamera?: DeskStaggerAfterCamera;
};

export type DeskItemIntroFrom = {
  y?: number;
  scale?: number;
  /**
   * Stagger only: 0 = fully transparent at start, tweened to 1 with the same
   * timing as y/scale. Omitted = no opacity tween (default visible materials).
   */
  opacity?: number;
};

export type DeskItemIntroConfig = {
  delayMs: number;
  durationMs: number;
  easing: string;
  from: DeskItemIntroFrom;
};

/**
 * After the camera intro completes, run GSAP stagger on all registered desk
 * items **except** `intro.focusItemId` (e.g. the self-portrait polaroid).
 *
 * `from.y` is in **local** space on the item’s intro group (above the draggable
 * body). For a top‑down orthographic desk, **negative** values can push props
 * below the desk plane in world space and depth‑occlude them against the floor.
 * `from.opacity` (optional, 0–1): fade meshes from that value to 1, same
 * duration/ease/stagger as position/scale — configured here, not hard-coded in
 * the timeline file.
 */
export type DeskStaggerAfterCamera = {
  /** Seconds between the start of each item’s enter tween. */
  staggerMs: number;
  eachDurationMs: number;
  /** GSAP ease string (e.g. `power2.out`, `sine.out`). */
  ease: string;
  from: DeskItemIntroFrom;
};

export type DeskLayoutFileV1 = {
  version: typeof DESK_LAYOUT_VERSION;
  items: Record<string, DeskItemLayout>;
  /** World X, Z; Y is always ball radius. Omitted in older saves. */
  ball?: [number, number];
  /** Rest camera after intro (or immediately if no `intro`). */
  camera?: DeskCameraState;
  /** Page-load camera motion; from bundled file only, not in localStorage. */
  intro?: DeskIntroZoomOutFromItem;
  /** Per–layout-id enter animation; from bundled file only, not in localStorage. */
  itemIntros?: Record<string, DeskItemIntroConfig>;
};

function isNumberTriple(x: unknown): x is [number, number, number] {
  return (
    Array.isArray(x) &&
    x.length === 3 &&
    x.every((n) => typeof n === "number" && Number.isFinite(n))
  );
}

function isPair(x: unknown): x is [number, number] {
  return (
    Array.isArray(x) &&
    x.length === 2 &&
    x.every((n) => typeof n === "number" && Number.isFinite(n))
  );
}

function isFiniteNumber(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n);
}

function isDeskCameraState(x: unknown): x is DeskCameraState {
  if (x === null || typeof x !== "object") {
    return false;
  }
  const o = x as Record<string, unknown>;
  return (
    isFiniteNumber(o.x) &&
    isFiniteNumber(o.y) &&
    isFiniteNumber(o.z) &&
    isFiniteNumber(o.zoom)
  );
}

function isIntroFrom(x: unknown): x is DeskIntroFromOverride {
  if (x === null || typeof x !== "object") {
    return false;
  }
  const o = x as Record<string, unknown>;
  if (o.y !== undefined && !isFiniteNumber(o.y)) {
    return false;
  }
  if (o.zoom !== undefined && !isFiniteNumber(o.zoom)) {
    return false;
  }
  return true;
}

function isIntroTo(x: unknown): x is DeskIntroToOverride {
  if (x === null || typeof x !== "object") {
    return false;
  }
  const o = x as Record<string, unknown>;
  for (const k of ["x", "y", "z", "zoom"] as const) {
    if (o[k] !== undefined && !isFiniteNumber(o[k])) {
      return false;
    }
  }
  return true;
}

function isDeskStaggerAfterCamera(x: unknown): x is DeskStaggerAfterCamera {
  if (x === null || typeof x !== "object") {
    return false;
  }
  const s = x as Record<string, unknown>;
  if (!isFiniteNumber(s.staggerMs) || s.staggerMs < 0) {
    return false;
  }
  if (!isFiniteNumber(s.eachDurationMs) || s.eachDurationMs <= 0) {
    return false;
  }
  if (typeof s.ease !== "string") {
    return false;
  }
  if (
    typeof s.from !== "object" ||
    s.from === null ||
    !isItemIntroFrom(s.from)
  ) {
    return false;
  }
  return true;
}

function isDeskIntroZoomOutFromItem(
  x: unknown,
): x is DeskIntroZoomOutFromItem {
  if (x === null || typeof x !== "object") {
    return false;
  }
  const o = x as Record<string, unknown>;
  if (o.mode !== "zoomOutFromItem") {
    return false;
  }
  if (typeof o.focusItemId !== "string" || o.focusItemId.length === 0) {
    return false;
  }
  if (!isFiniteNumber(o.durationMs) || o.durationMs <= 0) {
    return false;
  }
  if (typeof o.easing !== "string") {
    return false;
  }
  if (o.easingGsap !== undefined && typeof o.easingGsap !== "string") {
    return false;
  }
  if (
    o.holdBeforeZoomOutMs !== undefined &&
    (!isFiniteNumber(o.holdBeforeZoomOutMs) || o.holdBeforeZoomOutMs < 0)
  ) {
    return false;
  }
  if (o.from !== undefined && !isIntroFrom(o.from)) {
    return false;
  }
  if (o.to !== undefined && !isIntroTo(o.to)) {
    return false;
  }
  if (o.staggerAfterCamera !== undefined) {
    if (!isDeskStaggerAfterCamera(o.staggerAfterCamera)) {
      return false;
    }
  }
  return true;
}

function isItemIntroFrom(x: unknown): x is DeskItemIntroFrom {
  if (x === null || typeof x !== "object") {
    return false;
  }
  const o = x as Record<string, unknown>;
  if (o.y !== undefined && !isFiniteNumber(o.y)) {
    return false;
  }
  if (o.scale !== undefined && !isFiniteNumber(o.scale)) {
    return false;
  }
  if (o.opacity !== undefined) {
    if (!isFiniteNumber(o.opacity) || o.opacity < 0 || o.opacity > 1) {
      return false;
    }
  }
  return true;
}

function isDeskItemIntroConfig(x: unknown): x is DeskItemIntroConfig {
  if (x === null || typeof x !== "object") {
    return false;
  }
  const o = x as Record<string, unknown>;
  if (!isFiniteNumber(o.delayMs) || o.delayMs < 0) {
    return false;
  }
  if (!isFiniteNumber(o.durationMs) || o.durationMs <= 0) {
    return false;
  }
  if (typeof o.easing !== "string") {
    return false;
  }
  if (typeof o.from !== "object" || o.from === null || !isItemIntroFrom(o.from)) {
    return false;
  }
  return true;
}

function isItemIntrosRecord(
  x: unknown,
): x is Record<string, DeskItemIntroConfig> {
  if (x === null || typeof x !== "object") {
    return false;
  }
  for (const v of Object.values(x)) {
    if (!isDeskItemIntroConfig(v)) {
      return false;
    }
  }
  return true;
}

export function isDeskLayoutFileV1(x: unknown): x is DeskLayoutFileV1 {
  if (x === null || typeof x !== "object") {
    return false;
  }
  const o = x as Record<string, unknown>;
  if (o.version !== DESK_LAYOUT_VERSION) {
    return false;
  }
  if (typeof o.items !== "object" || o.items === null) {
    return false;
  }
  for (const v of Object.values(o.items)) {
    if (typeof v !== "object" || v === null) {
      return false;
    }
    const d = v as Record<string, unknown>;
    if (!isNumberTriple(d.position) || !isNumberTriple(d.rotation)) {
      return false;
    }
    if (d.scale !== undefined) {
      if (typeof d.scale !== "number" || !Number.isFinite(d.scale)) {
        return false;
      }
    }
  }
  if (o.ball !== undefined && !isPair(o.ball)) {
    return false;
  }
  if (o.camera !== undefined && !isDeskCameraState(o.camera)) {
    return false;
  }
  if (o.intro !== undefined && !isDeskIntroZoomOutFromItem(o.intro)) {
    return false;
  }
  if (o.itemIntros !== undefined && !isItemIntrosRecord(o.itemIntros)) {
    return false;
  }
  return true;
}

function normalizePartial(raw: unknown): {
  items: Record<string, DeskItemLayout>;
  ball: [number, number] | null;
} {
  if (!isDeskLayoutFileV1(raw)) {
    return { items: {}, ball: null };
  }
  const sanitized: Record<string, DeskItemLayout> = {};
  for (const [id, item] of Object.entries(raw.items)) {
    sanitized[id] = sanitizeDeskItemLayout(item);
  }
  return {
    items: migrateLegacyDeskHandwritingItems(sanitized),
    ball: raw.ball ?? null,
  };
}

export function hasDeskLayoutInStorageForKey(storageKey: string): boolean {
  if (typeof window === "undefined" || !window.localStorage) {
    return false;
  }
  return window.localStorage.getItem(storageKey) != null;
}

/** @deprecated prefer hasDeskLayoutInStorageForKey(getDeskLayoutStorageKey(scene)) */
export function hasDeskLayoutInStorage(): boolean {
  return hasDeskLayoutInStorageForKey(DESK_LAYOUT_STORAGE_KEY);
}

export function readDeskLayoutFromStorageKey(storageKey: string): {
  items: Record<string, DeskItemLayout>;
  ball: [number, number] | null;
} {
  if (typeof window === "undefined" || !window.localStorage) {
    return { items: {}, ball: null };
  }
  try {
    const s = window.localStorage.getItem(storageKey);
    if (s == null) {
      return { items: {}, ball: null };
    }
    return normalizePartial(JSON.parse(s) as unknown);
  } catch {
    return { items: {}, ball: null };
  }
}

/** @deprecated prefer readDeskLayoutFromStorageKey */
export function readDeskLayoutFromStorage(): {
  items: Record<string, DeskItemLayout>;
  ball: [number, number] | null;
} {
  return readDeskLayoutFromStorageKey(DESK_LAYOUT_STORAGE_KEY);
}

export function writeDeskLayoutToStorageKey(
  storageKey: string,
  layout: DeskLayoutFileV1,
): void {
  if (typeof window === "undefined" || !window.localStorage) {
    return;
  }
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(layout, null, 2));
  } catch {
    // quota / private mode; ignore
  }
}

/** @deprecated prefer writeDeskLayoutToStorageKey */
export function writeDeskLayoutToStorage(layout: DeskLayoutFileV1): void {
  writeDeskLayoutToStorageKey(DESK_LAYOUT_STORAGE_KEY, layout);
}

export function buildDeskLayoutFileV1(
  items: Record<string, DeskItemLayout>,
  ball: [number, number],
): DeskLayoutFileV1 {
  return {
    version: DESK_LAYOUT_VERSION,
    items: { ...items },
    ball: [ball[0], ball[1]],
  };
}

export function formatDeskLayoutJson(layout: DeskLayoutFileV1): string {
  return JSON.stringify(layout, null, 2);
}

export function tryParseDeskLayoutJson(s: string): {
  ok: true;
  value: { items: Record<string, DeskItemLayout>; ball: [number, number] | null };
} | { ok: false; error: string } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(s) as unknown;
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
  const n = normalizePartial(parsed);
  if (Object.keys(n.items).length === 0 && n.ball == null) {
    return {
      ok: false,
      error: "Unrecognized or empty layout JSON (need at least one item or ball)",
    };
  }
  return { ok: true, value: n };
}

/** Stable id helpers (match `DeskScene` usage). */
export const deskItemId = {
  card: (index: number) => `card-${index}`,
  polaroid: (slug: string) => `polaroid-${slug}`,
  /** `/about` polaroids — **`slug`** matches [`PolaroidItem.layoutId`](portfolio-data.ts). */
  aboutPolaroid: (slug: string) => `about-polaroid-${slug}`,
  nameplate: "nameplate",
  pencil: "pencil",
  /** About desk loop clips (`AboutDeskLoopVideo`), `/about` scene only */
  aboutLoopVideo: "about-loop-video",
  aboutLoopVideo2: "about-loop-video-2",
  aboutLoopVideo3: "about-loop-video-3",
  /** `public/about/Loop_8.webm` */
  aboutLoopVideoLoop8: "about-loop-video-loop-8",
  /** One `/about/Loop_19.webm` per `my-start-*-timeframe` — same asset, distinct layout ids. */
  aboutLoopVideoTimeframeMyStart01: "about-loop-video-timeframe-my-start-01",
  aboutLoopVideoTimeframeMyStart03: "about-loop-video-timeframe-my-start-03",
  aboutLoopVideoTimeframeMyStart04: "about-loop-video-timeframe-my-start-04",
  /** Extra `Loop_19` clones (layouts from Arrange / `desk-layout-about.json`). */
  aboutLoopVideoLoop19ExtraA: "about-loop-video-loop19-extra-a",
  aboutLoopVideoLoop19ExtraB: "about-loop-video-loop19-extra-b",
  aboutLoopVideoLoop19ExtraC: "about-loop-video-loop19-extra-c",
  aboutLoopVideoLoop19ExtraD: "about-loop-video-loop19-extra-d",
  /** Seven `/about/Loop_46.webm` meshes — same asset; **`index`** `1…7` → `about-loop-video-loop46-extra-{index}`. */
  aboutLoopVideoLoop46Extra: (index: number) =>
    `about-loop-video-loop46-extra-${index}`,
  /** More clips — `src` set per slot in `DeskScene` (`Loop_31`/`Loop_36`, `old-2000s-commercial-snippet`, etc.; remainder may still use `Loop_19`). */
  aboutLoopVideoSupplement1: "about-loop-video-supplement-1",
  aboutLoopVideoSupplement2: "about-loop-video-supplement-2",
  aboutLoopVideoSupplement3: "about-loop-video-supplement-3",
  aboutLoopVideoSupplement4: "about-loop-video-supplement-4",
  /** Home desk GLB phone (`DeskIPhone`). */
  iphone: "iphone",
  /** Home desk loop video (`output.webm`). */
  homeDeskVideo: "home-desk-video",
  /** Draggable desk copy from `DESK_TEXT_OVERLAYS` — id → `desk-text-${id}` */
  deskText: deskTextLayoutId,
  /** Draggable jitter-text elements — same shader as welcome header */
  jitterText: (index: number) => `jitter-text-${index}`,
} as const;

/** Fill missing `camera` JSON fields with [`DEFAULT_CAMERA`](desk-scene-defaults). */
export function mergeDeskCameraWithDefaults(
  c: Partial<DeskCameraState> | undefined,
): DeskCameraState {
  return {
    x: c?.x ?? DEFAULT_CAMERA.x,
    y: clampCameraY(c?.y ?? DEFAULT_CAMERA.y),
    z: c?.z ?? DEFAULT_CAMERA.z,
    zoom: c?.zoom ?? DEFAULT_CAMERA.zoom,
  };
}
