/**
 * Bridges **app easing names** (used in `desk-layout.json` and `easing.ts`) to
 * **GSAP ease** strings, so the same JSON can be read as CSS-like labels while
 * the camera intro tween gets valid GSAP values.
 *
 * **Camera intro (this file is used in `DeskLoadIntro`):**
 * - If `intro.easingGsap` is set in JSON, that string is passed through as-is
 *   (bypassing this table). Use the [GSAP ease docs](https://gsap.com/docs/v3/Plugins/EasePack)
 *   or the online visualizer to pick a string.
 * - Else `mapIntroEaseToGsap(intro.easing)` is used, where `intro.easing` is
 *   one of the keys in `NAMED_TO_GSAP` below (same vocabulary as `easing.ts`).
 *
 * **Prop stagger** (`StaggerGsapContext`) does **not** use this file; it reads
 * `staggerAfterCamera.ease` as a **raw** GSAP string in JSON (e.g. `power2.out`).
 */
import type { EasingName } from "@/lib/easing";

const NAMED_TO_GSAP: Record<EasingName, string> = {
  linear: "none",
  easeInQuad: "power2.in",
  easeOutQuad: "power2.out",
  easeInOutQuad: "power2.inOut",
  easeInCubic: "power3.in",
  easeOutCubic: "power3.out",
  easeInOutCubic: "power3.inOut",
  easeInQuart: "power4.in",
  easeOutQuart: "power4.out",
  easeInOutQuart: "power4.inOut",
};

/** JSON `easing` field (app preset) or any GSAP ease string; unknown names pass through. */
export function mapIntroEaseToGsap(name: string): string {
  if (name in NAMED_TO_GSAP) {
    return NAMED_TO_GSAP[name as EasingName];
  }
  return name;
}
