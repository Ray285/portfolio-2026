import DeskScene from "@/components/desk/DeskScene";
import { SceneControlsPanel } from "@/components/SceneControlsPanel";
import { DeskControlsProvider } from "@/context/DeskControlsContext";
import { DeskLayoutProvider } from "@/context/DeskLayoutContext";

export default function Home() {
  return (
    <DeskControlsProvider>
      <DeskLayoutProvider>
        <main className="relative z-0 min-h-dvh w-full min-w-0 max-w-none overflow-x-hidden bg-white">
          <DeskScene />
          <SceneControlsPanel />
        </main>
      </DeskLayoutProvider>
    </DeskControlsProvider>
  );
}
