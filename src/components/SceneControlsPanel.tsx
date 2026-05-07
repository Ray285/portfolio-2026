"use client";

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { useDeskControls } from "@/context/DeskControlsContext";
import type { DeskControls } from "@/context/DeskControlsContext";
import { useDeskLayout } from "@/context/DeskLayoutContext";
import { useDeskSceneId } from "@/context/DeskSceneContext";
import { CAMERA_Y_MAX } from "@/lib/desk-camera-y-bounds";
import {
  CAMERA_PAN_X_MAX,
  CAMERA_PAN_X_MIN,
  CAMERA_PAN_Z_MAX,
  CAMERA_PAN_Z_MIN,
} from "@/lib/desk-scene-defaults";
import {
  clampDeskItemBaseY,
  clampDeskItemLayoutScale,
  DESK_ITEM_BASE_Y_MAX,
  DESK_ITEM_BASE_Y_MIN,
  DESK_ITEM_BASE_Y_STEP,
  DESK_ITEM_LAYOUT_SCALE_MAX,
  DESK_ITEM_LAYOUT_SCALE_MIN,
  getDeskLayoutStorageKey,
} from "@/lib/desk-layout";

const ARRANGE_ITEM_FALLBACK = {
  position: [0, 0.08, 0] as [number, number, number],
  rotation: [0, 0, 0] as [number, number, number],
  scale: 1,
};

type SliderConfig = {
  key: keyof DeskControls;
  label: string;
  description: string;
  min: number;
  max: number;
  step: number;
};

const SECTIONS: { title: string; items: SliderConfig[] }[] = [
  {
    title: "Camera (orthographic, top view)",
    items: [
      {
        key: "cameraX",
        label: "Camera X",
        description:
          "Moves the view left or right in world space. " +
          "The camera still looks straight down, so this pans the frame horizontally on screen.",
        min: CAMERA_PAN_X_MIN,
        max: CAMERA_PAN_X_MAX,
        step: 0.05,
      },
      {
        key: "cameraY",
        label: "Camera Y (height)",
        description:
          "World height of the camera above the table. " +
          "For an ortho camera, moving only along the view line does not change the image, so this is paired with a zoom factor (relative to the default in desk-scene-defaults) so higher Y shows more of the scene and lower Y crops tighter.",
        min: 4,
        max: CAMERA_Y_MAX,
        step: 0.05,
      },
      {
        key: "cameraZ",
        label: "Camera Z",
        description:
          "Pans the view forward and back on the table. " +
          "Use with X to re-center the subject without changing the tilt of the camera.",
        min: CAMERA_PAN_Z_MIN,
        max: CAMERA_PAN_Z_MAX,
        step: 0.05,
      },
      {
        key: "cameraZoom",
        label: "Camera zoom scale",
        description:
          "Multiplies the auto-fitted zoom so you can crop tighter or see more of the desk. " +
          "Values above one zoom in; below one show more of the surface.",
        min: 0.55,
        max: 1.45,
        step: 0.01,
      },
    ],
  },
  {
    title: "Key light (shadows)",
    items: [
      {
        key: "keyLightX",
        label: "Key X",
        description:
          "Main shadow-casting light position on the world X axis. " +
          "It defines where strong sunlight comes from; pairs with Y and Z to aim it.",
        min: -35,
        max: 15,
        step: 0.5,
      },
      {
        key: "keyLightY",
        label: "Key Y",
        description:
          "Height of the key light. " +
          "Lower values make shadows longer and more dramatic; higher values soften the angle on props.",
        min: 8,
        max: 45,
        step: 0.5,
      },
      {
        key: "keyLightZ",
        label: "Key Z",
        description:
          "Depth of the key light along the table. " +
          "Adjust it with X so shadows fall the direction you want on the flat-lay view.",
        min: -30,
        max: 15,
        step: 0.5,
      },
      {
        key: "keyLight",
        label: "Key intensity",
        description:
          "Brightness of the main directional. " +
          "It drives the primary highlights and the strength of cast shadows when paired with ambient fill.",
        min: 0,
        max: 5,
        step: 0.05,
      },
      {
        key: "shadowRadius",
        label: "Key shadow softening",
        description:
          "Blurs the PCF shadow map for softer penumbra on the ground. " +
          "Increase for gentle edges; if you see banding, nudge the bias in code instead of maxing this out.",
        min: 0,
        max: 20,
        step: 0.5,
      },
    ],
  },
  {
    title: "Fill light (no extra shadows)",
    items: [
      {
        key: "fillLightX",
        label: "Fill X",
        description:
          "Horizontal position of a second light that only brightens, without casting another shadow. " +
          "It lifts shadowed sides of cards and polas for readability.",
        min: -15,
        max: 25,
        step: 0.5,
      },
      {
        key: "fillLightY",
        label: "Fill Y",
        description:
          "Vertical height of the fill light. " +
          "It should usually stay a bit below the key so the scene keeps a clear primary direction.",
        min: 6,
        max: 30,
        step: 0.5,
      },
      {
        key: "fillLightZ",
        label: "Fill Z",
        description:
          "Depth placement of the fill so it bounces from a complementary angle to the key. " +
          "Small moves can fix props that look too dark on one long edge.",
        min: -12,
        max: 22,
        step: 0.5,
      },
      {
        key: "fillLight",
        label: "Fill intensity",
        description:
          "How strong the second light is. " +
          "It adds gentle illumination without a second set of hard-edged contact shadows in the map.",
        min: 0,
        max: 1,
        step: 0.01,
      },
    ],
  },
  {
    title: "Global lighting and tone",
    items: [
      {
        key: "ambient",
        label: "Ambient",
        description:
          "Omnidirectional base light that softens the darkest crevices. " +
          "High values can flatten the image; very low values keep contrast punchy on props.",
        min: 0,
        max: 1,
        step: 0.01,
      },
      {
        key: "hemisphere",
        label: "Hemisphere",
        description:
          "Sky-and-ground style fill with a cool upper and warm lower tint. " +
          "It gently shapes large surfaces; keep it small if you want a cleaner white desk read.",
        min: 0,
        max: 0.4,
        step: 0.01,
      },
      {
        key: "environment",
        label: "Environment IBL",
        description:
          "Image-based lighting from the studio environment map. " +
          "It adds specular and reflections on PBR materials; turn it down if surfaces look too glossy on white.",
        min: 0,
        max: 0.3,
        step: 0.01,
      },
      {
        key: "exposure",
        label: "Exposure",
        description:
          "Global tone-mapping exposure for the whole rendered frame. " +
          "Use it for quick brightness; pair with ambient and the key to avoid pure white clipping.",
        min: 0.5,
        max: 1.5,
        step: 0.01,
      },
    ],
  },
  {
    title: "Spot light (window light)",
    items: [
      {
        key: "spotLightX",
        label: "Spot X",
        description:
          "Horizontal world position of the spot light. Negative = left of the desk (upper-left window feel).",
        min: -30,
        max: 10,
        step: 0.5,
      },
      {
        key: "spotLightY",
        label: "Spot Y",
        description:
          "Height of the spot light above the desk. Higher = shallower angle, smaller shadow elongation.",
        min: 4,
        max: 25,
        step: 0.5,
      },
      {
        key: "spotLightZ",
        label: "Spot Z",
        description:
          "Depth position of the spot light. Pair with X to aim it at the part of the desk you want lit.",
        min: -20,
        max: 10,
        step: 0.5,
      },
      {
        key: "spotLightIntensity",
        label: "Intensity",
        description:
          "Brightness of the spot. Keep it subtle relative to the key light so you get warm pooling, not a blown-out circle.",
        min: 0,
        max: 10,
        step: 0.1,
      },
      {
        key: "spotLightAngle",
        label: "Cone angle (rad)",
        description:
          "Half-angle of the cone in radians. Smaller = tighter beam; larger = wider lit pool on the desk.",
        min: 0.1,
        max: 1.2,
        step: 0.01,
      },
      {
        key: "spotLightPenumbra",
        label: "Penumbra",
        description:
          "Softness of the cone edge (0 = hard cutoff, 1 = fully graduated). High values give a natural window-light fade.",
        min: 0,
        max: 1,
        step: 0.01,
      },
    ],
  },
  {
    title: "Contact shadows and polaroid",
    items: [
      {
        key: "contactOpacity",
        label: "Contact shadow opacity",
        description:
          "How dark the fake contact shadow is under each prop. " +
          "It is a post-style blur on the ground, not the same as the key shadow, but it sells grounding.",
        min: 0,
        max: 0.4,
        step: 0.01,
      },
      {
        key: "contactBlur",
        label: "Contact blur",
        description:
          "Softness of the contact shadow puddle. " +
          "Higher values spread the darkening; lower values look sharper under thin edges.",
        min: 0,
        max: 5,
        step: 0.1,
      },
      {
        key: "contactScale",
        label: "Contact scale",
        description:
          "World size of the contact shadow pass. " +
          "Enlarge it if the soft shadow clips at the edge of the desk; shrink if the dark area is too big.",
        min: 10,
        max: 50,
        step: 1,
      },
      {
        key: "polaroidPrintScale",
        label: "Print size in frame",
        description:
          "How much of the white inner area the image uses, like object-fit. " +
          "One is maximum print area; lower values add more border around the photo inside the same frame.",
        min: 0.85,
        max: 1,
        step: 0.01,
      },
    ],
  },
];

function formatValue(key: keyof DeskControls, v: number): string {
  if (key === "contactScale" || key === "shadowRadius") {
    return v.toFixed(1);
  }
  return v.toFixed(2);
}

export function SceneControlsPanel() {
  const scene = useDeskSceneId();
  const layoutStorageKey = getDeskLayoutStorageKey(scene);
  const {
    controls,
    set,
    reset,
    arrangeMode,
    setArrangeMode,
    selectedLayoutId,
    selectedLayoutIds,
  } = useDeskControls();
  const {
    exportJson,
    importJson,
    clear: clearSavedLayout,
    getItem,
    recordItem,
  } = useDeskLayout();
  const [layoutPaste, setLayoutPaste] = useState("");
  const [layoutHint, setLayoutHint] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  const copyLayout = useCallback(async () => {
    const s = exportJson();
    setLayoutHint(null);
    try {
      await navigator.clipboard.writeText(s);
      setLayoutHint("Copied to clipboard.");
    } catch {
      setLayoutHint("Copy failed — select the file from devtools or download.");
    }
  }, [exportJson]);

  const applyLayoutPaste = useCallback(() => {
    const r = importJson(layoutPaste);
    if (r.ok) {
      setLayoutHint("Imported. Positions should update on the desk.");
    } else {
      setLayoutHint(r.error);
    }
  }, [importJson, layoutPaste]);

  /** Arrange mode: `[` / `]` step baseline Y (stack order) for the selected item. */
  useEffect(() => {
    if (!arrangeMode || selectedLayoutId == null) {
      return;
    }
    const layoutId = selectedLayoutId;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== "[" && e.key !== "]") {
        return;
      }
      const t = e.target;
      if (
        t instanceof HTMLInputElement ||
        t instanceof HTMLTextAreaElement ||
        (t instanceof HTMLElement && t.isContentEditable)
      ) {
        return;
      }
      e.preventDefault();
      const cur = getItem(layoutId, ARRANGE_ITEM_FALLBACK);
      const delta =
        e.key === "]" ? DESK_ITEM_BASE_Y_STEP : -DESK_ITEM_BASE_Y_STEP;
      const nextY = clampDeskItemBaseY(cur.position[1] + delta);
      recordItem(layoutId, {
        ...cur,
        position: [cur.position[0], nextY, cur.position[2]],
      });
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [arrangeMode, selectedLayoutId, getItem, recordItem]);

  const keys = useMemo(
    () => new Set(SECTIONS.flatMap((s) => s.items.map((i) => i.key))),
    [],
  );

  return (
    <div className="pointer-events-auto fixed right-0 top-0 z-50 w-[min(22rem,92vw)] border-b border-l border-zinc-200/80 bg-white/95 shadow-lg backdrop-blur-sm sm:rounded-bl-lg sm:border-t-0 sm:border-l">
      <div className="flex items-center justify-between gap-2 p-3 touch-manipulation">
        <h2 className="text-xs font-semibold tracking-wide text-zinc-800">
          Scene
        </h2>
        <div className="flex items-center gap-1.5">
          {open && (
            <button
              type="button"
              onClick={reset}
              className="rounded border border-zinc-300 bg-white px-2 py-0.5 text-[10px] text-zinc-600 hover:border-zinc-500 hover:text-zinc-900"
            >
              Reset
            </button>
          )}
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-label={open ? "Collapse panel" : "Expand panel"}
            className="rounded border border-zinc-300 bg-white px-2 py-0.5 text-[10px] text-zinc-600 hover:border-zinc-500 hover:text-zinc-900"
          >
            {open ? "▲" : "▼"}
          </button>
        </div>
      </div>
      {open && <div className="max-h-[calc(100dvh-3rem)] overflow-y-auto border-t border-zinc-200/80 p-3 pt-2">
      <div className="mb-3 rounded border border-amber-200/90 bg-amber-50/80 p-2">
        <label className="flex cursor-pointer items-start gap-2">
          <input
            type="checkbox"
            className="mt-0.5"
            checked={arrangeMode}
            onChange={(e) => setArrangeMode(e.target.checked)}
          />
          <span>
            <span className="text-[10px] font-medium text-amber-950">
              Arrange desk
            </span>
            <span className="mt-0.5 block text-[8px] leading-relaxed text-amber-900/80">
              Click a prop to select (ring appears), drag the body to move on the
              table, drag the ring to rotate. With a selection: wheel / trackpad
              scales; use the controls below for lift (Y, stack order) and
              precise size. Buttons or [ / ] nudge lift by a small step. While
              arrange is on, single-clicks do not open links. Press Escape to
              clear selection.
            </span>
          </span>
        </label>
      </div>
      {arrangeMode && selectedLayoutId ? (
        <div className="mb-3 rounded border border-zinc-200 bg-zinc-50/90 p-2">
          {selectedLayoutIds.length > 1 ? (
            <p className="mb-2 rounded bg-zinc-100/90 px-1.5 py-1 text-[9px] leading-snug text-zinc-600">
              {selectedLayoutIds.length} items selected. Sliders edit the
              primary only ({selectedLayoutId}). Dragging on canvas moves every
              selected item together (Shift-click to toggle).
            </p>
          ) : null}
          <div className="mb-1 flex items-baseline justify-between gap-1">
            <span className="text-[10px] font-medium text-zinc-700">
              Lift — stack order (baseline Y)
            </span>
            <span className="shrink-0 text-[9px] tabular-nums text-zinc-500">
              {clampDeskItemBaseY(
                getItem(selectedLayoutId, ARRANGE_ITEM_FALLBACK).position[1],
              ).toFixed(4)}
            </span>
          </div>
          <div className="mb-1 flex gap-1">
            <button
              type="button"
              className="min-w-8 rounded border border-zinc-300 bg-white px-2 py-0.5 text-[11px] font-medium text-zinc-700 hover:border-zinc-500"
              aria-label="Decrease lift"
              onClick={() => {
                const cur = getItem(selectedLayoutId, ARRANGE_ITEM_FALLBACK);
                const nextY = clampDeskItemBaseY(
                  cur.position[1] - DESK_ITEM_BASE_Y_STEP,
                );
                recordItem(selectedLayoutId, {
                  ...cur,
                  position: [cur.position[0], nextY, cur.position[2]],
                });
              }}
            >
              −
            </button>
            <button
              type="button"
              className="min-w-8 rounded border border-zinc-300 bg-white px-2 py-0.5 text-[11px] font-medium text-zinc-700 hover:border-zinc-500"
              aria-label="Increase lift"
              onClick={() => {
                const cur = getItem(selectedLayoutId, ARRANGE_ITEM_FALLBACK);
                const nextY = clampDeskItemBaseY(
                  cur.position[1] + DESK_ITEM_BASE_Y_STEP,
                );
                recordItem(selectedLayoutId, {
                  ...cur,
                  position: [cur.position[0], nextY, cur.position[2]],
                });
              }}
            >
              +
            </button>
          </div>
          <input
            aria-label="Selected item baseline height above desk for stacking"
            className="h-1 w-full cursor-pointer appearance-none rounded bg-zinc-200 accent-zinc-800"
            type="range"
            min={DESK_ITEM_BASE_Y_MIN}
            max={DESK_ITEM_BASE_Y_MAX}
            step={DESK_ITEM_BASE_Y_STEP}
            value={clampDeskItemBaseY(
              getItem(selectedLayoutId, ARRANGE_ITEM_FALLBACK).position[1],
            )}
            onChange={(e) => {
              const nextY = clampDeskItemBaseY(Number(e.target.value));
              const cur = getItem(selectedLayoutId, ARRANGE_ITEM_FALLBACK);
              recordItem(selectedLayoutId, {
                ...cur,
                position: [cur.position[0], nextY, cur.position[2]],
              });
            }}
          />
          <p className="mt-1 text-[8px] leading-relaxed text-zinc-500">
            Higher values draw in front when props overlap (top-down camera).
            Drag on the desk still moves X / Z only. Keyboard{" "}
            <kbd className="rounded bg-zinc-100 px-0.5 font-mono text-[8px]">
              [
            </kbd>{" "}
            /{" "}
            <kbd className="rounded bg-zinc-100 px-0.5 font-mono text-[8px]">
              ]
            </kbd>{" "}
            nudge by {DESK_ITEM_BASE_Y_STEP} world units.
          </p>

          <div className="mt-3 border-t border-zinc-200/90 pt-3">
            <div className="mb-1 flex items-baseline justify-between gap-1">
              <span className="text-[10px] font-medium text-zinc-700">
                Selected item scale
              </span>
              <span className="shrink-0 text-[9px] tabular-nums text-zinc-500">
                {clampDeskItemLayoutScale(
                  getItem(selectedLayoutId, ARRANGE_ITEM_FALLBACK).scale ?? 1,
                ).toFixed(2)}
              </span>
            </div>
            <input
              aria-label="Selected draggable layout scale"
              className="h-1 w-full cursor-pointer appearance-none rounded bg-zinc-200 accent-zinc-800"
              type="range"
              min={DESK_ITEM_LAYOUT_SCALE_MIN}
              max={DESK_ITEM_LAYOUT_SCALE_MAX}
              step={0.02}
              value={clampDeskItemLayoutScale(
                getItem(selectedLayoutId, ARRANGE_ITEM_FALLBACK).scale ?? 1,
              )}
              onChange={(e) => {
                const v = clampDeskItemLayoutScale(Number(e.target.value));
                const cur = getItem(selectedLayoutId, ARRANGE_ITEM_FALLBACK);
                recordItem(selectedLayoutId, { ...cur, scale: v });
              }}
            />
            <p className="mt-1 text-[8px] leading-relaxed text-zinc-500">
              Applies to{" "}
              <code className="rounded bg-zinc-100 px-0.5">
                {selectedLayoutId}
              </code>
              . Matches wheel scaling on the canvas while arrange mode is on.
            </p>
          </div>
        </div>
      ) : null}
      <p className="mb-1.5 text-[9px] leading-relaxed text-zinc-500">
        Panel edits are live only. To persist: export below, drop{" "}
        <code className="rounded bg-zinc-100 px-0.5">desk-scene-config.json</code>{" "}
        in <code className="rounded bg-zinc-100 px-0.5">public/</code>, reload.
      </p>
      <div className="mb-3 flex flex-wrap gap-1.5">
        <button
          type="button"
          onClick={() => {
            const json = JSON.stringify({ version: 1, controls }, null, 2);
            const a = document.createElement("a");
            a.href = `data:application/json;charset=utf-8,${encodeURIComponent(json)}`;
            a.download = "desk-scene-config.json";
            a.click();
          }}
          className="rounded border border-zinc-300 bg-white px-2 py-0.5 text-[10px] text-zinc-600 hover:border-zinc-500 hover:text-zinc-900"
        >
          Export scene config
        </button>
      </div>
      {SECTIONS.map((section) => (
        <Fragment key={section.title}>
          <h3 className="mb-1.5 mt-3 first:mt-0 text-[10px] font-bold uppercase tracking-wider text-zinc-500">
            {section.title}
          </h3>
          <ul className="mb-1 flex flex-col gap-3">
            {section.items.map((s) => (
              <li key={s.key}>
                <div className="mb-0.5 flex items-baseline justify-between gap-1">
                  <label
                    className="text-[10px] font-medium text-zinc-700"
                    htmlFor={`desk-${String(s.key)}`}
                  >
                    {s.label}
                  </label>
                  <span className="shrink-0 text-[9px] tabular-nums text-zinc-500">
                    {formatValue(s.key, Number(controls[s.key]))}
                  </span>
                </div>
                <p className="mb-1 text-[8px] leading-relaxed text-zinc-500">
                  {s.description}
                </p>
                <input
                  id={`desk-${String(s.key)}`}
                  className="h-1 w-full cursor-pointer appearance-none rounded bg-zinc-200 accent-zinc-800"
                  type="range"
                  min={s.min}
                  max={s.max}
                  step={s.step}
                  value={Number(controls[s.key])}
                  onChange={(e) => {
                    set(s.key, Number(e.target.value) as never);
                  }}
                />
              </li>
            ))}
          </ul>
        </Fragment>
      ))}
      {(() => {
        const defined = keys;
        const allKeys = Object.keys(controls) as (keyof DeskControls)[];
        const extra = allKeys.filter((k) => !defined.has(k));
        if (extra.length === 0) {
          return null;
        }
        return (
          <p className="mt-1 text-[8px] text-amber-700">
            Unlisted keys: {extra.join(", ")} (add to the panel if needed)
          </p>
        );
      })()}

      <h3 className="mb-1.5 mt-3 text-[10px] font-bold uppercase tracking-wider text-zinc-500">
        Desk layout (draggables)
      </h3>
      <p className="mb-2 text-[8px] leading-relaxed text-zinc-500">
        Positions, rotations, and per-item layout scale are saved to{" "}
        <code className="rounded bg-zinc-100 px-0.5">localStorage</code> as JSON
        under{" "}
        <code className="rounded bg-zinc-100 px-0.5">{layoutStorageKey}</code>{" "}
        (per route: <code className="rounded bg-zinc-100 px-0.5">…:about</code> for{" "}
        <code className="rounded bg-zinc-100 px-0.5">/about</code>){" "}
        when you <strong>finish dragging</strong> a card, photo, or prop,{" "}
        <strong>change scale</strong> (wheel or slider), and when the ball{" "}
        <strong>stops</strong> (or you release a soft nudge). Copy the file
        for backups or to share; paste and apply to load.
      </p>
      <div className="mb-2 flex flex-wrap gap-1.5">
        <button
          type="button"
          onClick={copyLayout}
          className="rounded border border-zinc-300 bg-white px-2 py-0.5 text-[10px] text-zinc-600 hover:border-zinc-500 hover:text-zinc-900"
        >
          Copy layout JSON
        </button>
        <button
          type="button"
          onClick={() => {
            const a = document.createElement("a");
            a.href = `data:application/json;charset=utf-8,${encodeURIComponent(exportJson())}`;
            a.download = "desk-layout.json";
            a.click();
            setLayoutHint("Download started.");
          }}
          className="rounded border border-zinc-300 bg-white px-2 py-0.5 text-[10px] text-zinc-600 hover:border-zinc-500 hover:text-zinc-900"
        >
          Download JSON
        </button>
        <button
          type="button"
          onClick={() => {
            clearSavedLayout();
            setLayoutHint(
              "Cleared browser save. The desk resets to the default layout in src/data/desk-layout.json until you move things again.",
            );
          }}
          className="rounded border border-amber-200 bg-amber-50/80 px-2 py-0.5 text-[10px] text-amber-900 hover:border-amber-400"
        >
          Clear saved
        </button>
      </div>
      <label className="mb-0.5 block text-[9px] font-medium text-zinc-600">
        Paste layout JSON, then apply
      </label>
      <textarea
        className="mb-1.5 min-h-[4.5rem] w-full resize-y rounded border border-zinc-200 bg-white px-1.5 py-1 font-mono text-[9px] text-zinc-800"
        value={layoutPaste}
        onChange={(e) => setLayoutPaste(e.target.value)}
        placeholder='{"version":1,"items":{...},"ball":[4.4,1.6]}'
        spellCheck={false}
      />
      <div className="mb-1 flex items-center gap-2">
        <button
          type="button"
          onClick={applyLayoutPaste}
          className="rounded border border-zinc-300 bg-zinc-900 px-2 py-0.5 text-[10px] text-white hover:bg-zinc-800"
        >
          Apply import
        </button>
        {layoutHint ? (
          <span className="text-[8px] text-zinc-600">{layoutHint}</span>
        ) : null}
      </div>
      </div>}
    </div>
  );
}
