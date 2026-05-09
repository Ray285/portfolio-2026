/**
 * Generates public/theatre-state.json — initial Theatre.js keyframe state that
 * replicates the existing GSAP animation timing so existing behavior is preserved
 * on first load. Open the Theatre.js studio in dev (npm run dev) to refine.
 *
 * Camera sheet
 *   CameraRig      { y, zoom } — hold 5s then zoom-out over 0.3s
 *   WelcomeHeader  { opacity } — fade in during the last 0.5s of hold
 *
 * ItemIntros sheet
 *   One object per desk item, props { opacity, scale }
 *   Stagger: 0.2s gap, 0.6s each, back.out(1.55) ease
 */

import { writeFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const OUT = join(ROOT, "src", "data", "theatre-state.json");

// ─── Timing constants ────────────────────────────────────────────────────────
const HOLD_SEC = 5.0;
const ZOOM_SEC = 0.3;
const CAMERA_END = HOLD_SEC + ZOOM_SEC; // 5.3s

const STAGGER_GAP = 0.2;
const EACH_DUR = 0.6;

// ─── Bezier handle presets ───────────────────────────────────────────────────
// Handles format: [h1x, h1y, h2x, h2y]
// h1 = right handle of left KF  (x: fraction of interval, y: fraction of value range)
// h2 = left  handle of right KF (x: fraction of interval, y: fraction of value range)
const H_DEFAULT = [0.5, 1, 0.5, 0]; // Theatre.js default (smooth S)
const H_POWER2_INOUT = [0.42, 0, 0.42, 1]; // ≈ CSS ease-in-out / GSAP power2.inOut
const H_POWER2_OUT = [0, 0, 0.42, 1]; // ≈ GSAP power2.out
const H_BACK_OUT = [0.34, 1.56, 0.36, 1]; // ≈ GSAP back.out(1.55)

// ─── ID counters (deterministic, human-readable) ─────────────────────────────
let _trackN = 0;
let _kfN = 0;
const tid = (label) =>
  `t${String(++_trackN).padStart(3, "0")}_${label.replace(/[^a-z0-9]/gi, "_").slice(0, 30)}`;
const kfid = () => `kf${String(++_kfN).padStart(5, "0")}`;

// ─── Keyframe factories ───────────────────────────────────────────────────────
function kf(position, value, handles, connectedRight = true) {
  return { id: kfid(), position, connectedRight, handles, type: "bezier", value };
}

/** Two-KF track: from → to with easing handles. */
function animTrack(label, t0, v0, t1, v1, ease) {
  return {
    type: "BasicKeyframedTrack",
    __debugName: label,
    keyframes: [kf(t0, v0, ease, true), kf(t1, v1, H_DEFAULT, false)],
  };
}

/** Hold-then-animate: constant until tHold, then tween to final value. */
function holdThenAnimTrack(label, tHold, tEnd, holdVal, endVal, ease) {
  return {
    type: "BasicKeyframedTrack",
    __debugName: label,
    keyframes: [
      kf(0, holdVal, H_DEFAULT, true),
      kf(tHold, holdVal, ease, false), // connectedRight=false → sharp corner into animate segment
      kf(tEnd, endVal, H_DEFAULT, false),
    ],
  };
}

/** Single-KF constant track (no animation). */
function constTrack(label, value) {
  return {
    type: "BasicKeyframedTrack",
    __debugName: label,
    keyframes: [kf(0, value, H_DEFAULT, false)],
  };
}

// ─── Sheet builder ────────────────────────────────────────────────────────────
function buildSheet(entries, length) {
  // entries: [{ objectId, propPath, track }]
  // Theatre.js 0.7.x format: tracksByObject[objectId].{ trackData, trackIdByPropPath }
  const tracksByObject = {};
  for (const { objectId, propPath, track } of entries) {
    const trackId = tid(`${objectId}_${propPath}`);
    tracksByObject[objectId] ??= { trackData: {}, trackIdByPropPath: {} };
    tracksByObject[objectId].trackData[trackId] = track;
    tracksByObject[objectId].trackIdByPropPath[propPath] = trackId;
  }
  return {
    staticOverrides: { byObject: {} },
    sequence: {
      subUnitsPerUnit: 30,
      length,
      tracksByObject,
    },
  };
}

// ─── Camera sheet ─────────────────────────────────────────────────────────────
const cameraEntries = [
  {
    objectId: "CameraRig",
    propPath: "zoom",
    track: holdThenAnimTrack("CameraRig / zoom", HOLD_SEC, CAMERA_END, 1.65, 1.0, H_POWER2_INOUT),
  },
  {
    objectId: "CameraRig",
    propPath: "y",
    track: holdThenAnimTrack("CameraRig / y", HOLD_SEC, CAMERA_END, 2.2, 4.0, H_POWER2_INOUT),
  },
  // WelcomeHeader: fade in during the last 0.5s of the hold
  {
    objectId: "WelcomeHeader",
    propPath: "opacity",
    track: holdThenAnimTrack(
      "WelcomeHeader / opacity",
      HOLD_SEC - 0.5,
      HOLD_SEC,
      0,
      0.98,
      H_POWER2_OUT,
    ),
  },
];

// ─── ItemIntros items ─────────────────────────────────────────────────────────
// Order mirrors desk-intro-imperative.ts:
//   hero (raymond) appears at t=0 (scale only, opacity constant=1)
//   remaining items stagger at 0.2s intervals
const ITEM_INTROS = [
  // hero
  { id: "polaroid-raymond", t: 0, hero: true },
  // stagger
  { id: "card-0", t: 0 },
  { id: "card-1", t: 0.2 },
  { id: "card-2", t: 0.4 },
  { id: "polaroid-interface-study", t: 0.6 },
  { id: "polaroid-prototype-desk", t: 0.8 },
  { id: "polaroid-launch-notes", t: 1.0 },
  { id: "polaroid-archive-01", t: 1.2 },
  { id: "polaroid-archive-02", t: 1.4 },
  { id: "polaroid-archive-03", t: 1.6 },
  { id: "polaroid-archive-04", t: 1.8 },
  { id: "polaroid-archive-05", t: 2.0 },
  { id: "polaroid-archive-06", t: 2.2 },
  { id: "polaroid-archive-07", t: 2.4 },
  { id: "polaroid-archive-08", t: 2.6 },
  { id: "polaroid-archive-09", t: 2.8 },
  { id: "polaroid-archive-10", t: 3.0 },
  { id: "polaroid-archive-11", t: 3.2 },
  { id: "polaroid-archive-12", t: 3.4 },
  { id: "polaroid-archive-13", t: 3.6 },
  { id: "polaroid-archive-14", t: 3.8 },
  { id: "polaroid-archive-15", t: 4.0 },
  { id: "home-desk-video", t: 4.2 },
  { id: "iphone", t: 4.4 },
  { id: "jitter-text-0", t: 4.6 },
  { id: "jitter-text-1", t: 4.8 },
  { id: "jitter-text-2", t: 5.0 },
  { id: "jitter-text-3", t: 5.2 },
  // welcome-header: constant opacity=1 after camera finishes; scale=1 immediately.
  // (opacity was already driven to 0.98 by the Camera sheet during hold.)
  { id: "welcome-header", t: 0, welcomeHeader: true },
];

const itemsLength =
  5.2 + EACH_DUR + 0.1; // last jitter text end + a little slack

const itemIntrosEntries = [];
for (const item of ITEM_INTROS) {
  const { id, t, hero, welcomeHeader } = item;

  if (welcomeHeader) {
    itemIntrosEntries.push({
      objectId: id,
      propPath: "opacity",
      track: constTrack(`${id} / opacity`, 1),
    });
    itemIntrosEntries.push({
      objectId: id,
      propPath: "scale",
      track: constTrack(`${id} / scale`, 1),
    });
    continue;
  }

  // opacity
  itemIntrosEntries.push({
    objectId: id,
    propPath: "opacity",
    track: hero
      ? constTrack(`${id} / opacity`, 1)
      : animTrack(`${id} / opacity`, t, 0, t + EACH_DUR, 1, H_BACK_OUT),
  });

  // scale
  const scaleEase = hero ? H_POWER2_OUT : H_BACK_OUT;
  itemIntrosEntries.push({
    objectId: id,
    propPath: "scale",
    track: animTrack(`${id} / scale`, t, 0.9, t + EACH_DUR, 1, scaleEase),
  });
}

// ─── Assemble state ───────────────────────────────────────────────────────────
const state = {
  definitionVersion: "0.4.0",
  revisionHistory: [],
  sheetsById: {
    Camera: buildSheet(cameraEntries, CAMERA_END),
    ItemIntros: buildSheet(itemIntrosEntries, itemsLength),
  },
};

await writeFile(OUT, JSON.stringify(state, null, 2) + "\n", "utf8");
console.log(`theatre-state: wrote ${OUT}`);
console.log(`  Camera sheet: ${CAMERA_END}s`);
console.log(`  ItemIntros sheet: ${itemsLength.toFixed(2)}s, ${ITEM_INTROS.length} items`);
