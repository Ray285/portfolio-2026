"use client";

import { useEffect, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

const MAX_WORLD_WIDTH = 3.2;

/** Stable filtering/wrap so GPU sampling doesn't pull dark texels into frame edges (common "black border" artifact). */
function configureVideoTexture(tex: THREE.Texture): void {
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

/** Desk loop clip mesh — uses a canvas so the alpha channel from VP9 WebM is preserved.
 *  `THREE.VideoTexture` does not read alpha from video elements; `CanvasTexture` does. */
export function AboutDeskLoopVideo({ src, maxHeight }: AboutDeskLoopVideoProps) {
  const [texture, setTexture] = useState<THREE.CanvasTexture | null>(null);
  const [dims, setDims] = useState({ w: MAX_WORLD_WIDTH, h: MAX_WORLD_WIDTH / (16 / 9) });
  const [hasRenderableVideo, setHasRenderableVideo] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const textureRef = useRef<THREE.CanvasTexture | null>(null);
  const hiddenContainerRef = useRef<HTMLDivElement | null>(null);

  // Hidden container so the browser can play the video and draw to the canvas
  const getHiddenContainer = () => {
    if (!hiddenContainerRef.current) {
      const div = document.createElement("div");
      div.style.cssText = "position:absolute;width:0;height:0;overflow:hidden;visibility:hidden;pointer-events:none;";
      document.body.appendChild(div);
      hiddenContainerRef.current = div;
    }
    return hiddenContainerRef.current;
  };

  useEffect(() => {
    const container = getHiddenContainer();
    const video = document.createElement("video");
    video.src = src;
    video.crossOrigin = "anonymous";
    video.loop = true;
    video.muted = true;
    video.playsInline = true;
    video.setAttribute("playsinline", "");
    video.setAttribute("webkit-playsinline", "");
    video.style.display = "none";
    container.appendChild(video);
    videoRef.current = video;

    function onLoadedMetadata() {
      const vw = video.videoWidth;
      const vh = video.videoHeight;
      if (vw > 0 && vh > 0) {
        const aspect = vw / vh;
        const maxH = maxHeight ?? MAX_WORLD_WIDTH;
        let w = MAX_WORLD_WIDTH;
        let h = w / aspect;
        if (h > maxH) {
          h = maxH;
          w = h * aspect;
        }
        setDims({ w, h });

        // Create canvas once we know dimensions
        const canvas = document.createElement("canvas");
        canvas.width = vw;
        canvas.height = vh;
        canvas.style.display = "none";
        container.appendChild(canvas);
        const ctx = canvas.getContext("2d");
        if (ctx) {
          canvasRef.current = canvas;
          ctxRef.current = ctx;

          // Create texture from canvas — preserves alpha (unlike VideoTexture)
          const tex = new THREE.CanvasTexture(canvas);
          configureVideoTexture(tex);
          textureRef.current = tex;
          setTexture(tex);
        }
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

    video.addEventListener("loadedmetadata", onLoadedMetadata);
    video.addEventListener("loadeddata", markRenderableIfPossible);
    video.addEventListener("canplay", markRenderableIfPossible);

    queueMicrotask(() => {
      void video.play().catch(() => {});
      markRenderableIfPossible();
    });

    return () => {
      video.removeEventListener("loadedmetadata", onLoadedMetadata);
      video.removeEventListener("loadeddata", markRenderableIfPossible);
      video.removeEventListener("canplay", markRenderableIfPossible);
      video.pause();
      video.removeAttribute("src");
      video.load();
      container.removeChild(video);
      if (canvasRef.current) {
        container.removeChild(canvasRef.current);
        canvasRef.current = null;
      }
      ctxRef.current = null;
      textureRef.current?.dispose();
      textureRef.current = null;
      setTexture(null);
      setHasRenderableVideo(false);
    };
  }, [src]);

  // Draw each video frame onto the canvas so the texture updates with alpha
  useFrame(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = ctxRef.current;
    const tex = textureRef.current;
    if (!video || !canvas || !ctx || !tex) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    tex.needsUpdate = true;
  });

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
