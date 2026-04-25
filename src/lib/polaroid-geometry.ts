/**
 * World units for the polaroid block and the largest “window” the print is fit into.
 * Tight margins so the image fills more of the white area than the original layout.
 */
export const POLAROID_FRAME = {
  width: 1.44,
  height: 0.05,
  depth: 1.75,
} as const;

export const POLAROID_INNER_MAX = {
  width: 1.38,
  depth: 1.12,
} as const;

export const PHOTO_PLANE_Y = 0.034;
/** Offset toward the “top” of the polaroid (shallow bottom margin in screen space). */
export const PHOTO_PLANE_Z = -0.12;

const hw = POLAROID_FRAME.width / 2;
export const POLAROID_LABEL_X = -hw + 0.09;
export const POLAROID_CAPTION1_Z = 0.5;
export const POLAROID_CAPTION2_Z = 0.7;
