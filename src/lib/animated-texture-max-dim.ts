/**
 * Longest side (px) of each pre-decoded animation frame uploaded to the polaroid
 * `CanvasTexture`. Lower = less GPU/CPU and faster decode, higher = sharper.
 * 128 was too aggressive; 512 gives ~2× headroom for sharpness on high-DPI
 * views while capping 4K sources (still ~16× fewer pixels than 2048-wide).
 */
export const ANIMATED_TEXTURE_MAX_SOURCE_DIM = 512;
