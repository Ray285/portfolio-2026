"use client";

import { createContext, useContext, type ReactNode } from "react";
import {
  DESK_SCENE_HOME,
  type DeskSceneId,
} from "@/lib/desk-scene-id";

const DeskSceneIdContext = createContext<DeskSceneId | null>(null);

export function DeskSceneIdProvider({
  children,
  sceneId,
}: {
  children: ReactNode;
  sceneId: DeskSceneId;
}) {
  return (
    <DeskSceneIdContext.Provider value={sceneId}>
      {children}
    </DeskSceneIdContext.Provider>
  );
}

export function useDeskSceneId(): DeskSceneId {
  const v = useContext(DeskSceneIdContext);
  if (v == null) {
    return DESK_SCENE_HOME;
  }
  return v;
}

export function useDeskSceneIdOptional(): DeskSceneId | null {
  return useContext(DeskSceneIdContext);
}
