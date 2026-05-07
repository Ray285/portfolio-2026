"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Text } from "@react-three/drei";
import { Group, MeshBasicMaterial } from "three";
import { HANDWRITING_FONT_URL } from "@/lib/desk-handwriting-font";

export interface JitterTextProps {
  children: string;
  /** World units — matches welcome header scale when ~0.44 */
  fontSize?: number;
  maxWidth?: number;
  color?: string;
  lineHeight?: number;
}

/** Draggable text on the desk with the same jitter shader as the welcome header. */
export function JitterText({
  children,
  fontSize = 0.44,
  maxWidth = 14,
  color = "#1c1917",
  lineHeight = 1.05,
}: JitterTextProps) {
  const groupRef = useRef<Group>(null);
  const jitterUniformRef = useRef<{ value: number } | null>(null);

  const jitterMaterial = useMemo(() => {
    const mat = new MeshBasicMaterial({ color });
    mat.onBeforeCompile = (shader) => {
      const uTime = { value: 0 };
      shader.uniforms.uTime = uTime;
      jitterUniformRef.current = uTime;
      shader.vertexShader =
        "uniform float uTime;\n" +
        shader.vertexShader.replace(
          "#include <begin_vertex>",
          `#include <begin_vertex>
float frame   = floor(uTime * 5.0);
float charBin = floor(position.x * 8.0);
transformed.x += sin(charBin * 127.1 + frame * 31.416) * 0.006;
transformed.y += cos(charBin * 311.7  + frame * 47.124) * 0.009;`,
        );
    };
    return mat;
  }, [color]);

  useFrame((_, delta) => {
    if (jitterUniformRef.current) {
      jitterUniformRef.current.value += delta;
    }
  });

  return (
    <group ref={groupRef}>
      <Text
        position={[0, 0.028, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        anchorX="center"
        anchorY="middle"
        color={color}
        font={HANDWRITING_FONT_URL}
        fontSize={fontSize}
        maxWidth={maxWidth}
        textAlign="center"
        lineHeight={lineHeight}
        material={jitterMaterial}
      >
        {children}
      </Text>
    </group>
  );
}
