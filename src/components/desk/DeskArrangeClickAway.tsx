"use client";

import { useCallback } from "react";
import { DeskArrangeMarquee, type DeskMarqueeOverlayRect } from "./DeskArrangeMarquee";

/**
 * @deprecated Prefer `DeskArrangeMarquee` with `onMarqueeRectChange` wired at the Canvas
 * shell so the marquee box can render in DOM outside R3F.
 */
export function DeskArrangeClickAway() {
  const noopOverlay = useCallback((rect: DeskMarqueeOverlayRect | null) => {
    void rect;
  }, []);
  return <DeskArrangeMarquee onMarqueeRectChange={noopOverlay} />;
}
