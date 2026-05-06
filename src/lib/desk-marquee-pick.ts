import type {
  Camera as ThreeCamera,
  OrthographicCamera,
  PerspectiveCamera,
} from "three";
import { Plane, Raycaster, Vector2, Vector3 } from "three";

function cameraWithProjection(cam: ThreeCamera): PerspectiveCamera | OrthographicCamera {
  return cam as PerspectiveCamera | OrthographicCamera;
}
import type { ArrangePeerHandles } from "@/lib/desk-arrange-registry";

/** Approx desk surface Y for marquee center ray + primary-distance X/Z. */
const MARQUEE_DESK_PLANE_Y = 0.082;

/**
 * Applied to physics radius during marquee picking only (collision uses full radius).
 */
export const MARQUEE_PICK_RADIUS_SCALE = 0.88;

/** Vertices sampled on the pivot X/Z disk projected to NDc for SAT vs marquee AABB. */
const MARQUEE_DISK_SEGMENTS = 20;

/** Marquee SAT axis tests use this epsilon against parallel edges. */
const SAT_EPS = 1e-9;

const pivotProj = new Vector3();
const ringPt = new Vector3();
const intersectPlaneScratch = new Vector3();

/** NDc marquee + projected disk ring (SAT). */
export type NdVec2 = { readonly x: number; readonly y: number };

export function marqueeClientRectToNdcBounds(params: {
  canvasRect: DOMRect;
  minClientX: number;
  maxClientX: number;
  minClientY: number;
  maxClientY: number;
}): { minXNdc: number; maxXNdc: number; minYNdc: number; maxYNdc: number } {
  const {
    canvasRect,
    minClientX,
    maxClientX,
    minClientY,
    maxClientY,
  } = params;
  const w = canvasRect.width;
  const h = canvasRect.height;
  if (w <= 0 || h <= 0) {
    return { minXNdc: 0, maxXNdc: 0, minYNdc: 0, maxYNdc: 0 };
  }
  function toNDC(clientX: number, clientY: number) {
    const x = ((clientX - canvasRect.left) / w) * 2 - 1;
    const y = -((clientY - canvasRect.top) / h) * 2 + 1;
    return { x, y };
  }
  const c1 = toNDC(minClientX, minClientY);
  const c2 = toNDC(maxClientX, minClientY);
  const c3 = toNDC(minClientX, maxClientY);
  const c4 = toNDC(maxClientX, maxClientY);
  const xs = [c1.x, c2.x, c3.x, c4.x];
  const ys = [c1.y, c2.y, c3.y, c4.y];
  return {
    minXNdc: Math.min(...xs),
    maxXNdc: Math.max(...xs),
    minYNdc: Math.min(...ys),
    maxYNdc: Math.max(...ys),
  };
}

function projectRangePts(
  pts: readonly NdVec2[],
  ax: number,
  ay: number,
): [number, number] {
  const n = pts.length;
  if (n === 0) {
    return [0, 0];
  }
  let min = Infinity;
  let max = -Infinity;
  for (let i = 0; i < n; i++) {
    const k = pts[i].x * ax + pts[i].y * ay;
    min = Math.min(min, k);
    max = Math.max(max, k);
  }
  return [min, max];
}

function rectCorners(
  minX: number,
  maxX: number,
  minY: number,
  maxY: number,
): NdVec2[] {
  return [
    { x: minX, y: minY },
    { x: maxX, y: minY },
    { x: maxX, y: maxY },
    { x: minX, y: maxY },
  ];
}

function rangesOverlap(a0: number, a1: number, b0: number, b1: number): boolean {
  if (a1 < b0 - SAT_EPS || b1 < a0 - SAT_EPS) {
    return false;
  }
  return true;
}

/**
 * Convex polygon vs axis-aligned rect (NDc), SAT axes: (1,0), (0,1), polygon-edge normals.
 */
function satConvexPolyVsAaRect(poly: NdVec2[], bounds: NdVec2[]): boolean {
  if (poly.length < 3) {
    return false;
  }

  /** Unit axes aligned with the marquee */
  function testSeparation(ax: number, ay: number): boolean {
    const [amin, amax] = projectRangePts(poly, ax, ay);
    const [bmin, bmax] = projectRangePts(bounds, ax, ay);
    return rangesOverlap(amin, amax, bmin, bmax);
  }

  if (!testSeparation(1, 0)) {
    return false;
  }
  if (!testSeparation(0, 1)) {
    return false;
  }

  const n = poly.length;
  for (let i = 0; i < n; i++) {
    const ax0 = poly[i]?.x ?? 0;
    const ay0 = poly[i]?.y ?? 0;
    const j = (i + 1) % n;
    const bx = poly[j]?.x ?? 0;
    const by = poly[j]?.y ?? 0;
    const edx = bx - ax0;
    const edy = by - ay0;
    const elenSq = edx * edx + edy * edy;
    if (elenSq < 1e-24) {
      continue;
    }
    /** Inward perpendicular to edge (−Δy, Δx); normalise */
    let nx = -edy;
    let ny = edx;
    const nlen = Math.hypot(nx, ny);
    if (nlen < SAT_EPS) {
      continue;
    }
    nx /= nlen;
    ny /= nlen;
    if (!testSeparation(nx, ny)) {
      return false;
    }
  }

  /** Also test marquee corner axes if rect has duplicate projection — covered by (1,0)/(0,1). */
  /** Edge normals from rect on polygon (SAT for two convex polygons) — AABB normals already handled. */

  /** Test normals of rect edges (= (1,0) and (0,1)); already tested. */

  return true;
}

function buildNdDiskOutline(
  pivotX: number,
  pivotY: number,
  pivotZ: number,
  rWorld: number,
  camera: ThreeCamera,
  outPoly: NdVec2[],
): void {
  const nSeg = MARQUEE_DISK_SEGMENTS;
  twoPiSweep(nSeg, pivotX, pivotY, pivotZ, rWorld, camera, outPoly);
}

function twoPiSweep(
  nSeg: number,
  pivotX: number,
  pivotY: number,
  pivotZ: number,
  rWorld: number,
  camera: ThreeCamera,
  outPoly: NdVec2[],
): void {
  outPoly.length = 0;
  const twoPi = Math.PI * 2;
  for (let i = 0; i < nSeg; i++) {
    const t = (i / nSeg) * twoPi;
    ringPt.set(
      pivotX + Math.cos(t) * rWorld,
      pivotY,
      pivotZ + Math.sin(t) * rWorld,
    );
    ringPt.project(camera);
    outPoly.push({ x: ringPt.x, y: ringPt.y });
  }
}

const ringNdScratch: NdVec2[] = [];
const cornersScratch: NdVec2[] = [];

function xzDiskOverlapsMarqueeNdc(
  pivotX: number,
  pivotY: number,
  pivotZ: number,
  rWorld: number,
  camera: ThreeCamera,
  minXNdc: number,
  maxXNdc: number,
  minYNdc: number,
  maxYNdc: number,
): boolean {
  cameraWithProjection(camera).updateProjectionMatrix();
  camera.updateMatrixWorld(true);

  pivotProj.set(pivotX, pivotY, pivotZ).project(camera);
  const rcx = pivotProj.x;
  const rcy = pivotProj.y;
  /** Pivot inside marquee  fast accept */
  if (
    rcx >= minXNdc &&
    rcx <= maxXNdc &&
    rcy >= minYNdc &&
    rcy <= maxYNdc
  ) {
    return true;
  }

  buildNdDiskOutline(
    pivotX,
    pivotY,
    pivotZ,
    rWorld,
    camera,
    ringNdScratch,
  );
  cornersScratch.length = 0;
  cornersScratch.push(...rectCorners(minXNdc, maxXNdc, minYNdc, maxYNdc));

  return satConvexPolyVsAaRect(ringNdScratch, cornersScratch);
}

export function marqueeEffectiveFootprintRadiusWorld(
  handles: ArrangePeerHandles,
): number {
  return handles.getMarqueeRadius() * MARQUEE_PICK_RADIUS_SCALE;
}

const ndcForRay = new Vector2();
const raycasterDesk = new Raycaster();
const deskPlane = new Plane(new Vector3(0, 1, 0), -MARQUEE_DESK_PLANE_Y);

export function marqueeScreenCenterToWorldXZ(params: {
  camera: ThreeCamera;
  canvasRect: DOMRect;
  centerClientX: number;
  centerClientY: number;
}): { x: number; z: number } | null {
  const { camera, canvasRect, centerClientX, centerClientY } = params;
  const w = canvasRect.width;
  const h = canvasRect.height;
  if (w <= 0 || h <= 0) {
    return null;
  }
  ndcForRay.x = ((centerClientX - canvasRect.left) / w) * 2 - 1;
  ndcForRay.y = -((centerClientY - canvasRect.top) / h) * 2 + 1;
  raycasterDesk.setFromCamera(ndcForRay, camera);
  const ray = raycasterDesk.ray;
  const hit = ray.intersectPlane(deskPlane, intersectPlaneScratch);
  if (hit == null) {
    return null;
  }
  return { x: hit.x, z: hit.z };
}

export function pickLayoutsInMarqueeNdc(params: {
  bounds: ReturnType<typeof marqueeClientRectToNdcBounds>;
  peers: Iterable<readonly [string, ArrangePeerHandles]>;
  camera: ThreeCamera;
  marqueeWorldCenterXZ: { x: number; z: number } | null;
}): { ids: string[]; primaryId: string | null } {
  const { bounds, peers, camera, marqueeWorldCenterXZ } = params;

  const { minXNdc, maxXNdc, minYNdc, maxYNdc } = bounds;

  type Cand = { id: string; distSq: number };
  const found: Cand[] = [];

  for (const [id, handles] of peers) {
    const snap = handles.snapshotLayout();
    const px = snap.position[0];
    const py = snap.position[1];
    const pz = snap.position[2];
    const rWorld = marqueeEffectiveFootprintRadiusWorld(handles);

    const overlap = xzDiskOverlapsMarqueeNdc(
      px,
      py,
      pz,
      rWorld,
      camera,
      minXNdc,
      maxXNdc,
      minYNdc,
      maxYNdc,
    );
    if (!overlap) {
      continue;
    }
    const distSq =
      marqueeWorldCenterXZ == null
        ? 0
        : (px - marqueeWorldCenterXZ.x) ** 2 +
          (pz - marqueeWorldCenterXZ.z) ** 2;
    found.push({ id, distSq });
  }

  if (found.length === 0) {
    return { ids: [], primaryId: null };
  }

  found.sort((a, b) => {
    const d = a.distSq - b.distSq;
    if (Math.abs(d) > 1e-15) {
      return d;
    }
    return a.id.localeCompare(b.id);
  });

  return {
    ids: found.map((c) => c.id),
    primaryId: found[0]?.id ?? null,
  };
}
