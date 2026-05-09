"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useDeskSceneId } from "@/context/DeskSceneContext";
import { getZoomOutIntroStartCameraForInitialControls } from "@/lib/desk-intro-bundled-start-camera";
import { DESK_SCENE_HOME, type DeskSceneId } from "@/lib/desk-scene-id";
import { clampCameraY } from "@/lib/desk-camera-y-bounds";
import {
  DEFAULT_CAMERA,
  DEFAULT_FILL_LIGHT,
  DEFAULT_KEY_LIGHT,
  DEFAULT_SPOT_LIGHT,
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
  /** SpotLight: warm window-light cone (no shadow map — avoids double-shadow artifact). */
  spotLightIntensity: number;
  spotLightX: number;
  spotLightY: number;
  spotLightZ: number;
  /** Cone half-angle in radians. */
  spotLightAngle: number;
  /** Soft edge fraction of the cone (0 = hard, 1 = fully soft). */
  spotLightPenumbra: number;
  /** Hex color of the desk surface material. */
  deskColor: string;
  /** Hex color of the key (shadow-casting) directional light. */
  keyLightColor: string;
  /** Hex color of the fill directional light. */
  fillLightColor: string;
  /** Hex color of the spot (window) light. */
  spotLightColor: string;
  /** Hex sky color for the hemisphere light. */
  hemisphereSkyColor: string;
  /** Hex ground-bounce color for the hemisphere light. */
  hemisphereGroundColor: string;
  /** Global Y offset added to every desk item — lifts them off the surface. */
  itemElevation: number;
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
  contactScale: 44,
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
  spotLightIntensity: 1.2,
  spotLightX: DEFAULT_SPOT_LIGHT.x,
  spotLightY: DEFAULT_SPOT_LIGHT.y,
  spotLightZ: DEFAULT_SPOT_LIGHT.z,
  spotLightAngle: Math.PI / 5,
  spotLightPenumbra: 0.7,
  deskColor: "#ffffff",
  keyLightColor: "#ffffff",
  fillLightColor: "#f8f6f2",
  spotLightColor: "#fff5df",
  hemisphereSkyColor: "#ffffff",
  hemisphereGroundColor: "#ededea",
  itemElevation: 0,
};

function createInitialControlsState(scene: DeskSceneId): DeskControls {
  const start = getZoomOutIntroStartCameraForInitialControls(scene);
  if (start == null) {
    return { ...defaultControls };
  }
  return {
    ...defaultControls,
    cameraX: start.x,
    cameraY: clampCameraY(start.y),
    cameraZ: start.z,
    cameraZoom: start.zoom,
  };
}

type Ctx = {
  controls: DeskControls;
  set: <K extends keyof DeskControls>(key: K, value: DeskControls[K]) => void;
  /** Single state update (avoids split camera props for one frame during GSAP). */
  setCamera: (c: { x: number; y: number; z: number; zoom: number }) => void;
  reset: () => void;
  /** Scene panel: when true, select items, drag body to move, drag ring to yaw-rotate. */
  arrangeMode: boolean;
  setArrangeMode: (value: boolean) => void;
  /**
   * Last-interacted arrange selection (panels, wheel scaling). Mirrors first id when only one selected.
   * @deprecated Prefer `primarySelectionId` + `selectedLayoutIds`.
   */
  selectedLayoutId: string | null;
  /** @deprecated Prefer `primarySelectionId` + `toggleLayoutInArrangeSelection`. */
  setSelectedLayoutId: (id: string | null) => void;

  selectedLayoutIds: readonly string[];
  /** Last clicked arrange item — controls panel edits & rotate ring anchor. */
  primarySelectionId: string | null;
  selectExclusiveLayout: (layoutId: string) => void;
  toggleLayoutInArrangeSelection: (layoutId: string) => void;
  clearArrangeSelection: () => void;
  /** Replace selection (e.g. marquee); primary defaults to first id. */
  setArrangeSelection: (
    ids: readonly string[],
    primaryId?: string | null,
  ) => void;
  /** Union with current selection (e.g. Shift+marquee). */
  addArrangeSelection: (
    extraIds: readonly string[],
    primaryPreferred?: string | null,
  ) => void;
};

const DeskControlsContext = createContext<Ctx | null>(null);

export function DeskControlsProvider({ children }: { children: ReactNode }) {
  const scene = useDeskSceneId();
  const [controls, setControls] = useState<DeskControls>(() =>
    createInitialControlsState(scene),
  );

  useEffect(() => {
    fetch("/desk-scene-config.json")
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null)
      .then((data: unknown) => {
        if (
          data !== null &&
          typeof data === "object" &&
          "version" in data &&
          (data as { version: unknown }).version === 1 &&
          "controls" in data &&
          typeof (data as { controls: unknown }).controls === "object"
        ) {
          const saved = (data as { controls: Partial<DeskControls> }).controls;
          setControls((prev) => ({ ...prev, ...saved }));
        }
      });
  }, []);
  const [arrangeMode, setArrangeModeState] = useState(false);
  const [selectionIds, setSelectionIds] = useState<string[]>([]);
  const [primarySelectionId, setPrimarySelectionId] = useState<string | null>(
    null,
  );
  const selectionIdsRef = useRef(selectionIds);

  useEffect(() => {
    selectionIdsRef.current = selectionIds;
  }, [selectionIds]);

  const selectedLayoutIds = selectionIds;

  /** Back-compat: singleton API → multi-select internals */
  const setSelectedLayoutId = useCallback((id: string | null) => {
    if (id == null) {
      setSelectionIds([]);
      setPrimarySelectionId(null);
      return;
    }
    setSelectionIds([id]);
    setPrimarySelectionId(id);
  }, []);

  const selectedLayoutId = primarySelectionId;

  const clearArrangeSelection = useCallback(() => {
    setSelectionIds([]);
    setPrimarySelectionId(null);
  }, []);

  const setArrangeSelection = useCallback(
    (
      ids: readonly string[],
      primaryId?: string | null,
    ) => {
      const next = [...new Set(ids)];
      setSelectionIds(next);
      if (next.length === 0) {
        setPrimarySelectionId(null);
        return;
      }
      const prim =
        primaryId != null && next.includes(primaryId)
          ? primaryId
          : next[0] ?? null;
      setPrimarySelectionId(prim);
    },
    [],
  );

  const addArrangeSelection = useCallback(
    (extraIds: readonly string[], primaryPreferred?: string | null) => {
      const merged = [...new Set([...selectionIdsRef.current, ...extraIds])];
      setSelectionIds(merged);
      if (merged.length === 0) {
        setPrimarySelectionId(null);
        return;
      }
      if (
        primaryPreferred != null &&
        merged.includes(primaryPreferred)
      ) {
        setPrimarySelectionId(primaryPreferred);
      } else if (extraIds.length > 0) {
        const last = extraIds[extraIds.length - 1];
        if (last !== undefined && merged.includes(last)) {
          setPrimarySelectionId(last);
        }
      }
    },
    [],
  );

  const selectExclusiveLayout = useCallback((layoutId: string) => {
    setSelectionIds([layoutId]);
    setPrimarySelectionId(layoutId);
  }, []);

  const toggleLayoutInArrangeSelection = useCallback((layoutId: string) => {
    setSelectionIds((prev) => {
      const idx = prev.indexOf(layoutId);
      if (idx >= 0) {
        const next = prev.filter((x) => x !== layoutId);
        setPrimarySelectionId(
          next.length === 0 ? null : next[next.length - 1] ?? null,
        );
        return next;
      }
      const next = [...prev, layoutId];
      setPrimarySelectionId(layoutId);
      return next;
    });
  }, []);

  const setArrangeMode = useCallback((value: boolean) => {
    setArrangeModeState(value);
    if (!value) {
      setSelectionIds([]);
      setPrimarySelectionId(null);
    }
  }, []);

  useEffect(() => {
    if (!arrangeMode) {
      return;
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        clearArrangeSelection();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
    };
  }, [arrangeMode, clearArrangeSelection]);

  const set = useCallback(
    <K extends keyof DeskControls>(key: K, value: DeskControls[K]) => {
      if (key === "cameraY" && typeof value === "number") {
        setControls((prev) => ({ ...prev, cameraY: clampCameraY(value) }));
        return;
      }
      setControls((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );

  const setCamera = useCallback(
    (c: { x: number; y: number; z: number; zoom: number }) => {
      setControls((prev) => ({
        ...prev,
        cameraX: c.x,
        cameraY: clampCameraY(c.y),
        cameraZ: c.z,
        cameraZoom: c.zoom,
      }));
    },
    [],
  );

  const reset = useCallback(() => {
    setControls(createInitialControlsState(scene));
  }, [scene]);

  const value = useMemo(
    () => ({
      controls,
      set,
      setCamera,
      reset,
      arrangeMode,
      setArrangeMode,
      selectedLayoutId,
      setSelectedLayoutId,
      selectedLayoutIds,
      primarySelectionId,
      selectExclusiveLayout,
      toggleLayoutInArrangeSelection,
      clearArrangeSelection,
      setArrangeSelection,
      addArrangeSelection,
    }),
    [
      controls,
      set,
      setCamera,
      reset,
      arrangeMode,
      setArrangeMode,
      selectedLayoutId,
      selectedLayoutIds,
      primarySelectionId,
      selectExclusiveLayout,
      toggleLayoutInArrangeSelection,
      clearArrangeSelection,
      setArrangeSelection,
      addArrangeSelection,
      setSelectedLayoutId,
    ],
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
  return createInitialControlsState(DESK_SCENE_HOME);
}
