import type { Object3D } from "three";

/** Matches `deskItemId.polaroid("launch-notes")` */
export const POLAROID_3_LAYOUT_ID = "polaroid-launch-notes";

export function isPolaroid3IntroDebug(layoutId: string): boolean {
  return (
    layoutId === POLAROID_3_LAYOUT_ID &&
    process.env.NODE_ENV === "development"
  );
}

export function logPolaroid3Intro(
  phase: string,
  data?: Record<string, unknown>,
): void {
  if (!isPolaroid3IntroDebug(POLAROID_3_LAYOUT_ID)) return;
  if (data === undefined) {
    console.info("[polaroid-3-intro]", phase);
    return;
  }
  console.info("[polaroid-3-intro]", phase, data);
}

export function snapshotObject3D(name: string, o: Object3D) {
  return {
    name,
    position: o.position.toArray() as readonly [number, number, number],
    rotation: [o.rotation.x, o.rotation.y, o.rotation.z] as readonly [
      number,
      number,
      number,
    ],
    scale: o.scale.toArray() as readonly [number, number, number],
  };
}
