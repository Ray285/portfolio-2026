"use client";

import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useDeskSceneId } from "@/context/DeskSceneContext";
import { deskSceneHasAnimatedCameraIntro } from "@/lib/desk-intro-timelines";

type DeskIntroContextValue = {
  /** When true, `CameraViewControls` and similar should not fight scripted motion. */
  introActive: boolean;
  setIntroActive: (v: boolean) => void;
};

const DeskIntroContext = createContext<DeskIntroContextValue | null>(null);

/**
 * `introActive` starts true when the scene runs a scripted camera intro on load;
 * `DeskLoadIntro` clears it when that segment completes.
 */
export function DeskIntroProvider({ children }: { children: ReactNode }) {
  const scene = useDeskSceneId();
  const [introActive, setIntroActive] = useState(() =>
    deskSceneHasAnimatedCameraIntro(scene),
  );
  const value = useMemo(
    () => ({ introActive, setIntroActive }),
    [introActive],
  );
  return (
    <DeskIntroContext.Provider value={value}>
      {children}
    </DeskIntroContext.Provider>
  );
}

export function useDeskIntro(): DeskIntroContextValue {
  const c = useContext(DeskIntroContext);
  if (!c) {
    throw new Error("useDeskIntro must be used within DeskIntroProvider");
  }
  return c;
}

export function useDeskIntroOptional(): DeskIntroContextValue | null {
  return useContext(DeskIntroContext);
}
