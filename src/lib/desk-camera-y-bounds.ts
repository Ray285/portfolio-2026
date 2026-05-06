/** Orthographic "zoom out" = higher Y; these bounds match `CameraViewControls` and the Scene panel. */
export const CAMERA_Y_MIN = 2;
export const CAMERA_Y_MAX = 4;

export function clampCameraY(y: number): number {
  return Math.max(CAMERA_Y_MIN, Math.min(CAMERA_Y_MAX, y));
}
