import type { DeskFontPresetId } from "@/lib/desk-font-presets";
import type { DeskSceneId } from "@/lib/desk-scene-id";
import { DESK_SCENE_ABOUT } from "@/lib/desk-scene-id";

export type PortfolioItem = {
  title: string;
  label: string;
  description: string;
  href: string;
  /** Stable slug for desk intro choreography (`home-desk-choreography.ts`) — unique among cards. */
  deskSlug: string;
};

/** CTA copy for the link pill on cards (3D, not `href` itself). */
export function getPortfolioLinkCta(href: string): string {
  if (href.startsWith("mailto:") || href.startsWith("tel:")) return "Email";
  if (href === "/about" || href.startsWith("/about?")) return "About Me";
  if (href.startsWith("/case-study/")) return "View Case Study";
  if (href.startsWith("/")) return "Open";
  if (href.startsWith("http")) return "Open";
  return "Open";
}

/**
 * Gradient polaroids use `palette`; photo polaroids use `imageUrl` (path under
 * `public/`, e.g. `/images/photo.jpg`). Paths ending in **`.gif` or `.webp`**
 * use a canvas + `Image` each frame (animated GIF / animated WebP; `useTexture`
 * alone would only show one frame). Other formats (jpg, png) use a standard texture.
 */
export type PolaroidItem = {
  title: string;
  caption: string;
  palette?: [string, string, string];
  imageUrl?: string;
  /** Optional: single-tap same as project cards; see `navigate-href` rules. */
  href?: string;
  /**
   * `/about` desk layout identity — stable slug (`desk-layout-about.json` keys
   * `about-polaroid-<layoutId>`). Omit on home polaroids (index-based `polaroid-N`).
   */
  layoutId?: string;
  /**
   * Home polaroids (`polaroids`): stable slug for choreo (`home-desk-choreography.ts`).
   * Omit on `/about` polaroids (they use `layoutId` from filenames).
   */
  deskSlug?: string;
};

export const profile = {
  name: "Raymond Lemon",
  role: "Designer-developer crafting tactile web experiences.",
  intro:
    "A clean flat-lay portfolio prototype with draggable projects, soft shadows, and a white desk aesthetic.",
};

export const portfolioItems: PortfolioItem[] = [
  {
    deskSlug: "selected-work",
    title: "Selected Work",
    label: "Projects",
    description: "Product interfaces, experiments, and interactive systems.",
    href: "/case-study/selected-work",
  },
  {
    deskSlug: "studio-notes",
    title: "Studio Notes",
    label: "About",
    description: "How I think, build, prototype, and ship polished software.",
    href: "mailto:hello@example.com",
  },
  {
    deskSlug: "contact",
    title: "Contact Card",
    label: "Contact",
    description: "Available for collaborations, product work, and prototypes.",
    href: "/about",
  },
];

export const polaroids: PolaroidItem[] = [
  {
    deskSlug: "raymond",
    title: "Raymond",
    caption: "self portrait",
    imageUrl: "/images/self-portrait_Raymond-Lemon.jpeg",
  },
  {
    deskSlug: "interface-study",
    title: "Interface Study",
    caption: "visual system",
    palette: ["#f8fafc", "#dbeafe", "#111827"],
  },
  {
    deskSlug: "prototype-desk",
    title: "Prototype Desk",
    caption: "interaction test",
    palette: ["#fff7ed", "#fed7aa", "#292524"],
  },
  {
    deskSlug: "launch-notes",
    title: "Launch Notes",
    caption: "case study",
    palette: ["#f0fdf4", "#bbf7d0", "#14532d"],
    href: "/case-study/launch-notes",
  },
  {
    deskSlug: "archive-01",
    title: "Archive 01",
    caption: "reference",
    imageUrl: "/images/tumblr_mim0g52K5g1r43l79o1_1280.jpg",
  },
  {
    deskSlug: "archive-02",
    title: "Archive 02",
    caption: "reference",
    imageUrl: "/images/tumblr_lqdx6hjVCK1r25pfoo1_400.jpg",
  },
  {
    deskSlug: "archive-03",
    title: "Archive 03",
    caption: "reference",
    imageUrl: "/images/tumblr_m3sdguCMIj1r9bpg5o1_500.jpg",
  },
  {
    deskSlug: "archive-04",
    title: "Archive 04",
    caption: "reference",
    imageUrl: "/images/tumblr_lqct1fWfkz1r25pfoo1_1280.png",
  },
  {
    deskSlug: "archive-05",
    title: "Archive 05",
    caption: "reference",
    imageUrl: "/images/gph9wwt1g7jha_600.jpg",
  },
  {
    deskSlug: "archive-06",
    title: "Archive 06",
    caption: "reference",
    imageUrl: "/images/tumblr_ly45zrXkTk1qbycdbo1_500.jpg",
  },
  {
    deskSlug: "archive-07",
    title: "Archive 07",
    caption: "reference",
    imageUrl: "/images/tumblr_lqdx845i7Z1r25pfoo1_1280.jpg",
  },
  {
    deskSlug: "archive-08",
    title: "Archive 08",
    caption: "webp",
    imageUrl: "/images/tumblr_ecf12b41d4978f19e6c19b6fe2c34a61_1fb5f3b6_1280.webp",
  },
  {
    deskSlug: "archive-09",
    title: "Archive 09",
    caption: "webp",
    imageUrl: "/images/tumblr_mf82gvgl0c1qbn6jwo1_500.webp",
  },
  {
    deskSlug: "archive-10",
    title: "Archive 10",
    caption: "webp",
    imageUrl: "/images/tumblr_e12412e43fea279b5abed82b9c0edadb_af6932f4_500.webp",
  },
  {
    deskSlug: "archive-11",
    title: "Archive 11",
    caption: "webp",
    imageUrl: "/images/tumblr_3573c8c542e167975df4f916944bf2b7_808f14bb_500.webp",
  },
  {
    deskSlug: "archive-12",
    title: "Archive 12",
    caption: "webp",
    imageUrl: "/images/tumblr_572a28339585fb7dc3681954be2d69a3_7a2a781a_640.webp",
  },
  {
    deskSlug: "archive-13",
    title: "Archive 13",
    caption: "reference",
    imageUrl: "/images/tumblr_n038iw9RZT1reeolao1_500.webp",
  },
  {
    deskSlug: "archive-14",
    title: "Archive 14",
    caption: "reference",
    imageUrl: "/images/tumblr_nhi44qqDrk1rvxid3o1_500.webp",
  },
  {
    deskSlug: "archive-15",
    title: "Archive 15",
    caption: "reference",
    imageUrl: "/images/tumblr_nv6b294dmC1uxy8t7o1_1280.jpg",
  },
];

/** Maps {@link PortfolioItem.deskSlug} → runtime layout key `card-{index}` */
export function homeCardLayoutIdFromDeskSlug(slug: string): string | undefined {
  const i = portfolioItems.findIndex((c) => c.deskSlug === slug);
  return i >= 0 ? `card-${i}` : undefined;
}

/** Maps {@link PolaroidItem.deskSlug} on home polaroids → `polaroid-{index}` */
export function homePolaroidLayoutIdFromDeskSlug(slug: string): string | undefined {
  const i = polaroids.findIndex((p) => p.deskSlug === slug);
  return i >= 0 ? `polaroid-${i}` : undefined;
}

/**
 * Polaroids shown **only on `/about`**. Files under **`public/about/`** — one desk polaroid per entry.
 * Layout keys use **`about-polaroid-<layoutId>`** where **`layoutId`** defaults to the filename stem.
 */
/** Filename stem → stable **`layoutId`** (omit extension). */
export function aboutPolaroidLayoutIdFromFilename(file: string): string {
  return file.replace(/\.[^.]+$/, "");
}

/** Optional title/caption overrides (default title = filename stem). */
const ABOUT_POLAROID_LABELS: Partial<
  Record<string, Pick<PolaroidItem, "title" | "caption">>
> = {
  "ms-degree": {
    title: "M.S.",
    caption: "Michigan Tech",
  },
};

/** Filenames under `public/about/` (drops removed assets so `/about/...` URLs stay valid). */
const ABOUT_POLAROID_FILES = [
  "1rhianna.png",
  "BEAUTY.png",
  "Heatup1.png",
  "bleach.png",
  "boogavy.png",
  "gph9wwt1g7jha_600.jpg",
  "hydroponic.png",
  "lee1.png",
  "mfdoomfnl.png",
  "ms-degree.png",
  "seadogsfnl.png",
  "sprite2.png",
  "tumblr_lqct1fWfkz1r25pfoo1_1280.png",
  "tumblr_lqdx6hjVCK1r25pfoo1_400.jpg",
  "tumblr_m383f1hR6y1qzf2hjo1_500.jpg",
  "tumblr_m3sdguCMIj1r9bpg5o1_500.jpg",
  "tumblr_nhi44qqDrk1rvxid3o1_500.webp",
  "user6285_pic13891_1285422846.png",
  "user6285_pic37394_1285895628.jpg",
  "user6285_pic37478_1285895964.png",
  "coca-cola.jpeg",
  "DSC09804.jpg",
  "graduation-2014.jpeg",
  "tumblr_m508xobS3y1r25pfoo1_1280.jpg",
  "IMG_1042.jpeg",
  "IMG_1309.jpeg",
  "terrio-popeyes.webp",
] as const;

export const aboutPolaroids: PolaroidItem[] = ABOUT_POLAROID_FILES.map(
  (file) => {
    const layoutId = aboutPolaroidLayoutIdFromFilename(file);
    const title = layoutId;
    const labels = ABOUT_POLAROID_LABELS[layoutId];
    return {
      title: labels?.title ?? title,
      caption: labels?.caption ?? "",
      imageUrl: `/about/${file}`,
      layoutId,
    };
  },
);

/** Draggable flat desk copy — each `id` persists as `desk-text-${id}` in layout JSON. */
export type DeskTextOverlayItem = {
  /** Stable slug — used in layout keys and defaults map. */
  id: string;
  scene: DeskSceneId;
  text: string;
  /** Defaults to handwriting when omitted and `fontUrl` unset. */
  font?: DeskFontPresetId;
  /** Overrides `font` when set (path under `public/`, e.g. `/fonts/Foo.otf`). */
  fontUrl?: string;
  fontSize?: number;
  maxWidth?: number;
  color?: string;
};

export const DESK_TEXT_OVERLAYS: DeskTextOverlayItem[] = [
  {
    id: "thats-me",
    scene: DESK_SCENE_ABOUT,
    text: "Est. 1990's\n\n90's kid for life!",
    font: "handwriting",
    fontSize: 0.21,
  },
  {
    id: "bachelors",
    scene: DESK_SCENE_ABOUT,
    text: "2014\n\nMy obsession with computers led me to get\nmy BS in Computer Science",
    font: "handwriting",
    fontSize: 0.21,
  },
  {
    id: "married",
    scene: DESK_SCENE_ABOUT,
    text: "2022\n\nGot married to my\nbeautiful wife, Lizna",
    font: "handwriting",
    fontSize: 0.21,
  },
  {
    id: "cats",
    scene: DESK_SCENE_ABOUT,
    text: "Our Cats: Cupcake & Sway.\n(They asked me to include these.)",
    font: "handwriting",
    fontSize: 0.21,
  },
  {
    id: "my-start-01",
    scene: DESK_SCENE_ABOUT,
    text: "My journey towards UX started way back\nin middle school with a\n📢COMPLETELY LEGIT copy of\nAdobe Photoshop CS4...",
    font: "handwriting",
    fontSize: 0.21,
  },
  {
    id: "my-start-01-timeframe",
    scene: DESK_SCENE_ABOUT,
    text: "2004",
    font: "handwriting",
    fontSize: 0.18,
  },
  {
    id: "my-start-02",
    scene: DESK_SCENE_ABOUT,
    text: "I taught myself how to use Photoshop in order to create signature images called \"sigs\"\nfor video game and digital art forums that I was on at the time.",
    font: "handwriting",
    fontSize: 0.21,
  },
  {
    id: "my-start-02-01",
    scene: DESK_SCENE_ABOUT,
    text: "😎\nFound my old\nphotobucket account...\niykyk.",
    font: "handwriting",
    fontSize: 0.21,
  },
  {
    id: "my-start-02-timeframe",
    scene: DESK_SCENE_ABOUT,
    text: "2005–2007",
    font: "handwriting",
    fontSize: 0.18,
  },
  {
    id: "my-start-03",
    scene: DESK_SCENE_ABOUT,
    text: "Worked as a web developer for a few years\nbefore discovering UX design and\ngot the opportunity to pivot.",
    font: "handwriting",
    fontSize: 0.21,
  },
  {
    id: "my-start-03-timeframe",
    scene: DESK_SCENE_ABOUT,
    text: "2014–2017",
    font: "handwriting",
    fontSize: 0.18,
  },
  {
    id: "my-start-04",
    scene: DESK_SCENE_ABOUT,
    text: "Worked my way up from design execution to research\nand strategy. While also building and trying\nto launch my own products outside of work.",
    font: "handwriting",
    fontSize: 0.21,
  },
  {
    id: "my-start-04-timeframe",
    scene: DESK_SCENE_ABOUT,
    text: "2018–2022",
    font: "handwriting",
    fontSize: 0.18,
  },
  {
    id: "my-start-05-timeframe",
    scene: DESK_SCENE_ABOUT,
    text: "2022–2025",
    font: "handwriting",
    fontSize: 0.18,
  },
  {
    id: "my-start-05",
    scene: DESK_SCENE_ABOUT,
    text: "Focused on UX Research and Strategy within the enterprise\nand B2B space. While also navigating layoffs\nand going back to school to learn about AI.",
    font: "handwriting",
    fontSize: 0.18,
  },
  {
    id: "my-start-06-timeframe",
    scene: DESK_SCENE_ABOUT,
    text: "Fall 2025",
    font: "handwriting",
    fontSize: 0.18,
  },
  {
    id: "my-start-06",
    scene: DESK_SCENE_ABOUT,
    text: "Got my Master's in Applied Statistics",
    font: "handwriting",
    fontSize: 0.18,
  },
  {
    id: "my-start-07-timeframe",
    scene: DESK_SCENE_ABOUT,
    text: "2026-Present",
    font: "handwriting",
    fontSize: 0.18,
  },
  {
    id: "my-start-07",
    scene: DESK_SCENE_ABOUT,
    text: "Currently building my own products\nand taking on freelance projects.",
    font: "handwriting",
    fontSize: 0.18,
  },
  {
    id: "my-start-08",
    scene: DESK_SCENE_ABOUT,
    text: "Thanks for reading about my journey!\nFeel free to reach out if you have\nany questions or want to collaborate.",
    font: "handwriting",
    fontSize: 0.18,
  },
  {
    id: "page-title",
    scene: DESK_SCENE_ABOUT,
    text: "My villian orgin story",
    font: "handwriting",
    fontSize: 0.64,
  },
];

export function getDeskTextOverlaysForScene(
  scene: DeskSceneId,
): DeskTextOverlayItem[] {
  return DESK_TEXT_OVERLAYS.filter(
    (o) => o.scene === scene && o.text.trim() !== "",
  );
}

