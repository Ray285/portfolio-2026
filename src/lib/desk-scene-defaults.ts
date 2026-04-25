/**
 * Default camera, lights, and scene tuning. These values are mirrored in
 * `DeskControlsContext` defaults and the Scene panel. Live edits are stored in
 * context (not in this file).
 *
 * - **Camera** ([`DeskScene` `ResponsiveCamera`](src/components/desk/DeskScene.tsx)):
 *   world position + orthographic `zoom` factor (bigger = tighter crop).
 * - **Key light** (`KeyLight`): casts shadows; was `KEY_LIGHT_POSITION` in code.
 * - **Fill light** (`FillLight`): no shadow map, only fills dark sides.
 */
export const DEFAULT_CAMERA = {
  x: 0,
  y: 8,
  z: 0,
  /** Multiplier on the auto-fit zoom (1 = current behavior). */
  zoom: 1,
} as const;

export const DEFAULT_KEY_LIGHT = {
  x: -16,
  y: 30,
  z: -14,
} as const;

export const DEFAULT_FILL_LIGHT = {
  x: 10,
  y: 14,
  z: 12,
} as const;
