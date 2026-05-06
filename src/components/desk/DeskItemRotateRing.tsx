"use client";

import { useMemo } from "react";
import { type ThreeEvent } from "@react-three/fiber";
import { DoubleSide } from "three";

type DeskItemRotateRingProps = {
  /** Outer radius in world units (in local XZ before parent yaw). */
  outerRadius: number;
  onPointerDown: (e: ThreeEvent<PointerEvent>) => void;
  onPointerMove: (e: ThreeEvent<PointerEvent>) => void;
  onPointerUp: (e: ThreeEvent<PointerEvent>) => void;
  onPointerCancel: (e: ThreeEvent<PointerEvent>) => void;
};

const LINE_Y = 0.025;
const TUBE = 0.04;

/**
 * Shallow, wide ring in the local horizontal plane: visual stroke + a slightly
 * larger invisible mesh for hit-testing (top-down pick).
 */
export function DeskItemRotateRing({
  outerRadius,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerCancel,
}: DeskItemRotateRingProps) {
  const innerR = useMemo(
    () => Math.max(0.1, outerRadius * 0.88),
    [outerRadius],
  );
  const pickOuter = useMemo(
    () => outerRadius + TUBE * 0.5,
    [outerRadius],
  );
  return (
    <group>
      <mesh
        name="desk-item-rotate-ring"
        position={[0, LINE_Y, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
        onDoubleClick={(e) => e.stopPropagation()}
        renderOrder={2}
      >
        <ringGeometry args={[innerR, pickOuter, 64]} />
        <meshBasicMaterial
          color="#0ea5e9"
          transparent
          opacity={0.2}
          depthWrite={false}
          side={DoubleSide}
        />
      </mesh>
    </group>
  );
}
