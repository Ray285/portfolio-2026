/**
 * Home (`/`) desk intro — camera segment.
 *
 * Camera animation is driven by the Theatre.js `Camera` sheet
 * (`CameraRig.y`, `CameraRig.zoom`, `WelcomeHeader.opacity`). When the sequence
 * finishes, `setCameraAnimationComplete(true)` fires the item intro gate.
 *
 * The GSAP master timeline still owns the `afterCamera` label (for GSDevTools
 * scrubbing) but no longer drives the camera tween itself.
 */

import { cameraSheet, whenStudioReady } from "@/lib/theatre-project";
import type {
  DeskIntroMasterTimeline,
  DeskIntroTimelineAppendContext,
} from "@/lib/desk-intro-timelines/types";
import { HOME_DESK_INTRO_ZOOM_OUT } from "@/lib/desk-intro-timelines/home-desk-choreography";
import { WELCOME_HEADER_STAGGER_ID } from "@/lib/desk-intro-timelines/desk-intro-imperative";
import { setObject3DTreeOpacity } from "@/lib/three-object-opacity";

export function appendHomeDeskIntroTimeline(
  master: DeskIntroMasterTimeline,
  ctx: DeskIntroTimelineAppendContext & {
    getStaggerTarget?: (id: string) => import("three").Object3D | undefined;
  },
): void {
  const { setCam, restCamera, setIntroActive, setCameraAnimationComplete, getStaggerTarget } = ctx;
  const zoomOut = HOME_DESK_INTRO_ZOOM_OUT;
  const fromY = zoomOut.from?.y ?? 2.2;
  const fromZoom = zoomOut.from?.zoom ?? 1.65;
  const holdSec = (zoomOut.holdBeforeZoomOutMs ?? 1000) / 1000;
  const zoomSec = zoomOut.durationMs / 1000;

  // Keep master timeline label so GSDevTools can scrub the full sequence.
  master.addLabel("afterCamera", holdSec + zoomSec);
  setIntroActive(false);
  // Note: setCameraAnimationComplete(true) is deferred to the Theatre.js .then() below.

  // ─── Theatre.js Camera sheet ──────────────────────────────────────────────
  // CameraRig drives setCam each frame during playback.
  const cameraRig = cameraSheet.object(
    "CameraRig",
    { y: fromY, zoom: fromZoom },
    { reconfigure: true },
  );

  const unsubCamera = cameraRig.onValuesChange(({ y, zoom }) => {
    setCam({ x: ctx.startCameraX, y, z: ctx.startCameraZ, zoom });
  });

  // WelcomeHeader opacity is also in the Camera sheet (fades in during hold).
  const welcomeHeaderObj = cameraSheet.object(
    "WelcomeHeader",
    { opacity: 0 },
    { reconfigure: true },
  );

  const unsubHeader = welcomeHeaderObj.onValuesChange(({ opacity }) => {
    if (!getStaggerTarget) return;
    const obj = getStaggerTarget(WELCOME_HEADER_STAGGER_ID);
    if (obj) setObject3DTreeOpacity(obj, opacity);
  });

  // Defer play() until after Studio.initialize() so Studio cannot reset the
  // sequence's playing state. In production whenStudioReady resolves immediately.
  // The merged Camera sheet runs for 18.509s total:
  //   0–12.609s  → camera hold + zoom-out
  //   12.609s+   → item intro stagger (same sheet, keyframes offset)
  whenStudioReady.then(() => {
    // Signal camera complete at exactly 12.609s so DraggableObject stops
    // zeroing item opacities and onValuesChange callbacks start applying values.
    const camCompleteTimeout = setTimeout(() => {
      setCameraAnimationComplete(true);
    }, 12609);

    cameraSheet.sequence
      .play({ iterationCount: 1 })
      .catch(() => {
        // Sequence interrupted (e.g. hot-reload) — clean up and unblock item intros.
        clearTimeout(camCompleteTimeout);
        unsubCamera();
        unsubHeader();
        setCameraAnimationComplete(true);
      });
  });

  // Play a SFX near the end of the hold.
  setTimeout(() => {
    const audio = new Audio("/swoosh.wav");
    audio.volume = 0.07;
    audio.play().catch(() => {});
  }, holdSec * 1000 - 200);
}
