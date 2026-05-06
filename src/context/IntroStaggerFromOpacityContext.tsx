"use client";

import { createContext, useContext } from "react";

/**
 * `staggerAfterCamera.from.opacity` (when present) is supplied so polaroid
 * print materials are created with matching opacity on the first R3F paint
 * (see `DraggableObject` desk-load stagger wiring).
 */
export const IntroStaggerFromOpacityContext = createContext<number | undefined>(
  undefined,
);

export function useIntroStaggerFromOpacity(): number | undefined {
  return useContext(IntroStaggerFromOpacityContext);
}
