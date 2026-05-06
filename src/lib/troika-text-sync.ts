import type { Material, Mesh } from "three";

/** Troika SDF + ACES can wash mid-grays; disabling tone mapping matches flat UI text. */
export function troikaTextDisableToneMap(mesh: Mesh) {
  const r = mesh.material;
  const list: Material[] = Array.isArray(r) ? r : r ? [r] : [];
  for (const m of list) {
    if (m && "toneMapped" in m) {
      (m as { toneMapped: boolean }).toneMapped = false;
    }
  }
}
