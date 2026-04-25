"use client";

import { Text } from "@react-three/drei";

type PortfolioCard3DProps = {
  title: string;
  label: string;
  description: string;
  accent?: string;
};

export function PortfolioCard3D({
  title,
  label,
  description,
  accent = "#111827",
}: PortfolioCard3DProps) {
  return (
    <group>
      <mesh castShadow receiveShadow>
        <boxGeometry args={[2.5, 0.08, 1.45]} />
        <meshStandardMaterial color="#fffefa" roughness={0.62} />
      </mesh>
      <mesh castShadow position={[-0.95, 0.052, -0.52]}>
        <boxGeometry args={[0.34, 0.018, 0.08]} />
        <meshStandardMaterial color={accent} roughness={0.5} />
      </mesh>
      <Text
        position={[-1.03, 0.062, -0.32]}
        rotation={[-Math.PI / 2, 0, 0]}
        anchorX="left"
        anchorY="middle"
        color="#71717a"
        fontSize={0.12}
        letterSpacing={0.08}
        textAlign="left"
      >
        {label.toUpperCase()}
      </Text>
      <Text
        position={[-1.03, 0.064, -0.05]}
        rotation={[-Math.PI / 2, 0, 0]}
        anchorX="left"
        anchorY="middle"
        color="#18181b"
        fontSize={0.22}
        maxWidth={1.9}
        textAlign="left"
      >
        {title}
      </Text>
      <Text
        position={[-1.03, 0.064, 0.32]}
        rotation={[-Math.PI / 2, 0, 0]}
        anchorX="left"
        anchorY="middle"
        color="#52525b"
        fontSize={0.115}
        lineHeight={1.35}
        maxWidth={1.95}
        textAlign="left"
      >
        {description}
      </Text>
    </group>
  );
}
