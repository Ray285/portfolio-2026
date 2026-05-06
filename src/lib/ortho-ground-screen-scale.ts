import { Vector3 } from "three";
import type { OrthographicCamera } from "three";

const a = new Vector3();
const b = new Vector3();

/**
 * For a top-down (or near top-down) ortho camera, how many **CSS pixels** a
 * one–world-unit segment on the y=`worldY` plane measures on screen, averaged
 * for +X and +Z. Used to pick a 3D scale so an object of known world width
 * covers a target fraction of the **smaller** viewport edge across devices.
 */
export function worldGroundPixelsPerUnit(
  camera: OrthographicCamera,
  width: number,
  height: number,
  worldY = 0,
): number {
  if (width <= 0 || height <= 0) {
    return 1;
  }
  camera.updateMatrixWorld(true);
  a.set(0, worldY, 0);
  a.project(camera);
  b.set(1, worldY, 0);
  b.project(camera);
  const ax = (a.x * 0.5 + 0.5) * width;
  const ay = (-a.y * 0.5 + 0.5) * height;
  const bx = (b.x * 0.5 + 0.5) * width;
  const by = (-b.y * 0.5 + 0.5) * height;
  const pxX = Math.hypot(bx - ax, by - ay);

  a.set(0, worldY, 0);
  a.project(camera);
  b.set(0, worldY, 1);
  b.project(camera);
  const ax2 = (a.x * 0.5 + 0.5) * width;
  const ay2 = (-a.y * 0.5 + 0.5) * height;
  const pxZ = Math.hypot(
    (b.x * 0.5 + 0.5) * width - ax2,
    (-b.y * 0.5 + 0.5) * height - ay2,
  );
  return (pxX + pxZ) * 0.5;
}
