"use client";

import {
  createContext,
  useContext,
  useMemo,
  useRef,
  type MutableRefObject,
  type ReactNode,
} from "react";
import { Vector3 } from "three";

export type DeskPhysicsEntry = {
  id: string;
  position: Vector3;
  velocity: Vector3;
  radius: number;
  pushRadius: number;
  pushStrength: number;
  tiltStrength: number;
  isDragging: boolean;
  isHovered: boolean;
  /** When true (e.g. a rolling ball), this entry pushes nearby items even though
   *  it is not being directly dragged. */
  pushWhileMoving?: boolean;
};

type DeskPhysicsContextValue = {
  entriesRef: MutableRefObject<Map<string, DeskPhysicsEntry>>;
  register: (entry: DeskPhysicsEntry) => () => void;
};

const DeskPhysicsContext = createContext<DeskPhysicsContextValue | null>(null);

export function DeskPhysicsProvider({ children }: { children: ReactNode }) {
  const entriesRef = useRef(new Map<string, DeskPhysicsEntry>());

  const value = useMemo<DeskPhysicsContextValue>(
    () => ({
      entriesRef,
      register(entry) {
        entriesRef.current.set(entry.id, entry);
        return () => {
          entriesRef.current.delete(entry.id);
        };
      },
    }),
    [],
  );

  return (
    <DeskPhysicsContext.Provider value={value}>
      {children}
    </DeskPhysicsContext.Provider>
  );
}

export function useDeskPhysics() {
  return useContext(DeskPhysicsContext);
}
