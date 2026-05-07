/**
 * Home desk props intro — **one** readiness-gated `gsap.timeline()` after camera
 * ([`StaggerGsapContext`](../../context/StaggerGsapContext.tsx)).
 *
 * Each prop below uses explicit **`deskProps.fromTo`** (opacity proxy → **`setObject3DTreeOpacity`**)
 * and **`deskProps.to`** on **`o.scale`** with **`back.out`** overshoot — same structure as DOM-style GSAP,
 * Three targets (`position` / `scale`). Order matches [`buildDeskIntroSequenceSlots`](./home-desk-choreography.ts).
 *
 * **`HOME_DESK_PROPS_INTRO_MOUNT_STYLE`** mirrors React mount pinning ([`DraggableObject`](../../components/desk/DraggableObject.tsx)).
 */

import gsap from "gsap";
import { MathUtils, type Object3D } from "three";
import type { DeskStaggerAfterCamera } from "@/lib/desk-layout";
import { deskItemId } from "@/lib/desk-layout";
import type { DeskIntroMasterTimeline } from "@/lib/desk-intro-timelines/types";
import { setObject3DTreeOpacity } from "@/lib/three-object-opacity";
import {
  homeCardLayoutIdFromDeskSlug,
  homePolaroidLayoutIdFromDeskSlug,
} from "@/lib/portfolio-data";

/** After camera completes: wait this long for shells to register, then animate whichever targets exist. */
export const HOME_DESK_INTRO_READINESS_TIMEOUT_MS = 500;

/** Stable ref — React stagger deps compare by identity; do not recreate each render. */
export const HOME_DESK_PROPS_INTRO_MOUNT_STYLE: DeskStaggerAfterCamera = {
  staggerMs: 200,
  eachDurationMs: 600,
  ease: "back.out(1.55)",
  from: {
    y: 0,
    scale: 0.9,
    opacity: 0,
  },
};

const STAGGER_GAP_SEC = HOME_DESK_PROPS_INTRO_MOUNT_STYLE.staggerMs / 1000;
const PROP_INTRO_DURATION_SEC =
  HOME_DESK_PROPS_INTRO_MOUNT_STYLE.eachDurationMs / 1000;
const PROP_INTRO_EASE = HOME_DESK_PROPS_INTRO_MOUNT_STYLE.ease;
const FROM_SCALE = HOME_DESK_PROPS_INTRO_MOUNT_STYLE.from.scale ?? 1;
const FROM_OPACITY = HOME_DESK_PROPS_INTRO_MOUNT_STYLE.from.opacity ?? 0;
const FROM_Y = HOME_DESK_PROPS_INTRO_MOUNT_STYLE.from.y ?? 0;

/** Local Z offset (positive = below on screen in top-down ortho view) for hero items. */
const HERO_FROM_Z = 0.8;
const HERO_EASE = "power2.out";
/** Hero items start fully visible — the camera zoom itself reveals them. */
const HERO_FROM_OPACITY = 1;

/** Layout ID used to register the static welcome header with the stagger system. */
export const WELCOME_HEADER_STAGGER_ID = "welcome-header";

/**
 * Single props wave at **`afterCamera`**: explicit linear sequence (no choreography loop).
 *
 * @returns `true` if at least one item was animated.
 */
export function appendDeskPropsIntroImperative(
  master: DeskIntroMasterTimeline,
  targets: Map<string, Object3D>,
  focusItemId: string,
  animatedIds: Set<string>,
): boolean {
  const deskProps = gsap.timeline();
  let t = 0;
  let anyAdded = false;

  /* ——— HERO: raymond polaroid — scale at rest position (fully visible from frame one; camera zoom reveals it) ——— */
  {
    const layoutId = homePolaroidLayoutIdFromDeskSlug("raymond");
    if (layoutId != null) {
      const o = targets.get(layoutId);
      if (o != null && !animatedIds.has(layoutId)) {
        animatedIds.add(layoutId);
        setObject3DTreeOpacity(o, HERO_FROM_OPACITY);
        deskProps.to(
          o.scale,
          { x: 1, y: 1, z: 1, duration: PROP_INTRO_DURATION_SEC, ease: HERO_EASE },
          t,
        );
        anyAdded = true;
      }
    }
  }
  /* ——— Welcome header — faded in during the camera hold; just mark as done, don't touch opacity.
   *     Calling setObject3DTreeOpacity(o, 1) here would flip transparent→false on the jitter
   *     material's onBeforeCompile shader, forcing a GPU recompile right as the zoom starts. ——— */
  {
    const o = targets.get(WELCOME_HEADER_STAGGER_ID);
    if (o != null && !animatedIds.has(WELCOME_HEADER_STAGGER_ID)) {
      animatedIds.add(WELCOME_HEADER_STAGGER_ID);
      anyAdded = true;
    }
  }
  t += STAGGER_GAP_SEC;

  /* ——— Remaining items ——— delay to after camera zoom completes ——— */
  t = 0.0;

  /* ——— Selected Work ——— */
  {
    const layoutId = homeCardLayoutIdFromDeskSlug("selected-work");
    if (layoutId != null && layoutId !== focusItemId) {
      const o = targets.get(layoutId);
      if (o != null && !animatedIds.has(layoutId)) {
        animatedIds.add(layoutId);
        o.position.set(0, FROM_Y, 0);
        o.scale.setScalar(FROM_SCALE);
        setObject3DTreeOpacity(o, FROM_OPACITY);
        const op = { v: FROM_OPACITY };
        deskProps.fromTo(
          op,
          { v: FROM_OPACITY },
          {
            v: 1,
            duration: PROP_INTRO_DURATION_SEC,
            ease: PROP_INTRO_EASE,
            immediateRender: false,
            onUpdate: () => setObject3DTreeOpacity(o, op.v),
          },
          t,
        );
        deskProps.to(
          o.scale,
          {
            x: 1,
            y: 1,
            z: 1,
            duration: PROP_INTRO_DURATION_SEC,
            ease: PROP_INTRO_EASE,
          },
          "<",
        );
        t += STAGGER_GAP_SEC;
        anyAdded = true;
      }
    }
  }

  /* ——— Studio Notes ——— */
  {
    const layoutId = homeCardLayoutIdFromDeskSlug("studio-notes");
    if (layoutId != null && layoutId !== focusItemId) {
      const o = targets.get(layoutId);
      if (o != null && !animatedIds.has(layoutId)) {
        animatedIds.add(layoutId);
        o.position.set(0, FROM_Y, 0);
        o.scale.setScalar(FROM_SCALE);
        setObject3DTreeOpacity(o, FROM_OPACITY);
        const op = { v: FROM_OPACITY };
        deskProps.fromTo(
          op,
          { v: FROM_OPACITY },
          {
            v: 1,
            duration: PROP_INTRO_DURATION_SEC,
            ease: PROP_INTRO_EASE,
            immediateRender: false,
            onUpdate: () => setObject3DTreeOpacity(o, op.v),
          },
          t,
        );
        deskProps.to(
          o.scale,
          {
            x: 1,
            y: 1,
            z: 1,
            duration: PROP_INTRO_DURATION_SEC,
            ease: PROP_INTRO_EASE,
          },
          "<",
        );
        t += STAGGER_GAP_SEC;
        anyAdded = true;
      }
    }
  }

  /* ——— Contact ——— */
  {
    const layoutId = homeCardLayoutIdFromDeskSlug("contact");
    if (layoutId != null && layoutId !== focusItemId) {
      const o = targets.get(layoutId);
      if (o != null && !animatedIds.has(layoutId)) {
        animatedIds.add(layoutId);
        o.position.set(0, FROM_Y, 0);
        o.scale.setScalar(FROM_SCALE);
        setObject3DTreeOpacity(o, FROM_OPACITY);
        const op = { v: FROM_OPACITY };
        deskProps.fromTo(
          op,
          { v: FROM_OPACITY },
          {
            v: 1,
            duration: PROP_INTRO_DURATION_SEC,
            ease: PROP_INTRO_EASE,
            immediateRender: false,
            onUpdate: () => setObject3DTreeOpacity(o, op.v),
          },
          t,
        );
        deskProps.to(
          o.scale,
          {
            x: 1,
            y: 1,
            z: 1,
            duration: PROP_INTRO_DURATION_SEC,
            ease: PROP_INTRO_EASE,
          },
          "<",
        );
        t += STAGGER_GAP_SEC;
        anyAdded = true;
      }
    }
  }

  /* ——— Polaroid: interface-study ——— */
  {
    const layoutId = homePolaroidLayoutIdFromDeskSlug("interface-study");
    if (layoutId != null && layoutId !== focusItemId) {
      const o = targets.get(layoutId);
      if (o != null && !animatedIds.has(layoutId)) {
        animatedIds.add(layoutId);
        o.position.set(0, FROM_Y, 0);
        o.scale.setScalar(FROM_SCALE);
        setObject3DTreeOpacity(o, FROM_OPACITY);
        const op = { v: FROM_OPACITY };
        deskProps.fromTo(
          op,
          { v: FROM_OPACITY },
          {
            v: 1,
            duration: PROP_INTRO_DURATION_SEC,
            ease: PROP_INTRO_EASE,
            immediateRender: false,
            onUpdate: () => setObject3DTreeOpacity(o, op.v),
          },
          t
        );
        deskProps.to(o.scale, { x: 1, y: 1, z: 1, duration: PROP_INTRO_DURATION_SEC, ease: PROP_INTRO_EASE }, "<");
        t += STAGGER_GAP_SEC;
        anyAdded = true;
      }
    }
  }

  /* ——— Polaroid: prototype-desk ——— */
  {
    const layoutId = homePolaroidLayoutIdFromDeskSlug("prototype-desk");
    if (layoutId != null && layoutId !== focusItemId) {
      const o = targets.get(layoutId);
      if (o != null && !animatedIds.has(layoutId)) {
        animatedIds.add(layoutId);
        o.position.set(0, FROM_Y, 0);
        o.scale.setScalar(FROM_SCALE);
        setObject3DTreeOpacity(o, FROM_OPACITY);
        const op = { v: FROM_OPACITY };
        deskProps.fromTo(
          op,
          { v: FROM_OPACITY },
          {
            v: 1,
            duration: PROP_INTRO_DURATION_SEC,
            ease: PROP_INTRO_EASE,
            immediateRender: false,
            onUpdate: () => setObject3DTreeOpacity(o, op.v),
          },
          t,
        );
        deskProps.to(o.scale, { x: 1, y: 1, z: 1, duration: PROP_INTRO_DURATION_SEC, ease: PROP_INTRO_EASE }, "<");
        t += STAGGER_GAP_SEC;
        anyAdded = true;
      }
    }
  }

  /* ——— Polaroid: launch-notes ——— */
  {
    const layoutId = homePolaroidLayoutIdFromDeskSlug("launch-notes");
    if (layoutId != null && layoutId !== focusItemId) {
      const o = targets.get(layoutId);
      if (o != null && !animatedIds.has(layoutId)) {
        animatedIds.add(layoutId);
        o.position.set(0, FROM_Y, 0);
        o.scale.setScalar(FROM_SCALE);
        setObject3DTreeOpacity(o, FROM_OPACITY);
        const op = { v: FROM_OPACITY };
        deskProps.fromTo(
          op,
          { v: FROM_OPACITY },
          {
            v: 1,
            duration: PROP_INTRO_DURATION_SEC,
            ease: PROP_INTRO_EASE,
            immediateRender: false,
            onUpdate: () => setObject3DTreeOpacity(o, op.v),
          },
          t,
        );
        deskProps.to(o.scale, { x: 1, y: 1, z: 1, duration: PROP_INTRO_DURATION_SEC, ease: PROP_INTRO_EASE }, "<");
        t += STAGGER_GAP_SEC;
        anyAdded = true;
      }
    }
  }

  /* ——— Polaroid: archive-01 ——— */
  {
    const layoutId = homePolaroidLayoutIdFromDeskSlug("archive-01");
    if (layoutId != null && layoutId !== focusItemId) {
      const o = targets.get(layoutId);
      if (o != null && !animatedIds.has(layoutId)) {
        animatedIds.add(layoutId);
        o.position.set(0, FROM_Y, 0);
        o.scale.setScalar(0.5);
        o.rotation.set(0, MathUtils.degToRad(-30), 0); // initial rotation
        setObject3DTreeOpacity(o, 1);
        const op = { v: FROM_OPACITY };
        deskProps.fromTo(
          op,
          { v: FROM_OPACITY },
          {
            v: 1,
            duration: PROP_INTRO_DURATION_SEC,
            ease: PROP_INTRO_EASE,
            immediateRender: false,
            onUpdate: () => setObject3DTreeOpacity(o, op.v),
          },
          t,
        );
        deskProps.to(o.scale, { x: 1, y: 1, z: 1, duration: PROP_INTRO_DURATION_SEC, ease: PROP_INTRO_EASE }, "<");
        deskProps.to(o.rotation, { y: MathUtils.degToRad(90), duration: 0.3, ease: PROP_INTRO_EASE }, "<");

        t += STAGGER_GAP_SEC;
        anyAdded = true;
      }
    }
  }

  /* ——— Polaroid: archive-02 ——— */
  {
    const layoutId = homePolaroidLayoutIdFromDeskSlug("archive-02");
    if (layoutId != null && layoutId !== focusItemId) {
      const o = targets.get(layoutId);
      if (o != null && !animatedIds.has(layoutId)) {
        animatedIds.add(layoutId);
        o.position.set(0, FROM_Y, 0);
        o.scale.setScalar(FROM_SCALE);
        setObject3DTreeOpacity(o, FROM_OPACITY);
        const op = { v: FROM_OPACITY };
        deskProps.fromTo(
          op,
          { v: FROM_OPACITY },
          {
            v: 1,
            duration: PROP_INTRO_DURATION_SEC,
            ease: PROP_INTRO_EASE,
            immediateRender: false,
            onUpdate: () => setObject3DTreeOpacity(o, op.v),
          },
          t,
        );
        deskProps.to(o.scale, { x: 1, y: 1, z: 1, duration: PROP_INTRO_DURATION_SEC, ease: PROP_INTRO_EASE }, "<");
        t += STAGGER_GAP_SEC;
        anyAdded = true;
      }
    }
  }

  /* ——— Polaroid: archive-03 ——— */
  {
    const layoutId = homePolaroidLayoutIdFromDeskSlug("archive-03");
    if (layoutId != null && layoutId !== focusItemId) {
      const o = targets.get(layoutId);
      if (o != null && !animatedIds.has(layoutId)) {
        animatedIds.add(layoutId);
        o.position.set(0, FROM_Y, 0);
        o.scale.setScalar(FROM_SCALE);
        setObject3DTreeOpacity(o, FROM_OPACITY);
        const op = { v: FROM_OPACITY };
        deskProps.fromTo(
          op,
          { v: FROM_OPACITY },
          {
            v: 1,
            duration: PROP_INTRO_DURATION_SEC,
            ease: PROP_INTRO_EASE,
            immediateRender: false,
            onUpdate: () => setObject3DTreeOpacity(o, op.v),
          },
          t,
        );
        deskProps.to(o.scale, { x: 1, y: 1, z: 1, duration: PROP_INTRO_DURATION_SEC, ease: PROP_INTRO_EASE }, "<");
        t += STAGGER_GAP_SEC;
        anyAdded = true;
      }
    }
  }

  /* ——— Polaroid: archive-04 ——— */
  {
    const layoutId = homePolaroidLayoutIdFromDeskSlug("archive-04");
    if (layoutId != null && layoutId !== focusItemId) {
      const o = targets.get(layoutId);
      if (o != null && !animatedIds.has(layoutId)) {
        animatedIds.add(layoutId);
        o.position.set(0, FROM_Y, 0);
        o.scale.setScalar(FROM_SCALE);
        setObject3DTreeOpacity(o, FROM_OPACITY);
        const op = { v: FROM_OPACITY };
        deskProps.fromTo(
          op,
          { v: FROM_OPACITY },
          {
            v: 1,
            duration: PROP_INTRO_DURATION_SEC,
            ease: PROP_INTRO_EASE,
            immediateRender: false,
            onUpdate: () => setObject3DTreeOpacity(o, op.v),
          },
          t,
        );
        deskProps.to(o.scale, { x: 1, y: 1, z: 1, duration: PROP_INTRO_DURATION_SEC, ease: PROP_INTRO_EASE }, "<");
        t += STAGGER_GAP_SEC;
        anyAdded = true;
      }
    }
  }

  /* ——— Polaroid: archive-05 ——— */
  {
    const layoutId = homePolaroidLayoutIdFromDeskSlug("archive-05");
    if (layoutId != null && layoutId !== focusItemId) {
      const o = targets.get(layoutId);
      if (o != null && !animatedIds.has(layoutId)) {
        animatedIds.add(layoutId);
        o.position.set(0, FROM_Y, 0);
        o.scale.setScalar(FROM_SCALE);
        setObject3DTreeOpacity(o, FROM_OPACITY);
        const op = { v: FROM_OPACITY };
        deskProps.fromTo(
          op,
          { v: FROM_OPACITY },
          {
            v: 1,
            duration: PROP_INTRO_DURATION_SEC,
            ease: PROP_INTRO_EASE,
            immediateRender: false,
            onUpdate: () => setObject3DTreeOpacity(o, op.v),
          },
          t,
        );
        deskProps.to(o.scale, { x: 1, y: 1, z: 1, duration: PROP_INTRO_DURATION_SEC, ease: PROP_INTRO_EASE }, "<");
        t += STAGGER_GAP_SEC;
        anyAdded = true;
      }
    }
  }

  /* ——— Polaroid: archive-06 ——— */
  {
    const layoutId = homePolaroidLayoutIdFromDeskSlug("archive-06");
    if (layoutId != null && layoutId !== focusItemId) {
      const o = targets.get(layoutId);
      if (o != null && !animatedIds.has(layoutId)) {
        animatedIds.add(layoutId);
        o.position.set(0, FROM_Y, 0);
        o.scale.setScalar(FROM_SCALE);
        setObject3DTreeOpacity(o, FROM_OPACITY);
        const op = { v: FROM_OPACITY };
        deskProps.fromTo(
          op,
          { v: FROM_OPACITY },
          {
            v: 1,
            duration: PROP_INTRO_DURATION_SEC,
            ease: PROP_INTRO_EASE,
            immediateRender: false,
            onUpdate: () => setObject3DTreeOpacity(o, op.v),
          },
          t,
        );
        deskProps.to(o.scale, { x: 1, y: 1, z: 1, duration: PROP_INTRO_DURATION_SEC, ease: PROP_INTRO_EASE }, "<");
        t += STAGGER_GAP_SEC;
        anyAdded = true;
      }
    }
  }

  /* ——— Polaroid: archive-07 ——— */
  {
    const layoutId = homePolaroidLayoutIdFromDeskSlug("archive-07");
    if (layoutId != null && layoutId !== focusItemId) {
      const o = targets.get(layoutId);
      if (o != null && !animatedIds.has(layoutId)) {
        animatedIds.add(layoutId);
        o.position.set(0, FROM_Y, 0);
        o.scale.setScalar(FROM_SCALE);
        setObject3DTreeOpacity(o, FROM_OPACITY);
        const op = { v: FROM_OPACITY };
        deskProps.fromTo(
          op,
          { v: FROM_OPACITY },
          {
            v: 1,
            duration: PROP_INTRO_DURATION_SEC,
            ease: PROP_INTRO_EASE,
            immediateRender: false,
            onUpdate: () => setObject3DTreeOpacity(o, op.v),
          },
          t,
        );
        deskProps.to(o.scale, { x: 1, y: 1, z: 1, duration: PROP_INTRO_DURATION_SEC, ease: PROP_INTRO_EASE }, "<");
        t += STAGGER_GAP_SEC;
        anyAdded = true;
      }
    }
  }

  /* ——— Polaroid: archive-08 ——— */
  {
    const layoutId = homePolaroidLayoutIdFromDeskSlug("archive-08");
    if (layoutId != null && layoutId !== focusItemId) {
      const o = targets.get(layoutId);
      if (o != null && !animatedIds.has(layoutId)) {
        animatedIds.add(layoutId);
        o.position.set(0, FROM_Y, 0);
        o.scale.setScalar(FROM_SCALE);
        setObject3DTreeOpacity(o, FROM_OPACITY);
        const op = { v: FROM_OPACITY };
        deskProps.fromTo(
          op,
          { v: FROM_OPACITY },
          {
            v: 1,
            duration: PROP_INTRO_DURATION_SEC,
            ease: PROP_INTRO_EASE,
            immediateRender: false,
            onUpdate: () => setObject3DTreeOpacity(o, op.v),
          },
          t,
        );
        deskProps.to(o.scale, { x: 1, y: 1, z: 1, duration: PROP_INTRO_DURATION_SEC, ease: PROP_INTRO_EASE }, "<");
        t += STAGGER_GAP_SEC;
        anyAdded = true;
      }
    }
  }

  /* ——— Polaroid: archive-09 ——— */
  {
    const layoutId = homePolaroidLayoutIdFromDeskSlug("archive-09");
    if (layoutId != null && layoutId !== focusItemId) {
      const o = targets.get(layoutId);
      if (o != null && !animatedIds.has(layoutId)) {
        animatedIds.add(layoutId);
        o.position.set(0, FROM_Y, 0);
        o.scale.setScalar(FROM_SCALE);
        setObject3DTreeOpacity(o, FROM_OPACITY);
        const op = { v: FROM_OPACITY };
        deskProps.fromTo(
          op,
          { v: FROM_OPACITY },
          {
            v: 1,
            duration: PROP_INTRO_DURATION_SEC,
            ease: PROP_INTRO_EASE,
            immediateRender: false,
            onUpdate: () => setObject3DTreeOpacity(o, op.v),
          },
          t,
        );
        deskProps.to(o.scale, { x: 1, y: 1, z: 1, duration: PROP_INTRO_DURATION_SEC, ease: PROP_INTRO_EASE }, "<");
        t += STAGGER_GAP_SEC;
        anyAdded = true;
      }
    }
  }

  /* ——— Polaroid: archive-10 ——— */
  {
    const layoutId = homePolaroidLayoutIdFromDeskSlug("archive-10");
    if (layoutId != null && layoutId !== focusItemId) {
      const o = targets.get(layoutId);
      if (o != null && !animatedIds.has(layoutId)) {
        animatedIds.add(layoutId);
        o.position.set(0, FROM_Y, 0);
        o.scale.setScalar(FROM_SCALE);
        setObject3DTreeOpacity(o, FROM_OPACITY);
        const op = { v: FROM_OPACITY };
        deskProps.fromTo(
          op,
          { v: FROM_OPACITY },
          {
            v: 1,
            duration: PROP_INTRO_DURATION_SEC,
            ease: PROP_INTRO_EASE,
            immediateRender: false,
            onUpdate: () => setObject3DTreeOpacity(o, op.v),
          },
          t,
        );
        deskProps.to(o.scale, { x: 1, y: 1, z: 1, duration: PROP_INTRO_DURATION_SEC, ease: PROP_INTRO_EASE }, "<");
        t += STAGGER_GAP_SEC;
        anyAdded = true;
      }
    }
  }

  /* ——— Polaroid: archive-11 ——— */
  {
    const layoutId = homePolaroidLayoutIdFromDeskSlug("archive-11");
    if (layoutId != null && layoutId !== focusItemId) {
      const o = targets.get(layoutId);
      if (o != null && !animatedIds.has(layoutId)) {
        animatedIds.add(layoutId);
        o.position.set(0, FROM_Y, 0);
        o.scale.setScalar(FROM_SCALE);
        setObject3DTreeOpacity(o, FROM_OPACITY);
        const op = { v: FROM_OPACITY };
        deskProps.fromTo(
          op,
          { v: FROM_OPACITY },
          {
            v: 1,
            duration: PROP_INTRO_DURATION_SEC,
            ease: PROP_INTRO_EASE,
            immediateRender: false,
            onUpdate: () => setObject3DTreeOpacity(o, op.v),
          },
          t,
        );
        deskProps.to(o.scale, { x: 1, y: 1, z: 1, duration: PROP_INTRO_DURATION_SEC, ease: PROP_INTRO_EASE }, "<");
        t += STAGGER_GAP_SEC;
        anyAdded = true;
      }
    }
  }

  /* ——— Polaroid: archive-12 ——— */
  {
    const layoutId = homePolaroidLayoutIdFromDeskSlug("archive-12");
    if (layoutId != null && layoutId !== focusItemId) {
      const o = targets.get(layoutId);
      if (o != null && !animatedIds.has(layoutId)) {
        animatedIds.add(layoutId);
        o.position.set(0, FROM_Y, 0);
        o.scale.setScalar(FROM_SCALE);
        setObject3DTreeOpacity(o, FROM_OPACITY);
        const op = { v: FROM_OPACITY };
        deskProps.fromTo(
          op,
          { v: FROM_OPACITY },
          {
            v: 1,
            duration: PROP_INTRO_DURATION_SEC,
            ease: PROP_INTRO_EASE,
            immediateRender: false,
            onUpdate: () => setObject3DTreeOpacity(o, op.v),
          },
          t,
        );
        deskProps.to(o.scale, { x: 1, y: 1, z: 1, duration: PROP_INTRO_DURATION_SEC, ease: PROP_INTRO_EASE }, "<");
        t += STAGGER_GAP_SEC;
        anyAdded = true;
      }
    }
  }

  /* ——— Polaroid: archive-13 ——— */
  {
    const layoutId = homePolaroidLayoutIdFromDeskSlug("archive-13");
    if (layoutId != null && layoutId !== focusItemId) {
      const o = targets.get(layoutId);
      if (o != null && !animatedIds.has(layoutId)) {
        animatedIds.add(layoutId);
        o.position.set(0, FROM_Y, 0);
        o.scale.setScalar(FROM_SCALE);
        setObject3DTreeOpacity(o, FROM_OPACITY);
        const op = { v: FROM_OPACITY };
        deskProps.fromTo(
          op,
          { v: FROM_OPACITY },
          {
            v: 1,
            duration: PROP_INTRO_DURATION_SEC,
            ease: PROP_INTRO_EASE,
            immediateRender: false,
            onUpdate: () => setObject3DTreeOpacity(o, op.v),
          },
          t,
        );
        deskProps.to(o.scale, { x: 1, y: 1, z: 1, duration: PROP_INTRO_DURATION_SEC, ease: PROP_INTRO_EASE }, "<");
        t += STAGGER_GAP_SEC;
        anyAdded = true;
      }
    }
  }

  /* ——— Polaroid: archive-14 ——— */
  {
    const layoutId = homePolaroidLayoutIdFromDeskSlug("archive-14");
    if (layoutId != null && layoutId !== focusItemId) {
      const o = targets.get(layoutId);
      if (o != null && !animatedIds.has(layoutId)) {
        animatedIds.add(layoutId);
        o.position.set(0, FROM_Y, 0);
        o.scale.setScalar(FROM_SCALE);
        setObject3DTreeOpacity(o, FROM_OPACITY);
        const op = { v: FROM_OPACITY };
        deskProps.fromTo(
          op,
          { v: FROM_OPACITY },
          {
            v: 1,
            duration: PROP_INTRO_DURATION_SEC,
            ease: PROP_INTRO_EASE,
            immediateRender: false,
            onUpdate: () => setObject3DTreeOpacity(o, op.v),
          },
          t,
        );
        deskProps.to(o.scale, { x: 1, y: 1, z: 1, duration: PROP_INTRO_DURATION_SEC, ease: PROP_INTRO_EASE }, "<");
        t += STAGGER_GAP_SEC;
        anyAdded = true;
      }
    }
  }

  /* ——— Polaroid: archive-15 ——— */
  {
    const layoutId = homePolaroidLayoutIdFromDeskSlug("archive-15");
    if (layoutId != null && layoutId !== focusItemId) {
      const o = targets.get(layoutId);
      if (o != null && !animatedIds.has(layoutId)) {
        animatedIds.add(layoutId);
        o.position.set(0, FROM_Y, 0);
        o.scale.setScalar(FROM_SCALE);
        setObject3DTreeOpacity(o, FROM_OPACITY);
        const op = { v: FROM_OPACITY };
        deskProps.fromTo(
          op,
          { v: FROM_OPACITY },
          {
            v: 1,
            duration: PROP_INTRO_DURATION_SEC,
            ease: PROP_INTRO_EASE,
            immediateRender: false,
            onUpdate: () => setObject3DTreeOpacity(o, op.v),
          },
          t,
        );
        deskProps.to(o.scale, { x: 1, y: 1, z: 1, duration: PROP_INTRO_DURATION_SEC, ease: PROP_INTRO_EASE }, "<");
        t += STAGGER_GAP_SEC;
        anyAdded = true;
      }
    }
  }

  /* ——— Home desk video ——— */
  {
    const layoutId = deskItemId.homeDeskVideo;
    const o = targets.get(layoutId);
    if (o != null && !animatedIds.has(layoutId)) {
      animatedIds.add(layoutId);
      o.position.set(0, FROM_Y, 0);
      o.scale.setScalar(FROM_SCALE);
      setObject3DTreeOpacity(o, FROM_OPACITY);
      const op = { v: FROM_OPACITY };
      deskProps.fromTo(
        op,
        { v: FROM_OPACITY },
        {
          v: 1,
          duration: PROP_INTRO_DURATION_SEC,
          ease: PROP_INTRO_EASE,
          immediateRender: false,
          onUpdate: () => setObject3DTreeOpacity(o, op.v),
        },
        t,
      );
      deskProps.to(o.scale, { x: 1, y: 1, z: 1, duration: PROP_INTRO_DURATION_SEC, ease: PROP_INTRO_EASE }, "<");
      t += STAGGER_GAP_SEC;
      anyAdded = true;
    }
  }

  /* ——— iPhone ——— */
  {
    const layoutId = deskItemId.iphone;
    if (layoutId !== focusItemId) {
      const o = targets.get(layoutId);
      if (o != null && !animatedIds.has(layoutId)) {
        animatedIds.add(layoutId);
        o.position.set(0, FROM_Y, 0);
        o.scale.setScalar(FROM_SCALE);
        setObject3DTreeOpacity(o, FROM_OPACITY);
        const op = { v: FROM_OPACITY };
        deskProps.fromTo(
          op,
          { v: FROM_OPACITY },
          {
            v: 1,
            duration: PROP_INTRO_DURATION_SEC,
            ease: PROP_INTRO_EASE,
            immediateRender: false,
            onUpdate: () => setObject3DTreeOpacity(o, op.v),
          },
          t,
        );
        deskProps.to(o.scale, { x: 1, y: 1, z: 1, duration: PROP_INTRO_DURATION_SEC, ease: PROP_INTRO_EASE }, "<");
        t += STAGGER_GAP_SEC;
        anyAdded = true;
      }
    }
  }

  /* ——— Catch-all: registered targets not covered by an explicit block above ———
   *  Handles items added to the desk after the choreography was written (e.g.
   *  jitter-text elements) so they aren't permanently opacity-zeroed by the
   *  DraggableObject frame loop, which keeps items at FROM_OPACITY until they
   *  appear in animatedIds. */
  for (const [layoutId, o] of targets) {
    if (animatedIds.has(layoutId) || layoutId === focusItemId) {
      continue;
    }
    animatedIds.add(layoutId);
    setObject3DTreeOpacity(o, FROM_OPACITY);
    const op = { v: FROM_OPACITY };
    deskProps.fromTo(
      op,
      { v: FROM_OPACITY },
      {
        v: 1,
        duration: PROP_INTRO_DURATION_SEC,
        ease: PROP_INTRO_EASE,
        immediateRender: false,
        onUpdate: () => setObject3DTreeOpacity(o, op.v),
      },
      t,
    );
    t += STAGGER_GAP_SEC;
    anyAdded = true;
  }

  if (!anyAdded) {
    return false;
  }

  const labelMap = (master as { labels?: Record<string, number> }).labels;
  const hasAfterCameraLabel =
    labelMap != null &&
    Object.prototype.hasOwnProperty.call(labelMap, "afterCamera");

  const at: number | string = hasAfterCameraLabel ? "afterCamera" : 0;
  master.add(deskProps, at);
  return true;
}
