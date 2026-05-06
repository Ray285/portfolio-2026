/**
 * Home (`/`) desk intro — **camera** segment only (`appendHomeDeskIntroTimeline`).
 *
 * Camera zooms out from the focus polaroid over `HOME_DESK_INTRO_ZOOM_OUT.durationMs`,
 * then the props stagger begins at the `afterCamera` label.
 */

import gsap from "gsap";
import { HOME_DESK_INTRO_ZOOM_OUT } from "@/lib/desk-intro-timelines/home-desk-choreography";
import type {
  DeskIntroMasterTimeline,
  DeskIntroTimelineAppendContext,
} from "@/lib/desk-intro-timelines/types";
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

  // Set camera to zoomed-in position at t=0.
  setCam({ x: restCamera.x, y: fromY, z: restCamera.z, zoom: fromZoom });

  const proxy = { x: restCamera.x, y: fromY, z: restCamera.z, zoom: fromZoom };
  const holdSec = (zoomOut.holdBeforeZoomOutMs ?? 1000) / 1000;
  const zoomSec = zoomOut.durationMs / 1000;
  const ease = zoomOut.easingGsap ?? "power2.inOut";

  // Fade in welcome header during the hold period (starts 0.5s before zoom).
  if (getStaggerTarget) {
    const headerTarget = { v: 0 };
    master.fromTo(
      headerTarget,
      { v: 0 },
      {
        // Cap at 0.98 — below setObject3DTreeOpacity's `fully = o >= 0.99` threshold,
        // so `material.transparent` never flips back to false and triggers a mid-animation
        // shader recompile (the jitter onBeforeCompile makes that a full GPU program swap).
        v: 0.98,
        duration: 0.5,
        ease: "power2.out",
        immediateRender: false,
        onUpdate: () => {
          const obj = getStaggerTarget(WELCOME_HEADER_STAGGER_ID);
          if (obj) setObject3DTreeOpacity(obj, headerTarget.v);
        },
      },
      holdSec - 0.5,
    );
  }

  // Hold at zoomed-in position, then zoom out.
  master.call(() => { }, [], holdSec);
  master.to(proxy, {
    x: restCamera.x,
    y: restCamera.y,
    z: restCamera.z,
    zoom: restCamera.zoom,
    duration: zoomSec,
    ease,
    onUpdate: () => setCam(proxy),
    onStart: () => {
      const audio = new Audio("/swoosh.wav");
      audio.volume = 0.07;
      audio.play().catch(() => { });
    },
  });

  master.addLabel("afterCamera", holdSec + zoomSec);
  setIntroActive(false);
  setCameraAnimationComplete(true);
}
