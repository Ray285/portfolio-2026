"use client";

/**
 * Loads the official **GSDevTools** plugin (bundled with `gsap`) and binds it
 * to the desk **intro** timeline from `registerDeskIntroTimeline`. In
 * development you get GreenSock’s timeline UI (play/pause, scrub, timeScale).
 * Stagger is on the same master timeline; see `StaggerGsapContext`.
 *
 * @see https://gsap.com/docs/v3/Plugins/GSDevTools/
 */

import gsap from "gsap";
import { useEffect } from "react";
import { GSAP_DEVTOOLS_ENABLED } from "@/lib/gsap-devtools-flags";
import { subscribeDeskIntroTimeline } from "@/lib/gsap-desk-animation-registry";

const DEVTOOLS_ID = "deskLoadIntro";

const isDev = process.env.NODE_ENV === "development";

export function GsapDevToolsBridge() {
  useEffect(() => {
    if (!isDev || !GSAP_DEVTOOLS_ENABLED) {
      return;
    }

    let cancelled = false;
    let unsub: (() => void) | undefined;

    void import("gsap/GSDevTools").then(({ GSDevTools }) => {
      if (cancelled) {
        return;
      }
      gsap.registerPlugin(GSDevTools);
      unsub = subscribeDeskIntroTimeline((tl) => {
        GSDevTools.getById(DEVTOOLS_ID)?.kill();
        if (tl) {
          GSDevTools.create({
            id: DEVTOOLS_ID,
            animation: tl,
            minimal: true,
          });
        }
      });
    });

    return () => {
      cancelled = true;
      unsub?.();
      if (isDev && GSAP_DEVTOOLS_ENABLED) {
        void import("gsap/GSDevTools").then(({ GSDevTools }) => {
          GSDevTools.getById(DEVTOOLS_ID)?.kill();
        });
      }
    };
  }, []);

  return null;
}
