"use client";

import { useLayoutEffect, useMemo } from "react";
import { useTexture } from "@react-three/drei";
import { CanvasTexture, SRGBColorSpace, type Texture } from "three";
import { useDeskControls } from "@/context/DeskControlsContext";
import {
  PHOTO_PLANE_Y,
  PHOTO_PLANE_Z,
  POLAROID_FRAME,
  POLAROID_INNER_MAX,
} from "@/lib/polaroid-geometry";
import {
  isCanvasAnimatedImagePath,
  useAnimatedImageTexture,
} from "./polaroid/useAnimatedImageTexture";

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

function useGradientPlaneSize() {
  const { controls } = useDeskControls();
  const s = controls.polaroidPrintScale;
  return {
    w: POLAROID_INNER_MAX.width * s,
    d: POLAROID_INNER_MAX.depth * s,
  };
}

type PolaroidImageBlockProps = { texture: Texture };

/**
 * A thin box instead of a single plane: a flat print parallel to the desk
 * throws almost no shadow; extruding slightly restores a legible cast shadow.
 */
function PolaroidImageBlock({ texture }: PolaroidImageBlockProps) {
  const { w, h } = usePhotoPrintPlaneSize(texture);
  const t = PRINT_THICKNESS;
  const cy = PHOTO_PLANE_Y - t / 2;

  useLayoutEffect(() => {
    configurePhotoTexture(texture);
  }, [texture]);

  return (
    <mesh
      position={[0, cy, PHOTO_PLANE_Z]}
      castShadow
      receiveShadow
    >
      <boxGeometry args={[w, t, h]} />
      <meshStandardMaterial attach="material-0" {...EDGE_MAT} />
      <meshStandardMaterial attach="material-1" {...EDGE_MAT} />
      <meshStandardMaterial
        attach="material-2"
        map={texture}
        roughness={0.8}
        metalness={0}
        toneMapped={false}
        envMapIntensity={0.15}
      />
      <meshStandardMaterial attach="material-3" {...EDGE_MAT} color="#e6e3dc" />
      <meshStandardMaterial attach="material-4" {...EDGE_MAT} />
      <meshStandardMaterial attach="material-5" {...EDGE_MAT} />
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

  return (
    <group>
      {showFrame ? <PolaroidFrame /> : null}
      {texture && (
        <mesh position={[0, cy, PHOTO_PLANE_Z]} castShadow receiveShadow>
          <boxGeometry args={[w, t, d]} />
          <meshStandardMaterial attach="material-0" {...EDGE_MAT} />
          <meshStandardMaterial attach="material-1" {...EDGE_MAT} />
          <meshStandardMaterial
            attach="material-2"
            map={texture}
            roughness={0.8}
            metalness={0}
            toneMapped={false}
            envMapIntensity={0.15}
          />
          <meshStandardMaterial attach="material-3" {...EDGE_MAT} color="#e6e3dc" />
          <meshStandardMaterial attach="material-4" {...EDGE_MAT} />
          <meshStandardMaterial attach="material-5" {...EDGE_MAT} />
        </mesh>
      )}
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
  /** White polaroid border mesh. Off by default; set `true` to bring it back. */
  showFrame?: boolean;
};

export function PolaroidPhoto({
  palette,
  imageUrl,
  showFrame = false,
}: PolaroidPhotoProps) {
  if (imageUrl) {
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
