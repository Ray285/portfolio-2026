import gsap from "gsap";

/** Timeline instance returned by `gsap.timeline()`. */
export type DeskIntroTimeline = ReturnType<typeof gsap.timeline>;

let currentIntro: DeskIntroTimeline | null = null;
const introListeners = new Set<(tl: DeskIntroTimeline | null) => void>();

/**
 * The **full** page-load intro: one `gsap.timeline()` created in
 * `StaggerGsapContext` (camera from `DeskLoadIntro`, then staggered props).
 * **GSDevTools** (`GsapDevToolsBridge`) subscribes here to scrub the whole thing.
 */
export function registerDeskIntroTimeline(tl: DeskIntroTimeline) {
  currentIntro = tl;
  introListeners.forEach((f) => f(tl));
}

export function unregisterDeskIntroTimeline(tl: DeskIntroTimeline) {
  if (currentIntro === tl) {
    currentIntro = null;
    introListeners.forEach((f) => f(null));
  }
}

export function getDeskIntroTimeline(): DeskIntroTimeline | null {
  return currentIntro;
}

export function subscribeDeskIntroTimeline(
  fn: (tl: DeskIntroTimeline | null) => void,
): () => void {
  introListeners.add(fn);
  fn(currentIntro);
  return () => {
    introListeners.delete(fn);
  };
}
