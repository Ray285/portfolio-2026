import { HANDWRITING_FONT_URL } from "@/lib/desk-handwriting-font";

/** Named fonts under `public/fonts/` — extend as you add files. */
export const DESK_FONT_PRESETS = {
  handwriting: HANDWRITING_FONT_URL,
} as const;

export type DeskFontPresetId = keyof typeof DESK_FONT_PRESETS;

export function resolveDeskFontUrl(opts: {
  preset?: DeskFontPresetId;
  fontUrl?: string;
}): string {
  if (opts.fontUrl?.trim()) {
    return opts.fontUrl.trim();
  }
  const preset = opts.preset ?? "handwriting";
  return DESK_FONT_PRESETS[preset];
}
