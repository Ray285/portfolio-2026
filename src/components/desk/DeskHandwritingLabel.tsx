"use client";

import { Text } from "@react-three/drei";
import {
  resolveDeskFontUrl,
  type DeskFontPresetId,
} from "@/lib/desk-font-presets";

type DeskHandwritingLabelProps = {
  children: string;
  /** World units — matches welcome header scale when ~0.44 */
  fontSize?: number;
  maxWidth?: number;
  color?: string;
  /** Named preset from `desk-font-presets`; ignored when `fontUrl` is set. */
  font?: DeskFontPresetId;
  /** Absolute URL/path under `public/` — overrides `font`. */
  fontUrl?: string;
};

/** Flat handwriting on the desk; wrap with `DraggableObject` for pose / arrange mode like polaroids. */
export function DeskHandwritingLabel({
  children,
  fontSize = 0.42,
  maxWidth = 14,
  color = "#1c1917",
  font,
  fontUrl,
}: DeskHandwritingLabelProps) {
  const lines = children.trim();
  if (!lines) {
    return null;
  }
  const resolvedFont = resolveDeskFontUrl({ preset: font, fontUrl });
  return (
    <Text
      position={[0, 0.028, 0]}
      rotation={[-Math.PI / 2, 0, 0]}
      anchorX="center"
      anchorY="middle"
      color={color}
      font={resolvedFont}
      fontSize={fontSize}
      maxWidth={maxWidth}
      textAlign="center"
      lineHeight={1.05}
    >
      {lines}
    </Text>
  );
}
