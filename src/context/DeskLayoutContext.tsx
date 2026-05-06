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
import { getBundledDataForScene } from "@/lib/desk-default-layout";
import {
  buildDeskLayoutFileV1,
  clampDeskItemLayoutScale,
  formatDeskLayoutJson,
  getDeskLayoutStorageKey,
  hasDeskLayoutInStorageForKey,
  mergeDeskItemLayout,
  readDeskLayoutFromStorageKey,
  tryParseDeskLayoutJson,
  writeDeskLayoutToStorageKey,
  type DeskItemLayout,
} from "@/lib/desk-layout";
import type { DeskSceneId } from "@/lib/desk-scene-id";

function getInitialLayoutPack(scene: DeskSceneId): {
  state: LayoutState;
  ballTrack: [number, number];
} {
  const key = getDeskLayoutStorageKey(scene);
  const b = getBundledDataForScene(scene);
  if (!hasDeskLayoutInStorageForKey(key)) {
    const ball: [number, number] = [b.ball[0], b.ball[1]] as [number, number];
    return {
      state: { items: { ...b.items }, ball, loaded: true },
      ballTrack: ball,
    };
  }
  const { items, ball: ballRaw } = readDeskLayoutFromStorageKey(key);
  const ball: [number, number] =
    ballRaw != null
      ? [ballRaw[0], ballRaw[1]] as [number, number]
      : [b.ball[0], b.ball[1]] as [number, number];
  return { state: { items, ball, loaded: true }, ballTrack: ball };
}

type LayoutState = {
  items: Record<string, DeskItemLayout>;
  /** null: no saved point yet (use bundled ball for the scene’s spawn). */
  ball: [number, number] | null;
  loaded: boolean;
};

type DeskLayoutContextValue = {
  /** True after the first `localStorage` read (client only). */
  loaded: boolean;
  getItem: (id: string, fallback: DeskItemLayout) => DeskItemLayout;
  getBallXZ: () => [number, number];
  sampleBallXZ: (xz: [number, number]) => void;
  recordItem: (id: string, data: DeskItemLayout) => void;
  /** Single localStorage persist for grouped arrange moves */
  recordItems: (updates: Record<string, DeskItemLayout>) => void;
  /** Arrange mode + wheel / UI: bump uniform layout scale for `id` (merged with bundled fallback). */
  nudgeItemScale: (id: string, deltaY: number) => void;
  recordBall: (xz: [number, number]) => void;
  exportJson: () => string;
  importJson: (json: string) => { ok: true } | { ok: false; error: string };
  clear: () => void;
};

const DeskLayoutContext = createContext<DeskLayoutContextValue | null>(null);

export function DeskLayoutProvider({ children }: { children: ReactNode }) {
  const scene = useDeskSceneId();
  const initPack = useMemo(() => getInitialLayoutPack(scene), [scene]);
  const [state, setState] = useState<LayoutState>(() => initPack.state);
  const ballTrackRef = useRef<[number, number]>(initPack.ballTrack);

  const storageKey = getDeskLayoutStorageKey(scene);
  const bundled = getBundledDataForScene(scene);
  const bundledItems = bundled.items;
  const bundledBall = bundled.ball;

  const itemsRef = useRef(state.items);
  useEffect(() => {
    itemsRef.current = state.items;
  }, [state.items]);

  const getItem = useCallback(
    (id: string, fallback: DeskItemLayout): DeskItemLayout => {
      const stored = state.items[id] ?? bundledItems[id];
      return mergeDeskItemLayout(fallback, stored);
    },
    [state.items, bundledItems],
  );

  const nudgeItemScale = useCallback(
    (id: string, deltaY: number) => {
      const fb = bundledItems[id];
      if (fb == null) {
        return;
      }
      setState((prev) => {
        const merged = mergeDeskItemLayout(fb, prev.items[id]);
        const factor = Math.exp(-deltaY * 0.002);
        const nextScale = clampDeskItemLayoutScale(
          (merged.scale ?? 1) * factor,
        );
        const nextItem: DeskItemLayout = {
          position: merged.position,
          rotation: merged.rotation,
          scale: nextScale,
        };
        const nextItems = { ...prev.items, [id]: nextItem };
        writeDeskLayoutToStorageKey(
          storageKey,
          buildDeskLayoutFileV1(nextItems, ballTrackRef.current),
        );
        return { ...prev, items: nextItems };
      });
    },
    [bundledItems, storageKey],
  );

  const getBallXZ = useCallback((): [number, number] => {
    if (state.ball != null) {
      return [state.ball[0], state.ball[1]] as [number, number];
    }
    return [bundledBall[0], bundledBall[1]] as [number, number];
  }, [state.ball, bundledBall]);

  const sampleBallXZ = useCallback((xz: [number, number]) => {
    ballTrackRef.current = [xz[0], xz[1]];
  }, []);

  const recordItem = useCallback(
    (id: string, data: DeskItemLayout) => {
      setState((prev) => {
        const nextItems = { ...prev.items, [id]: data };
        writeDeskLayoutToStorageKey(
          storageKey,
          buildDeskLayoutFileV1(nextItems, ballTrackRef.current),
        );
        return { ...prev, items: nextItems };
      });
    },
    [storageKey],
  );

  const recordItems = useCallback(
    (updates: Record<string, DeskItemLayout>) => {
      const keys = Object.keys(updates);
      if (keys.length === 0) {
        return;
      }
      setState((prev) => {
        let nextItems = prev.items;
        for (let i = 0; i < keys.length; i++) {
          const k = keys[i];
          nextItems = { ...nextItems, [k]: updates[k] } as Record<
            string,
            DeskItemLayout
          >;
        }
        writeDeskLayoutToStorageKey(
          storageKey,
          buildDeskLayoutFileV1(nextItems, ballTrackRef.current),
        );
        return { ...prev, items: nextItems };
      });
    },
    [storageKey],
  );

  const recordBall = useCallback(
    (xz: [number, number]) => {
      ballTrackRef.current = [xz[0], xz[1]];
      setState((prev) => {
        const next: LayoutState = {
          ...prev,
          ball: [xz[0], xz[1]] as [number, number],
        };
        writeDeskLayoutToStorageKey(
          storageKey,
          buildDeskLayoutFileV1({ ...next.items }, [xz[0], xz[1]]),
        );
        return next;
      });
    },
    [storageKey],
  );

  const exportJson = useCallback((): string => {
    return formatDeskLayoutJson(
      buildDeskLayoutFileV1({ ...itemsRef.current }, ballTrackRef.current),
    );
  }, []);

  const importJson = useCallback(
    (json: string) => {
      const p = tryParseDeskLayoutJson(json);
      if (!p.ok) {
        return p;
      }
      const b =
        p.value.ball != null ? p.value.ball : bundledBall;
      ballTrackRef.current = [b[0], b[1]];
      setState((prev) => {
        const next: LayoutState = {
          ...prev,
          items: { ...p.value.items },
          ball: p.value.ball != null
            ? [p.value.ball[0], p.value.ball[1]] as [number, number]
            : null,
          loaded: true,
        };
        writeDeskLayoutToStorageKey(
          storageKey,
          buildDeskLayoutFileV1({ ...next.items }, b),
        );
        return next;
      });
      return { ok: true } as const;
    },
    [bundledBall, storageKey],
  );

  const clear = useCallback(() => {
    ballTrackRef.current = [bundledBall[0], bundledBall[1]];
    if (typeof window !== "undefined" && window.localStorage) {
      try {
        window.localStorage.removeItem(storageKey);
      } catch {
        // ignore
      }
    }
    setState((prev) => ({
      ...prev,
      items: { ...bundledItems },
      ball: [bundledBall[0], bundledBall[1]] as [number, number],
    }));
  }, [storageKey, bundledItems, bundledBall]);

  const value = useMemo<DeskLayoutContextValue>(
    () => ({
      loaded: state.loaded,
      getItem,
      getBallXZ,
      sampleBallXZ,
      recordItem,
      recordItems,
      nudgeItemScale,
      recordBall,
      exportJson,
      importJson,
      clear,
    }),
    [
      state.loaded,
      getItem,
      getBallXZ,
      sampleBallXZ,
      recordItem,
      recordItems,
      nudgeItemScale,
      recordBall,
      exportJson,
      importJson,
      clear,
    ],
  );

  return (
    <DeskLayoutContext.Provider value={value}>{children}</DeskLayoutContext.Provider>
  );
}

export function useDeskLayout(): DeskLayoutContextValue {
  const c = useContext(DeskLayoutContext);
  if (!c) {
    throw new Error("useDeskLayout must be used within DeskLayoutProvider");
  }
  return c;
}
