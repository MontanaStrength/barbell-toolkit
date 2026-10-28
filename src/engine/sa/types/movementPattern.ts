// Movement-pattern domain nouns. The `MovementPattern` enum is the
// vocabulary the whole engine categorizes exercises with; `StrengthPattern`
// is the compound-lift subset the periodization machinery plans around.
//
// Runtime helpers over these (labels, ordering, the strength-pattern
// canonical-lift / muscle maps) live next to their consumers in
// `@/engine/exercises` — this file is the type/enum lingua franca only.

export const MovementPattern = {
  SQUAT: 'squat',
  HINGE: 'hinge',
  HORIZONTAL_PUSH: 'horizontal-push',
  HORIZONTAL_PULL: 'horizontal-pull',
  VERTICAL_PUSH: 'vertical-push',
  VERTICAL_PULL: 'vertical-pull',
  CARRY: 'carry',
  CORE: 'core',
  ISOLATION: 'isolation',
} as const;

export type MovementPattern = (typeof MovementPattern)[keyof typeof MovementPattern];

/**
 * The six MovementPattern values we plan strength training around.
 * A typed subset of MovementPattern — the string values are identical.
 */
export type StrengthPattern =
  | typeof MovementPattern.SQUAT
  | typeof MovementPattern.HINGE
  | typeof MovementPattern.HORIZONTAL_PUSH
  | typeof MovementPattern.VERTICAL_PUSH
  | typeof MovementPattern.HORIZONTAL_PULL
  | typeof MovementPattern.VERTICAL_PULL;
