"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";

const MAX_WORLD_WIDTH = 3.2;

/** Stable filtering/wrap so GPU sampling doesn’t pull dark texels into frame edges (common “black border” artifact). */
function configureAboutDeskVideoTexture(tex: THREE.VideoTexture): void {
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.generateMipmaps = false;
}

export type AboutDeskLoopVideoProps = {
  /** URL under `public/` — use VP9 **`.webm`** with alpha (`scripts/convert-mov-alpha-to-webm.sh`). */
  src: string;
  /** Maximum height in world units. Portrait videos that would exceed this are scaled down so height fits. */
  maxHeight?: number;
};

/** Desk loop clip mesh (child of **`DraggableObject`**) via `THREE.VideoTexture`. */
export function AboutDeskLoopVideo({ src, maxHeight }: AboutDeskLoopVideoProps) {
  const [texture, setTexture] = useState<THREE.VideoTexture | null>(null);
  const [dims, setDims] = useState({ w: MAX_WORLD_WIDTH, h: MAX_WORLD_WIDTH / (16 / 9) });
  const [hasRenderableVideo, setHasRenderableVideo] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const video = document.createElement("video");
    video.src = src;
    video.crossOrigin = "anonymous";
    video.loop = true;
    video.muted = true;
    video.playsInline = true;
    video.setAttribute("playsinline", "");
    video.setAttribute("webkit-playsinline", "");
    videoRef.current = video;

    function onLoadedMetadata() {
      const vw = video.videoWidth;
      const vh = video.videoHeight;
      if (vw > 0 && vh > 0) {
        const aspect = vw / vh;
        const maxH = maxHeight ?? MAX_WORLD_WIDTH;
        let w = MAX_WORLD_WIDTH;
        let h = w / aspect;
        // Clamp portrait videos so height doesn't exceed maxH
        if (h > maxH) {
          h = maxH;
          w = h * aspect;
        }
        setDims({ w, h });
      }
    }

    function markRenderableIfPossible() {
      if (
        video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA &&
        video.videoWidth > 0 &&
        video.videoHeight > 0
      ) {
        setHasRenderableVideo(true);
      }
    }

    // Workaround: VP9 alpha WebM ignores the `loop` attribute in Chrome because
    // the browser fails to seek the alpha bitstream back to the start.
    function handleEnded() {
      void video.play().catch(() => {});
    }

    video.addEventListener("loadedmetadata", onLoadedMetadata);
    video.addEventListener("loadeddata", markRenderableIfPossible);
    video.addEventListener("canplay", markRenderableIfPossible);
    video.addEventListener("ended", handleEnded);

    const tex = new THREE.VideoTexture(video);
    configureAboutDeskVideoTexture(tex);

    queueMicrotask(() => {
      setTexture(tex);
      void video.play().catch(() => {});
      markRenderableIfPossible();
    });

    return () => {
      video.removeEventListener("loadedmetadata", onLoadedMetadata);
      video.removeEventListener("loadeddata", markRenderableIfPossible);
      video.removeEventListener("canplay", markRenderableIfPossible);
      video.removeEventListener("ended", handleEnded);
      video.pause();
      video.removeAttribute("src");
      video.load();
      tex.dispose();
      setTexture(null);
      setHasRenderableVideo(false);
    };
  }, [src]);

  /** VP9/WebM alpha needs blending + no depth write so transparent pixels composite cleanly. */
  const alphaBlend = /\.webm$/i.test(src);

  if (texture == null || !hasRenderableVideo) {
    return null;
  }

  return (
    <mesh
      key={`${src}-${dims.w}x${dims.h}`}
      position={[0, 0.004, 0]}
      rotation={[-Math.PI / 2, 0, 0]}
      castShadow={alphaBlend}
      receiveShadow={alphaBlend}
      renderOrder={alphaBlend ? 1 : 0}
    >
      <planeGeometry args={[dims.w, dims.h]} />
      <meshBasicMaterial
        map={texture}
        toneMapped={false}
        side={THREE.DoubleSide}
        transparent={alphaBlend}
        depthWrite={!alphaBlend}
        alphaTest={0.01}
      />
    </mesh>
  );
}
