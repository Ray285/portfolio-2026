/**
 * Fixes corrupt array-form tracks (["opacity"], ["scale"]) in the merged Camera sheet.
 *
 * Background: Theatre.js Studio adds internal array-form tracks (["opacity"]) alongside
 * the named string-form tracks (opacity). When a previous session applied offsets, the
 * array-form tracks ended up with wrong positions (negative → now ~9s after +12.609 merge).
 *
 * Fix: remap trackIdByPropPath["[\"opacity\"]"] → the string-form track ID (which has
 * correct 12.609+ positions), then delete the orphaned corrupt array-form track data.
 * Theatre.js will then use the correct string-form keyframes for onValuesChange.
 */

import { readFileSync, writeFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const jsonPath = join(__dirname, "../public/Portfolio.theatre-project-state-v1.json");

const state = JSON.parse(readFileSync(jsonPath, "utf8"));
const cameraSheet = state.sheetsById["Camera"];

const CAMERA_ONLY = new Set(["CameraRig", "WelcomeHeader"]);

let fixed = 0;

for (const [objId, objData] of Object.entries(cameraSheet.sequence.tracksByObject)) {
  if (CAMERA_ONLY.has(objId)) continue;

  const { trackData, trackIdByPropPath } = objData;

  // Fix ["opacity"] → remap to string-form opacity track
  const arrayOpacityKey = '["opacity"]';
  const stringOpacityKey = "opacity";
  if (
    trackIdByPropPath[arrayOpacityKey] &&
    trackIdByPropPath[stringOpacityKey] &&
    trackIdByPropPath[arrayOpacityKey] !== trackIdByPropPath[stringOpacityKey]
  ) {
    const oldTrackId = trackIdByPropPath[arrayOpacityKey];
    trackIdByPropPath[arrayOpacityKey] = trackIdByPropPath[stringOpacityKey];
    delete trackData[oldTrackId];
    console.log(`${objId}: remapped ["opacity"] ${oldTrackId} → ${trackIdByPropPath[stringOpacityKey]}`);
    fixed++;
  }

  // Fix ["scale"] → remap to string-form scale track
  const arrayScaleKey = '["scale"]';
  const stringScaleKey = "scale";
  if (
    trackIdByPropPath[arrayScaleKey] &&
    trackIdByPropPath[stringScaleKey] &&
    trackIdByPropPath[arrayScaleKey] !== trackIdByPropPath[stringScaleKey]
  ) {
    const oldTrackId = trackIdByPropPath[arrayScaleKey];
    trackIdByPropPath[arrayScaleKey] = trackIdByPropPath[stringScaleKey];
    delete trackData[oldTrackId];
    console.log(`${objId}: remapped ["scale"] ${oldTrackId} → ${trackIdByPropPath[stringScaleKey]}`);
    fixed++;
  }
}

writeFileSync(jsonPath, JSON.stringify(state, null, 2));
console.log(`\nFixed ${fixed} corrupt array-form track mappings.`);
