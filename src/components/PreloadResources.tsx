"use client";

import { useEffect } from "react";
import ReactDOM from "react-dom";

/**
 * Hoists resource hints into <head> and eagerly warms the jsquash WASM
 * module on idle so it's ready before any animated polaroid mounts.
 */
export function PreloadResources() {
  ReactDOM.preload("/fonts/HandwrittingVolII-Bold.otf", { as: "font" });

  useEffect(() => {
    const trigger = () => {
      import("@jsquash/webp");
    };
    if (typeof requestIdleCallback !== "undefined") {
      const id = requestIdleCallback(trigger);
      return () => cancelIdleCallback(id);
    }
    const id = setTimeout(trigger, 200);
    return () => clearTimeout(id);
  }, []);

  return null;
}
