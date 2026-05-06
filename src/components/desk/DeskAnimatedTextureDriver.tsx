"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { runAnimatedTextureTicks } from "@/components/desk/polaroid/desk-animated-texture-registry";

/**
 * Single subscriber that advances every {@link registerAnimatedTextureTick} hook once per
 * canvas frame instead of spawning one requestAnimationFrame loop per polaroid.
 */
export function DeskAnimatedTextureDriver() {
  const invalidate = useThree((s) => s.invalidate);

  useFrame((_, delta) => {
    const d = Math.min(delta, 0.1);
    if (runAnimatedTextureTicks(d)) {
      invalidate();
    }
  });

  return null;
}
