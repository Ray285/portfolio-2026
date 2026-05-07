"use client";

import { Suspense, useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Environment, OrthographicCamera, Text } from "@react-three/drei";
import { CuboidCollider, Physics, RigidBody } from "@react-three/rapier";
import { ContactShadows } from "./ContactShadows";
import { DeskAnimatedTextureDriver } from "./DeskAnimatedTextureDriver";
import { DirectionalLight, Group, MeshBasicMaterial, PCFShadowMap, type WebGLRenderer } from "three";
import { useDeskSceneId } from "@/context/DeskSceneContext";
import { useDeskControls } from "@/context/DeskControlsContext";
import { useDeskIntroOptional } from "@/context/DeskIntroContext";
import { DeskSurface } from "./DeskSurface";
import { CameraViewControls } from "./CameraViewControls";
import { DeskBall } from "./DeskBall";
import { DeskPhysicsProvider } from "./DeskPhysicsContext";
import { DraggableObject } from "./DraggableObject";
import { RapierBoundaryWalls } from "./RapierBoundaryWalls";
import { AboutDeskLoopVideo } from "./AboutDeskLoopVideo";
import { DeskHandwritingLabel } from "./DeskHandwritingLabel";
import { JitterText } from "./JitterText";
import {
  DeskArrangeMarquee,
  type DeskMarqueeOverlayRect,
} from "./DeskArrangeMarquee";
import { PolaroidPhoto } from "./PolaroidPhoto";
import { PortfolioCard3D } from "./PortfolioCard3D";
import { ItemIntroTimeProvider } from "@/context/DeskItemIntroContext";
import { StaggerGsapProvider, useStaggerGsapOptional } from "@/context/StaggerGsapContext";
import { useDeskLayout } from "@/context/DeskLayoutContext";
import { DeskLoadIntro } from "./DeskLoadIntro";
import { deskItemId, type DeskItemLayout } from "@/lib/desk-layout";
import { getDeskIntroStaggerAfterCamera } from "@/lib/desk-intro-timelines";
import {
  aboutPolaroids,
  getDeskTextOverlaysForScene,
  getPortfolioLinkCta,
  polaroids,
  portfolioItems,
} from "@/lib/portfolio-data";
import { HANDWRITING_FONT_URL } from "@/lib/desk-handwriting-font";
import { setObject3DTreeOpacity } from "@/lib/three-object-opacity";
import { WELCOME_HEADER_STAGGER_ID } from "@/lib/desk-intro-timelines/desk-intro-imperative";
import { DEFAULT_CAMERA } from "@/lib/desk-scene-defaults";
import { DESK_SCENE_ABOUT, DESK_SCENE_HOME } from "@/lib/desk-scene-id";

/** After camera intro on `/`, ease contact shadow visibility up alongside staggered props. */
const CONTACT_SHADOW_INTRO_REVEAL_SMOOTH = 0.85;

const cardAccents = ["#18181b", "#64748b", "#a8a29e"];

const POLAROID_GRID_COLS = 4;

const HOME_INTRO_FLASH_CUT_IMAGES = [
  "/intro-images/tumblr_m10drfer9v1r25pfoo1_640.jpg",
  "/intro-images/tumblr_lqct1fWfkz1r25pfoo1_1280.png",
  "/intro-images/coca-cola.jpeg",
  "/intro-images/tumblr_m50b6zQsBq1r25pfoo1_1280.jpg",
  "/intro-images/self-portrait_Raymond-Lemon.jpeg",
];

const CARD_PHYSICS = {
  radius: 1.22,
  pushRadius: 1.6,
  pushStrength: 0.34,
  tiltStrength: 0.17,
  tiltLimit: 0.1,
  tiltClearanceScale: 0.48,
  tiltClearanceMax: 0.042,
  focusApproxHalfHeight: 0.052,
  lift: 0.08,
  focusLift: 0.78,
  focusScale: 1.22,
  focusCenterStrength: 0.98,
  focusModalWidthWorld: 2.5,
} as const;
const POLAROID_PHYSICS = {
  radius: 0.72,
  pushRadius: 1.25,
  pushStrength: 0.28,
  tiltStrength: 0.2,
  tiltLimit: 0.11,
  tiltClearanceScale: 0.46,
  tiltClearanceMax: 0.04,
  focusApproxHalfHeight: 0.06,
  lift: 0.075,
  focusLift: 0.84,
  focusScale: 1.4,
  focusCenterStrength: 0.98,
  focusModalWidthWorld: 1.75,
  participatesInBallPhysics: false,
} as const;

const ABOUT_LOOP_VIDEO_PHYSICS = {
  ...POLAROID_PHYSICS,
  radius: 1.38,
  pushRadius: 1.48,
  focusModalWidthWorld: 3.25,
  focusApproxHalfHeight: 0.025,
  participatesInBallPhysics: false,
} as const;
const HANDWRITING_LABEL_PHYSICS = {
  ...POLAROID_PHYSICS,
  radius: 1.5,
  pushRadius: 1.55,
  focusModalWidthWorld: 6,
  focusApproxHalfHeight: 0.04,
  participatesInBallPhysics: false,
} as const;

const CARD_DEFAULTS: DeskItemLayout[] = [
  { position: [-3.75, 0.08, -1.85], rotation: [0, -0.13, 0] },
  { position: [0.05, 0.08, -2.35], rotation: [0, 0.08, 0] },
  { position: [3.65, 0.08, -1.55], rotation: [0, -0.06, 0] },
];

/** Center-bottom of the desk — default for the home desk loop video. */
const HOME_DESK_VIDEO_DEFAULT: DeskItemLayout = {
  position: [0.5, 0.08, 1.5],
  rotation: [0, -0.1, 0],
};


/**
 * ——— Adding `/about` loop clips ———
 * ① Append a row to `ABOUT_LOOP_CLIP_INSTANCES` (unique `layoutId`, `src`, `defaultLayout`).
 * ② **`Loop_25`** / **`Loop_48`** / **`Loop_8`** / timelines / **`loop19-extra-{a–d}`** / **`loop46-extra-{1–7}`** / **`supplement-{1–4}`** (`Loop_31`/`Loop_36` on **1–2**, **`old-2000s-commercial-snippet`** on **3**).
 * ——— Adding `/about` polaroids ———
 * List filenames in **`portfolio-data`** (`ABOUT_POLAROID_FILES`); layout keys **`about-polaroid-<layoutId>`** where **`layoutId`** = filename stem (`aboutPolaroidLayoutIdFromFilename`).
 * ③ **`desk-layout-about.json`** → `items["…"]` (`desk-layout.ts` → **`deskItemId`**).
 */

/** Fallback before bundled/saved JSON includes layout for `about-loop-video`. */
const ABOUT_LOOP_VIDEO_DEFAULT: DeskItemLayout = {
  position: [0.6, 0.082, 2.35],
  rotation: [0, 0.06, 0],
};

const ABOUT_LOOP_VIDEO_2_DEFAULT: DeskItemLayout = {
  position: [-1.45, 0.082, 2.35],
  rotation: [0, -0.06, 0],
};

const ABOUT_LOOP_VIDEO_3_DEFAULT: DeskItemLayout = {
  position: [2.5, 0.082, 2.35],
  rotation: [0, 0.05, 0],
};

/** `Loop_8.webm` — place with Arrange (`about-loop-video-loop-8`). */
const ABOUT_LOOP_VIDEO_LOOP_8_DEFAULT: DeskItemLayout = {
  position: [-0.2, 0.082, 1.85],
  rotation: [0, -0.04, 0],
};

/** `Loop_19` paired with `my-start-01-timeframe` — tweak in Arrange. */
const ABOUT_LOOP_VIDEO_TIMEFRAME_MY_START_01_DEFAULT: DeskItemLayout = {
  position: [-2.0, 0.082, -0.4],
  rotation: [0, 0.05, 0],
};

/** `Loop_19` paired with `my-start-03-timeframe`. */
const ABOUT_LOOP_VIDEO_TIMEFRAME_MY_START_03_DEFAULT: DeskItemLayout = {
  position: [-4.0, 0.082, 2.0],
  rotation: [0, 0.04, 0],
};

/** `Loop_19` paired with `my-start-04-timeframe`. */
const ABOUT_LOOP_VIDEO_TIMEFRAME_MY_START_04_DEFAULT: DeskItemLayout = {
  position: [1.0, 0.082, 2.6],
  rotation: [0, -0.06, 0],
};

/** Extra `Loop_19` meshes (paired with Arrange keys `*-extra-{a,b,c,d}`). */
const ABOUT_LOOP_VIDEO_LOOP19_EXTRA_A_DEFAULT: DeskItemLayout = {
  position: [-2.585, 0.082, 3.07],
  rotation: [0, -0.56, 0],
};

const ABOUT_LOOP_VIDEO_LOOP19_EXTRA_B_DEFAULT: DeskItemLayout = {
  position: [0.53, 0.082, 3.15],
  rotation: [0, -0.49, 0],
};

const ABOUT_LOOP_VIDEO_LOOP19_EXTRA_C_DEFAULT: DeskItemLayout = {
  position: [-3.4, 0.082, 4.45],
  rotation: [0, -0.42, 0],
};

const ABOUT_LOOP_VIDEO_LOOP19_EXTRA_D_DEFAULT: DeskItemLayout = {
  position: [2.15, 0.082, 4.38],
  rotation: [0, -0.38, 0],
};

/** Placeholder poses for **`about-loop-video-supplement-{1–4}`** — align with bundled JSON / Arrange. */
const ABOUT_LOOP_VIDEO_SUPPLEMENT_1_DEFAULT: DeskItemLayout = {
  position: [3.8, 0.082, -1.2],
  rotation: [0, 0.06, 0],
};
const ABOUT_LOOP_VIDEO_SUPPLEMENT_2_DEFAULT: DeskItemLayout = {
  position: [5.6, 0.082, 0.9],
  rotation: [0, -0.09, 0],
};
const ABOUT_LOOP_VIDEO_SUPPLEMENT_3_DEFAULT: DeskItemLayout = {
  position: [4.9, 0.082, 5.6],
  rotation: [0, 0.1, 0],
};
const ABOUT_LOOP_VIDEO_SUPPLEMENT_4_DEFAULT: DeskItemLayout = {
  position: [-6.2, 0.082, 5.9],
  rotation: [0, -0.15, 0],
};

/** Seven **`Loop_46`** meshes (`about-loop-video-loop46-extra-{1–7}`) — tweak in Arrange / bundled JSON. */
const ABOUT_LOOP_VIDEO_LOOP46_EXTRA_DEFAULTS: DeskItemLayout[] = Array.from(
  { length: 7 },
  (_, i) => {
    const col = i % 4;
    const row = Math.floor(i / 4);
    const x = -5 + col * 3.2;
    const z = 4.2 + row * 1.35;
    const ry = -0.22 + col * 0.06 + row * 0.05;
    return {
      position: [x, 0.082, z] as [number, number, number],
      rotation: [0, ry, 0] as [number, number, number],
    };
  },
);

/**
 * One draggable `AboutDeskLoopVideo` each. Duplicate **`Loop_19`** / **`Loop_46`** `src`: independent `<video>`/texture (`Loop_48`/`Loop_25`/`Loop_31`/`Loop_36`/`old-2000s-commercial-snippet` where noted).
 */
const ABOUT_LOOP_CLIP_INSTANCES = [
  {
    layoutId: deskItemId.aboutLoopVideo,
    src: "/about/Loop_25.webm",
    defaultLayout: ABOUT_LOOP_VIDEO_DEFAULT,
  },
  {
    layoutId: deskItemId.aboutLoopVideo3,
    src: "/about/Loop_48.webm",
    defaultLayout: ABOUT_LOOP_VIDEO_3_DEFAULT,
  },
  {
    layoutId: deskItemId.aboutLoopVideoLoop8,
    src: "/about/Loop_8.webm",
    defaultLayout: ABOUT_LOOP_VIDEO_LOOP_8_DEFAULT,
  },
  {
    layoutId: deskItemId.aboutLoopVideoTimeframeMyStart01,
    src: "/about/Loop_19.webm",
    defaultLayout: ABOUT_LOOP_VIDEO_TIMEFRAME_MY_START_01_DEFAULT,
  },
  {
    layoutId: deskItemId.aboutLoopVideo2,
    src: "/about/Loop_19.webm",
    defaultLayout: ABOUT_LOOP_VIDEO_2_DEFAULT,
  },
  {
    layoutId: deskItemId.aboutLoopVideoTimeframeMyStart03,
    src: "/about/Loop_19.webm",
    defaultLayout: ABOUT_LOOP_VIDEO_TIMEFRAME_MY_START_03_DEFAULT,
  },
  {
    layoutId: deskItemId.aboutLoopVideoTimeframeMyStart04,
    src: "/about/Loop_19.webm",
    defaultLayout: ABOUT_LOOP_VIDEO_TIMEFRAME_MY_START_04_DEFAULT,
  },
  {
    layoutId: deskItemId.aboutLoopVideoLoop19ExtraA,
    src: "/about/Loop_19.webm",
    defaultLayout: ABOUT_LOOP_VIDEO_LOOP19_EXTRA_A_DEFAULT,
  },
  {
    layoutId: deskItemId.aboutLoopVideoLoop19ExtraB,
    src: "/about/Loop_19.webm",
    defaultLayout: ABOUT_LOOP_VIDEO_LOOP19_EXTRA_B_DEFAULT,
  },
  {
    layoutId: deskItemId.aboutLoopVideoLoop19ExtraC,
    src: "/about/Loop_19.webm",
    defaultLayout: ABOUT_LOOP_VIDEO_LOOP19_EXTRA_C_DEFAULT,
  },
  {
    layoutId: deskItemId.aboutLoopVideoLoop19ExtraD,
    src: "/about/Loop_19.webm",
    defaultLayout: ABOUT_LOOP_VIDEO_LOOP19_EXTRA_D_DEFAULT,
  },
  {
    layoutId: deskItemId.aboutLoopVideoSupplement1,
    src: "/about/Loop_31.webm",
    defaultLayout: ABOUT_LOOP_VIDEO_SUPPLEMENT_1_DEFAULT,
  },
  {
    layoutId: deskItemId.aboutLoopVideoSupplement2,
    src: "/about/Loop_36.webm",
    defaultLayout: ABOUT_LOOP_VIDEO_SUPPLEMENT_2_DEFAULT,
  },
  {
    layoutId: deskItemId.aboutLoopVideoSupplement3,
    src: "/about/old-2000s-commercial-snippet.webm",
    defaultLayout: ABOUT_LOOP_VIDEO_SUPPLEMENT_3_DEFAULT,
  },
  {
    layoutId: deskItemId.aboutLoopVideoSupplement4,
    src: "/about/Loop_19.webm",
    defaultLayout: ABOUT_LOOP_VIDEO_SUPPLEMENT_4_DEFAULT,
  },
  ...Array.from({ length: 7 }, (_, i) => ({
    layoutId: deskItemId.aboutLoopVideoLoop46Extra(i + 1),
    src: "/about/Loop_46.webm",
    defaultLayout: ABOUT_LOOP_VIDEO_LOOP46_EXTRA_DEFAULTS[i]!,
  })),
] as const;

/** Bundled fallback for draggable desk text (`desk-text-*`). */
const DESK_TEXT_FALLBACK_LAYOUT: DeskItemLayout = {
  position: [0, 0.04, 0.65],
  rotation: [0, 0, 0],
};

/** Optional default pose per overlay id — unset ids use [`DESK_TEXT_FALLBACK_LAYOUT`](DeskScene). */
const DESK_TEXT_LAYOUT_DEFAULTS: Partial<
  Record<string, DeskItemLayout>
> = {};

/** Scattered jitter-text elements across the desk — same shader as welcome header.
 *  Add entries here and place them via Arrange or the bundled JSON. */
interface JitterDeskTextItem {
  id: string;
  text: string;
  position: [number, number, number];
  rotation: [number, number, number];
  fontSize?: number;
  maxWidth?: number;
  lineHeight?: number;
}

const JITTER_DESK_TEXTS: JitterDeskTextItem[] = [];

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
    position: [x, 0.07, z] as [number, number, number],
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
      color={controls.keyLightColor}
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
      color={controls.fillLightColor}
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

/** Avoid orthographic `zoom` = 0 when R3F `size` is still 0×0 (e.g. first frame on iOS). */
const MIN_ORTHO_ZOOM = 0.01;

function ResponsiveCamera() {
  const { size } = useThree();
  const { controls } = useDeskControls();
  // Fit the full desk content (≈11.3 × 6.75 world units) with ~10 % padding.
  // width/13 and height/7.5 encode those target visible-world dimensions.
  const safeW = Math.max(1, size.width);
  const safeH = Math.max(1, size.height);
  const baseZoom = Math.min(76, safeW / 13, safeH / 7.5);
  /** World Y (height) moves the camera along the view axis; for ortho, that does not
   *  change the projected image, so we scale `zoom` with height so a higher Y reads as
   *  “further / see more of the desk” and lower Y as tighter, matching the panel copy. */
  const yForZoom = Math.max(1, controls.cameraY);
  const heightZoomFactor = DEFAULT_CAMERA.y / yForZoom;
  const zoom = Math.max(
    MIN_ORTHO_ZOOM,
    baseZoom * controls.cameraZoom * heightZoomFactor,
  );

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

/** One entry for a handwritten text line in the welcome header. */
interface WelcomeTextItem {
  text: string;
  position: [number, number, number];
  fontSize?: number;
  maxWidth?: number;
  lineHeight?: number;
}

/** Default single-line text for the welcome header. */
const DEFAULT_WELCOME_TEXTS: WelcomeTextItem[] = [
  { text: "Hey, I'm Ray", position: [0, 0.04, 0.65], fontSize: 0.44, maxWidth: 14 },
];

/** Large static header on the desk; uses WOFF/OTF from `public/fonts/`. Registers with the intro stagger. */
function WelcomeHeader({ texts = DEFAULT_WELCOME_TEXTS }: { texts?: WelcomeTextItem[] }) {
  const groupRef = useRef<Group>(null);
  const stagger = useStaggerGsapOptional();
  const jitterUniformRef = useRef<{ value: number } | null>(null);

  const jitterMaterial = useMemo(() => {
    const mat = new MeshBasicMaterial({ color: "#1c1917" });
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
  }, []);

  useLayoutEffect(() => {
    const g = groupRef.current;
    if (!g || !stagger) return;
    setObject3DTreeOpacity(g, 0);
    stagger.registerStaggerTarget(WELCOME_HEADER_STAGGER_ID, g);
    return () => {
      stagger.unregisterStaggerTarget(WELCOME_HEADER_STAGGER_ID);
    };
  }, [stagger]);

  useFrame((_, delta) => {
    if (jitterUniformRef.current) {
      jitterUniformRef.current.value += delta;
    }
  });

  return (
    <group ref={groupRef}>
      {texts.map((item, i) => (
        <Text
          key={i}
          position={item.position}
          rotation={[-Math.PI / 2, 0, 0]}
          anchorX="center"
          anchorY="middle"
          color="#1c1917"
          font={HANDWRITING_FONT_URL}
          fontSize={item.fontSize ?? 0.44}
          maxWidth={item.maxWidth ?? 14}
          textAlign="center"
          lineHeight={item.lineHeight ?? 1.05}
          material={jitterMaterial}
        >
          {item.text}
        </Text>
      ))}
    </group>
  );
}

function polaroidDefaultLayout(index: number): DeskItemLayout {
  const { position, rotation } = getPolaroidLayout(index);
  return { position, rotation };
}

function hashLayoutUnit(seed: string, salt: string): number {
  let h = 2166136261 >>> 0;
  const s = `${seed}\0${salt}`;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 0xffffffff;
}

/** Deterministic pose for `/about` polaroids — independent of sibling count / array order. */
function polaroidDefaultLayoutAbout(slug: string): DeskItemLayout {
  const u1 = hashLayoutUnit(slug, "x");
  const u2 = hashLayoutUnit(slug, "z");
  const u3 = hashLayoutUnit(slug, "ry");
  const xStart = -3.4;
  const zStart = -0.35;
  const spanX = 14;
  const spanZ = 12;
  const x = xStart + u1 * spanX;
  const z = zStart + u2 * spanZ;
  const ry = -0.5 + u3 * 1.0;
  return {
    position: [x, 0.07, z],
    rotation: [0, ry, 0],
  };
}

function DeskObjects() {
  const scene = useDeskSceneId();
  const { getItem, getBallXZ, sampleBallXZ, recordBall } = useDeskLayout();
  const polaroidList =
    scene === DESK_SCENE_ABOUT ? aboutPolaroids : polaroids;

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
            layoutScale={l.scale ?? 1}
            physics={CARD_PHYSICS}
            rapierMode="kinematic"
            href={scene === DESK_SCENE_HOME ? item.href : undefined}
          >
            <PortfolioCard3D
              title={item.title}
              label={item.label}
              description={item.description}
              accent={cardAccents[index]}
              linkCta={
                scene === DESK_SCENE_HOME
                  ? getPortfolioLinkCta(item.href)
                  : undefined
              }
            />
          </DraggableObject>
        );
      })}

      <Suspense fallback={null}>
        {polaroidList.map((photo, index) => {
          const aboutSlug = photo.layoutId;
          const layoutId =
            scene === DESK_SCENE_ABOUT && aboutSlug != null
              ? deskItemId.aboutPolaroid(aboutSlug)
              : deskItemId.polaroid(index);
          const def =
            scene === DESK_SCENE_ABOUT && aboutSlug != null
              ? polaroidDefaultLayoutAbout(aboutSlug)
              : polaroidDefaultLayout(index);
          const l = getItem(layoutId, def);
          return (
            <DraggableObject
              key={layoutId}
              layoutId={layoutId}
              position={l.position}
              rotation={l.rotation}
              layoutScale={l.scale ?? 1}
              physics={POLAROID_PHYSICS}
              rapierMode="kinematic"
              href={scene === DESK_SCENE_HOME && photo.href ? photo.href : undefined}
            >
              <PolaroidPhoto
                palette={photo.palette}
                imageUrl={photo.imageUrl}
                flashCutImages={index === 0 && scene === DESK_SCENE_HOME ? HOME_INTRO_FLASH_CUT_IMAGES : undefined}
              />
            </DraggableObject>
          );
        })}
      </Suspense>

      {scene === DESK_SCENE_HOME ? (
        <Suspense fallback={null}>
          <DraggableObject
            layoutId={deskItemId.homeDeskVideo}
            position={getItem(deskItemId.homeDeskVideo, HOME_DESK_VIDEO_DEFAULT).position}
            rotation={getItem(deskItemId.homeDeskVideo, HOME_DESK_VIDEO_DEFAULT).rotation}
            layoutScale={getItem(deskItemId.homeDeskVideo, HOME_DESK_VIDEO_DEFAULT).scale ?? 1}
            physics={ABOUT_LOOP_VIDEO_PHYSICS}
            rapierMode="none"
          >
            <AboutDeskLoopVideo src="/images/output-alpha.webm" maxHeight={3.2} />
          </DraggableObject>
        </Suspense>
      ) : null}

      {scene === DESK_SCENE_ABOUT ? (
        <Suspense fallback={null}>
          <>
            {ABOUT_LOOP_CLIP_INSTANCES.map((clip) => {
              const l = getItem(clip.layoutId, clip.defaultLayout);
              return (
                <DraggableObject
                  key={clip.layoutId}
                  layoutId={clip.layoutId}
                  position={l.position}
                  rotation={l.rotation}
                  layoutScale={l.scale ?? 1}
                  physics={ABOUT_LOOP_VIDEO_PHYSICS}
                  rapierMode="none"
                >
                  <AboutDeskLoopVideo src={clip.src} />
                </DraggableObject>
              );
            })}
          </>
        </Suspense>
      ) : null}

      {getDeskTextOverlaysForScene(scene).map((item) => {
        const layoutId = deskItemId.deskText(item.id);
        const hl = getItem(
          layoutId,
          DESK_TEXT_LAYOUT_DEFAULTS[item.id] ?? DESK_TEXT_FALLBACK_LAYOUT,
        );
        return (
          <Suspense key={layoutId} fallback={null}>
            <DraggableObject
              layoutId={layoutId}
              position={hl.position}
              rotation={hl.rotation}
              layoutScale={hl.scale ?? 1}
              physics={HANDWRITING_LABEL_PHYSICS}
              rapierMode="none"
            >
              <DeskHandwritingLabel
                font={item.font}
                fontUrl={item.fontUrl}
                fontSize={item.fontSize}
                maxWidth={item.maxWidth}
                color={item.color}
              >
                {item.text}
              </DeskHandwritingLabel>
            </DraggableObject>
          </Suspense>
        );
      })}

      {JITTER_DESK_TEXTS.map((item, index) => {
        const layoutId = deskItemId.jitterText(index);
        const hl = getItem(
          layoutId,
          { position: item.position, rotation: item.rotation },
        );
        return (
          <Suspense key={layoutId} fallback={null}>
            <DraggableObject
              layoutId={layoutId}
              position={hl.position}
              rotation={hl.rotation}
              layoutScale={hl.scale ?? 1}
              physics={HANDWRITING_LABEL_PHYSICS}
              rapierMode="none"
            >
              <JitterText
                fontSize={item.fontSize}
                maxWidth={item.maxWidth}
                lineHeight={item.lineHeight}
              >
                {item.text}
              </JitterText>
            </DraggableObject>
          </Suspense>
        );
      })}

      <DeskBall
        initialPosition={getBallXZ()}
        onWorldXZFrame={sampleBallXZ}
        onCommitWorldXZ={recordBall}
      />

      <ContactShadowsGroup />
    </>
  );
}

function WelcomeHeaderGate() {
  const scene = useDeskSceneId();
  if (scene === DESK_SCENE_ABOUT) {
    return null;
  }
  return (
    <Suspense fallback={null}>
      <WelcomeHeader />
    </Suspense>
  );
}

export default function DeskScene() {
  const [marqueeOverlay, setMarqueeOverlay] = useState<DeskMarqueeOverlayRect | null>(
    null,
  );
  const { arrangeMode } = useDeskControls();
  const scene = useDeskSceneId();

  const handleMarqueeRectChange = useCallback(
    (rect: DeskMarqueeOverlayRect | null) => {
      setMarqueeOverlay(rect);
    },
    [],
  );

  const visibleMarquee =
    arrangeMode && marqueeOverlay != null ? marqueeOverlay : null;

  return (
    <div className="fixed inset-0 z-0 h-dvh w-full min-h-0">
      <Canvas
        className="block h-full w-full"
        shadows={{ type: PCFShadowMap }}
        dpr={[1, 1.5]}
        gl={{ antialias: true, alpha: false }}
        onCreated={({ gl }) => {
          gl.setClearColor(0xffffff, 1);
        }}
      >
        <color attach="background" args={["#ffffff"]} />
        <ToneMappingSync />
        <StaggerGsapProvider>
          <ItemIntroTimeProvider>
            <DeskLoadIntro />
            <DeskAnimatedTextureDriver />
            <CameraViewControls />
          <ResponsiveCamera />
          <SceneLights />
          <DeskSurface />
          <WelcomeHeaderGate />
          <Physics gravity={[0, -30, 0]} timeStep="vary">
            {/* Desk surface collider — matches DeskSurface planeGeometry at y=-0.04 */}
            <RigidBody type="fixed" position={[0, -0.03, 0]}>
              <CuboidCollider args={[16, 0.01, 11]} />
            </RigidBody>
            <RapierBoundaryWalls />
            <DeskPhysicsProvider>
              <DeskArrangeMarquee onMarqueeRectChange={handleMarqueeRectChange} />
              <DeskObjects />
            </DeskPhysicsProvider>
          </Physics>
          </ItemIntroTimeProvider>
        </StaggerGsapProvider>
      </Canvas>
      {visibleMarquee != null ? (
        <div
          aria-hidden
          style={{
            position: "fixed",
            left: `${Math.min(visibleMarquee.minX, visibleMarquee.maxX)}px`,
            top: `${Math.min(visibleMarquee.minY, visibleMarquee.maxY)}px`,
            width: `${Math.abs(visibleMarquee.maxX - visibleMarquee.minX)}px`,
            height: `${Math.abs(visibleMarquee.maxY - visibleMarquee.minY)}px`,
            boxSizing: "border-box",
            border: "1px dashed rgba(59, 130, 246, 0.85)",
            background: "rgba(59, 130, 246, 0.08)",
            pointerEvents: "none",
            zIndex: 10000,
          }}
        />
      ) : null}
    </div>
  );
}

function SceneLights() {
  const { controls } = useDeskControls();
  return (
    <>
      <ambientLight intensity={controls.ambient} />
      <hemisphereLight
        color={controls.hemisphereSkyColor}
        groundColor={controls.hemisphereGroundColor}
        intensity={controls.hemisphere}
      />
      <KeyLight />
      <FillLight />
      <spotLight
        position={[controls.spotLightX, controls.spotLightY, controls.spotLightZ]}
        color={controls.spotLightColor}
        intensity={controls.spotLightIntensity}
        angle={controls.spotLightAngle}
        penumbra={controls.spotLightPenumbra}
        decay={0}
      />
      <Environment preset="studio" environmentIntensity={controls.environment} />
    </>
  );
}

function ContactShadowsGroup() {
  const { controls } = useDeskControls();
  const scene = useDeskSceneId();
  const intro = useDeskIntroOptional();
  const staggerCfg = getDeskIntroStaggerAfterCamera(scene);
  const needsRamp = scene === DESK_SCENE_HOME && staggerCfg != null;
  const revealMultRef = useRef(needsRamp ? 0 : 1);

  useLayoutEffect(() => {
    revealMultRef.current = needsRamp ? 0 : 1;
  }, [needsRamp]);

  useFrame((_, dt) => {
    if (!needsRamp) {
      return;
    }
    const introActive = intro?.introActive ?? false;
    const target = introActive ? 0 : 1;
    const t =
      1 -
      Math.exp(-CONTACT_SHADOW_INTRO_REVEAL_SMOOTH * Math.min(dt, 0.1));
    revealMultRef.current += (target - revealMultRef.current) * t;
  });

  /* `far` must exceed focus-lift + ball Y clearance (~1+ world Y). Tight 2.5 clipped
   * lifted items from the top-down depth pass, so the puddle stayed wrong until
   * the mesh eased back into the frustum (multi-second shadow lag). */
  return (
    <ContactShadows
      position={[0, 0.01, 0]}
      resolution={256}
      scale={controls.contactScale}
      blur={controls.contactBlur}
      opacity={controls.contactOpacity}
      far={14}
      smooth={false}
      opacityMultiplierRef={needsRamp ? revealMultRef : undefined}
    />
  );
}

