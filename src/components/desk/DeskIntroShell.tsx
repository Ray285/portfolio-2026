"use client";

import { type ReactNode, useLayoutEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Box3, Group, Vector3 } from "three";
import { IntroStaggerFromOpacityContext } from "@/context/IntroStaggerFromOpacityContext";
import { useDeskSceneId } from "@/context/DeskSceneContext";
import { useStaggerGsapOptional } from "@/context/StaggerGsapContext";
import { useItemIntroTime } from "@/context/DeskItemIntroContext";
import {
  getDeskIntroFocusItemId,
  getDeskIntroStaggerAfterCamera,
  getHomePropIntroSpec,
} from "@/lib/desk-intro-timelines";
import { getBundledDataForScene } from "@/lib/desk-default-layout";
import { getEasing } from "@/lib/easing";
import { setObject3DTreeOpacity } from "@/lib/three-object-opacity";

const scratchDeskIntroPivotCenter = new Vector3();

function measureDeskIntroScalePivot(outerShell: Group, pivot: Group): boolean {
  const content = pivot.children[0];
  if (content == null) {
    return false;
  }
  outerShell.updateWorldMatrix(true, false);
  content.updateWorldMatrix(true, true);
  const box = new Box3().setFromObject(content);
  if (box.isEmpty()) {
    return false;
  }
  box.getCenter(scratchDeskIntroPivotCenter);
  outerShell.worldToLocal(scratchDeskIntroPivotCenter);
  pivot.position.set(
    -scratchDeskIntroPivotCenter.x,
    -scratchDeskIntroPivotCenter.y,
    -scratchDeskIntroPivotCenter.z,
  );
  return true;
}

function legacyDeskIntroLerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

interface DeskIntroShellProps {
  layoutId: string;
  children: ReactNode;
}

export function DeskIntroShell({ layoutId, children }: DeskIntroShellProps) {
  const scene = useDeskSceneId();
  const staggerAfterCam = getDeskIntroStaggerAfterCamera(scene);
  const deskIntroFocusItemId = getDeskIntroFocusItemId(scene);
  const useDeskLoadIntroStagger =
    staggerAfterCam != null &&
    deskIntroFocusItemId != null;

  const bundledSceneData = getBundledDataForScene(scene);
  const legacyBundledIntro = bundledSceneData.itemIntros[layoutId];
  const legacyIntroTimeCtx = useItemIntroTime();
  const staggerGsapOptional = useStaggerGsapOptional();

  const homePropIntroSpecForDesk = getHomePropIntroSpec(layoutId);
  const scalePivotAnchorMode =
    homePropIntroSpecForDesk.introScaleAnchor ?? "none";
  const manualScalePivot = homePropIntroSpecForDesk.scalePivot;
  const needsDeskIntroScalePivot =
    useDeskLoadIntroStagger &&
    (scalePivotAnchorMode === "boundsCenter" ||
      scalePivotAnchorMode === "manual");

  const deskIntroTweenRootRef = useRef<Group>(null);
  const deskIntroScalePivotRef = useRef<Group>(null);
  const deskIntroBoundsMeasureShellRef = useRef<Group>(null);
  const legacyDeskIntroOuterRef = useRef<Group>(null);

  const staggerSceneOpacity =
    useDeskLoadIntroStagger && staggerAfterCam?.from.opacity != null
      ? (layoutId === deskIntroFocusItemId ? 1 : staggerAfterCam.from.opacity)
      : null;

  function wrapDeskIntroSceneOpacity(inner: ReactNode) {
    if (staggerSceneOpacity == null) {
      return inner;
    }
    return (
      <IntroStaggerFromOpacityContext.Provider value={staggerSceneOpacity}>
        {inner}
      </IntroStaggerFromOpacityContext.Provider>
    );
  }

  useLayoutEffect(() => {
    if (
      !useDeskLoadIntroStagger ||
      staggerGsapOptional == null ||
      staggerAfterCam == null
    ) {
      return;
    }
    const tgt = deskIntroTweenRootRef.current;
    if (tgt == null) {
      return;
    }
    // Skip opacity zeroing for the hero focus item — it starts fully visible
    // and the camera zoom itself reveals it (desk-intro-imperative sets HERO_FROM_OPACITY).
    if (staggerAfterCam.from.opacity != null && layoutId !== deskIntroFocusItemId) {
      setObject3DTreeOpacity(tgt, staggerAfterCam.from.opacity);
    }
    staggerGsapOptional.registerStaggerTarget(layoutId, tgt);
    return () => {
      staggerGsapOptional.unregisterStaggerTarget(layoutId);
    };
  }, [
    useDeskLoadIntroStagger,
    staggerGsapOptional,
    staggerAfterCam,
    layoutId,
    deskIntroFocusItemId,
  ]);

  useLayoutEffect(() => {
    if (!useDeskLoadIntroStagger || !needsDeskIntroScalePivot) {
      return;
    }
    const shell = deskIntroBoundsMeasureShellRef.current;
    const pivot = deskIntroScalePivotRef.current;
    if (shell == null || pivot == null) {
      return;
    }

    if (scalePivotAnchorMode === "manual") {
      if (manualScalePivot != null) {
        pivot.position.set(
          -manualScalePivot[0],
          -manualScalePivot[1],
          -manualScalePivot[2],
        );
      }
      return;
    }

    if (scalePivotAnchorMode !== "boundsCenter") {
      return;
    }

    let cancelled = false;
    function measure() {
      if (cancelled) {
        return;
      }
      const sh = deskIntroBoundsMeasureShellRef.current;
      const pv = deskIntroScalePivotRef.current;
      if (sh == null || pv == null || sh.parent == null) {
        return;
      }
      measureDeskIntroScalePivot(sh, pv);
    }
    measure();
    const raf1 = requestAnimationFrame(measure);
    const raf2 = requestAnimationFrame(() => measure());
    const t1 = window.setTimeout(measure, 90);
    const t2 = window.setTimeout(measure, 380);

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, [
    useDeskLoadIntroStagger,
    layoutId,
    needsDeskIntroScalePivot,
    scalePivotAnchorMode,
    manualScalePivot,
  ]);

  useFrame(() => {
    if (useDeskLoadIntroStagger || legacyBundledIntro == null) {
      return;
    }
    const g = legacyDeskIntroOuterRef.current;
    if (g == null) {
      return;
    }
    if (legacyIntroTimeCtx == null) {
      g.position.set(0, 0, 0);
      g.scale.set(1, 1, 1);
      return;
    }
    const t = legacyIntroTimeCtx.timeSec.current;
    const t0 = legacyBundledIntro.delayMs / 1000;
    const t1 = t0 + legacyBundledIntro.durationMs / 1000;
    let p = 0;
    if (t <= t0) {
      p = 0;
    } else if (t >= t1) {
      p = 1;
    } else {
      p = (t - t0) / (t1 - t0);
    }
    p = getEasing(legacyBundledIntro.easing)(p);
    const fy = legacyBundledIntro.from.y ?? 0;
    g.position.set(0, (1 - p) * fy, 0);
    const fScale = legacyBundledIntro.from.scale;
    const sc =
      fScale !== undefined ? legacyDeskIntroLerp(fScale, 1, p) : 1;
    g.scale.set(sc, sc, sc);
  });

  /** Negative priority runs before default useFrames (e.g. ContactShadows depth) so the scene matches this frame. */
  useFrame(() => {
    if (
      !useDeskLoadIntroStagger ||
      staggerSceneOpacity == null ||
      staggerGsapOptional == null
    ) {
      return;
    }
    if (staggerGsapOptional.isStaggerItemAnimated(layoutId)) {
      return;
    }
    const root = deskIntroTweenRootRef.current;
    if (root != null) {
      setObject3DTreeOpacity(root, staggerSceneOpacity);
    }
  });

  if (useDeskLoadIntroStagger) {
    if (needsDeskIntroScalePivot) {
      return (
        <group ref={deskIntroBoundsMeasureShellRef}>
          <group ref={deskIntroScalePivotRef}>
            <group ref={deskIntroTweenRootRef}>
              {wrapDeskIntroSceneOpacity(children)}
            </group>
          </group>
        </group>
      );
    }
    return (
      <group ref={deskIntroTweenRootRef}>
        {wrapDeskIntroSceneOpacity(children)}
      </group>
    );
  }
  if (legacyBundledIntro != null) {
    return <group ref={legacyDeskIntroOuterRef}>{children}</group>;
  }
  return <>{children}</>;
}
