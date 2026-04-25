"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  DEFAULT_CAMERA,
  DEFAULT_FILL_LIGHT,
  DEFAULT_KEY_LIGHT,
} from "@/lib/desk-scene-defaults";

export type DeskControls = {
  ambient: number;
  keyLight: number;
  fillLight: number;
  hemisphere: number;
  environment: number;
  exposure: number;
  contactOpacity: number;
  contactBlur: number;
  contactScale: number;
  shadowRadius: number;
  /** 0.85 = more white border, 1.0 = print uses max area inside the frame. */
  polaroidPrintScale: number;
  /** World-space camera position. Y is height above the desk; X/Z pan the view. */
  cameraX: number;
  cameraY: number;
  cameraZ: number;
  /** Multiplies the auto-fitted orthographic zoom (bigger = more zoomed in / tighter). */
  cameraZoom: number;
  /** World-space position of the main directional (shadow) light. */
  keyLightX: number;
  keyLightY: number;
  keyLightZ: number;
  /** World-space position of the fill (no-shadow) light. */
  fillLightX: number;
  fillLightY: number;
  fillLightZ: number;
};

const defaultControls: DeskControls = {
  ambient: 0.46,
  keyLight: 2.65,
  fillLight: 0.28,
  hemisphere: 0.14,
  environment: 0.04,
  exposure: 0.95,
  contactOpacity: 0.15,
  contactBlur: 2.4,
  contactScale: 28,
  shadowRadius: 8,
  polaroidPrintScale: 0.98,
  cameraX: DEFAULT_CAMERA.x,
  cameraY: DEFAULT_CAMERA.y,
  cameraZ: DEFAULT_CAMERA.z,
  cameraZoom: DEFAULT_CAMERA.zoom,
  keyLightX: DEFAULT_KEY_LIGHT.x,
  keyLightY: DEFAULT_KEY_LIGHT.y,
  keyLightZ: DEFAULT_KEY_LIGHT.z,
  fillLightX: DEFAULT_FILL_LIGHT.x,
  fillLightY: DEFAULT_FILL_LIGHT.y,
  fillLightZ: DEFAULT_FILL_LIGHT.z,
};

type Ctx = {
  controls: DeskControls;
  set: <K extends keyof DeskControls>(key: K, value: DeskControls[K]) => void;
  reset: () => void;
};

const DeskControlsContext = createContext<Ctx | null>(null);

export function DeskControlsProvider({ children }: { children: ReactNode }) {
  const [controls, setControls] = useState<DeskControls>(defaultControls);

  const set = useCallback(
    <K extends keyof DeskControls>(key: K, value: DeskControls[K]) => {
      setControls((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );

  const reset = useCallback(() => {
    setControls({ ...defaultControls });
  }, []);

  const value = useMemo(
    () => ({ controls, set, reset }),
    [controls, set, reset],
  );

  return (
    <DeskControlsContext.Provider value={value}>
      {children}
    </DeskControlsContext.Provider>
  );
}

export function useDeskControls() {
  const ctx = useContext(DeskControlsContext);
  if (!ctx) {
    throw new Error("useDeskControls must be used within DeskControlsProvider");
  }
  return ctx;
}

export function getDefaultDeskControls(): DeskControls {
  return { ...defaultControls };
}
