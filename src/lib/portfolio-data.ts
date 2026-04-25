export type PortfolioItem = {
  title: string;
  label: string;
  description: string;
  href: string;
};

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
};

export const profile = {
  name: "Raymond Lemon",
  role: "Designer-developer crafting tactile web experiences.",
  intro:
    "A clean flat-lay portfolio prototype with draggable projects, soft shadows, and a white desk aesthetic.",
};

export const portfolioItems: PortfolioItem[] = [
  {
    title: "Selected Work",
    label: "Projects",
    description: "Product interfaces, experiments, and interactive systems.",
    href: "#work",
  },
  {
    title: "Studio Notes",
    label: "About",
    description: "How I think, build, prototype, and ship polished software.",
    href: "#about",
  },
  {
    title: "Contact Card",
    label: "Contact",
    description: "Available for collaborations, product work, and prototypes.",
    href: "mailto:hello@example.com",
  },
];

export const polaroids: PolaroidItem[] = [
  {
    title: "Raymond",
    caption: "self portrait",
    imageUrl: "/images/self-portrait_Raymond-Lemon.jpeg",
  },
  {
    title: "Interface Study",
    caption: "visual system",
    palette: ["#f8fafc", "#dbeafe", "#111827"],
  },
  {
    title: "Prototype Desk",
    caption: "interaction test",
    palette: ["#fff7ed", "#fed7aa", "#292524"],
  },
  {
    title: "Launch Notes",
    caption: "case study",
    palette: ["#f0fdf4", "#bbf7d0", "#14532d"],
  },
  {
    title: "Archive 01",
    caption: "reference",
    imageUrl: "/images/tumblr_mim0g52K5g1r43l79o1_1280.jpg",
  },
  {
    title: "Archive 02",
    caption: "reference",
    imageUrl: "/images/tumblr_lqdx6hjVCK1r25pfoo1_400.jpg",
  },
  {
    title: "Archive 03",
    caption: "reference",
    imageUrl: "/images/tumblr_m3sdguCMIj1r9bpg5o1_500.jpg",
  },
  {
    title: "Archive 04",
    caption: "reference",
    imageUrl: "/images/tumblr_lqct1fWfkz1r25pfoo1_1280.png",
  },
  {
    title: "Archive 05",
    caption: "reference",
    imageUrl: "/images/gph9wwt1g7jha_600.jpg",
  },
  {
    title: "Archive 06",
    caption: "reference",
    imageUrl: "/images/tumblr_ly45zrXkTk1qbycdbo1_500.jpg",
  },
  {
    title: "Archive 07",
    caption: "reference",
    imageUrl: "/images/tumblr_lqdx845i7Z1r25pfoo1_1280.jpg",
  },
  {
    title: "Archive 08",
    caption: "webp",
    imageUrl: "/images/tumblr_ecf12b41d4978f19e6c19b6fe2c34a61_1fb5f3b6_1280.webp",
  },
  {
    title: "Archive 09",
    caption: "webp",
    imageUrl: "/images/tumblr_mf82gvgl0c1qbn6jwo1_500.webp",
  },
  {
    title: "Archive 10",
    caption: "webp",
    imageUrl: "/images/tumblr_e12412e43fea279b5abed82b9c0edadb_af6932f4_500.webp",
  },
  {
    title: "Archive 11",
    caption: "webp",
    imageUrl: "/images/tumblr_3573c8c542e167975df4f916944bf2b7_808f14bb_500.webp",
  },
  {
    title: "Archive 12",
    caption: "webp",
    imageUrl: "/images/tumblr_572a28339585fb7dc3681954be2d69a3_7a2a781a_640.webp",
  },
];
