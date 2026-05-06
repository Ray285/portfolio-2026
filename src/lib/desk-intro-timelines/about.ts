/**
 * About (`/about`) desk intro — edit THIS FILE for future camera/object choreography.
 *
 * Today: jump to rest camera so stagger registration sees label `afterCamera` immediately.
 */

import type {
  DeskIntroMasterTimeline,
  DeskIntroTimelineAppendContext,
} from "@/lib/desk-intro-timelines/types";

export function appendAboutDeskIntroTimeline(
  master: DeskIntroMasterTimeline,
  ctx: DeskIntroTimelineAppendContext,
): void {
  const { setCam, restCamera, setIntroActive, setCameraAnimationComplete } = ctx;

  setCam({
    x: restCamera.x,
    y: restCamera.y,
    z: restCamera.z,
    zoom: restCamera.zoom,
  });
  setIntroActive(false);
  master.addLabel("afterCamera", 0);
  setCameraAnimationComplete(true);
}
