import type { NextConfig } from "next";

/**
 * Hosts allowed to hit Next 16's dev-only `/_next/*` endpoints from a
 * non-`localhost` origin (e.g. an iPhone on the LAN reaching the Mac
 * dev server by IP). Without this, Next.js prints a warning and 403s
 * cross-origin requests to internal dev assets, which can manifest as
 * a Canvas/Suspense-stalled "blank" 3D scene on the device.
 *
 * Add the actual LAN IPs you test from. Common LAN ranges are listed
 * to cover most home routers; trim to taste.
 */
const allowedDevOrigins = [
  "192.168.68.57",
  "192.168.68.*",
  "192.168.0.*",
  "192.168.1.*",
  "10.0.0.*",
  "10.0.1.*",
  "100.101.13.102",
];

const nextConfig: NextConfig = {
  allowedDevOrigins,
};

export default nextConfig;
