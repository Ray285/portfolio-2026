"use client";

import { useEffect, useState } from "react";

export type PolaroidManifestItem = {
  /** Filename inside `public/polaroids/` — present for image-based items. */
  file?: string;
  /** Gradient palette — present for gradient placeholder items. */
  palette?: [string, string, string];
  /** Stable slug — used as the layout ID suffix (`polaroid-{slug}`). */
  slug: string;
  title: string;
  caption: string;
  /** Optional link href (same as `PolaroidItem.href`). */
  href?: string;
};

type PolaroidManifestFile = {
  version: 1;
  items: PolaroidManifestItem[];
};

function isManifest(x: unknown): x is PolaroidManifestFile {
  return (
    typeof x === "object" &&
    x !== null &&
    "version" in x &&
    (x as { version: unknown }).version === 1 &&
    "items" in x &&
    Array.isArray((x as { items: unknown }).items)
  );
}

/** Resolves to the public URL for a manifest item's image, or `undefined` for palette items. */
export function polaroidManifestItemImageUrl(
  item: PolaroidManifestItem,
): string | undefined {
  return item.file != null ? `/polaroids/${item.file}` : undefined;
}

/**
 * Fetches `/polaroid-manifest.json` once on mount and returns the item list.
 * Falls back to an empty array if the fetch fails or the file is malformed.
 */
export function usePolaroidManifest(): PolaroidManifestItem[] {
  const [items, setItems] = useState<PolaroidManifestItem[]>([]);

  useEffect(() => {
    fetch("/polaroid-manifest.json")
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null)
      .then((data: unknown) => {
        if (isManifest(data)) {
          setItems(data.items);
        }
      });
  }, []);

  return items;
}
