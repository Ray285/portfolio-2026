/**
 * Types for desk prop intro specs — shared by {@link ./home-intro-props.ts} and
 * {@link ./home-desk-choreography.ts} without circular imports.
 */

/** Resolved tween settings for one draggable item intro shell */
export type HomePropIntroSpec = {
  staggerGapSec: number;
  durationSec: number;
  ease: string;
  fromX?: number;
  fromY: number;
  fromZ?: number;
  fromScale: number;
  fromOpacity: number;
  introScaleAnchor?: "none" | "boundsCenter" | "manual";
  scalePivot?: readonly [number, number, number];
};

export type HomePropIntroPositionPartial = {
  x?: number;
  y?: number;
  z?: number;
};

export type HomePropIntroSegment = {
  durationSec: number;
  ease: string;
} & Partial<{
  opacity: number;
  position: HomePropIntroPositionPartial;
  scale: number;
}>;

export type HomePropIntroSequencePlan = {
  sequence: HomePropIntroSegment[];
  initial?: Partial<HomePropIntroSpec>;
};

export type HomePropIntroOverride =
  | Partial<HomePropIntroSpec>
  | HomePropIntroSequencePlan;
