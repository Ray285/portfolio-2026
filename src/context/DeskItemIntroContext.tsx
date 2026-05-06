"use client";

import { useFrame } from "@react-three/fiber";
import {
  createContext,
  useContext,
  useRef,
  type ReactNode,
  type MutableRefObject,
} from "react";
import { useDeskLayout } from "@/context/DeskLayoutContext";
import { useDeskSceneId } from "@/context/DeskSceneContext";
import { getDeskIntroStaggerAfterCamera } from "@/lib/desk-intro-timelines";
import { getBundledDataForScene } from "@/lib/desk-default-layout";

const ItemIntroTimeContext = createContext<{
  /** Seconds since the item-intro clock started (after layout `loaded`). */
  timeSec: MutableRefObject<number>;
} | null>(null);

/**
 * Drives a single global elapsed time for `itemIntros` (bundled JSON). Children
 * read `timeSec` in their own `useFrame` to lerp from → rest without
 * re-rendering the React tree each frame.
 */
export function ItemIntroTimeProvider({ children }: { children: ReactNode }) {
  const scene = useDeskSceneId();
  const { loaded } = useDeskLayout();
  const timeSec = useRef(0);
  const start = useRef<number | null>(null);
  const bundled = getBundledDataForScene(scene);
  const hasIntros =
    getDeskIntroStaggerAfterCamera(scene) == null &&
    Object.keys(bundled.itemIntros).length > 0;

  useFrame(() => {
    if (!hasIntros || !loaded) {
      return;
    }
    if (start.current == null) {
      start.current = performance.now();
    }
    timeSec.current = (performance.now() - start.current) / 1000;
  });

  return (
    <ItemIntroTimeContext.Provider value={{ timeSec }}>
      {children}
    </ItemIntroTimeContext.Provider>
  );
}

export function useItemIntroTime() {
  return useContext(ItemIntroTimeContext);
}
