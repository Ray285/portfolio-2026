/**
 * desk layout: draggable positions/rotations + ball XZ, persisted as JSON
 * in `localStorage` (see `STORAGE_KEY`). `version` bumps when the shape
 * changes so we can extend without silent corruption.
 */

export const DESK_LAYOUT_VERSION = 1 as const;
export const DESK_LAYOUT_STORAGE_KEY = "portfolio-2026:desk-layout-v1" as const;

export type DeskItemLayout = {
  position: [number, number, number];
  rotation: [number, number, number];
};

export type DeskLayoutFileV1 = {
  version: typeof DESK_LAYOUT_VERSION;
  items: Record<string, DeskItemLayout>;
  /** World X, Z; Y is always ball radius. Omitted in older saves. */
  ball?: [number, number];
};

function isNumberTriple(x: unknown): x is [number, number, number] {
  return (
    Array.isArray(x) &&
    x.length === 3 &&
    x.every((n) => typeof n === "number" && Number.isFinite(n))
  );
}

function isPair(x: unknown): x is [number, number] {
  return (
    Array.isArray(x) &&
    x.length === 2 &&
    x.every((n) => typeof n === "number" && Number.isFinite(n))
  );
}

export function isDeskLayoutFileV1(x: unknown): x is DeskLayoutFileV1 {
  if (x === null || typeof x !== "object") {
    return false;
  }
  const o = x as Record<string, unknown>;
  if (o.version !== DESK_LAYOUT_VERSION) {
    return false;
  }
  if (typeof o.items !== "object" || o.items === null) {
    return false;
  }
  for (const v of Object.values(o.items)) {
    if (typeof v !== "object" || v === null) {
      return false;
    }
    const d = v as Record<string, unknown>;
    if (!isNumberTriple(d.position) || !isNumberTriple(d.rotation)) {
      return false;
    }
  }
  if (o.ball !== undefined && !isPair(o.ball)) {
    return false;
  }
  return true;
}

function normalizePartial(raw: unknown): {
  items: Record<string, DeskItemLayout>;
  ball: [number, number] | null;
} {
  if (!isDeskLayoutFileV1(raw)) {
    return { items: {}, ball: null };
  }
  return {
    items: { ...raw.items },
    ball: raw.ball ?? null,
  };
}

export function readDeskLayoutFromStorage(): {
  items: Record<string, DeskItemLayout>;
  ball: [number, number] | null;
} {
  if (typeof window === "undefined" || !window.localStorage) {
    return { items: {}, ball: null };
  }
  try {
    const s = window.localStorage.getItem(DESK_LAYOUT_STORAGE_KEY);
    if (s == null) {
      return { items: {}, ball: null };
    }
    return normalizePartial(JSON.parse(s) as unknown);
  } catch {
    return { items: {}, ball: null };
  }
}

export function writeDeskLayoutToStorage(layout: DeskLayoutFileV1): void {
  if (typeof window === "undefined" || !window.localStorage) {
    return;
  }
  try {
    window.localStorage.setItem(
      DESK_LAYOUT_STORAGE_KEY,
      JSON.stringify(layout, null, 2),
    );
  } catch {
    // quota / private mode; ignore
  }
}

export function buildDeskLayoutFileV1(
  items: Record<string, DeskItemLayout>,
  ball: [number, number],
): DeskLayoutFileV1 {
  return {
    version: DESK_LAYOUT_VERSION,
    items: { ...items },
    ball: [ball[0], ball[1]],
  };
}

export function formatDeskLayoutJson(layout: DeskLayoutFileV1): string {
  return JSON.stringify(layout, null, 2);
}

export function tryParseDeskLayoutJson(s: string): {
  ok: true;
  value: { items: Record<string, DeskItemLayout>; ball: [number, number] | null };
} | { ok: false; error: string } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(s) as unknown;
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
  const n = normalizePartial(parsed);
  if (Object.keys(n.items).length === 0 && n.ball == null) {
    return {
      ok: false,
      error: "Unrecognized or empty layout JSON (need at least one item or ball)",
    };
  }
  return { ok: true, value: n };
}

/** Stable id helpers (match `DeskScene` usage). */
export const deskItemId = {
  card: (index: number) => `card-${index}`,
  polaroid: (index: number) => `polaroid-${index}`,
  nameplate: "nameplate",
  pencil: "pencil",
} as const;
