/**
 * Theatre.js project singleton.
 *
 * Single sheet: `cameraSheet` (the "Camera" sheet)
 *   0–12.609s  CameraRig { y, zoom } + WelcomeHeader { opacity }
 *   12.609s+   One object per desk item { opacity, scale }
 *
 * State JSON: `public/Portfolio.theatre-project-state-v1.json`
 * To update keyframes: run `npm run dev`, edit in Studio, then Export + overwrite.
 * Studio is only initialized in development (`TheatreStudioInit` component).
 */

import { getProject, val } from "@theatre/core";
import type { ISheet } from "@theatre/core";

export { val };
import theatreState from "../../public/Portfolio.theatre-project-state-v1.json";

// Cache on globalThis so HMR module re-evaluations reuse the same instance.
// Theatre.js uses reference equality on the config object, so re-calling
// getProject with a new object literal (even identical content) throws.
declare global { var __theatreProject: ReturnType<typeof getProject> | undefined }
// eslint-disable-next-line @typescript-eslint/no-explicit-any
globalThis.__theatreProject ??= getProject("Portfolio", { state: theatreState as any });
export const theatreProject = globalThis.__theatreProject;

export const cameraSheet: ISheet = theatreProject.sheet("Camera");

// In development, Studio.initialize() resets any in-flight sequence.play() call.
// `whenStudioReady` resolves after Studio has finished initializing so callers
// can defer sequence.play() until it is safe to do so.
// In production (no Studio) this resolves immediately.
declare global { var __studioReadyResolve: (() => void) | undefined }
export const whenStudioReady: Promise<void> =
  process.env.NODE_ENV === "development"
    ? new Promise<void>((resolve) => { globalThis.__studioReadyResolve = resolve; })
    : Promise.resolve();

export function notifyStudioReady(): void {
  globalThis.__studioReadyResolve?.();
  globalThis.__studioReadyResolve = undefined;
}
