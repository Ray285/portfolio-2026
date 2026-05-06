import { Material, Mesh, type Object3D } from "three";

const OPACITY_EPS = 1e-4;

/**
 * Sets opacity on all mesh materials under `root` (0–1). While faded,
 * `castShadow` is off so an opacity‑0 prop does not still cast a dark silhouette
 * (read as “gray squares”) and `depthWrite` is relaxed for correct blending.
 *
 * Skips `material.needsUpdate` when opacity/transparent/depthWrite already match —
 * callers that re-invoke with the same fade every frame avoid redundant GPU pings.
 */
export function setObject3DTreeOpacity(root: Object3D, opacity: number) {
  const o = Math.min(1, Math.max(0, opacity));
  const fully = o >= 0.99;
  const wantTransparent = !fully;
  const wantDepthWrite = fully;

  root.traverse((obj) => {
    if (!(obj instanceof Mesh)) {
      return;
    }
    obj.castShadow = fully;

    const mats = obj.material;
    const list = Array.isArray(mats) ? mats : [mats];
    for (const mat of list) {
      if (mat == null || !("opacity" in mat)) {
        continue;
      }
      const m = mat as Material;
      if (
        Math.abs((m.opacity ?? 1) - o) < OPACITY_EPS &&
        m.transparent === wantTransparent &&
        m.depthWrite === wantDepthWrite
      ) {
        continue;
      }
      m.transparent = wantTransparent;
      m.opacity = o;
      m.depthWrite = wantDepthWrite;
      m.needsUpdate = true;
    }
  });
}
