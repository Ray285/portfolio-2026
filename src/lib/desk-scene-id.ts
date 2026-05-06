export const DESK_SCENE_HOME = "home" as const;
export const DESK_SCENE_ABOUT = "about" as const;

export type DeskSceneId = typeof DESK_SCENE_HOME | typeof DESK_SCENE_ABOUT;

/**
 * Map URL pathname to desk scene. Case study and other app routes are not desk scenes; treat as home.
 */
export function getDeskSceneIdFromPathname(pathname: string | null): DeskSceneId {
  if (pathname == null) {
    return DESK_SCENE_HOME;
  }
  if (pathname === "/about" || pathname.startsWith("/about/")) {
    return DESK_SCENE_ABOUT;
  }
  return DESK_SCENE_HOME;
}
