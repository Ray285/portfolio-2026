"use client";

import { useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { CuboidCollider, RigidBody, type RapierRigidBody } from "@react-three/rapier";
import { OrthographicCamera } from "three";
import { computeVisibleDeskBounds } from "./useWorkspaceDragBounds";

/** Half-thickness of each wall slab (world units). */
const HALF_T = 0.5;
/** Wall half-height — tall enough to stop a ball at any Y near the desk. */
const HALF_H = 3.0;
/** Wall half-span along its long axis — covers any foreseeable desk width. */
const HALF_SPAN = 40;
/** Matches DeskBall's EDGE_RESTITUTION. */
const WALL_RESTITUTION = 0.72;

/**
 * Four kinematic Rapier walls that track the visible orthographic frustum every
 * frame. They replace DeskBall's manual velocity-reflection + bounds-clamp logic.
 */
export function RapierBoundaryWalls() {
  const { camera, size } = useThree();
  const northRef = useRef<RapierRigidBody>(null); // +Z
  const southRef = useRef<RapierRigidBody>(null); // -Z
  const eastRef  = useRef<RapierRigidBody>(null); // +X
  const westRef  = useRef<RapierRigidBody>(null); // -X

  useFrame(() => {
    if (!(camera instanceof OrthographicCamera)) return;
    camera.updateMatrixWorld(true);
    const b = computeVisibleDeskBounds(camera, size.width, size.height, 0);
    const cx = (b.x[0] + b.x[1]) / 2;
    const cz = (b.z[0] + b.z[1]) / 2;
    const y = HALF_H; // wall center sits above desk surface

    northRef.current?.setNextKinematicTranslation({ x: cx,         y, z: b.z[1] + HALF_T });
    southRef.current?.setNextKinematicTranslation({ x: cx,         y, z: b.z[0] - HALF_T });
    eastRef.current?.setNextKinematicTranslation ({ x: b.x[1] + HALF_T, y, z: cz });
    westRef.current?.setNextKinematicTranslation ({ x: b.x[0] - HALF_T, y, z: cz });
  });

  return (
    <>
      {/* North / South — extend along X */}
      <RigidBody ref={northRef} type="kinematicPosition" colliders={false}>
        <CuboidCollider args={[HALF_SPAN, HALF_H, HALF_T]} restitution={WALL_RESTITUTION} friction={0} />
      </RigidBody>
      <RigidBody ref={southRef} type="kinematicPosition" colliders={false}>
        <CuboidCollider args={[HALF_SPAN, HALF_H, HALF_T]} restitution={WALL_RESTITUTION} friction={0} />
      </RigidBody>
      {/* East / West — extend along Z */}
      <RigidBody ref={eastRef} type="kinematicPosition" colliders={false}>
        <CuboidCollider args={[HALF_T, HALF_H, HALF_SPAN]} restitution={WALL_RESTITUTION} friction={0} />
      </RigidBody>
      <RigidBody ref={westRef} type="kinematicPosition" colliders={false}>
        <CuboidCollider args={[HALF_T, HALF_H, HALF_SPAN]} restitution={WALL_RESTITUTION} friction={0} />
      </RigidBody>
    </>
  );
}
