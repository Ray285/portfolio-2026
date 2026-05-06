import { ANIMATED_TEXTURE_MAX_SOURCE_DIM } from "@/lib/animated-texture-max-dim";

const DEFAULT_FRAME_MS = 100;

function downscaleImageDataToCanvas(imageData: ImageData): HTMLCanvasElement {
  const w = imageData.width;
  const h = imageData.height;
  const scale = Math.min(
    1,
    ANIMATED_TEXTURE_MAX_SOURCE_DIM / Math.max(w, h, 1),
  );
  const c0 = document.createElement("canvas");
  c0.width = w;
  c0.height = h;
  c0.getContext("2d")?.putImageData(imageData, 0, 0);
  if (scale >= 1) {
    return c0;
  }
  const tw = Math.max(1, Math.round(w * scale));
  const th = Math.max(1, Math.round(h * scale));
  const out = document.createElement("canvas");
  out.width = tw;
  out.height = th;
  out.getContext("2d")?.drawImage(c0, 0, 0, w, h, 0, 0, tw, th);
  return out;
}

export type PredecodedFrames = {
  frames: HTMLCanvasElement[];
  frameDurationsMs: number[];
  totalDurationMs: number;
};

/**
 * WASM (libwebp) path for **animated** WebP when `ImageDecoder` is missing or
 * reports a single frame (common on iOS). This avoids
 * `CanvasRenderingContext2D.drawImage(HTMLImageElement)` for animated
 * rasters, which WebKit only samples as the first frame.
 */
export async function tryDecodeAnimatedWebpWithJsquash(
  buffer: ArrayBuffer,
): Promise<PredecodedFrames | null> {
  try {
    const { decodeAnimated } = await import("@jsquash/webp");
    const rawFrames = await decodeAnimated(buffer);
    if (rawFrames.length <= 1) {
      return null;
    }
    const frames: HTMLCanvasElement[] = [];
    const frameDurationsMs: number[] = [];
    for (const fr of rawFrames) {
      frames.push(downscaleImageDataToCanvas(fr.imageData));
      /** jSquash uses ms for animated frame duration. */
      const ms = fr.duration > 0 ? fr.duration : 0;
      frameDurationsMs.push(ms);
    }
    for (let i = 0; i < frameDurationsMs.length; i++) {
      if (frameDurationsMs[i] <= 0) {
        frameDurationsMs[i] = DEFAULT_FRAME_MS;
      }
    }
    const totalDurationMs = frameDurationsMs.reduce((a, b) => a + b, 0) || 1;
    return { frames, frameDurationsMs, totalDurationMs };
  } catch {
    return null;
  }
}

/**
 * Pure JS: non–full-bleed GIFs (patches) are not supported here — those need a
 * full compositor. When every frame is full-canvas, we can `putImageData` each
 * patch (same as WebKit-safe software decode).
 */
export async function tryDecodeAnimatedGifWithGifuct(
  buffer: ArrayBuffer,
): Promise<PredecodedFrames | null> {
  try {
    const { parseGIF, decompressFrames } = await import("gifuct-js");
    const parsed = parseGIF(buffer);
    const { lsd } = parsed;
    const raw = decompressFrames(parsed, true);
    if (raw.length <= 1) {
      return null;
    }
    for (const f of raw) {
      if (
        f.dims.left !== 0 ||
        f.dims.top !== 0 ||
        f.dims.width !== lsd.width ||
        f.dims.height !== lsd.height
      ) {
        return null;
      }
    }
    const frames: HTMLCanvasElement[] = [];
    const frameDurationsMs: number[] = [];
    for (const f of raw) {
      const c = document.createElement("canvas");
      c.width = lsd.width;
      c.height = lsd.height;
      const cctx = c.getContext("2d");
      if (!cctx) {
        return null;
      }
      const id = cctx.createImageData(lsd.width, lsd.height);
      id.data.set(f.patch);
      cctx.putImageData(id, 0, 0);
      frames.push(
        c.width > ANIMATED_TEXTURE_MAX_SOURCE_DIM ||
        c.height > ANIMATED_TEXTURE_MAX_SOURCE_DIM
          ? (() => {
              const s = Math.min(
                1,
                ANIMATED_TEXTURE_MAX_SOURCE_DIM /
                  Math.max(c.width, c.height, 1),
              );
              const tw = Math.max(1, Math.round(c.width * s));
              const th = Math.max(1, Math.round(c.height * s));
              const o = document.createElement("canvas");
              o.width = tw;
              o.height = th;
              o.getContext("2d")?.drawImage(c, 0, 0, c.width, c.height, 0, 0, tw, th);
              return o;
            })()
          : c,
      );
      const ms = f.delay > 0 ? f.delay : 0;
      frameDurationsMs.push(ms);
    }
    for (let i = 0; i < frameDurationsMs.length; i++) {
      if (frameDurationsMs[i] <= 0) {
        frameDurationsMs[i] = DEFAULT_FRAME_MS;
      }
    }
    const totalDurationMs = frameDurationsMs.reduce((a, b) => a + b, 0) || 1;
    return { frames, frameDurationsMs, totalDurationMs };
  } catch {
    return null;
  }
}
