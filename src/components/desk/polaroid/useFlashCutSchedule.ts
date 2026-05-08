import { useEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { Mesh, MeshBasicMaterial, MeshStandardMaterial, Texture } from "three";
import type { RefObject } from "react";

// [imageIndex, durationMs] — cycles 0-3 with linear ramp (80ms → 250ms), lands on 4 (self-portrait)
export const FLASH_CUT_SEQUENCE: readonly [number, number][] = [
  [0, 80], [1, 89], [2, 98], [3, 107],
  [0, 116], [1, 125], [2, 134], [3, 143],
  [0, 152], [1, 161], [2, 170], [3, 179],
  [0, 188], [1, 197], [2, 206], [3, 215],
  [0, 224], [1, 233], [2, 242], [3, 250],
  [4, Infinity],
];

export type PrintSize = { w: number; h: number };

export function useFlashCutSchedule(
  textures: Texture[],
  matRef: RefObject<MeshStandardMaterial | MeshBasicMaterial | null>,
  meshRef: RefObject<Mesh | null>,
  printSizes: PrintSize[],
): void {
  const elapsedMsRef = useRef(0);
  const frameRef = useRef(-1);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const audioBufferRef = useRef<AudioBuffer | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);

  useEffect(() => {
    const ctx = new AudioContext();
    const gain = ctx.createGain();
    gain.gain.value = 0.55;
    gain.connect(ctx.destination);
    audioCtxRef.current = ctx;
    gainNodeRef.current = gain;

    fetch("/intro-images/click.wav")
      .then((r) => r.arrayBuffer())
      .then((buf) => ctx.decodeAudioData(buf))
      .then((decoded) => { audioBufferRef.current = decoded; })
      .catch(() => { });

    return () => {
      void ctx.close();
      audioCtxRef.current = null;
      audioBufferRef.current = null;
      gainNodeRef.current = null;
    };
  }, []);

  useFrame((_, delta) => {
    const mat = matRef.current;
    const mesh = meshRef.current;
    if (!mat || !mesh) return;

    elapsedMsRef.current += delta * 1000;

    let cumulative = 0;
    let targetIndex = FLASH_CUT_SEQUENCE[FLASH_CUT_SEQUENCE.length - 1][0];
    for (const [imgIdx, dur] of FLASH_CUT_SEQUENCE) {
      if (elapsedMsRef.current < cumulative + dur) {
        targetIndex = imgIdx;
        break;
      }
      if (dur === Infinity) break;
      cumulative += dur;
    }

    if (targetIndex !== frameRef.current) {
      frameRef.current = targetIndex;
      const ctx = audioCtxRef.current;
      const buf = audioBufferRef.current;
      const gain = gainNodeRef.current;
      if (ctx && buf && gain) {
        if (ctx.state === "suspended") void ctx.resume();
        const source = ctx.createBufferSource();
        source.buffer = buf;
        source.connect(gain);
        source.start();
      }
      const tex = textures[targetIndex];
      if (tex) {
        mat.map = tex;
        mat.needsUpdate = true;
      }
      const size = printSizes[targetIndex];
      if (size) {
        mesh.scale.set(size.w, 1, size.h);
      }
    }
  });
}
