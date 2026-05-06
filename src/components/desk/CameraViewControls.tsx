"use client";

import { useThree } from "@react-three/fiber";
import { useEffect, useLayoutEffect, useRef } from "react";
import { OrthographicCamera } from "three";
import { useDeskControls } from "@/context/DeskControlsContext";
import { useDeskLayout } from "@/context/DeskLayoutContext";
import { useDeskIntroOptional } from "@/context/DeskIntroContext";
import { CAMERA_Y_MAX, CAMERA_Y_MIN } from "@/lib/desk-camera-y-bounds";
import {
  CAMERA_PAN_X_MAX,
  CAMERA_PAN_X_MIN,
  CAMERA_PAN_Z_MAX,
  CAMERA_PAN_Z_MIN,
} from "@/lib/desk-scene-defaults";
import { capturedPointers } from "@/lib/touch-capture-registry";

/** Match Scene panel and `ResponsiveCamera`. */
const Y_MIN = CAMERA_Y_MIN;
const Y_MAX = CAMERA_Y_MAX;
/** Sensitivity: wheel / trackpad toward higher Y = move "up" = see more. */
const WHEEL_TO_Y = 0.04;
const PAN_SENSITIVITY = 1.25;
/** cameraY units per pixel of pinch distance change (spread = zoom in). */
const PINCH_ZOOM_SCALE = 0.032;

function getWorldUnitsPerPixel(camera: OrthographicCamera, el: HTMLCanvasElement) {
  const r = el.getBoundingClientRect();
  const rw = Math.max(1, r.width);
  const rh = Math.max(1, r.height);
  const z = Math.max(1e-6, camera.zoom);
  return {
    x: (camera.right - camera.left) / z / rw,
    z: (camera.top - camera.bottom) / z / rh,
  };
}

function isTextInput(t: EventTarget | null) {
  if (t == null) return false;
  const e = t as HTMLElement;
  const { tagName } = e;
  if (tagName === "INPUT" || tagName === "TEXTAREA" || tagName === "SELECT") return true;
  return e.isContentEditable;
}

function pinchDist(a: { x: number; y: number }, b: { x: number; y: number }) {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

function pinchMid(a: { x: number; y: number }, b: { x: number; y: number }) {
  return { x: (a.x + b.x) * 0.5, y: (a.y + b.y) * 0.5 };
}

function clampPanAxis(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

/**
 * Camera interaction layer — handles all pointer/wheel/keyboard input:
 *
 * Desktop
 *   Space + drag  → pan (cameraX / Z), clamped (same bounds as Scene panel sliders)
 *   Trackpad two-finger scroll → pan (browser sends `wheel` with deltaX / deltaY, not two pointers)
 *   Ctrl+wheel (pinch-zoom on many trackpads) → zoom (cameraY)
 *
 * Mobile / touch
 *   Single-finger drag on empty canvas → pan (cameraX / Z)
 *   Two-finger pinch → zoom (cameraY)
 *   Two-finger drag  → pan (cameraX / Z)
 *   Single-finger tap / drag on objects → handled by DraggableObject / DeskBall
 *
 * The single-finger pan decision is deferred until the FIRST `pointermove`
 * after a single-finger `pointerdown`. By then R3F's bubble-phase delegation
 * to `DraggableObject` / `DeskBall` has already run synchronously (during
 * the previous `pointerdown` event dispatch task), so `capturedPointers` is
 * guaranteed to be up-to-date. If captured, we stand down silently — no
 * `preventDefault`, no `stopImmediatePropagation` — so R3F's bubble-phase
 * `pointermove` dispatch reaches the captured object normally. If not
 * captured, we claim the pan: `preventDefault` + `stopImmediatePropagation`
 * so R3F never sees the move, and apply the delta.
 *
 * This is more robust than scheduling a microtask in `pointerdown` — there
 * are platforms (iOS Safari especially) where the order between R3F's bubble
 * dispatch and our microtask can race. Using the first-move signal is purely
 * synchronous and survives whatever event ordering the browser picks.
 */
export function CameraViewControls() {
  const { gl, camera } = useThree();
  const { set, controls, arrangeMode, selectedLayoutIds } = useDeskControls();
  const { nudgeItemScale } = useDeskLayout();
  const controlsRef = useRef(controls);
  const intro = useDeskIntroOptional();
  const introBlocks = useRef(false);
  useLayoutEffect(() => {
    introBlocks.current = intro?.introActive ?? false;
  }, [intro?.introActive]);

  // ── desktop pan (space + drag) ──────────────────────────────────────────
  const spaceDown = useRef(false);
  const desktopPanning = useRef(false);
  const lastDesktopClient = useRef({ x: 0, y: 0 });

  // ── touch state ─────────────────────────────────────────────────────────
  /** All currently active pointer IDs → last known client position. */
  const activePointers = useRef(new Map<number, { x: number; y: number }>());

  /** Set while a two-finger gesture is in progress. */
  const pinching = useRef(false);
  const lastPinchDist = useRef(0);
  const lastPinchMid = useRef({ x: 0, y: 0 });

  /** Single-finger pan: `candidate` is the pointer id that started a single
   *  touch on the canvas — the pan/no-pan decision is deferred to the first
   *  pointermove for this id. `active` flips on once we've decided to pan. */
  const touchPanCandidate = useRef<number | null>(null);
  const touchPanActive = useRef(false);
  const touchPanPointerId = useRef<number | null>(null);
  const touchPanLast = useRef({ x: 0, y: 0 });

  const rafRef = useRef<number | null>(null);

  useLayoutEffect(() => {
    controlsRef.current = controls;
  }, [controls]);

  useEffect(() => {
    const el = gl.domElement;

    // ── helpers ───────────────────────────────────────────────────────────

    function scheduleControlSync() {
      if (rafRef.current != null) return;
      rafRef.current = window.requestAnimationFrame(() => {
        rafRef.current = null;
        const c = controlsRef.current;
        set("cameraX", c.cameraX);
        set("cameraZ", c.cameraZ);
      });
    }

    function applyPanDelta(dx: number, dy: number) {
      const ortho = camera as OrthographicCamera;
      const units = getWorldUnitsPerPixel(ortho, el);
      const c = controlsRef.current;
      const ncx = clampPanAxis(
        c.cameraX - dx * units.x * PAN_SENSITIVITY,
        CAMERA_PAN_X_MIN,
        CAMERA_PAN_X_MAX,
      );
      const ncz = clampPanAxis(
        c.cameraZ - dy * units.z * PAN_SENSITIVITY,
        CAMERA_PAN_Z_MIN,
        CAMERA_PAN_Z_MAX,
      );
      controlsRef.current = { ...c, cameraX: ncx, cameraZ: ncz };
      camera.position.set(ncx, c.cameraY, ncz);
      camera.updateMatrixWorld();
      scheduleControlSync();
    }

    function applyZoomDelta(pixelDelta: number) {
      // positive pixelDelta = fingers spreading = zoom in = cameraY decreases
      const c = controlsRef.current;
      const nextY = Math.max(Y_MIN, Math.min(Y_MAX, c.cameraY - pixelDelta * PINCH_ZOOM_SCALE));
      controlsRef.current = { ...c, cameraY: nextY };
      set("cameraY", nextY);
    }

    function endTouchPan() {
      touchPanCandidate.current = null;
      touchPanActive.current = false;
      touchPanPointerId.current = null;
    }

    // ── keyboard (desktop) ────────────────────────────────────────────────

    function onKeyDown(e: KeyboardEvent) {
      if (introBlocks.current) {
        return;
      }
      if (e.code === "Space" && !e.repeat) {
        if (isTextInput(e.target)) return;
        e.preventDefault();
        spaceDown.current = true;
        el.style.cursor = desktopPanning.current ? "grabbing" : "grab";
      }
    }

    function onKeyUp(e: KeyboardEvent) {
      if (e.code === "Space") {
        spaceDown.current = false;
        if (!desktopPanning.current) el.style.cursor = "";
        if (!e.repeat) e.preventDefault();
      }
    }

    function onWindowBlur() {
      spaceDown.current = false;
      desktopPanning.current = false;
      endTouchPan();
      pinching.current = false;
      activePointers.current.clear();
      el.style.cursor = "";
    }

    // ── pointer events ────────────────────────────────────────────────────

    function onPointerDown(e: PointerEvent) {
      if (introBlocks.current) {
        return;
      }
      if (e.pointerType === "touch") {
        endTouchPan();
      }

      activePointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

      const count = activePointers.current.size;

      if (count === 2) {
        // Two fingers → pinch + pan; cancel any pending single-finger pan.
        e.preventDefault();
        e.stopImmediatePropagation();
        endTouchPan();
        pinching.current = true;
        const [a, b] = [...activePointers.current.values()];
        lastPinchDist.current = pinchDist(a, b);
        lastPinchMid.current = pinchMid(a, b);
        return;
      }

      if (count > 2) {
        return;
      }

      // count === 1 (single touch)
      if (e.pointerType === "touch") {
        // Don't activate pan yet — the decision is deferred to the first
        // pointermove for this pointer id. By then R3F will have already
        // dispatched its bubble-phase pointerdown to any 3-D object the touch
        // hit (DraggableObject / DeskBall) and `capturedPointers` will be
        // populated. We critically do NOT preventDefault or
        // stopImmediatePropagation here, so R3F's bubble dispatch is fully
        // intact and `setPointerCapture` on the canvas works normally.
        touchPanCandidate.current = e.pointerId;
        touchPanLast.current = { x: e.clientX, y: e.clientY };
        return;
      }

      // Desktop: space + drag
      if (!spaceDown.current || e.button !== 0) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      desktopPanning.current = true;
      el.style.cursor = "grabbing";
      lastDesktopClient.current = { x: e.clientX, y: e.clientY };
      el.setPointerCapture(e.pointerId);
    }

    function onPointerMove(e: PointerEvent) {
      if (introBlocks.current) {
        return;
      }
      // Update tracked position
      if (activePointers.current.has(e.pointerId)) {
        activePointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      }

      // ── two-finger gesture ──────────────────────────────────────────────
      if (pinching.current && activePointers.current.size >= 2) {
        e.preventDefault();
        e.stopImmediatePropagation();
        const [a, b] = [...activePointers.current.values()];
        const newDist = pinchDist(a, b);
        const newMid = pinchMid(a, b);
        // Zoom
        applyZoomDelta(newDist - lastPinchDist.current);
        // Pan
        applyPanDelta(
          newMid.x - lastPinchMid.current.x,
          newMid.y - lastPinchMid.current.y,
        );
        lastPinchDist.current = newDist;
        lastPinchMid.current = newMid;
        return;
      }

      // ── single-finger pan (active) ───────────────────────────────────────
      if (touchPanActive.current && e.pointerId === touchPanPointerId.current) {
        e.preventDefault();
        e.stopImmediatePropagation();
        const dx = e.clientX - touchPanLast.current.x;
        const dy = e.clientY - touchPanLast.current.y;
        applyPanDelta(dx, dy);
        touchPanLast.current = { x: e.clientX, y: e.clientY };
        return;
      }

      // First pointermove after a single-finger touchdown: decide whether to
      // pan or yield to a 3-D object. By now R3F's bubble-phase dispatch from
      // the pointerdown event has fully completed, so `capturedPointers`
      // reflects whether a DraggableObject / DeskBall claimed the touch.
      if (touchPanCandidate.current === e.pointerId) {
        if (capturedPointers.has(e.pointerId)) {
          // A 3-D object owns this touch. Stand down silently — DO NOT
          // preventDefault or stopImmediatePropagation — so R3F's bubble
          // dispatch reaches the captured object's onPointerMove handler.
          touchPanCandidate.current = null;
          return;
        }
        if (activePointers.current.size !== 1) {
          // A second finger arrived. The two-finger branch above will have
          // taken over; just clear the candidate.
          touchPanCandidate.current = null;
          return;
        }
        // Empty canvas → activate pan and apply this move's delta.
        touchPanCandidate.current = null;
        touchPanActive.current = true;
        touchPanPointerId.current = e.pointerId;
        el.style.cursor = "grabbing";
        e.preventDefault();
        e.stopImmediatePropagation();
        const dx = e.clientX - touchPanLast.current.x;
        const dy = e.clientY - touchPanLast.current.y;
        applyPanDelta(dx, dy);
        touchPanLast.current = { x: e.clientX, y: e.clientY };
        return;
      }

      // ── desktop space+drag ─────────────────────────────────────────────
      if (!desktopPanning.current) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      applyPanDelta(
        e.clientX - lastDesktopClient.current.x,
        e.clientY - lastDesktopClient.current.y,
      );
      lastDesktopClient.current = { x: e.clientX, y: e.clientY };
    }

    function onPointerUp(e: PointerEvent) {
      if (introBlocks.current) {
        activePointers.current.delete(e.pointerId);
        return;
      }
      activePointers.current.delete(e.pointerId);

      if (pinching.current && activePointers.current.size < 2) {
        pinching.current = false;
        // Don't auto-start single-finger pan for the remaining finger — the
        // user must re-press to begin a new gesture.
      }

      if (
        e.pointerId === touchPanPointerId.current ||
        e.pointerId === touchPanCandidate.current
      ) {
        endTouchPan();
        el.style.cursor = "";
      }

      if (desktopPanning.current && e.button === 0) {
        e.preventDefault();
        try { el.releasePointerCapture(e.pointerId); } catch { /* not captured */ }
        desktopPanning.current = false;
        el.style.cursor = spaceDown.current ? "grab" : "";
      }
    }

    function onWheel(e: WheelEvent) {
      if (introBlocks.current) {
        return;
      }
      if (e.target !== el) return;
      if (arrangeMode && selectedLayoutIds.length > 0) {
        e.preventDefault();
        const lineScale = e.deltaMode === 1 ? 16 : 1;
        const dy = e.deltaY * lineScale;
        for (let i = 0; i < selectedLayoutIds.length; i++) {
          nudgeItemScale(selectedLayoutIds[i], dy);
        }
        return;
      }
      const lineScale =
        e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 800 : 1;
      const dx = e.deltaX * lineScale;
      const dy = e.deltaY * lineScale;

      /** Pinch-zoom (Chrome often sets ctrlKey on trackpad pinch). Mouse: hold Ctrl while scrolling to zoom. */
      if (e.ctrlKey) {
        e.preventDefault();
        const c = controlsRef.current;
        const nextY = Math.max(
          Y_MIN,
          Math.min(Y_MAX, c.cameraY + dy * WHEEL_TO_Y),
        );
        set("cameraY", nextY);
        controlsRef.current = { ...c, cameraY: nextY };
        return;
      }

      if (dx !== 0 || dy !== 0) {
        e.preventDefault();
        /** Wheel deltas are scroll-oriented; negate for hand-tool / drag-the-canvas feel. */
        applyPanDelta(-dx, -dy);
      }
    }

    window.addEventListener("keydown", onKeyDown, { capture: true });
    window.addEventListener("keyup", onKeyUp, { capture: true });
    window.addEventListener("blur", onWindowBlur);
    el.addEventListener("pointerdown", onPointerDown, { capture: true });
    el.addEventListener("pointermove", onPointerMove, { capture: true });
    el.addEventListener("pointerup", onPointerUp, { capture: true });
    el.addEventListener("pointercancel", onPointerUp, { capture: true });
    el.addEventListener("wheel", onWheel, { passive: false, capture: true });

    return () => {
      if (rafRef.current != null) window.cancelAnimationFrame(rafRef.current);
      endTouchPan();
      window.removeEventListener("keydown", onKeyDown, { capture: true });
      window.removeEventListener("keyup", onKeyUp, { capture: true });
      window.removeEventListener("blur", onWindowBlur);
      el.removeEventListener("pointerdown", onPointerDown, { capture: true });
      el.removeEventListener("pointermove", onPointerMove, { capture: true });
      el.removeEventListener("pointerup", onPointerUp, { capture: true });
      el.removeEventListener("pointercancel", onPointerUp, { capture: true });
      el.removeEventListener("wheel", onWheel, { capture: true });
    };
  }, [gl, camera, set, arrangeMode, selectedLayoutIds, nudgeItemScale]);

  return null;
}
