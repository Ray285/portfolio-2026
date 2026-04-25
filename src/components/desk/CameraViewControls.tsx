"use client";

import { useThree } from "@react-three/fiber";
import { useEffect, useLayoutEffect, useRef } from "react";
import { OrthographicCamera } from "three";
import { useDeskControls } from "@/context/DeskControlsContext";

/** Match Scene panel and `ResponsiveCamera`. */
const Y_MIN = 4;
const Y_MAX = 16;
/** Sensitivity: wheel / trackpad toward higher Y = move “up” = see more. */
const WHEEL_TO_Y = 0.04;
const PAN_SENSITIVITY = 1.25;

function getWorldUnitsPerPixel(camera: OrthographicCamera, el: HTMLCanvasElement) {
  const r = el.getBoundingClientRect();
  return {
    x: (camera.right - camera.left) / camera.zoom / r.width,
    z: (camera.top - camera.bottom) / camera.zoom / r.height,
  };
}

function isTextInput(t: EventTarget | null) {
  if (t == null) {
    return false;
  }
  const e = t as HTMLElement;
  const { tagName } = e;
  if (tagName === "INPUT" || tagName === "TEXTAREA" || tagName === "SELECT") {
    return true;
  }
  return e.isContentEditable;
}

/**
 * — Hold **Space** and drag to pan the camera in world X and Z.
 * — **Wheel** / trackpad scroll adjusts camera Y (height; pairs with the ortho height factor).
 * Writes the same `DeskControls` fields as the Scene panel.
 */
export function CameraViewControls() {
  const { gl, camera } = useThree();
  const { set, controls } = useDeskControls();
  const controlsRef = useRef(controls);

  const spaceDown = useRef(false);
  const panning = useRef(false);
  const lastClient = useRef({ x: 0, y: 0 });
  const rafRef = useRef<number | null>(null);

  useLayoutEffect(() => {
    controlsRef.current = controls;
  }, [controls]);

  useEffect(() => {
    const el = gl.domElement;

    function applyCameraFromRef() {
      const c = controlsRef.current;
      camera.position.set(c.cameraX, c.cameraY, c.cameraZ);
      camera.updateMatrixWorld();
    }

    function scheduleControlSync() {
      if (rafRef.current != null) {
        return;
      }
      rafRef.current = window.requestAnimationFrame(() => {
        rafRef.current = null;
        const c = controlsRef.current;
        set("cameraX", c.cameraX);
        set("cameraZ", c.cameraZ);
      });
    }

    function onKeyDown(e: KeyboardEvent) {
      if (e.code === "Space" && !e.repeat) {
        if (isTextInput(e.target)) {
          return;
        }
        e.preventDefault();
        spaceDown.current = true;
        el.style.cursor = panning.current ? "grabbing" : "grab";
      }
    }

    function onKeyUp(e: KeyboardEvent) {
      if (e.code === "Space") {
        spaceDown.current = false;
        if (!panning.current) {
          el.style.cursor = "";
        }
        if (!e.repeat) {
          e.preventDefault();
        }
      }
    }

    function onWindowBlur() {
      spaceDown.current = false;
      panning.current = false;
      el.style.cursor = "";
    }

    function onPointerDown(e: PointerEvent) {
      if (!spaceDown.current || e.button !== 0) {
        return;
      }
      e.preventDefault();
      e.stopImmediatePropagation();
      panning.current = true;
      el.style.cursor = "grabbing";
      lastClient.current = { x: e.clientX, y: e.clientY };
      el.setPointerCapture(e.pointerId);
    }

    function onPointerMove(e: PointerEvent) {
      if (!panning.current) {
        return;
      }
      e.preventDefault();
      e.stopImmediatePropagation();

      const ortho = camera as OrthographicCamera;
      applyCameraFromRef();
      const units = getWorldUnitsPerPixel(ortho, el);
      const dx = e.clientX - lastClient.current.x;
      const dy = e.clientY - lastClient.current.y;
      const c = controlsRef.current;
      const ncx = c.cameraX - dx * units.x * PAN_SENSITIVITY;
      const ncz = c.cameraZ - dy * units.z * PAN_SENSITIVITY;
      controlsRef.current = { ...c, cameraX: ncx, cameraZ: ncz };
      camera.position.set(ncx, c.cameraY, ncz);
      camera.updateMatrixWorld();
      scheduleControlSync();
      lastClient.current = { x: e.clientX, y: e.clientY };
    }

    function onPointerUp(e: PointerEvent) {
      if (e.button === 0 && panning.current) {
        e.preventDefault();
        try {
          el.releasePointerCapture(e.pointerId);
        } catch {
          /* not captured */
        }
      }
      panning.current = false;
      el.style.cursor = spaceDown.current ? "grab" : "";
    }

    function onWheel(e: WheelEvent) {
      if (e.target !== el) {
        return;
      }
      e.preventDefault();
      const c = controlsRef.current;
      const lineScale = e.deltaMode === 1 ? 16 : 1;
      const dy = e.deltaY * lineScale;
      const nextY = Math.max(Y_MIN, Math.min(Y_MAX, c.cameraY + dy * WHEEL_TO_Y));
      set("cameraY", nextY);
      controlsRef.current = { ...c, cameraY: nextY };
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
      if (rafRef.current != null) {
        window.cancelAnimationFrame(rafRef.current);
      }
      window.removeEventListener("keydown", onKeyDown, { capture: true });
      window.removeEventListener("keyup", onKeyUp, { capture: true });
      window.removeEventListener("blur", onWindowBlur);
      el.removeEventListener("pointerdown", onPointerDown, { capture: true });
      el.removeEventListener("pointermove", onPointerMove, { capture: true });
      el.removeEventListener("pointerup", onPointerUp, { capture: true });
      el.removeEventListener("pointercancel", onPointerUp, { capture: true });
      el.removeEventListener("wheel", onWheel, { capture: true });
    };
  }, [gl, camera, set]);

  return null;
}
