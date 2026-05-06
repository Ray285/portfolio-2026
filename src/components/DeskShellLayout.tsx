"use client";

import { usePathname } from "next/navigation";
import { Fragment, type ReactNode, useMemo } from "react";
import DeskScene from "@/components/desk/DeskScene";
import { GsapDevToolsBridge } from "@/components/desk/GsapDevToolsBridge";
import { SceneControlsPanel } from "@/components/SceneControlsPanel";
import { DeskControlsProvider } from "@/context/DeskControlsContext";
import { DeskIntroProvider } from "@/context/DeskIntroContext";
import { DeskLayoutProvider } from "@/context/DeskLayoutContext";
import { DeskSceneIdProvider } from "@/context/DeskSceneContext";
import { getDeskSceneIdFromPathname } from "@/lib/desk-scene-id";
import { GSAP_DEVTOOLS_ENABLED } from "@/lib/gsap-devtools-flags";

type DeskShellLayoutProps = {
  children: ReactNode;
};

/**
 * Full-screen desk canvas, shared by `/` and `/about` so WebGL is not
 * unmounted on client navigations. `children` is the route segment (often empty).
 */
export function DeskShellLayout({ children }: DeskShellLayoutProps) {
  const pathname = usePathname();
  const sceneId = useMemo(
    () => getDeskSceneIdFromPathname(pathname),
    [pathname],
  );
  const showGsapDevtools = false;
    // process.env.NODE_ENV === "development" && GSAP_DEVTOOLS_ENABLED;

  return (
    <DeskSceneIdProvider sceneId={sceneId}>
      <Fragment key={sceneId}>
        <DeskControlsProvider>
          <DeskIntroProvider>
            <DeskLayoutProvider>
              <main className="relative z-0 min-h-dvh w-full min-w-0 max-w-none overflow-x-hidden bg-white">
                <DeskScene />
                <SceneControlsPanel />
                {showGsapDevtools ? <GsapDevToolsBridge /> : null}
                {children}
              </main>
            </DeskLayoutProvider>
          </DeskIntroProvider>
        </DeskControlsProvider>
      </Fragment>
    </DeskSceneIdProvider>
  );
}
