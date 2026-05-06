"use client";

import { useThree } from "@react-three/fiber";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef } from "react";
import type { Object3D } from "three";
import { Raycaster, Vector2 } from "three";
import { useDeskControls } from "@/context/DeskControlsContext";
import type { ArrangePeerHandles } from "@/lib/desk-arrange-registry";
import { forEachArrangePeer } from "@/lib/desk-arrange-registry";
import {
  marqueeClientRectToNdcBounds,
  marqueeScreenCenterToWorldXZ,
  pickLayoutsInMarqueeNdc,
} from "@/lib/desk-marquee-pick";

/** Screen pixels before a press becomes a marquee drag (not a tap). */
const MARQUEE_DRAG_THRESHOLD_PX = 8;
/** Max movement for “tap on empty” to clear selection. */
const TAP_CLEAR_MAX_PX = 8;

function deskLayoutHitId(hit: Object3D | undefined): string | undefined {
  let o: Object3D | null | undefined = hit;
  while (o) {
    const ud = (o.userData ?? {}) as { deskLayoutItem?: string };
    if (typeof ud.deskLayoutItem === "string") {
      return ud.deskLayoutItem;
    }
    o = o.parent;
  }
  return undefined;
}

type PendingEmpty = {
  pointerId: number;
  startClientX: number;
  startClientY: number;
};

/** Screen-space marquee box (absolute client coordinates — same convention as PointerEvent.clientX/Y). */
export type DeskMarqueeOverlayRect = {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
};

type Props = {
  onMarqueeRectChange: (rect: DeskMarqueeOverlayRect | null) => void;
};

/**
 * Arrange mode: rubber-band selection on empty canvas + tap empty to clear selection
 * (replaces immediate pointerdown clear from `DeskArrangeClickAway`).
 *
 * Dom not returned here — R3F forbids `<div>` under `<Canvas>`; overlay is rendered
 * by the route parent (`DeskScene`) via `onMarqueeRectChange`.
 */
export function DeskArrangeMarquee({ onMarqueeRectChange }: Props) {
  const { gl, camera, scene } = useThree();
  const raycaster = useMemo(() => new Raycaster(), []);
  const marqueeRectCbRef = useRef(onMarqueeRectChange);

  useLayoutEffect(() => {
    marqueeRectCbRef.current = onMarqueeRectChange;
  }, [onMarqueeRectChange]);

  const notifyMarqueeRect = useCallback((rect: DeskMarqueeOverlayRect | null) => {
    marqueeRectCbRef.current(rect);
  }, []);

  const {
    arrangeMode,
    selectedLayoutIds,
    clearArrangeSelection,
    setArrangeSelection,
    addArrangeSelection,
  } = useDeskControls();

  const spaceHeldRef = useRef(false);
  useEffect(() => {
    const kd = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        spaceHeldRef.current = true;
      }
    };
    const ku = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        spaceHeldRef.current = false;
      }
    };
    window.addEventListener("keydown", kd);
    window.addEventListener("keyup", ku);
    return () => {
      window.removeEventListener("keydown", kd);
      window.removeEventListener("keyup", ku);
    };
  }, []);

  const pendingRef = useRef<PendingEmpty | null>(null);
  const marqueeActiveRef = useRef(false);

  const raycastDeskItemId = useCallback(
    (clientX: number, clientY: number) => {
      const canvas = gl.domElement;
      const r = canvas.getBoundingClientRect();
      if (r.width <= 0 || r.height <= 0) {
        return undefined;
      }
      const nd = new Vector2(
        ((clientX - r.left) / r.width) * 2 - 1,
        -((clientY - r.top) / r.height) * 2 + 1,
      );
      raycaster.setFromCamera(nd, camera);
      const hits = raycaster.intersectObject(scene, true);
      return hits.length === 0 ? undefined : deskLayoutHitId(hits[0]?.object);
    },
    [camera, gl.domElement, raycaster, scene],
  );

  const gestureApisRef = useRef({
    camera,
    raycastDeskItemId,
    clearArrangeSelection,
    setArrangeSelection,
    addArrangeSelection,
    arrangeMode,
    selectedCount: selectedLayoutIds.length,
  });

  useLayoutEffect(() => {
    gestureApisRef.current = {
      camera,
      raycastDeskItemId,
      clearArrangeSelection,
      setArrangeSelection,
      addArrangeSelection,
      arrangeMode,
      selectedCount: selectedLayoutIds.length,
    };
  }, [
    addArrangeSelection,
    arrangeMode,
    camera,
    clearArrangeSelection,
    raycastDeskItemId,
    selectedLayoutIds.length,
    setArrangeSelection,
  ]);

  useEffect(() => {
    if (!arrangeMode) {
      return;
    }

    const canvas = gl.domElement;

    function resetGesture() {
      pendingRef.current = null;
      marqueeActiveRef.current = false;
      notifyMarqueeRect(null);
    }

    function onPointerDownCapture(e: PointerEvent) {
      if (!gestureApisRef.current.arrangeMode) {
        return;
      }
      if (!canvas.contains(e.target as Node)) {
        return;
      }
      if (e.button !== 0) {
        return;
      }
      if (spaceHeldRef.current) {
        return;
      }

      const id = gestureApisRef.current.raycastDeskItemId(
        e.clientX,
        e.clientY,
      );
      if (id != null) {
        return;
      }

      pendingRef.current = {
        pointerId: e.pointerId,
        startClientX: e.clientX,
        startClientY: e.clientY,
      };
      marqueeActiveRef.current = false;
      notifyMarqueeRect(null);
    }

    function onPointerMoveCapture(e: PointerEvent) {
      const pending = pendingRef.current;
      if (!pending || e.pointerId !== pending.pointerId) {
        return;
      }

      const dx = e.clientX - pending.startClientX;
      const dy = e.clientY - pending.startClientY;
      if (
        !marqueeActiveRef.current &&
        Math.hypot(dx, dy) < MARQUEE_DRAG_THRESHOLD_PX
      ) {
        return;
      }

      if (spaceHeldRef.current) {
        resetGesture();
        return;
      }

      marqueeActiveRef.current = true;
      try {
        canvas.setPointerCapture(e.pointerId);
      } catch {
        //
      }

      const minX = Math.min(pending.startClientX, e.clientX);
      const maxX = Math.max(pending.startClientX, e.clientX);
      const minY = Math.min(pending.startClientY, e.clientY);
      const maxY = Math.max(pending.startClientY, e.clientY);
      notifyMarqueeRect({ minX, minY, maxX, maxY });
    }

    function commitMarquee(
      pending: PendingEmpty,
      endClientX: number,
      endClientY: number,
      shiftKey: boolean,
    ) {
      const apis = gestureApisRef.current;
      const cam = apis.camera;

      const r = canvas.getBoundingClientRect();

      const minX = Math.min(pending.startClientX, endClientX);
      const maxX = Math.max(pending.startClientX, endClientX);
      const minY = Math.min(pending.startClientY, endClientY);
      const maxY = Math.max(pending.startClientY, endClientY);

      const bounds = marqueeClientRectToNdcBounds({
        canvasRect: r,
        minClientX: minX,
        maxClientX: maxX,
        minClientY: minY,
        maxClientY: maxY,
      });

      const cx = (minX + maxX) * 0.5;
      const cy = (minY + maxY) * 0.5;
      const worldXZ = marqueeScreenCenterToWorldXZ({
        camera: cam,
        canvasRect: r,
        centerClientX: cx,
        centerClientY: cy,
      });

      const pairList: [string, ArrangePeerHandles][] = [];
      forEachArrangePeer((layoutId, handles) => {
        pairList.push([layoutId, handles]);
      });

      const { ids, primaryId } = pickLayoutsInMarqueeNdc({
        bounds,
        peers: pairList,
        camera: cam,
        marqueeWorldCenterXZ: worldXZ,
      });

      if (ids.length === 0) {
        apis.clearArrangeSelection();
      } else if (shiftKey) {
        apis.addArrangeSelection(ids, primaryId);
      } else {
        apis.setArrangeSelection(ids, primaryId);
      }
    }

    function onPointerUpCapture(e: PointerEvent) {
      const apis = gestureApisRef.current;
      const pending = pendingRef.current;
      if (!pending || e.pointerId !== pending.pointerId) {
        return;
      }

      const wasMarquee = marqueeActiveRef.current;
      const endX = e.clientX;
      const endY = e.clientY;
      const shiftKey = e.shiftKey;

      try {
        canvas.releasePointerCapture(e.pointerId);
      } catch {
        //
      }

      pendingRef.current = null;
      marqueeActiveRef.current = false;
      notifyMarqueeRect(null);

      if (wasMarquee) {
        commitMarquee(pending, endX, endY, shiftKey);
        return;
      }

      const dx = endX - pending.startClientX;
      const dy = endY - pending.startClientY;
      if (Math.hypot(dx, dy) > TAP_CLEAR_MAX_PX) {
        return;
      }
      if (apis.selectedCount === 0) {
        return;
      }
      const rayId = apis.raycastDeskItemId(endX, endY);
      if (rayId == null) {
        apis.clearArrangeSelection();
      }
    }

    function onPointerCancelCapture(e: PointerEvent) {
      if (pendingRef.current?.pointerId !== e.pointerId) {
        return;
      }
      try {
        canvas.releasePointerCapture(e.pointerId);
      } catch {
        //
      }
      resetGesture();
    }

    window.addEventListener("pointerdown", onPointerDownCapture, true);
    window.addEventListener("pointermove", onPointerMoveCapture, true);
    window.addEventListener("pointerup", onPointerUpCapture, true);
    window.addEventListener("pointercancel", onPointerCancelCapture, true);
    return () => {
      window.removeEventListener("pointerdown", onPointerDownCapture, true);
      window.removeEventListener("pointermove", onPointerMoveCapture, true);
      window.removeEventListener("pointerup", onPointerUpCapture, true);
      window.removeEventListener("pointercancel", onPointerCancelCapture, true);
      pendingRef.current = null;
      marqueeActiveRef.current = false;
      notifyMarqueeRect(null);
    };
  }, [arrangeMode, gl.domElement, notifyMarqueeRect]);

  return null;
}
