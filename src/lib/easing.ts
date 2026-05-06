/**
 * Named easing curves for desk intro / item animations.
 * `t` is linear progress in [0, 1].
 */

export const EASING_NAMES = [
  "linear",
  "easeInQuad",
  "easeOutQuad",
  "easeInOutQuad",
  "easeInCubic",
  "easeOutCubic",
  "easeInOutCubic",
  "easeInQuart",
  "easeOutQuart",
  "easeInOutQuart",
] as const;

export type EasingName = (typeof EASING_NAMES)[number];

function isEasingName(s: string): s is EasingName {
  return (EASING_NAMES as readonly string[]).includes(s);
}

export function getEasing(name: string): (t: number) => number {
  if (isEasingName(name)) {
    return easingByName[name];
  }
  return easeOutCubic;
}

export function easeLinear(t: number): number {
  return t;
}

export function easeInQuad(t: number): number {
  return t * t;
}

export function easeOutQuad(t: number): number {
  return 1 - (1 - t) * (1 - t);
}

export function easeInOutQuad(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
}

export function easeInCubic(t: number): number {
  return t * t * t;
}

export function easeOutCubic(t: number): number {
  return 1 - (1 - t) ** 3;
}

export function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
}

export function easeInQuart(t: number): number {
  return t * t * t * t;
}

export function easeOutQuart(t: number): number {
  return 1 - (1 - t) ** 4;
}

export function easeInOutQuart(t: number): number {
  return t < 0.5 ? 8 * t * t * t * t : 1 - (-2 * t + 2) ** 4 / 2;
}

const easingByName: Record<EasingName, (t: number) => number> = {
  linear: easeLinear,
  easeInQuad,
  easeOutQuad,
  easeInOutQuad,
  easeInCubic,
  easeOutCubic,
  easeInOutCubic,
  easeInQuart,
  easeOutQuart,
  easeInOutQuart,
};

/** Remap `t` through an easing function, clamped to [0, 1]. */
export function applyEasing(t: number, easing: (u: number) => number): number {
  const c = Math.min(1, Math.max(0, t));
  return easing(c);
}
