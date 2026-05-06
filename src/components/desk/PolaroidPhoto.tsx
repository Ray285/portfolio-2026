"use client";

import { useLayoutEffect, useMemo, useRef } from "react";
import { useTexture } from "@react-three/drei";
import {
  CanvasTexture,
  Mesh,
  MeshStandardMaterial,
  SRGBColorSpace,
  Texture,
} from "three";
import { useDeskControls } from "@/context/DeskControlsContext";
import {
  PHOTO_PLANE_Y,
  PHOTO_PLANE_Z,
  POLAROID_FRAME,
  POLAROID_INNER_MAX,
} from "@/lib/polaroid-geometry";
import { useIntroStaggerFromOpacity } from "@/context/IntroStaggerFromOpacityContext";
import {
  isCanvasAnimatedImagePath,
  useAnimatedImageTexture,
} from "./polaroid/useAnimatedImageTexture";
import { useFlashCutSchedule, type PrintSize } from "./polaroid/useFlashCutSchedule";

const PRINT_THICKNESS = 0.02;

const EDGE_MAT = {
  color: "#f2f0eb",
  roughness: 0.75,
  metalness: 0,
} as const;

function configurePhotoTexture(texture: Texture) {
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = 8;
  texture.repeat.set(1, 1);
  texture.offset.set(0, 0);
  texture.center.set(0, 0);
  texture.rotation = 0;
  texture.needsUpdate = true;
}

function PolaroidFrame() {
  return (
    <mesh castShadow receiveShadow>
      <boxGeometry
        args={[POLAROID_FRAME.width, POLAROID_FRAME.height, POLAROID_FRAME.depth]}
      />
      <meshStandardMaterial color="#fffefa" roughness={0.7} envMapIntensity={0.2} />
    </mesh>
  );
}

/**
 * Object-fit `contain` inside a rect derived from `POLAROID_INNER_MAX` ×
 * `polaroidPrintScale` (from desk controls).
 */
function usePhotoPrintPlaneSize(texture: Texture) {
  const { controls } = useDeskControls();
  const s = controls.polaroidPrintScale;
  const maxW = POLAROID_INNER_MAX.width * s;
  const maxD = POLAROID_INNER_MAX.depth * s;

  return useMemo(() => {
    const img = texture.image as HTMLImageElement & { naturalWidth: number; naturalHeight: number };
    if (!img || !("width" in img) || !img.width) {
      return { w: maxW, h: maxD };
    }
    const iw = img.naturalWidth || img.width;
    const ih = img.naturalHeight || img.height;
    if (!iw || !ih) {
      return { w: maxW, h: maxD };
    }
    const imageAspect = iw / ih;
    const maxAspect = maxW / maxD;
    if (imageAspect > maxAspect) {
      return { w: maxW, h: maxW / imageAspect };
    }
    return { w: maxD * imageAspect, h: maxD };
  }, [texture, maxW, maxD]);
}

function computePrintSize(texture: Texture, maxW: number, maxD: number): PrintSize {
  const img = texture.image as HTMLImageElement & { naturalWidth: number; naturalHeight: number };
  if (!img || !("width" in img) || !img.width) return { w: maxW, h: maxD };
  const iw = img.naturalWidth || img.width;
  const ih = img.naturalHeight || img.height;
  if (!iw || !ih) return { w: maxW, h: maxD };
  const imageAspect = iw / ih;
  const maxAspect = maxW / maxD;
  if (imageAspect > maxAspect) return { w: maxW, h: maxW / imageAspect };
  return { w: maxD * imageAspect, h: maxD };
}

function useGradientPlaneSize() {
  const { controls } = useDeskControls();
  const s = controls.polaroidPrintScale;
  return {
    w: POLAROID_INNER_MAX.width * s,
    d: POLAROID_INNER_MAX.depth * s,
  };
}

function textureBackingDimensions(tex: Texture): { w: number; h: number } {
  const img = tex.image as HTMLCanvasElement | HTMLImageElement | undefined | null;
  if (!img) {
    return { w: 0, h: 0 };
  }
  const iw =
    "naturalWidth" in img && img.naturalWidth > 0 ? img.naturalWidth : img.width;
  const ih =
    "naturalHeight" in img && img.naturalHeight > 0 ? img.naturalHeight : img.height;
  return { w: iw || 0, h: ih || 0 };
}

type PolaroidImageBlockProps = { texture: Texture };

/**
 * A thin box instead of a single plane: a flat print parallel to the desk
 * throws almost no shadow; extruding slightly restores a legible cast shadow.
 */
function PolaroidImageBlock({ texture }: PolaroidImageBlockProps) {
  const { w, h } = usePhotoPrintPlaneSize(texture);
  const dims = textureBackingDimensions(texture);
  const texReady = dims.w > 0 && dims.h > 0;
  const t = PRINT_THICKNESS;
  const cy = PHOTO_PLANE_Y - t / 2;
  const introO = useIntroStaggerFromOpacity();
  const op = introO !== undefined ? introO : 1;
  const fullOp = op >= 0.99;

  useLayoutEffect(() => {
    configurePhotoTexture(texture);
  }, [texture]);

  /** Avoid uploading WebGL uploads while canvas/image dimensions are still 0 (console warnings). */
  if (!texReady) {
    return null;
  }

  return (
    <mesh
      position={[0, cy, PHOTO_PLANE_Z]}
      castShadow={fullOp}
      receiveShadow
    >
      <boxGeometry args={[w, t, h]} />
      <meshStandardMaterial
        attach="material-0"
        {...EDGE_MAT}
        opacity={op}
        transparent={!fullOp}
        depthWrite={fullOp}
      />
      <meshStandardMaterial
        attach="material-1"
        {...EDGE_MAT}
        opacity={op}
        transparent={!fullOp}
        depthWrite={fullOp}
      />
      <meshStandardMaterial
        attach="material-2"
        map={texture}
        roughness={0.8}
        metalness={0}
        toneMapped={false}
        envMapIntensity={0.15}
        opacity={op}
        transparent={!fullOp}
        depthWrite={fullOp}
      />
      <meshStandardMaterial
        attach="material-3"
        {...EDGE_MAT}
        color="#e6e3dc"
        opacity={op}
        transparent={!fullOp}
        depthWrite={fullOp}
      />
      <meshStandardMaterial
        attach="material-4"
        {...EDGE_MAT}
        opacity={op}
        transparent={!fullOp}
        depthWrite={fullOp}
      />
      <meshStandardMaterial
        attach="material-5"
        {...EDGE_MAT}
        opacity={op}
        transparent={!fullOp}
        depthWrite={fullOp}
      />
    </mesh>
  );
}

type PolaroidWithImageUrlProps = {
  imageUrl: string;
  showFrame: boolean;
};

function PolaroidWithImageUrl({ imageUrl, showFrame }: PolaroidWithImageUrlProps) {
  const texture = useTexture(imageUrl);
  return (
    <group>
      {showFrame ? <PolaroidFrame /> : null}
      <PolaroidImageBlock texture={texture} />
    </group>
  );
}

function PolaroidWithCanvasImage({ imageUrl, showFrame }: PolaroidWithImageUrlProps) {
  const texture = useAnimatedImageTexture(imageUrl);
  if (!texture) {
    return showFrame ? (
      <group>
        <PolaroidFrame />
      </group>
    ) : null;
  }
  return (
    <group>
      {showFrame ? <PolaroidFrame /> : null}
      <PolaroidImageBlock texture={texture} />
    </group>
  );
}

type PolaroidWithGradientProps = {
  palette: [string, string, string];
  showFrame: boolean;
};

function PolaroidWithGradient({ palette, showFrame }: PolaroidWithGradientProps) {
  const texture = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 512;

    const context = canvas.getContext("2d");

    if (!context) {
      return null;
    }

    const gradient = context.createLinearGradient(0, 0, 512, 512);
    gradient.addColorStop(0, palette[0]);
    gradient.addColorStop(0.58, palette[1]);
    gradient.addColorStop(1, palette[2]);

    context.fillStyle = gradient;
    context.fillRect(0, 0, 512, 512);
    context.globalAlpha = 0.2;
    context.fillStyle = "#ffffff";
    context.beginPath();
    context.arc(395, 130, 84, 0, Math.PI * 2);
    context.fill();
    context.globalAlpha = 0.34;
    context.fillRect(54, 348, 340, 26);
    context.fillRect(54, 394, 245, 18);

    const canvasTexture = new CanvasTexture(canvas);
    canvasTexture.colorSpace = SRGBColorSpace;

    return canvasTexture;
  }, [palette]);

  const { w, d } = useGradientPlaneSize();
  const t = PRINT_THICKNESS;
  const cy = PHOTO_PLANE_Y - t / 2;
  const introO = useIntroStaggerFromOpacity();
  const op = introO !== undefined ? introO : 1;
  const fullOp = op >= 0.99;

  return (
    <group>
      {showFrame ? <PolaroidFrame /> : null}
      {texture && (
        <mesh
          position={[0, cy, PHOTO_PLANE_Z]}
          castShadow={fullOp}
          receiveShadow
        >
          <boxGeometry args={[w, t, d]} />
          <meshStandardMaterial
            attach="material-0"
            {...EDGE_MAT}
            opacity={op}
            transparent={!fullOp}
            depthWrite={fullOp}
          />
          <meshStandardMaterial
            attach="material-1"
            {...EDGE_MAT}
            opacity={op}
            transparent={!fullOp}
            depthWrite={fullOp}
          />
          <meshStandardMaterial
            attach="material-2"
            map={texture}
            roughness={0.8}
            metalness={0}
            toneMapped={false}
            envMapIntensity={0.15}
            opacity={op}
            transparent={!fullOp}
            depthWrite={fullOp}
          />
          <meshStandardMaterial
            attach="material-3"
            {...EDGE_MAT}
            color="#e6e3dc"
            opacity={op}
            transparent={!fullOp}
            depthWrite={fullOp}
          />
          <meshStandardMaterial
            attach="material-4"
            {...EDGE_MAT}
            opacity={op}
            transparent={!fullOp}
            depthWrite={fullOp}
          />
          <meshStandardMaterial
            attach="material-5"
            {...EDGE_MAT}
            opacity={op}
            transparent={!fullOp}
            depthWrite={fullOp}
          />
        </mesh>
      )}
    </group>
  );
}

// — Flash cut —

type PolaroidImageBlockFlashCutProps = {
  textures: Texture[];
  printSizes: PrintSize[];
};

function PolaroidImageBlockFlashCut({ textures, printSizes }: PolaroidImageBlockFlashCutProps) {
  const t = PRINT_THICKNESS;
  const cy = PHOTO_PLANE_Y - t / 2;
  const introO = useIntroStaggerFromOpacity();
  const op = introO !== undefined ? introO : 1;
  const fullOp = op >= 0.99;

  const matRef = useRef<MeshStandardMaterial>(null);
  const meshRef = useRef<Mesh>(null);
  useFlashCutSchedule(textures, matRef, meshRef, printSizes);

  const first = printSizes[0] ?? { w: 1, h: 1 };

  return (
    <mesh
      ref={meshRef}
      position={[0, cy, PHOTO_PLANE_Z]}
      scale={[first.w, 1, first.h]}
      castShadow={fullOp}
      receiveShadow
    >
      {/* Unit-size geometry — scale drives per-frame dimensions */}
      <boxGeometry args={[1, t, 1]} />
      <meshStandardMaterial attach="material-0" {...EDGE_MAT} opacity={op} transparent={!fullOp} depthWrite={fullOp} />
      <meshStandardMaterial attach="material-1" {...EDGE_MAT} opacity={op} transparent={!fullOp} depthWrite={fullOp} />
      <meshStandardMaterial
        ref={matRef}
        attach="material-2"
        map={textures[0]}
        roughness={0.8}
        metalness={0}
        toneMapped={false}
        envMapIntensity={0.15}
        opacity={op}
        transparent={!fullOp}
        depthWrite={fullOp}
      />
      <meshStandardMaterial attach="material-3" {...EDGE_MAT} color="#e6e3dc" opacity={op} transparent={!fullOp} depthWrite={fullOp} />
      <meshStandardMaterial attach="material-4" {...EDGE_MAT} opacity={op} transparent={!fullOp} depthWrite={fullOp} />
      <meshStandardMaterial attach="material-5" {...EDGE_MAT} opacity={op} transparent={!fullOp} depthWrite={fullOp} />
    </mesh>
  );
}

type PolaroidWithFlashCutProps = {
  flashCutImages: string[];
  showFrame: boolean;
};

function PolaroidWithFlashCut({ flashCutImages, showFrame }: PolaroidWithFlashCutProps) {
  const textures = useTexture(flashCutImages);
  const { controls } = useDeskControls();
  const s = controls.polaroidPrintScale;
  const maxW = POLAROID_INNER_MAX.width * s;
  const maxD = POLAROID_INNER_MAX.depth * s;

  const printSizes = useMemo(
    () => textures.map((tex) => computePrintSize(tex, maxW, maxD)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [textures, maxW, maxD],
  );

  useLayoutEffect(() => {
    for (const tex of textures) {
      configurePhotoTexture(tex);
    }
  }, [textures]);

  return (
    <group>
      {showFrame ? <PolaroidFrame /> : null}
      <PolaroidImageBlockFlashCut textures={textures} printSizes={printSizes} />
    </group>
  );
}

export type PolaroidPhotoProps = {
  /** Kept for data compatibility; not rendered. */
  title?: string;
  /** Kept for data compatibility; not rendered. */
  caption?: string;
  palette?: [string, string, string];
  imageUrl?: string;
  /** When provided alongside imageUrl, cycles through these images as a flash cut on intro. */
  flashCutImages?: string[];
  /** White polaroid border mesh. Off by default; set `true` to bring it back. */
  showFrame?: boolean;
};

export function PolaroidPhoto({
  palette,
  imageUrl,
  flashCutImages,
  showFrame = false,
}: PolaroidPhotoProps) {
  if (imageUrl) {
    if (flashCutImages && flashCutImages.length > 0) {
      return <PolaroidWithFlashCut flashCutImages={flashCutImages} showFrame={showFrame} />;
    }
    if (isCanvasAnimatedImagePath(imageUrl)) {
      return (
        <PolaroidWithCanvasImage imageUrl={imageUrl} showFrame={showFrame} />
      );
    }
    return <PolaroidWithImageUrl imageUrl={imageUrl} showFrame={showFrame} />;
  }
  if (palette) {
    return <PolaroidWithGradient palette={palette} showFrame={showFrame} />;
  }
  return null;
}
