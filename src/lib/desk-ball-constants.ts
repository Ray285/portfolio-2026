/**
 * Keep `DESK_BALL_DEFAULT_RADIUS` in sync with the default `radius` prop on
 * `DeskBall`. The ball’s center is at y = radius (resting on the desk at y=0),
 * so the crest is y = 2 * radius.
 */
export const DESK_BALL_DEFAULT_RADIUS = 0.45;

/** Stable id for the desk ball's {@link DeskPhysicsEntry} (`DeskBall`). */
export const DESK_BALL_ENTRY_ID = "ball";

export const DESK_BALL_CREST_Y = 2 * DESK_BALL_DEFAULT_RADIUS;

/** World units above the ball surface so focused items clear tilt and depth precision. */
export const FOCUS_CLEARANCE_ABOVE_DESK_BALL = 0.08;
