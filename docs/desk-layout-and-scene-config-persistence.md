# Desk Layout & Scene Config Persistence

## How the two systems work

### Item positions (`desk-layout-v1.json`)

Priority chain (highest wins):

1. **`localStorage`** — per-browser, written every time the user drags/scales/moves an item or the ball. Key: `"portfolio-2026:desk-layout-v1"` (home scene).
2. **`/public/desk-layout-v1.json`** — fetched at runtime on mount if no `localStorage` entry exists. This is the canonical layout all visitors see. Edit this file to change the default arrangement.
3. **`/src/data/desk-layout.json`** — bundled at build time, used as the final fallback and as the reset target when "Clear Saved" is clicked. Contains the same shape as the public file plus `camera` and optional `intro`/`itemIntros` fields.

The fetch lives in `DeskLayoutProvider` (`src/context/DeskLayoutContext.tsx`). It only runs for the home scene and only when there is no existing `localStorage` entry, so repeat visitors keep their personal layout untouched.

### Light and color config (`desk-scene-config-v1.json`)

`DeskControlsContext` (`src/context/DeskControlsContext.tsx`) fetches `/desk-scene-config-v1.json` on every mount and merges it over the hardcoded `defaultControls`. There is no `localStorage` layer here — scene config is always server-authoritative.

---

## Updating the canonical layout

1. Open the site locally (`npm run dev`).
2. Turn on **Arrange mode** in the Scene Controls panel.
3. Drag items and the ball into the desired positions.
4. Click **Download JSON** in the panel — this saves `desk-layout.json`.
5. Rename the downloaded file to `desk-layout-v1.json` and drop it into `public/`.
6. Redeploy. All browsers without a saved layout will now see the new arrangement.

> To force your own browser to pick up the new file: open the Scene Controls panel and click **Clear Saved** — this removes your `localStorage` entry so the next page load fetches the public file.

---

## Updating the scene config

1. Tune lights and colors in the Scene Controls panel.
2. Click **Export Scene Config** — this saves `desk-scene-config.json`.
3. Rename it `desk-scene-config-v1.json` and drop it into `public/`.
4. Redeploy. All visitors get the new config immediately (no cache busting needed — `fetch` uses the browser's normal HTTP cache).

---

## File reference

| File | Role |
|------|------|
| `public/desk-layout-v1.json` | Canonical item positions fetched at runtime |
| `public/desk-scene-config-v1.json` | Canonical light/color config fetched at runtime |
| `src/data/desk-layout.json` | Bundled fallback + reset target for home scene |
| `src/data/desk-layout-about.json` | Bundled fallback for about scene (no public file equivalent) |
| `src/context/DeskLayoutContext.tsx` | Fetch logic + localStorage read/write |
| `src/context/DeskControlsContext.tsx` | Scene config fetch + controls state |
| `src/lib/desk-layout.ts` | Storage keys, validators, serializers |
| `src/lib/desk-default-layout.ts` | Loads bundled JSON at import time |

---

## Adding a public layout for the about scene

The about scene (`DESK_SCENE_ABOUT`) currently has no public file — it falls straight through to `src/data/desk-layout-about.json`. To add one:

1. Create `public/desk-layout-about-v1.json` with the arranged positions.
2. In the `useEffect` inside `DeskLayoutProvider` (`DeskLayoutContext.tsx`), extend the fetch:

```ts
const publicFile =
  scene === DESK_SCENE_HOME
    ? "/desk-layout-v1.json"
    : "/desk-layout-about-v1.json";
fetch(publicFile)
  ...
```
