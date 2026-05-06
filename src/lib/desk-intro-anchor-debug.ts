/**
 * Enable with either:
 * - `NEXT_PUBLIC_DESK_INTRO_ANCHOR_DEBUG=true` (rebuild dev server), or
 * - in DevTools: `localStorage.setItem("deskIntroAnchorDebug", "1")` + refresh
 */
export function deskIntroAnchorDebugEnabled(): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  if (process.env.NEXT_PUBLIC_DESK_INTRO_ANCHOR_DEBUG === "true") {
    return true;
  }
  try {
    return window.localStorage?.getItem("deskIntroAnchorDebug") === "1";
  } catch {
    return false;
  }
}

/** Pass this as the first arg to `console.info` / `console.debug` copy-pastes. */
export const DESK_INTRO_ANCHOR_LOG_PREFIX = "[desk-intro-anchor]" as const;
