"use client";

/**
 * Page-load camera segment on the shared GSAP master timeline (`StaggerGsapContext`).
 * Choreography lives in `src/lib/desk-intro-timelines/` (`home.ts`, `about.ts`).
 */

import { useLayoutEffect, useMemo } from "react";
import { useDeskControls } from "@/context/DeskControlsContext";
import { useDeskSceneId } from "@/context/DeskSceneContext";
import { useDeskIntro } from "@/context/DeskIntroContext";
import { useStaggerGsap } from "@/context/StaggerGsapContext";
import {
  appendDeskSceneIntroTimeline,
  getDeskIntroZoomOutConfig,
  type DeskIntroCamProxy,
} from "@/lib/desk-intro-timelines";
import {
  getBundledRestCameraForIntro,
  getFocusItemLayoutForZoomOutIntroSync,
} from "@/lib/desk-intro-bundled-start-camera";

export function DeskLoadIntro() {
  const scene = useDeskSceneId();
  const { setCamera } = useDeskControls();
  const { setIntroActive } = useDeskIntro();
  const {
    getMasterIntroTimeline,
    resetMasterIntro,
    setCameraAnimationComplete,
    getStaggerTarget,
  } = useStaggerGsap();

  const intro = getDeskIntroZoomOutConfig(scene);

  const setCam = (c: DeskIntroCamProxy) => {
    setCamera({ x: c.x, y: c.y, z: c.z, zoom: c.zoom });
  };

  const restCamera = useMemo(() => getBundledRestCameraForIntro(scene), [scene]);

  const startCameraX = useMemo(() => {
    if (intro == null || intro.mode !== "zoomOutFromItem") {
      return restCamera.x;
    }
    const item = getFocusItemLayoutForZoomOutIntroSync(scene);
    return item?.position[0] ?? restCamera.x;
  }, [intro, scene, restCamera.x]);

  const startCameraZ = useMemo(() => {
    if (intro == null || intro.mode !== "zoomOutFromItem") {
      return restCamera.z;
    }
    const item = getFocusItemLayoutForZoomOutIntroSync(scene);
    return intro.from?.z ?? item?.position[2] ?? restCamera.z;
  }, [intro, scene, restCamera.z]);

  const zoomFocusLayoutKey = useMemo(() => {
    if (intro == null || intro.mode !== "zoomOutFromItem") {
      return null;
    }
    const item = getFocusItemLayoutForZoomOutIntroSync(scene);
    if (item == null) {
      return null;
    }
    const [x, y, z] = item.position;
    return `${x},${y},${z}`;
  }, [intro, scene]);

  useLayoutEffect(() => {
    const master = getMasterIntroTimeline();
    appendDeskSceneIntroTimeline(master, {
      scene,
      setCam,
      restCamera,
      startCameraX,
      startCameraZ,
      setIntroActive,
      setCameraAnimationComplete,
      getStaggerTarget,
    });

    return () => {
      resetMasterIntro();
    };
  }, [
    scene,
    restCamera,
    zoomFocusLayoutKey,
    getMasterIntroTimeline,
    resetMasterIntro,
    setCamera,
    setCameraAnimationComplete,
    setIntroActive,
  ]);

  return null;
}
