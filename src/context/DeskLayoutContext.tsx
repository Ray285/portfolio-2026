"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  buildDeskLayoutFileV1,
  DESK_LAYOUT_STORAGE_KEY,
  formatDeskLayoutJson,
  readDeskLayoutFromStorage,
  tryParseDeskLayoutJson,
  writeDeskLayoutToStorage,
  type DeskItemLayout,
} from "@/lib/desk-layout";

const DEFAULT_BALL: [number, number] = [4.4, 1.6];

type LayoutState = {
  items: Record<string, DeskItemLayout>;
  /** null: no saved point yet (use `DEFAULT_BALL` for the ball’s spawn). */
  ball: [number, number] | null;
  loaded: boolean;
};

type DeskLayoutContextValue = {
  /** True after the first `localStorage` read (client only). */
  loaded: boolean;
  getItem: (id: string, fallback: DeskItemLayout) => DeskItemLayout;
  getBallXZ: (fallback: [number, number]) => [number, number];
  /** Free-rolling: update the ref (no localStorage write) so a later item-save includes the current ball. */
  sampleBallXZ: (xz: [number, number]) => void;
  recordItem: (id: string, data: DeskItemLayout) => void;
  recordBall: (xz: [number, number]) => void;
  exportJson: () => string;
  importJson: (json: string) => { ok: true } | { ok: false; error: string };
  clear: () => void;
};

const DeskLayoutContext = createContext<DeskLayoutContextValue | null>(null);

export function DeskLayoutProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<LayoutState>({
    items: {},
    ball: null,
    loaded: false,
  });

  const itemsRef = useRef(state.items);
  useEffect(() => {
    itemsRef.current = state.items;
  }, [state.items]);

  const ballTrackRef = useRef<[number, number]>(DEFAULT_BALL);

  useLayoutEffect(() => {
    const { items, ball } = readDeskLayoutFromStorage();
    if (ball) {
      ballTrackRef.current = [ball[0], ball[1]];
    } else {
      ballTrackRef.current = DEFAULT_BALL;
    }
    queueMicrotask(() => {
      setState((prev) => ({ ...prev, items, ball, loaded: true }));
    });
  }, []);

  const getItem = useCallback(
    (id: string, fallback: DeskItemLayout): DeskItemLayout => {
      const s = state.items[id];
      return s ? { position: s.position, rotation: s.rotation } : fallback;
    },
    [state.items],
  );

  const getBallXZ = useCallback(
    (fallback: [number, number]) => {
      if (state.ball) {
        return [state.ball[0], state.ball[1]] as [number, number];
      }
      return fallback;
    },
    [state.ball],
  );

  const sampleBallXZ = useCallback((xz: [number, number]) => {
    ballTrackRef.current = [xz[0], xz[1]];
  }, []);

  const recordItem = useCallback((id: string, data: DeskItemLayout) => {
    setState((prev) => {
      const nextItems = { ...prev.items, [id]: data };
      writeDeskLayoutToStorage(
        buildDeskLayoutFileV1(nextItems, ballTrackRef.current),
      );
      return { ...prev, items: nextItems };
    });
  }, []);

  const recordBall = useCallback((xz: [number, number]) => {
    ballTrackRef.current = [xz[0], xz[1]];
    setState((prev) => {
      const next: LayoutState = {
        ...prev,
        ball: [xz[0], xz[1]],
      };
      writeDeskLayoutToStorage(
        buildDeskLayoutFileV1({ ...next.items }, [xz[0], xz[1]]),
      );
      return next;
    });
  }, []);

  const exportJson = useCallback((): string => {
    return formatDeskLayoutJson(
      buildDeskLayoutFileV1({ ...itemsRef.current }, ballTrackRef.current),
    );
  }, []);

  const importJson = useCallback((json: string) => {
    const p = tryParseDeskLayoutJson(json);
    if (!p.ok) {
      return p;
    }
    const b =
      p.value.ball != null ? p.value.ball : (DEFAULT_BALL as [number, number]);
    ballTrackRef.current = [b[0], b[1]];
    setState((prev) => {
      const next: LayoutState = {
        ...prev,
        items: { ...p.value.items },
        ball: p.value.ball ?? null,
        loaded: true,
      };
      writeDeskLayoutToStorage(buildDeskLayoutFileV1({ ...next.items }, b));
      return next;
    });
    return { ok: true } as const;
  }, []);

  const clear = useCallback(() => {
    ballTrackRef.current = DEFAULT_BALL;
    if (typeof window !== "undefined" && window.localStorage) {
      try {
        window.localStorage.removeItem(DESK_LAYOUT_STORAGE_KEY);
      } catch {
        // ignore
      }
    }
    setState((prev) => ({
      ...prev,
      items: {},
      ball: null,
    }));
  }, []);

  const value = useMemo<DeskLayoutContextValue>(
    () => ({
      loaded: state.loaded,
      getItem,
      getBallXZ,
      sampleBallXZ,
      recordItem,
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
