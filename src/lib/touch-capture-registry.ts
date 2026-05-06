/**
 * Tracks pointer IDs that have been captured by a 3D object (DraggableObject /
 * DeskBall). CameraViewControls reads this to avoid starting a single-finger
 * pan when the touch began on a draggable element.
 */
export const capturedPointers = new Set<number>();
