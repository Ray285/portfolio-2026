/**
 * ## Per-item desk intro motion — edit **these functions**
 *
 * GSAP timelines are built in **`home-intro-props.ts`** (`appendHomePropIntroLegacyFlatItem` /
 * `appendHomePropIntroSequenceItem`). You don’t write `timeline.to()` here; you return a **motion spec**
 * (`HomePropIntroOverride`): either a **flat partial** merged with **`HOME_PROP_INTRO_DEFAULTS`**, or a
 * **`sequence`** plan (multi-step beats).
 *
 * Wire-up: **`DESK_INTRO_MOTION_BUILDER_REGISTRY`** maps **`deskSlug`** → builder.
 * **`buildDeskIntroMotionByDeskSlug()`** feeds **`HOME_DESK_INTRO_MOTION_BY_DESK_SLUG`** in `home-desk-choreography.ts`.
 *
 * Return **`undefined`** → no override for that prop (global defaults only).
 */

import type {
  HomePropIntroOverride,
  HomePropIntroSequencePlan,
  HomePropIntroSpec,
} from "@/lib/desk-intro-timelines/home-intro-prop-types";

// ——— Shared templates (paste into builders or tweak) ———

/** Flat tween scaffold — merged with {@link HOME_PROP_INTRO_DEFAULTS} (`home-intro-props.ts`). */
export const INTRO_KEYFRAME_STUB_FLAT: Partial<HomePropIntroSpec> = {};

/** Multi-step scaffold — swap segments / `initial` pose. */
export const INTRO_KEYFRAME_STUB_SEQUENCE: HomePropIntroSequencePlan = {
  initial: {},
  sequence: [
    {
      durationSec: 0.55,
      ease: "power2.out",
      opacity: 1,
      position: { x: 0, y: 0, z: 0 },
      scale: 1,
    },
  ],
};

/** Example multi-step polaroid beat — customize or replace. */
export const POLAROID_LAUNCH_NOTES_INTRO_SEQUENCE: HomePropIntroSequencePlan = {
  initial: {
    fromOpacity: 0,
    fromX: -0.15,
  },
  sequence: [
    { durationSec: 0.35, ease: "power2.out", opacity: 1 },
    { durationSec: 1, ease: "none" },
    { durationSec: 0.35, ease: "power2.out", position: { x: 0, y: 0, z: 0 } },
  ],
};

// ——— Portfolio cards (`PortfolioItem.deskSlug`) ———

export function deskIntroMotion_selectedWork(): HomePropIntroOverride | undefined {
  return undefined;
}

export function deskIntroMotion_studioNotes(): HomePropIntroOverride | undefined {
  return undefined;
}

export function deskIntroMotion_contact(): HomePropIntroOverride | undefined {
  return undefined;
}

// ——— Polaroids (`PolaroidItem.deskSlug` on home list) ———

export function deskIntroMotion_raymond(): HomePropIntroOverride | undefined {
  return undefined;
}

export function deskIntroMotion_interfaceStudy(): HomePropIntroOverride | undefined {
  return undefined;
}

export function deskIntroMotion_prototypeDesk(): HomePropIntroOverride | undefined {
  return undefined;
}

export function deskIntroMotion_launchNotes(): HomePropIntroOverride | undefined {
  return POLAROID_LAUNCH_NOTES_INTRO_SEQUENCE;
}

export function deskIntroMotion_archive01(): HomePropIntroOverride | undefined {
  return undefined;
}

export function deskIntroMotion_archive02(): HomePropIntroOverride | undefined {
  return undefined;
}

export function deskIntroMotion_archive03(): HomePropIntroOverride | undefined {
  return undefined;
}

export function deskIntroMotion_archive04(): HomePropIntroOverride | undefined {
  return undefined;
}

export function deskIntroMotion_archive05(): HomePropIntroOverride | undefined {
  return undefined;
}

export function deskIntroMotion_archive06(): HomePropIntroOverride | undefined {
  return undefined;
}

export function deskIntroMotion_archive07(): HomePropIntroOverride | undefined {
  return undefined;
}

export function deskIntroMotion_archive08(): HomePropIntroOverride | undefined {
  return undefined;
}

export function deskIntroMotion_archive09(): HomePropIntroOverride | undefined {
  return undefined;
}

export function deskIntroMotion_archive10(): HomePropIntroOverride | undefined {
  return undefined;
}

export function deskIntroMotion_archive11(): HomePropIntroOverride | undefined {
  return undefined;
}

export function deskIntroMotion_archive12(): HomePropIntroOverride | undefined {
  return undefined;
}

export function deskIntroMotion_archive13(): HomePropIntroOverride | undefined {
  return undefined;
}

export function deskIntroMotion_archive14(): HomePropIntroOverride | undefined {
  return undefined;
}

export function deskIntroMotion_archive15(): HomePropIntroOverride | undefined {
  return undefined;
}

// ——— Phone (`iphone`) ———

export function deskIntroMotion_iphone(): HomePropIntroOverride | undefined {
  return undefined;
}

// ——— Home desk video (`homeDeskVideo`) ———

export function deskIntroMotion_homeDeskVideo(): HomePropIntroOverride | undefined {
  return undefined;
}

/**
 * Registry: **`deskSlug`** string → builder. Keys must match **`portfolio-data`** /
 * **`iphone`** for the GLB phone.
 */
export const DESK_INTRO_MOTION_BUILDER_REGISTRY: Record<
  string,
  () => HomePropIntroOverride | undefined
> = {
  "selected-work": deskIntroMotion_selectedWork,
  "studio-notes": deskIntroMotion_studioNotes,
  contact: deskIntroMotion_contact,

  raymond: deskIntroMotion_raymond,
  "interface-study": deskIntroMotion_interfaceStudy,
  "prototype-desk": deskIntroMotion_prototypeDesk,
  "launch-notes": deskIntroMotion_launchNotes,

  "archive-01": deskIntroMotion_archive01,
  "archive-02": deskIntroMotion_archive02,
  "archive-03": deskIntroMotion_archive03,
  "archive-04": deskIntroMotion_archive04,
  "archive-05": deskIntroMotion_archive05,
  "archive-06": deskIntroMotion_archive06,
  "archive-07": deskIntroMotion_archive07,
  "archive-08": deskIntroMotion_archive08,
  "archive-09": deskIntroMotion_archive09,
  "archive-10": deskIntroMotion_archive10,
  "archive-11": deskIntroMotion_archive11,
  "archive-12": deskIntroMotion_archive12,
  "archive-13": deskIntroMotion_archive13,
  "archive-14": deskIntroMotion_archive14,
  "archive-15": deskIntroMotion_archive15,

  iphone: deskIntroMotion_iphone,
  homeDeskVideo: deskIntroMotion_homeDeskVideo,
};

/** Materializes slug → motion overrides (drops **`undefined`** entries). */
export function buildDeskIntroMotionByDeskSlug(): Partial<
  Record<string, HomePropIntroOverride>
> {
  const out: Partial<Record<string, HomePropIntroOverride>> = {};
  for (const [slug, fn] of Object.entries(DESK_INTRO_MOTION_BUILDER_REGISTRY)) {
    const v = fn();
    if (v !== undefined) {
      out[slug] = v;
    }
  }
  return out;
}
