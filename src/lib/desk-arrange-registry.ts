import type { DeskItemLayout } from "@/lib/desk-layout";

export type ArrangePeerHandles = {
  snapshotLayout(): DeskItemLayout;
  addBaseXZ(deltaX: number, deltaZ: number): void;
  applyYawDelta(d: number): void;
  /** World-space X/Z radius (~physics radius × layout scale) for marquee hit-testing. */
  getMarqueeRadius(): number;
};

const peers = new Map<string, ArrangePeerHandles>();

export function registerArrangePeer(
  layoutId: string,
  handles: ArrangePeerHandles,
): () => void {
  peers.set(layoutId, handles);
  return () => {
    if (peers.get(layoutId) === handles) {
      peers.delete(layoutId);
    }
  };
}

export function getArrangePeer(layoutId: string): ArrangePeerHandles | undefined {
  return peers.get(layoutId);
}

/** Layout ids registered this frame cycle (mounted `DraggableObject` instances). */
export function getRegisteredArrangePeerIds(): readonly string[] {
  return Array.from(peers.keys());
}

export function forEachArrangePeer(
  cb: (layoutId: string, handles: ArrangePeerHandles) => void,
): void {
  peers.forEach((handles, layoutId) => {
    cb(layoutId, handles);
  });
}
