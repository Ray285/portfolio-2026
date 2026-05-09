import gsap from "gsap";
import type { Object3D } from "three";
import type { DeskCameraState } from "@/lib/desk-layout";
import type { DeskSceneId } from "@/lib/desk-scene-id";

/** Same shape as `StaggerGsapContext` master intro timeline. */
export type DeskIntroMasterTimeline = ReturnType<typeof gsap.timeline>;

/** Plain object GSAP tweens — wired to `DeskControlsContext.setCamera`. */
export type DeskIntroCamProxy = {
  x: number;
  y: number;
  z: number;
  zoom: number;
};

export type DeskIntroTimelineAppendContext = {
  scene: DeskSceneId;
  setCam: (c: DeskIntroCamProxy) => void;
  /** Rest orthographic pose from bundled layout (`desk-layout*.json` `camera`). */
  restCamera: DeskCameraState;
  /** Camera pose to use for X/Z during intro (centered on focus item). */
  startCameraX: number;
  startCameraZ: number;
  setIntroActive: (v: boolean) => void;
  setCameraAnimationComplete: (v: boolean) => void;
  /** Look up a registered stagger target by id (for late-bound animations during the hold phase). */
  getStaggerTarget?: (id: string) => Object3D | undefined;
};
