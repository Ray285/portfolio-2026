"use client";

import { CanvasTexture, SRGBColorSpace, type Texture } from "three";
import { useEffect, useRef, useState } from "react";
import { ANIMATED_TEXTURE_MAX_SOURCE_DIM } from "@/lib/animated-texture-max-dim";
import type { PredecodedFrames } from "./animated-fallback-decode";
import { registerAnimatedTextureTick } from "./desk-animated-texture-registry";

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
  /** Hidden DOM container that hosts `image` so iOS Safari will animate it. */
  host: HTMLDivElement;
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
 * `useTexture` only keeps one frame. We try in order:
 *
 *   1. `ImageDecoder` (WebCodecs) when it reports >1 frame — canvas frames + rAF.
 *   2. **Animated WebP** (`@jsquash/webp` / libwebp wasm) if WebCodecs is
 *      missing, fails, or says 1 frame (typical on iOS). `drawImage` from a
 *      playing `HTMLImageElement` is **not** used for animation on WebKit (first
 *      frame only; bugs.webkit.org/show_bug.cgi?id=74779), so we must
 *      software-decode frames.
 *   3. Legacy `<img>` + `drawImage` — last resort; animation may be static in
 *      WebKit, but static images still work.
 */
export function useAnimatedImageTexture(url: string) {
  const [texture, setTexture] = useState<CanvasTexture | null>(null);
  const textureRef = useRef<CanvasTexture | null>(null);
  const decoderOrLegacyRef = useRef<DecoderState | LegacyState | null>(null);
  const timeMsRef = useRef(0);
  const lastDecodedFrameIdxRef = useRef(-1);
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
      // Host the <img> in the DOM. iOS Safari does not advance animation
      // frames on detached <img> elements; mounting (even invisibly) lets the
      // engine drive the animation, and `drawImage(animatedImg)` copies the
      // current frame into our WebGL texture each frame.
      //
      // Do **not** use `opacity:0` with a 1×1 `contain:strict` box: mobile
      // WebKit/Chrome may skip repainting the bitmap (stuck on first frame).
      // Use a tiny but non-zero opacity, real minimum dimensions, and no
      // `content:visibility`-style strict containment.
      const host = document.createElement("div");
      host.setAttribute("aria-hidden", "true");
      host.style.cssText =
        "position:fixed;right:0;bottom:0;z-index:1;" +
        "min-width:4px;min-height:4px;opacity:0.01;" +
        "pointer-events:none;" +
        "will-change:transform;transform:translateZ(0);";
      const image = document.createElement("img");
      image.decoding = "async";
      image.setAttribute("loading", "eager");
      image.alt = "";
      image.style.cssText =
        "display:block;min-width:2px;min-height:2px;object-fit:contain;" +
        "will-change:transform;transform:translateZ(0);";
      host.appendChild(image);
      document.body.appendChild(host);

      function onLoad() {
        if (cancelled) {
          return;
        }
        if (!out || !ctx) {
          return;
        }
        const nw = image.naturalWidth;
        const nh = image.naturalHeight;
        if (nw > 0 && nh > 0) {
          const cap = ANIMATED_TEXTURE_MAX_SOURCE_DIM;
          const scale = Math.min(1, cap / Math.max(nw, nh));
          const dw = Math.max(4, Math.round(nw * scale));
          const dh = Math.max(4, Math.round(nh * scale));
          host.style.width = `${dw}px`;
          host.style.height = `${dh}px`;
          image.style.width = `${dw}px`;
          image.style.height = `${dh}px`;
        }
        out.width = image.naturalWidth;
        out.height = image.naturalHeight;
        ctx.drawImage(image, 0, 0);
        const next = new CanvasTexture(out);
        configureImageTextureForDesk(next);
        decoderOrLegacyRef.current = { kind: "legacy", image, canvas: out, host };
        finishTexture(next);
      }
      function onError() {
        if (process.env.NODE_ENV === "development") {
          console.error(`[PolaroidPhoto] Could not load image (legacy path): ${url}`);
        }
        if (host.parentNode) {
          host.parentNode.removeChild(host);
        }
      }
      image.addEventListener("load", onLoad);
      image.addEventListener("error", onError);
      image.src = url;
      if (image.complete && image.naturalWidth > 0) {
        onLoad();
      }
    }

    function applyPredecodedFrames(pre: PredecodedFrames): boolean {
      const out = outputCanvasRef.current;
      if (!out || !ctx) {
        return false;
      }
      const { frames, frameDurationsMs, totalDurationMs } = pre;
      if (frames.length <= 1) {
        return false;
      }
      const maxW = Math.max(...frames.map((c) => c.width));
      const maxH = Math.max(...frames.map((c) => c.height));
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
    }

    async function tryImageDecoderFromBuffer(
      buffer: ArrayBuffer,
    ): Promise<boolean> {
      if (typeof ImageDecoder === "undefined") {
        return false;
      }
      try {
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
      // When `n <= 1` (e.g. iOS mis-reports or static file), we fall back to
      // @jsquash/webp for animated WebP, then to `<img>`.
      if (n <= 1) {
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
        const scale = Math.min(
          1,
          ANIMATED_TEXTURE_MAX_SOURCE_DIM / Math.max(w, h, 1),
        );
        const tw = Math.max(1, Math.round(w * scale));
        const th = Math.max(1, Math.round(h * scale));
        maxW = Math.max(maxW, tw);
        maxH = Math.max(maxH, th);
        const c = document.createElement("canvas");
        c.width = tw;
        c.height = th;
        const cctx = c.getContext("2d");
        if (cctx) {
          cctx.drawImage(vf, 0, 0, tw, th);
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
      let buffer: ArrayBuffer;
      try {
        const res = await fetch(url);
        if (!res.ok) {
          if (!cancelled) {
            setupLegacyImage();
          }
          return;
        }
        buffer = await res.arrayBuffer();
      } catch {
        if (!cancelled) {
          setupLegacyImage();
        }
        return;
      }
      if (cancelled) {
        return;
      }
      let ok = false;
      try {
        ok = await tryImageDecoderFromBuffer(buffer);
      } catch {
        ok = false;
      }
      if (cancelled) {
        return;
      }
      if (ok) {
        return;
      }
      {
        const fallback = await import("./animated-fallback-decode");
        if (cancelled) {
          return;
        }
        if (/\.webp($|[?#])/i.test(url)) {
          const pre = await fallback.tryDecodeAnimatedWebpWithJsquash(buffer);
          if (cancelled) {
            return;
          }
          if (pre && applyPredecodedFrames(pre)) {
            return;
          }
        }
        if (/\.gif($|[?#])/i.test(url)) {
          const preGif = await fallback.tryDecodeAnimatedGifWithGifuct(buffer);
          if (cancelled) {
            return;
          }
          if (preGif && applyPredecodedFrames(preGif)) {
            return;
          }
        }
      }
      if (!cancelled) {
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
      } else if (state?.kind === "legacy") {
        if (state.host.parentNode) {
          state.host.parentNode.removeChild(state.host);
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

  // Shared global tick ({@link DeskAnimatedTextureDriver}): single invalidate per desk frame.
  useEffect(() => {
    if (!texture) {
      return;
    }
    lastDecodedFrameIdxRef.current = -1;

    const unregister = registerAnimatedTextureTick((delta) => {
      const tex = textureRef.current;
      const out = outputCanvasRef.current;
      const ctx2 = ctxRef.current;
      const state = decoderOrLegacyRef.current;
      if (!tex || !out || !ctx2 || !state) {
        return false;
      }

      if (state.kind === "decoder") {
        if (state.frames.length <= 1) {
          return false;
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

        if (idx === lastDecodedFrameIdxRef.current) {
          return false;
        }
        lastDecodedFrameIdxRef.current = idx;

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
        return true;
      }

      const { image, canvas: legacyCanvas } = state;
      if (!image.complete || legacyCanvas !== out) {
        return false;
      }
      if (out.width < 1 || out.height < 1) {
        return false;
      }
      ctx2.drawImage(image, 0, 0, out.width, out.height);
      tex.needsUpdate = true;
      return true;
    });

    return unregister;
  }, [texture, url]);

  return texture;
}
