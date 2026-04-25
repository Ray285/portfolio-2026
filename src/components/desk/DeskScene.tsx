"use client";

import { Suspense, useLayoutEffect, useRef } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import {
  ContactShadows,
  Environment,
  OrthographicCamera,
  Text,
} from "@react-three/drei";
import { DirectionalLight, PCFShadowMap, type WebGLRenderer } from "three";
import { useDeskControls } from "@/context/DeskControlsContext";
import { DeskSurface } from "./DeskSurface";
import { CameraViewControls } from "./CameraViewControls";
import { DeskBall } from "./DeskBall";
import { DeskPhysicsProvider } from "./DeskPhysicsContext";
import { DraggableObject } from "./DraggableObject";
import { PolaroidPhoto } from "./PolaroidPhoto";
import { PortfolioCard3D } from "./PortfolioCard3D";
import { useDeskLayout } from "@/context/DeskLayoutContext";
import { deskItemId, type DeskItemLayout } from "@/lib/desk-layout";
import { polaroids, portfolioItems } from "@/lib/portfolio-data";
import { DEFAULT_CAMERA } from "@/lib/desk-scene-defaults";

const cardAccents = ["#18181b", "#64748b", "#a8a29e"];

const POLAROID_GRID_COLS = 4;
const CARD_PHYSICS = {
  radius: 1.22,
  pushRadius: 1.6,
  pushStrength: 0.34,
  tiltStrength: 0.2,
  tiltLimit: 0.11,
  lift: 0.08,
  focusLift: 0.64,
  focusScale: 1.32,
  focusCenterStrength: 0.88,
} as const;
const POLAROID_PHYSICS = {
  radius: 0.72,
  pushRadius: 1.25,
  pushStrength: 0.28,
  tiltStrength: 0.24,
  tiltLimit: 0.13,
  lift: 0.075,
  focusLift: 0.68,
  focusScale: 1.62,
  focusCenterStrength: 0.9,
} as const;
const NAMEPLATE_PHYSICS = {
  radius: 1.1,
  pushRadius: 1.4,
  pushStrength: 0.22,
  tiltStrength: 0.12,
  tiltLimit: 0.08,
  lift: 0.055,
  focusLift: 0.52,
  focusScale: 1.3,
  focusCenterStrength: 0.84,
} as const;
const PENCIL_PHYSICS = {
  radius: 0.55,
  pushRadius: 1.05,
  pushStrength: 0.18,
  tiltStrength: 0.18,
  tiltLimit: 0.1,
  lift: 0.05,
  focusLift: 0.48,
  focusScale: 1.38,
  focusCenterStrength: 0.8,
} as const;

const PORTFOLIO_HEADER_FONT = "/fonts/HandwrittingVolII-Bold.otf" as const;

const DEFAULT_BALL_XZ: [number, number] = [4.4, 1.6];

const CARD_DEFAULTS: DeskItemLayout[] = [
  { position: [-3.75, 0.06, -1.85], rotation: [0, -0.13, 0] },
  { position: [0.05, 0.06, -2.35], rotation: [0, 0.08, 0] },
  { position: [3.65, 0.06, -1.55], rotation: [0, -0.06, 0] },
];

const NAMEPLATE_DEFAULT: DeskItemLayout = {
  position: [-4.5, 0.05, 3.1],
  rotation: [0, 0.1, 0],
};

const PENCIL_DEFAULT: DeskItemLayout = {
  position: [4.35, 0.04, 2.95],
  rotation: [0, -0.18, 0],
};

function applyToneMappingExposure(renderer: WebGLRenderer, exposure: number) {
  renderer.toneMappingExposure = exposure;
}

function getPolaroidLayout(
  index: number,
): { position: [number, number, number]; rotation: [number, number, number] } {
  const col = index % POLAROID_GRID_COLS;
  const row = Math.floor(index / POLAROID_GRID_COLS);
  const xStart = -3.4;
  const zStart = -0.35;
  const stepX = 1.85;
  const stepZ = 1.05;
  const x = xStart + col * stepX + (row & 1) * 0.2;
  const z = zStart + row * stepZ;
  const ry = 0.14 * Math.sin(index * 0.6 + col * 0.2);
  return {
    position: [x, 0.05, z] as [number, number, number],
    rotation: [0, ry, 0] as [number, number, number],
  };
}

/** Key / fill positions: defaults in `desk-scene-defaults.ts` and the Scene panel. */
function KeyLight() {
  const { controls } = useDeskControls();
  const ref = useRef<DirectionalLight>(null);

  useLayoutEffect(() => {
    const light = ref.current;
    if (!light) {
      return;
    }
    const cam = light.shadow.camera;
    light.shadow.mapSize.set(4096, 4096);
    light.shadow.radius = controls.shadowRadius;
    cam.near = 0.1;
    cam.far = 64;
    cam.left = -28;
    cam.right = 28;
    cam.top = 22;
    cam.bottom = -22;
    light.shadow.bias = -0.00022;
    light.shadow.normalBias = 0.055;
    light.shadow.camera.updateProjectionMatrix();
  }, [controls.shadowRadius]);

  return (
    <directionalLight
      ref={ref}
      castShadow
      position={[controls.keyLightX, controls.keyLightY, controls.keyLightZ]}
      intensity={controls.keyLight}
    />
  );
}

/** No shadows — softens shadow-side falloff so cards and polas do not “fade away.” */
function FillLight() {
  const { controls } = useDeskControls();
  return (
    <directionalLight
      castShadow={false}
      position={[
        controls.fillLightX,
        controls.fillLightY,
        controls.fillLightZ,
      ]}
      intensity={controls.fillLight}
      color="#f8f6f2"
    />
  );
}

function ToneMappingSync() {
  const { gl } = useThree();
  const { controls } = useDeskControls();
  useLayoutEffect(() => {
    applyToneMappingExposure(gl, controls.exposure);
  }, [gl, controls.exposure]);
  return null;
}

function ResponsiveCamera() {
  const { size } = useThree();
  const { controls } = useDeskControls();
  const baseZoom = Math.min(76, size.width / 15.2, size.height / 9.8);
  /** World Y (height) moves the camera along the view axis; for ortho, that does not
   *  change the projected image, so we scale `zoom` with height so a higher Y reads as
   *  “further / see more of the desk” and lower Y as tighter, matching the panel copy. */
  const yForZoom = Math.max(1, controls.cameraY);
  const heightZoomFactor = DEFAULT_CAMERA.y / yForZoom;
  const zoom = baseZoom * controls.cameraZoom * heightZoomFactor;

  return (
    <OrthographicCamera
      makeDefault
      position={[
        controls.cameraX,
        controls.cameraY,
        controls.cameraZ,
      ]}
      rotation={[-Math.PI / 2, 0, 0]}
      zoom={zoom}
      near={0.1}
      far={40}
    />
  );
}

function Pencil() {
  return (
    <group rotation={[0, 0.22, 0]}>
      <mesh castShadow position={[0, 0.03, 0]}>
        <boxGeometry args={[2.15, 0.06, 0.13]} />
        <meshStandardMaterial color="#f8e9b8" roughness={0.55} />
      </mesh>
      <mesh castShadow position={[1.13, 0.03, 0]}>
        <coneGeometry args={[0.1, 0.26, 4]} />
        <meshStandardMaterial color="#d6d3d1" roughness={0.5} />
      </mesh>
      <mesh castShadow position={[-1.14, 0.03, 0]}>
        <boxGeometry args={[0.18, 0.07, 0.15]} />
        <meshStandardMaterial color="#f5d0d8" roughness={0.5} />
      </mesh>
    </group>
  );
}

/** Large static header on the desk; uses WOFF/OTF from `public/fonts/`. */
function WelcomeHeader() {
  return (
    <Text
      position={[0, 0.04, 0.65]}
      rotation={[-Math.PI / 2, 0, 0]}
      anchorX="center"
      anchorY="middle"
      color="#1c1917"
      font={PORTFOLIO_HEADER_FONT}
      fontSize={0.44}
      maxWidth={14}
      textAlign="center"
      lineHeight={1.05}
    >
      Welcome to my portfolio
    </Text>
  );
}

function NamePlate() {
  return (
    <group>
      <mesh castShadow receiveShadow>
        <boxGeometry args={[2.7, 0.055, 0.7]} />
        <meshStandardMaterial color="#ffffff" roughness={0.68} />
      </mesh>
      <Text
        position={[-1.15, 0.042, -0.04]}
        rotation={[-Math.PI / 2, 0, 0]}
        anchorX="left"
        anchorY="middle"
        color="#18181b"
        fontSize={0.17}
        maxWidth={2.25}
      >
        Raymond Lemon
      </Text>
      <Text
        position={[-1.15, 0.042, 0.2]}
        rotation={[-Math.PI / 2, 0, 0]}
        anchorX="left"
        anchorY="middle"
        color="#71717a"
        fontSize={0.075}
        letterSpacing={0.06}
        maxWidth={2.25}
      >
        PORTFOLIO 2026
      </Text>
    </group>
  );
}

function polaroidDefaultLayout(index: number): DeskItemLayout {
  const { position, rotation } = getPolaroidLayout(index);
  return { position, rotation };
}

function DeskObjects() {
  const { getItem, getBallXZ, sampleBallXZ, recordBall } = useDeskLayout();
  const nameplate = getItem(deskItemId.nameplate, NAMEPLATE_DEFAULT);
  const pencil = getItem(deskItemId.pencil, PENCIL_DEFAULT);

  return (
    <>
      {portfolioItems.map((item, index) => {
        const def = CARD_DEFAULTS[index] ?? CARD_DEFAULTS[0];
        const l = getItem(deskItemId.card(index), def);
        return (
          <DraggableObject
            key={item.title}
            layoutId={deskItemId.card(index)}
            position={l.position}
            rotation={l.rotation}
            physics={CARD_PHYSICS}
          >
            <PortfolioCard3D
              title={item.title}
              label={item.label}
              description={item.description}
              accent={cardAccents[index]}
            />
          </DraggableObject>
        );
      })}

      <Suspense fallback={null}>
        {polaroids.map((photo, index) => {
          const def = polaroidDefaultLayout(index);
          const l = getItem(deskItemId.polaroid(index), def);
          return (
            <DraggableObject
              key={photo.imageUrl ?? `${photo.title}-${index}`}
              layoutId={deskItemId.polaroid(index)}
              position={l.position}
              rotation={l.rotation}
              physics={POLAROID_PHYSICS}
            >
              <PolaroidPhoto palette={photo.palette} imageUrl={photo.imageUrl} />
            </DraggableObject>
          );
        })}
      </Suspense>

      <DraggableObject
        layoutId={deskItemId.nameplate}
        position={nameplate.position}
        rotation={nameplate.rotation}
        physics={NAMEPLATE_PHYSICS}
      >
        <NamePlate />
      </DraggableObject>

      <DraggableObject
        layoutId={deskItemId.pencil}
        position={pencil.position}
        rotation={pencil.rotation}
        physics={PENCIL_PHYSICS}
      >
        <Pencil />
      </DraggableObject>

      <Suspense fallback={null}>
        <DeskBall
          initialPosition={getBallXZ(DEFAULT_BALL_XZ)}
          onWorldXZFrame={sampleBallXZ}
          onCommitWorldXZ={recordBall}
        />
      </Suspense>
    </>
  );
}

export default function DeskScene() {
  return (
    <div className="fixed inset-0 z-0 h-dvh w-full min-h-0">
      <Canvas
        className="block h-full w-full"
        shadows={{ type: PCFShadowMap }}
        dpr={[1, 1.8]}
        gl={{ antialias: true, alpha: false }}
        camera={{ position: [0, 8, 0], rotation: [-Math.PI / 2, 0, 0] }}
        onCreated={({ gl }) => {
          gl.setClearColor(0xffffff, 1);
        }}
      >
        <color attach="background" args={["#ffffff"]} />
        <ToneMappingSync />
        <CameraViewControls />
        <ResponsiveCamera />
        <SceneLights />
        <DeskSurface />
        <Suspense fallback={null}>
          <WelcomeHeader />
        </Suspense>
        <DeskPhysicsProvider>
          <DeskObjects />
        </DeskPhysicsProvider>
        <ContactShadowsGroup />
      </Canvas>
    </div>
  );
}

function SceneLights() {
  const { controls } = useDeskControls();
  return (
    <>
      <ambientLight intensity={controls.ambient} />
      <hemisphereLight
        color="#ffffff"
        groundColor="#ededea"
        intensity={controls.hemisphere}
      />
      <KeyLight />
      <FillLight />
      <Environment preset="studio" environmentIntensity={controls.environment} />
    </>
  );
}

function ContactShadowsGroup() {
  const { controls } = useDeskControls();
  return (
    <ContactShadows
      position={[0, 0.01, 0]}
      scale={controls.contactScale}
      blur={controls.contactBlur}
      opacity={controls.contactOpacity}
      far={2.5}
    />
  );
}

