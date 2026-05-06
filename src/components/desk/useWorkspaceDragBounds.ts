import { useMemo } from "react";
import { useThree } from "@react-three/fiber";
import { OrthographicCamera, Plane, Raycaster, Vector2, Vector3 } from "three";

const yPlane = new Plane(new Vector3(0, 1, 0), 0);
const hit = new Vector3();
const v2 = new Vector2();
const rc = new Raycaster();

export type DeskPlaneBounds = {
  x: [number, number];
  z: [number, number];
};

export const DESK_BOUNDS_FALLBACK: DeskPlaneBounds = {
  x: [-12, 12],
  z: [-9, 9],
};

/**
 * World XZ bounds on the y=0 plane that match the visible orthographic
 * frustum for the current canvas size, minus `margin` (inset from each side in
 * world units). Call every frame if the camera position/zoom changes without
 * a new React render (same `OrthographicCamera` instance).
 */
export function computeVisibleDeskBounds(
  camera: OrthographicCamera,
  width: number,
  height: number,
  margin: number,
): DeskPlaneBounds {
  const w = width;
  const h = height;
  if (w <= 0 || h <= 0) {
    return DESK_BOUNDS_FALLBACK;
  }

  const corners: [number, number][] = [
    [0, 0],
    [w, 0],
    [w, h],
    [0, h],
  ];
  const xs: number[] = [];
  const zs: number[] = [];

  for (const [px, py] of corners) {
    v2.set(
      (px / w) * 2 - 1,
      -((py / h) * 2) + 1,
    );
    rc.setFromCamera(v2, camera);
    if (rc.ray.intersectPlane(yPlane, hit)) {
      xs.push(hit.x);
      zs.push(hit.z);
    }
  }

  if (xs.length < 2) {
    return DESK_BOUNDS_FALLBACK;
  }

  let x0 = Math.min(...xs) + margin;
  let x1 = Math.max(...xs) - margin;
  let z0 = Math.min(...zs) + margin;
  let z1 = Math.max(...zs) - margin;
  if (x0 > x1) {
    const c = (x0 + x1) / 2;
    x0 = c;
    x1 = c;
  }
  if (z0 > z1) {
    const c = (z0 + z1) / 2;
    z0 = c;
    z1 = c;
  }

  return {
    x: [x0, x1],
    z: [z0, z1],
  };
}

/**
 * World XZ bounds on the y=0 plane that match the visible orthographic
 * frustum (full canvas), minus `margin` so objects do not sit half off-screen.
 *
 * Note: `useMemo` depends on the `camera` reference and `size`, not on
 * orthographic `position` / `zoom`. For drag bounds that must follow the
 * frustum on every move, call {@link computeVisibleDeskBounds} (see
 * `DraggableObject` and `DeskBall`).
 */
export function useWorkspaceDragBounds(margin = 1.1) {
  const { camera, size } = useThree();
  const { width: w, height: h } = size;

  return useMemo(() => {
    if (!(camera instanceof OrthographicCamera)) {
      return DESK_BOUNDS_FALLBACK;
    }
    return computeVisibleDeskBounds(camera, w, h, margin);
  }, [camera, w, h, margin]);
}
