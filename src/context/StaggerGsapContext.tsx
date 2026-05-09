"use client";

/**
 * One **shared** `gsap.timeline()` for the whole page-load intro:
 *   1) Camera + item intros — both live on the merged Theatre.js `Camera` sheet.
 *      `home.ts` plays the sheet; item keyframes begin at position 12.609s.
 *      At 12.609s, `setCameraAnimationComplete(true)` unblocks item opacity.
 *   2) Each registered item's `onValuesChange` drives opacity + scale.
 *
 * The GSAP `masterTl` still holds the `afterCamera` label for GSDevTools scrubbing.
 */

import gsap from "gsap";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { Object3D } from "three";
import { useDeskSceneId } from "@/context/DeskSceneContext";
import {
  HOME_DESK_INTRO_READINESS_TIMEOUT_MS,
  WELCOME_HEADER_STAGGER_ID,
} from "@/lib/desk-intro-timelines/desk-intro-imperative";
import { HOME_DESK_LAYOUT_IDS } from "@/lib/desk-intro-timelines/home-intro-props";
import {
  getDeskIntroFocusItemId,
  getDeskIntroStaggerAfterCamera,
} from "@/lib/desk-intro-timelines";
import { DESK_SCENE_HOME } from "@/lib/desk-scene-id";
import {
  registerDeskIntroTimeline,
  unregisterDeskIntroTimeline,
} from "@/lib/gsap-desk-animation-registry";
import type { DeskStaggerAfterCamera } from "@/lib/desk-layout";
import { setObject3DTreeOpacity } from "@/lib/three-object-opacity";
import { cameraSheet } from "@/lib/theatre-project";

export type MasterIntroTimeline = ReturnType<typeof gsap.timeline>;

type StaggerGsapContextValue = {
  staggerConfig: DeskStaggerAfterCamera | null;
  focusItemId: string | null;
  /** Single timeline: camera (from `DeskLoadIntro`) + stagger; GSDevTools scrubs this. */
  getMasterIntroTimeline: () => MasterIntroTimeline;
  /**
   * Kills the master intro timeline (camera + any stagger) and clears stagger
   * bookkeeping. Run when the camera intro unmounts (e.g. React Strict
   * Mode) so a fresh master can be built.
   */
  resetMasterIntro: () => void;
  setCameraAnimationComplete: (v: boolean) => void;
  registerStaggerTarget: (id: string, object: Object3D) => void;
  unregisterStaggerTarget: (id: string) => void;
  /** `true` once GSAP ran prop tweens for this id (`animated` set). */
  isStaggerItemAnimated: (id: string) => boolean;
  /** Look up a registered stagger target by id (for late-bound animations). */
  getStaggerTarget: (id: string) => Object3D | undefined;
};

const StaggerGsapContext = createContext<StaggerGsapContextValue | null>(null);

function ensureMasterTl(
  ref: React.MutableRefObject<MasterIntroTimeline | null>,
): MasterIntroTimeline {
  if (!ref.current) {
    ref.current = gsap.timeline();
    registerDeskIntroTimeline(ref.current);
  }
  return ref.current;
}

export function StaggerGsapProvider({ children }: { children: ReactNode }) {
  const scene = useDeskSceneId();
  const cfg = getDeskIntroStaggerAfterCamera(scene);
  const focusId = getDeskIntroFocusItemId(scene);

  const [cameraAnimationComplete, setCameraAnimationComplete] = useState(false);
  const [registryVersion, setRegistryVersion] = useState(0);
  const setCamera = useCallback((v: boolean) => {
    setCameraAnimationComplete(v);
  }, []);
  const targets = useRef(new Map<string, Object3D>());
  const animated = useRef(new Set<string>());
  const readinessTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const deskPropsIntroCompletedRef = useRef(false);
  /** Ensures fallback timeout does not reschedule on each registration tick (fixed deadline). */
  const readinessFallbackScheduledRef = useRef(false);
  const masterTlRef = useRef<MasterIntroTimeline | null>(null);
  const firstStaggerBatchPlaced = useRef(false);
  /** Cleanup functions for Theatre.js `onValuesChange` subscriptions. */
  const theatreUnsubsRef = useRef<Array<() => void>>([]);

  const getMasterIntroTimeline = useCallback(() => {
    return ensureMasterTl(masterTlRef);
  }, []);

  const resetMasterIntro = useCallback(() => {
    for (const unsub of theatreUnsubsRef.current) unsub();
    theatreUnsubsRef.current = [];
    for (const o of targets.current.values()) {
      setObject3DTreeOpacity(o, 1);
    }
    if (masterTlRef.current) {
      unregisterDeskIntroTimeline(masterTlRef.current);
      masterTlRef.current.kill();
      masterTlRef.current = null;
    }
    firstStaggerBatchPlaced.current = false;
    deskPropsIntroCompletedRef.current = false;
    readinessFallbackScheduledRef.current = false;
    animated.current.clear();
    setCameraAnimationComplete(false);
    if (readinessTimeoutRef.current != null) {
      clearTimeout(readinessTimeoutRef.current);
      readinessTimeoutRef.current = null;
    }
  }, []);

  const runDeskPropsIntroOnce = useCallback(() => {
    if (deskPropsIntroCompletedRef.current) return;
    if (focusId == null || scene !== DESK_SCENE_HOME) return;

    // Mark all targets animated so DraggableObject's useFrame stops zeroing opacity.
    // welcome-header is driven by the Camera sheet WelcomeHeader object — mark it too.
    // onValuesChange subscriptions (set up below) will now apply Theatre.js values.
    // The merged Camera sheet is already playing from home.ts; item keyframes
    // start at position 12.609s in that same sheet — no additional play() needed.
    for (const [layoutId] of targets.current) {
      animated.current.add(layoutId);
    }
    deskPropsIntroCompletedRef.current = true;
    firstStaggerBatchPlaced.current = true;
  }, [scene, focusId]);

  const registerStaggerTarget = useCallback(
    (id: string, object: Object3D) => {
      if (targets.current.get(id) === object) {
        return;
      }
      targets.current.set(id, object);
      // welcome-header opacity is driven by Theatre.js from sequence position 0;
      // pre-mark as animated so DraggableObject's frame loop never overrides it.
      if (id === WELCOME_HEADER_STAGGER_ID) {
        animated.current.add(id);
      }
      setRegistryVersion((v) => v + 1);
    },
    [],
  );

  const unregisterStaggerTarget = useCallback((id: string) => {
    if (targets.current.delete(id)) {
      animated.current.delete(id);
      setRegistryVersion((v) => v + 1);
    }
  }, []);

  const isStaggerItemAnimated = useCallback((id: string) => {
    return animated.current.has(id);
  }, []);

  const getStaggerTarget = useCallback((id: string) => {
    return targets.current.get(id);
  }, []);

  // Persistent Theatre.js subscriptions — keep scene in sync with studio scrubbing.
  // Objects live on the merged Camera sheet; item keyframes begin at 12.609s.
  useEffect(() => {
    if (scene !== DESK_SCENE_HOME || targets.current.size === 0) return;

    const unsubs: Array<() => void> = [];
    for (const [layoutId, obj] of targets.current) {
      if (layoutId === WELCOME_HEADER_STAGGER_ID) continue;
      const theatreObj = cameraSheet.object(
        layoutId,
        { opacity: 0, scale: 0.9 },
        { reconfigure: true },
      );
      unsubs.push(
        theatreObj.onValuesChange(({ opacity, scale }) => {
          if (!deskPropsIntroCompletedRef.current) return;
          setObject3DTreeOpacity(obj, opacity);
          obj.scale.setScalar(scale);
        }),
      );
    }

    return () => {
      for (const unsub of unsubs) unsub();
    };
  }, [registryVersion, scene]);

  useEffect(() => {
    if (!cfg || focusId == null || !cameraAnimationComplete || scene !== DESK_SCENE_HOME) {
      readinessFallbackScheduledRef.current = false;
      if (readinessTimeoutRef.current != null) {
        clearTimeout(readinessTimeoutRef.current);
        readinessTimeoutRef.current = null;
      }
      return;
    }
    if (deskPropsIntroCompletedRef.current) {
      return;
    }

    const expectedIds = HOME_DESK_LAYOUT_IDS;
    const allPresent = expectedIds.every((id) => targets.current.has(id));

    const fire = () => {
      requestAnimationFrame(() => {
        requestAnimationFrame(runDeskPropsIntroOnce);
      });
    };

    if (allPresent) {
      if (readinessTimeoutRef.current != null) {
        clearTimeout(readinessTimeoutRef.current);
        readinessTimeoutRef.current = null;
      }
      readinessFallbackScheduledRef.current = false;
      fire();
      return;
    }

    if (!readinessFallbackScheduledRef.current) {
      readinessFallbackScheduledRef.current = true;
      readinessTimeoutRef.current = setTimeout(() => {
        readinessTimeoutRef.current = null;
        readinessFallbackScheduledRef.current = false;
        const missing = expectedIds.filter((id) => !targets.current.has(id));
        if (missing.length > 0) {
          console.warn(
            "[desk intro] Readiness timeout — animating partial props. Missing:",
            missing,
          );
        }
        fire();
      }, HOME_DESK_INTRO_READINESS_TIMEOUT_MS);
    }
  }, [
    cfg,
    focusId,
    cameraAnimationComplete,
    registryVersion,
    scene,
    runDeskPropsIntroOnce,
  ]);

  useEffect(
    () => () => {
      for (const o of targets.current.values()) {
        gsap.killTweensOf(o.position);
        gsap.killTweensOf(o.scale);
        setObject3DTreeOpacity(o, 1);
      }
      const tl = masterTlRef.current;
      if (tl) {
        unregisterDeskIntroTimeline(tl);
        tl.kill();
        masterTlRef.current = null;
      }
    },
    [],
  );

  const value = useMemo<StaggerGsapContextValue>(
    () => ({
      staggerConfig: cfg,
      focusItemId: focusId,
      getMasterIntroTimeline,
      resetMasterIntro,
      setCameraAnimationComplete: setCamera,
      registerStaggerTarget,
      unregisterStaggerTarget,
      isStaggerItemAnimated,
      getStaggerTarget,
    }),
    [
      cfg,
      focusId,
      getMasterIntroTimeline,
      resetMasterIntro,
      setCamera,
      registerStaggerTarget,
      unregisterStaggerTarget,
      isStaggerItemAnimated,
      getStaggerTarget,
    ],
  );

  return (
    <StaggerGsapContext.Provider value={value}>
      {children}
    </StaggerGsapContext.Provider>
  );
}

export function useStaggerGsap(): StaggerGsapContextValue {
  const c = useContext(StaggerGsapContext);
  if (!c) {
    throw new Error("useStaggerGsap must be used within StaggerGsapProvider");
  }
  return c;
}

export function useStaggerGsapOptional(): StaggerGsapContextValue | null {
  return useContext(StaggerGsapContext);
}
