/**
 * ## Home desk intro — choreography by **desk slug** (not `polaroid-3` ids)
 *
 * - **Cards** — `PortfolioItem.deskSlug` in `portfolio-data.ts` (`selected-work`, …)
 * - **Polaroids** — `PolaroidItem.deskSlug` on home rows (`raymond`, `launch-notes`, …)
 * - **Phone** — fixed key `iphone`
 *
 * ### Where to animate
 * 1. **Per-item motion builders (optional)** — **`home-desk-intro-motion-builders.ts`** — not wired into the home imperative intro; keep for tooling/exports.
 * 2. **Stagger order** — `HOME_DESK_INTRO_SEQUENCE_SLOTS` here (or `buildDeskIntroSequenceSlots()`).
 * 3. **Home props GSAP** — edit **`desk-intro-imperative.ts`** — single timeline; this file supplies **order** only (`HOME_DESK_PROP_INTRO_ORDER`).
 * 4. **Camera zoom target** — `HOME_FOCUS_POLAROID_DESK_SLUG`.
 *
 * Runtime still uses `layoutId` strings (`card-0`, `polaroid-3`) internally; this file resolves slug → layoutId.
 */

import type { DeskIntroZoomOutFromItem } from "@/lib/desk-layout";
import { deskItemId } from "@/lib/desk-layout";
import {
  homeCardLayoutIdFromDeskSlug,
  homePolaroidLayoutIdFromDeskSlug,
  polaroids,
  portfolioItems,
} from "@/lib/portfolio-data";
import type { DeskSceneId } from "@/lib/desk-scene-id";
import { DESK_SCENE_HOME } from "@/lib/desk-scene-id";
import type { HomePropIntroOverride } from "@/lib/desk-intro-timelines/home-intro-prop-types";
import { buildDeskIntroMotionByDeskSlug } from "@/lib/desk-intro-timelines/home-desk-intro-motion-builders";

export {
  DESK_INTRO_MOTION_BUILDER_REGISTRY,
  INTRO_KEYFRAME_STUB_FLAT,
  INTRO_KEYFRAME_STUB_SEQUENCE,
  POLAROID_LAUNCH_NOTES_INTRO_SEQUENCE,
  buildDeskIntroMotionByDeskSlug,
} from "@/lib/desk-intro-timelines/home-desk-intro-motion-builders";

// ——— Camera ———

/** Polaroid **`deskSlug`** the zoom-out opens on (`portfolio-data` → `polaroids`). */
export const HOME_FOCUS_POLAROID_DESK_SLUG = "raymond";

export const HOME_FOCUS_ITEM_ID =
  homePolaroidLayoutIdFromDeskSlug(HOME_FOCUS_POLAROID_DESK_SLUG) ??
  `polaroid-${HOME_FOCUS_POLAROID_DESK_SLUG}`;

/** Camera segment — tweened in `home.ts` onto the GSAP master before desk props. */
export const HOME_DESK_INTRO_ZOOM_OUT: DeskIntroZoomOutFromItem = {
  mode: "zoomOutFromItem",
  focusItemId: HOME_FOCUS_ITEM_ID,
  holdBeforeZoomOutMs: 5000,
  durationMs: 300,
  easing: "easeInOutCubic",
  easingGsap: "power2.inOut",
  from: {
    y: 2.2,
    z: -1.3,
    zoom: 1.65,
  },
};

export function getDeskIntroZoomOutConfig(
  scene: DeskSceneId,
): DeskIntroZoomOutFromItem | null {
  return scene === DESK_SCENE_HOME ? HOME_DESK_INTRO_ZOOM_OUT : null;
}

// ——— Sequence slots (slug refs) → expanded to runtime layout rows ———

export type DeskIntroSequenceSlot =
  | { kind: "card"; slug: string }
  | { kind: "polaroid"; slug: string }
  | { kind: "iphone" }
  | { kind: "video" };

export function buildDeskIntroSequenceSlots(): DeskIntroSequenceSlot[] {
  return [
    { kind: "card", slug: "selected-work" },
    { kind: "card", slug: "studio-notes" },
    { kind: "card", slug: "contact" },
    ...polaroids.map((p) => {
      if (!p.deskSlug) {
        throw new Error(`Polaroid "${p.title}" is missing deskSlug`);
      }
      return { kind: "polaroid" as const, slug: p.deskSlug };
    }),
    { kind: "video" },
    { kind: "iphone" },
  ];
}

/** Ordered stagger slots — edit to reorder props relative to each other */
export const HOME_DESK_INTRO_SEQUENCE_SLOTS: readonly DeskIntroSequenceSlot[] =
  buildDeskIntroSequenceSlots();

function resolveDeskIntroSlotToLayoutId(slot: DeskIntroSequenceSlot): string {
  if (slot.kind === "iphone") {
    return deskItemId.iphone;
  }
  if (slot.kind === "video") {
    return deskItemId.homeDeskVideo;
  }
  if (slot.kind === "card") {
    const id = homeCardLayoutIdFromDeskSlug(slot.slug);
    if (!id) {
      throw new Error(`Unknown card deskSlug: "${slot.slug}"`);
    }
    return id;
  }
  const id = homePolaroidLayoutIdFromDeskSlug(slot.slug);
  if (!id) {
    throw new Error(`Unknown polaroid deskSlug: "${slot.slug}"`);
  }
  return id;
}

function labelForDeskIntroSlot(slot: DeskIntroSequenceSlot): string {
  if (slot.kind === "iphone") {
    return "iphone";
  }
  if (slot.kind === "video") {
    return "video";
  }
  if (slot.kind === "card") {
    return (
      portfolioItems.find((c) => c.deskSlug === slot.slug)?.title ?? slot.slug
    );
  }
  return polaroids.find((p) => p.deskSlug === slot.slug)?.title ?? slot.slug;
}

/**
 * Motion overrides keyed by **`deskSlug`** / **`iphone`** — built from **`deskIntroMotion_*`** builders.
 */
export const HOME_DESK_INTRO_MOTION_BY_DESK_SLUG: Partial<
  Record<string, HomePropIntroOverride>
> = buildDeskIntroMotionByDeskSlug();

export type HomeDeskPropIntroRow = {
  layoutId: string;
  /** `card|polaroid|iphone / slug / title` — DevTools-friendly */
  label: string;
};

function expandDeskIntroRows(): HomeDeskPropIntroRow[] {
  return HOME_DESK_INTRO_SEQUENCE_SLOTS.map((slot) => ({
    layoutId: resolveDeskIntroSlotToLayoutId(slot),
    label:
      slot.kind === "iphone"
        ? `iphone / ${labelForDeskIntroSlot(slot)}`
        : slot.kind === "video"
          ? `video / ${labelForDeskIntroSlot(slot)}`
          : `${slot.kind} / ${slot.slug} — ${labelForDeskIntroSlot(slot)}`,
  }));
}

/** Expanded rows consumed by prop intro order (`layoutId` + label). */
export const HOME_DESK_PROP_INTRO_ORDER: readonly HomeDeskPropIntroRow[] =
  expandDeskIntroRows();

export function getOrderedPendingPropIds(pendingIds: readonly string[]): string[] {
  const pending = new Set(pendingIds);
  const ordered: string[] = [];
  const listed = new Set<string>();

  for (const row of HOME_DESK_PROP_INTRO_ORDER) {
    listed.add(row.layoutId);
    if (pending.has(row.layoutId)) {
      ordered.push(row.layoutId);
      pending.delete(row.layoutId);
    }
  }

  const extras = [...pending].sort();
  return [...ordered, ...extras];
}
