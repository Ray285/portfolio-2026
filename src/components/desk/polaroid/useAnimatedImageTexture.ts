"use client";

import { useFrame } from "@react-three/fiber";
import { CanvasTexture, SRGBColorSpace, type Texture } from "three";
import { useEffect, useRef, useState } from "react";

function configureImageTextureForDesk(texture: Texture) {
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = 8;
  texture.repeat.set(1, 1);
  texture.offset.set(0, 0);
  texture.center.set(0, 0);
  texture.rotation = 0;
  texture.needsUpdate = true;
}

export function isCanvasAnimatedImagePath(url: string) {
  return /\.(gif|webp)($|[?#])/i.test(url);
}

function mimeTypeFromUrl(url: string) {
  if (/\.gif($|[?#])/i.test(url)) {
    return "image/gif";
  }
  if (/\.webp($|[?#])/i.test(url)) {
    return "image/webp";
  }
  return "image/webp";
}

type LegacyState = {
  kind: "legacy";
  image: HTMLImageElement;
  canvas: HTMLCanvasElement;
};

type DecoderState = {
  kind: "decoder";
  frames: HTMLCanvasElement[];
  /** ms per frame */
  frameDurationsMs: number[];
  totalDurationMs: number;
};

const DEFAULT_FRAME_MS = 100;

/**
 * `useTexture` only keeps one frame. `drawImage(HTMLImageElement)` for animated
 * **WebP** usually stays on frame 0 in browsers, so we use `ImageDecoder`
 * (WebCodecs) when available to copy each frame. **GIF** can fall back to the
 * legacy `Image` + rAF path when `ImageDecoder` is missing or fails.
 */
export function useAnimatedImageTexture(url: string) {
  const [texture, setTexture] = useState<CanvasTexture | null>(null);
  const textureRef = useRef<CanvasTexture | null>(null);
  const decoderOrLegacyRef = useRef<DecoderState | LegacyState | null>(null);
  const timeMsRef = useRef(0);
  const outputCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);

  useEffect(() => {
    let cancelled = false;
    timeMsRef.current = 0;
    const canvas = document.createElement("canvas");
    outputCanvasRef.current = canvas;
    const ctx = canvas.getContext("2d");
    ctxRef.current = ctx;

    function finishTexture(tex: CanvasTexture) {
      if (cancelled) {
        tex.dispose();
        return;
      }
      textureRef.current = tex;
      setTexture((prev) => {
        if (prev) {
          prev.dispose();
        }
        return tex;
      });
    }

    function setupLegacyImage() {
      const out = outputCanvasRef.current;
      if (!out || !ctx) {
        return;
      }
      const image = new Image();
      image.decoding = "async";
      function onLoad() {
        if (cancelled) {
          return;
        }
        if (!out || !ctx) {
          return;
        }
        out.width = image.naturalWidth;
        out.height = image.naturalHeight;
        ctx.drawImage(image, 0, 0);
        const next = new CanvasTexture(out);
        configureImageTextureForDesk(next);
        decoderOrLegacyRef.current = { kind: "legacy", image, canvas: out };
        finishTexture(next);
      }
      function onError() {
        if (process.env.NODE_ENV === "development") {
          console.error(`[PolaroidPhoto] Could not load image (legacy path): ${url}`);
        }
      }
      image.addEventListener("load", onLoad);
      image.addEventListener("error", onError);
      image.src = url;
      if (image.complete && image.naturalWidth > 0) {
        onLoad();
      }
    }

    async function tryImageDecoder() {
      if (typeof ImageDecoder === "undefined") {
        return false;
      }
      try {
      const res = await fetch(url);
      if (!res.ok) {
        return false;
      }
      const buffer = await res.arrayBuffer();
      const type = mimeTypeFromUrl(url);
      const canDecode = await ImageDecoder.isTypeSupported(type);
      if (!canDecode) {
        return false;
      }
      const decoder = new ImageDecoder({
        data: buffer,
        type,
      });
      try {
        await decoder.tracks.ready;
      } catch {
        await decoder.close();
        return false;
      }
      const trackList = decoder.tracks;
      const track = trackList.selectedTrack ?? trackList[0];
      if (!track) {
        await decoder.close();
        return false;
      }
      const n = track.frameCount;
      if (n < 1) {
        await decoder.close();
        return false;
      }

      const frames: HTMLCanvasElement[] = [];
      const frameDurationsMs: number[] = [];
      let maxW = 0;
      let maxH = 0;

      for (let i = 0; i < n; i++) {
        if (cancelled) {
          await decoder.close();
          for (const f of frames) {
            f.width = 0;
          }
          return true;
        }
        const { image: vf } = await decoder.decode({ frameIndex: i });
        const w = vf.displayWidth;
        const h = vf.displayHeight;
        maxW = Math.max(maxW, w);
        maxH = Math.max(maxH, h);
        const c = document.createElement("canvas");
        c.width = w;
        c.height = h;
        const cctx = c.getContext("2d");
        if (cctx) {
          cctx.drawImage(vf, 0, 0, w, h);
        }
        /** `VideoFrame.duration` is in microseconds. */
        const dUs = vf.duration ?? 0;
        frameDurationsMs.push(dUs > 0 ? dUs / 1000 : 0);
        frames.push(c);
        vf.close();
      }
      await decoder.close();

      if (cancelled) {
        for (const f of frames) {
          f.width = 0;
        }
        return true;
      }

      for (let i = 0; i < frameDurationsMs.length; i++) {
        if (frameDurationsMs[i] <= 0) {
          frameDurationsMs[i] = n > 1 ? DEFAULT_FRAME_MS : 0;
        }
      }
      const totalDurationMs = frameDurationsMs.reduce((a, b) => a + b, 0) || 1;

      const out = outputCanvasRef.current;
      if (!out || !ctx) {
        return true;
      }
      out.width = maxW;
      out.height = maxH;
      const first = frames[0];
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, out.width, out.height);
      ctx.drawImage(
        first,
        0,
        0,
        first.width,
        first.height,
        0,
        0,
        out.width,
        out.height,
      );
      const next = new CanvasTexture(out);
      configureImageTextureForDesk(next);
      decoderOrLegacyRef.current = {
        kind: "decoder",
        frames,
        frameDurationsMs,
        totalDurationMs,
      };
      finishTexture(next);
      return true;
      } catch (e) {
        if (process.env.NODE_ENV === "development") {
          console.warn("[PolaroidPhoto] ImageDecoder path failed, trying legacy image:", e);
        }
        return false;
      }
    }

    void (async () => {
      const ok = await tryImageDecoder();
      if (cancelled) {
        return;
      }
      if (!ok) {
        setupLegacyImage();
      }
    })();

    return () => {
      cancelled = true;
      const state = decoderOrLegacyRef.current;
      decoderOrLegacyRef.current = null;
      if (state?.kind === "decoder") {
        for (const c of state.frames) {
          c.width = 0;
        }
      }
      textureRef.current = null;
      setTexture((prev) => {
        if (prev) {
          prev.dispose();
        }
        return null;
      });
    };
  }, [url]);

  useFrame((_, delta) => {
    const tex = textureRef.current;
    const out = outputCanvasRef.current;
    const ctx2 = ctxRef.current;
    const state = decoderOrLegacyRef.current;
    if (!tex || !out || !ctx2 || !state) {
      return;
    }

    if (state.kind === "decoder") {
      if (state.frames.length <= 1) {
        return;
      }
      timeMsRef.current += delta * 1000;
      const wrapped = timeMsRef.current % state.totalDurationMs;
      let acc = 0;
      let idx = 0;
      for (let i = 0; i < state.frameDurationsMs.length; i++) {
        const d = state.frameDurationsMs[i];
        if (wrapped < acc + d) {
          idx = i;
          break;
        }
        acc += d;
        idx = i;
      }
      const f = state.frames[idx];
      ctx2.setTransform(1, 0, 0, 1, 0, 0);
      ctx2.clearRect(0, 0, out.width, out.height);
      ctx2.drawImage(
        f,
        0,
        0,
        f.width,
        f.height,
        0,
        0,
        out.width,
        out.height,
      );
      tex.needsUpdate = true;
      return;
    }

    const { image, canvas: legacyCanvas } = state;
    if (!image.complete || legacyCanvas !== out) {
      return;
    }
    if (out.width < 1 || out.height < 1) {
      return;
    }
    ctx2.drawImage(image, 0, 0, out.width, out.height);
    tex.needsUpdate = true;
  });

  return texture;
}
