"use client";

import { RoundedBox, Text } from "@react-three/drei";
import { Mesh } from "three";
import { troikaTextDisableToneMap } from "@/lib/troika-text-sync";

type PortfolioCard3DProps = {
  title: string;
  label: string;
  description: string;
  accent?: string;
  /** “View Case Study” / “About Me” (etc.); set when the card is a link. */
  linkCta?: string;
};

export function PortfolioCard3D({
  title,
  label,
  description,
  accent = "#111827",
  linkCta,
}: PortfolioCard3DProps) {
  return (
    <group>
      <mesh castShadow receiveShadow>
        <boxGeometry args={[2.5, 0.08, 1.45]} />
        <meshStandardMaterial
          color="#fffefa"
          roughness={0.62}
          envMapIntensity={0}
          toneMapped={false}
        />
      </mesh>
      <mesh castShadow position={[-0.95, 0.052, -0.52]}>
        <boxGeometry args={[0.34, 0.018, 0.08]} />
        <meshStandardMaterial
          color={accent}
          roughness={0.5}
          envMapIntensity={0}
          toneMapped={false}
        />
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
        depthOffset={0.02}
        onSync={(m) => troikaTextDisableToneMap(m as Mesh)}
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
        depthOffset={0.02}
        onSync={(m) => troikaTextDisableToneMap(m as Mesh)}
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
        depthOffset={0.02}
        onSync={(m) => troikaTextDisableToneMap(m as Mesh)}
      >
        {description}
      </Text>
      {linkCta ? (
        <group position={[0.2, 0, 0.55]}>
          {/*
            drei's RoundedBox is a 2D rounded rect (arg0 × arg1) extruded by arg2.
            radius must be < min(arg0, arg1) / 2, and arg2 > 2×radius for a solid core.
            A prior 0.016 height with radius 0.055 made the 2D shape invalid → a thin
            sliver with no room for the label. */}
          <group
            position={[0, 0.1, 0]}
            rotation={[-Math.PI / 2, 0, 0]}
          >
            <RoundedBox
              args={[0.92, 0.1, 0.12]}
              radius={0.045}
              smoothness={4}
              receiveShadow
              castShadow
            >
              <meshStandardMaterial
                color="#000000"
                roughness={0.45}
                metalness={0}
                envMapIntensity={0}
                toneMapped={false}
              />
            </RoundedBox>
          </group>
          <Text
            position={[0, 0.17, 0]}
            rotation={[-Math.PI / 2, 0, 0]}
            anchorX="center"
            anchorY="middle"
            color="#ffffff"
            fontSize={0.045}
            maxWidth={0.88}
            textAlign="center"
            lineHeight={1}
            depthOffset={0.1}
            onSync={(m) => troikaTextDisableToneMap(m as Mesh)}
          >
            {linkCta}
          </Text>
        </group>
      ) : null}
    </group>
  );
}
