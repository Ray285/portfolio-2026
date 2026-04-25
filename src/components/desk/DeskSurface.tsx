/**
 * Floor is intentionally **not** lit by the IBL. A flat white `meshStandard`
 * with `scene.environment` often picks up a darker ring from the environment
 * map, which looks like a gray "frame" around the desk at a top-down view.
 */
export function DeskSurface() {
  return (
    <mesh
      position={[0, -0.04, 0]}
      rotation={[-Math.PI / 2, 0, 0]}
      receiveShadow
    >
      <planeGeometry args={[32, 22]} />
      <meshStandardMaterial
        color="#ffffff"
        roughness={0.88}
        metalness={0}
        envMapIntensity={0}
        toneMapped={false}
      />
    </mesh>
  );
}
