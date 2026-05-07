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
  /** Reference height for `ResponsiveCamera` zoom trade-off; also the default & JSON rest pose. */
  y: 6.5,
  /** Centres the orthographic view on the content, which extends from Z≈-3.1
   *  (card top edges) to Z≈+3.7 (bottom polaroid row), midpoint ≈ +0.3. */
  z: 0.3,
  /** Multiplier on the auto-fit zoom (1 = current behavior). */
  zoom: 1,
} as const;

/**
 * Bounds for camera X / Z — used by Scene panel sliders and pointer/trackpad gesture pan in
 * `CameraViewControls`. Prevents unlimited pan into empty space off the desk; does not clamp
 * intro tweens or direct `setCamera` during one-shot animations.
 */
export const CAMERA_PAN_X_MIN = -4;
export const CAMERA_PAN_X_MAX = 4;
export const CAMERA_PAN_Z_MIN = -4;
export const CAMERA_PAN_Z_MAX = 4;

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

export const DEFAULT_SPOT_LIGHT = {
  x: -20,
  y: 12,
  z: -10,
} as const;
