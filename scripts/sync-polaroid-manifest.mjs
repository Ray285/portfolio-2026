/**
 * Scans public/polaroids/ and ensures every image file has an entry in
 * public/polaroid-manifest.json. New files are appended with defaults;
 * existing entries are never removed or reordered so manual edits are preserved.
 *
 * Run via: node scripts/sync-polaroid-manifest.mjs
 * Hooked into: "predev" and "prebuild" in package.json
 */

import { readdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, extname, basename } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const ROOT = join(__dirname, "..");
const POLAROIDS_DIR = join(ROOT, "public", "polaroids");
const MANIFEST_PATH = join(ROOT, "public", "polaroid-manifest.json");
const IMAGE_EXTS = new Set([".jpg", ".jpeg", ".png", ".gif", ".webp", ".webm"]);

function slugFromFilename(file) {
  return basename(file, extname(file))
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

async function main() {
  // Read existing manifest
  let manifest = { version: 1, items: [] };
  if (existsSync(MANIFEST_PATH)) {
    const raw = await readFile(MANIFEST_PATH, "utf8");
    manifest = JSON.parse(raw);
  }

  // Index existing file-based entries by filename
  const knownFiles = new Set(
    manifest.items.filter((i) => i.file).map((i) => i.file),
  );

  // Scan polaroids directory
  let files = [];
  try {
    files = await readdir(POLAROIDS_DIR);
  } catch {
    // Directory doesn't exist yet — nothing to sync
    return;
  }

  const imageFiles = files
    .filter((f) => IMAGE_EXTS.has(extname(f).toLowerCase()))
    .sort();

  let added = 0;
  for (const file of imageFiles) {
    if (knownFiles.has(file)) continue;
    const slug = slugFromFilename(file);
    manifest.items.push({ file, slug, title: "", caption: "" });
    added++;
    console.log(`  + ${file} → slug "${slug}"`);
  }

  await writeFile(MANIFEST_PATH, JSON.stringify(manifest, null, 2) + "\n", "utf8");

  if (added > 0) {
    console.log(`sync-polaroid-manifest: added ${added} new item(s) to polaroid-manifest.json`);
  }
}

main().catch((err) => {
  console.error("sync-polaroid-manifest failed:", err);
  process.exit(1);
});
