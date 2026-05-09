"use client";

import { useEffect } from "react";
import { notifyStudioReady } from "@/lib/theatre-project";

/** Set to `false` to hide the Theatre.js Studio UI overlay. */
const THEATRE_STUDIO_ENABLED = false;

/**
 * Mounts Theatre.js Studio in development. Import is dynamic so the studio
 * bundle (dev-only, ~400 kB) is never included in production builds.
 *
 * UI controls (call on the Studio import):
 *   studio.ui.hide()    — hides all Studio panels (keyboard shortcut: Alt+H)
 *   studio.ui.restore() — shows Studio panels again
 *   studio.ui.isHidden  — current visibility state
 */
export function TheatreStudioInit() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "development") return;
    // Wipe stale browser state so Theatre.js uses the bundled disk state.
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith("theatre-") || key.startsWith("@theatre")) localStorage.removeItem(key);
    }
    if (THEATRE_STUDIO_ENABLED) {
      import("@theatre/studio").then(({ default: Studio }) => {
        Studio.initialize();
        // Signal that Studio is ready — sequence.play() in home.ts waits for this.
        notifyStudioReady();
      });
    } else {
      // Studio UI is disabled but the Theatre.js core is still loaded by
      // the intro animation code. Resolve the readiness promise so the
      // camera hold + zoom-out sequence plays without the Studio overlay.
      notifyStudioReady();
    }
  }, []);
  return null;
}
