import "./r3f-register";
import { DeskShellLayout } from "@/components/DeskShellLayout";
import { PreloadResources } from "@/components/PreloadResources";

export default function DeskRouteGroupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <PreloadResources />
      <DeskShellLayout>{children}</DeskShellLayout>
    </>
  );
}
