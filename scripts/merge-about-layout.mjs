/**
 * Merge Arrange export into `desk-layout-about.json`:
 * - Copies all non-`polaroid-*` keys (cards, loops, desk-text, `about-polaroid-*`, …).
 * - Maps legacy `polaroid-N` → `about-polaroid-<stem>` using `ABOUT_POLAROID_FILES[N]` only
 *   when the new key is not already present.
 * - Re-applies explicit `about-polaroid-*` entries so they always win over `polaroid-*` fills.
 *
 * Usage: `node scripts/merge-about-layout.mjs path/to/export.json`
 */
import fs from "node:fs";

const ts = fs.readFileSync("src/lib/portfolio-data.ts", "utf8");
const m = ts.match(/const ABOUT_POLAROID_FILES = \[([\s\S]*?)\] as const/);
if (!m) throw new Error("ABOUT_POLAROID_FILES not found in portfolio-data.ts");
const FILES = [...m[1].matchAll(/"([^"]+)"/g)].map((x) => x[1]);

function slug(file) {
  return file.replace(/\.[^.]+$/, "");
}

/** Omit argv / `-` → stdin; else path to Arrange JSON export. */
const userPath = process.argv[2];
const rawText =
  userPath && userPath !== "-"
    ? fs.readFileSync(userPath, "utf8")
    : fs.readFileSync(0, "utf8");

const raw = JSON.parse(rawText);
const userItems = raw.items ?? {};
const items = {};

for (const [k, v] of Object.entries(userItems)) {
  if (k.startsWith("polaroid-")) continue;
  items[k] = v;
}

for (const [k, v] of Object.entries(userItems)) {
  if (!k.startsWith("polaroid-")) continue;
  const idx = Number(k.slice("polaroid-".length));
  if (!Number.isFinite(idx) || idx < 0 || idx >= FILES.length) continue;
  const nk = `about-polaroid-${slug(FILES[idx])}`;
  if (!(nk in items)) items[nk] = v;
}

for (const [k, v] of Object.entries(userItems)) {
  if (k.startsWith("about-polaroid-")) items[k] = v;
}

const out = {
  version: raw.version ?? 1,
  items,
  ball: raw.ball ?? [-6.67, 5.46],
};

fs.writeFileSync(
  "src/data/desk-layout-about.json",
  JSON.stringify(out, null, 2) + "\n",
);
console.log("Wrote src/data/desk-layout-about.json", {
  keys: Object.keys(items).length,
  tumblr_m3sdgu: Object.prototype.hasOwnProperty.call(
    items,
    "about-polaroid-tumblr_m3sdguCMIj1r9bpg5o1_500",
  ),
});
