/**
 * Merges the `ItemIntros` Theatre.js sheet into the `Camera` sheet.
 *
 * All ItemIntros keyframe positions are offset by the Camera sheet length
 * (12.609s) so items animate after the camera zoom-out completes.
 * Static overrides for ItemIntros objects are cleared so items are invisible
 * during the camera phase (Theatre.js flat-extrapolates from the first keyframe,
 * which is at 12.609+, so opacity reads 0 before that point).
 */

import { readFileSync, writeFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const jsonPath = join(__dirname, "../public/Portfolio.theatre-project-state-v1.json");

const state = JSON.parse(readFileSync(jsonPath, "utf8"));

const cameraSheet = state.sheetsById["Camera"];
const itemIntrosSheet = state.sheetsById["ItemIntros"];

if (!cameraSheet) throw new Error("Camera sheet not found");
if (!itemIntrosSheet) throw new Error("ItemIntros sheet not found");

const OFFSET = cameraSheet.sequence.length; // 12.609
console.log(`Offsetting ItemIntros keyframes by +${OFFSET}s`);

// Offset every keyframe position in every track of every object in ItemIntros.
for (const [objId, objData] of Object.entries(itemIntrosSheet.sequence.tracksByObject)) {
  for (const [trackId, trackData] of Object.entries(objData.trackData)) {
    for (const kf of trackData.keyframes) {
      kf.position = parseFloat((kf.position + OFFSET).toFixed(6));
    }
    console.log(`  ${objId} / ${trackData.__debugName}: ${trackData.keyframes.length} keyframe(s) offset`);
  }
}

// Merge ItemIntros tracksByObject into Camera tracksByObject.
Object.assign(cameraSheet.sequence.tracksByObject, itemIntrosSheet.sequence.tracksByObject);

// Update Camera sheet sequence length.
const newLength = OFFSET + itemIntrosSheet.sequence.length;
cameraSheet.sequence.length = parseFloat(newLength.toFixed(6));
console.log(`Camera sheet length: ${OFFSET} → ${cameraSheet.sequence.length}`);

// Clear staticOverrides for ItemIntros objects (items must start invisible).
// The Camera sheet's staticOverrides.byObject is already empty; keep it that way.
// (ItemIntros staticOverrides are intentionally discarded — they were Studio artefacts.)

// Remove the ItemIntros sheet.
delete state.sheetsById["ItemIntros"];

writeFileSync(jsonPath, JSON.stringify(state, null, 2));
console.log("Done. Portfolio.theatre-project-state-v1.json updated.");
