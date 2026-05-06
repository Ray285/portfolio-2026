/**
 * Shared tick queue for polaroid raster animations ({@link useAnimatedImageTexture}).
 * One R3F `useFrame` drives all clocks and schedules a single `invalidate()` when any
 * frame advanced (avoids N independent requestAnimationFrame loops per polaroid).
 */
export type AnimatedTextureTick = (deltaSec: number) => boolean;

const tickers = new Set<AnimatedTextureTick>();

export function registerAnimatedTextureTick(tick: AnimatedTextureTick): () => void {
  tickers.add(tick);
  return () => {
    tickers.delete(tick);
  };
}

/**
 * Runs all registered animations; returns true if anything requested a redraw
 * (decoder frame stepped or legacy repaint).
 */
export function runAnimatedTextureTicks(deltaSec: number): boolean {
  if (tickers.size === 0) return false;
  let dirty = false;
  for (const fn of tickers) {
    if (fn(deltaSec)) dirty = true;
  }
  return dirty;
}
