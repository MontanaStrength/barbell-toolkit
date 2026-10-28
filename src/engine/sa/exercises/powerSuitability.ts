import type {
  EvaluationExercise as Exercise,
} from './exerciseLibrary';
import type { PowerExerciseCategory } from '../types';
import { getExerciseById } from './exerciseLibrary';

/**
 * Resolve exercise-side power mechanics without scattering name checks
 * through the benefit model. Explicit catalog metadata wins; conservative
 * structural fallbacks keep ordinary entries backward compatible.
 */
export function powerCategoryForExercise(
  exercise: Pick<
    Exercise,
    'powerCategory' | 'accommodatingDevice' | 'isCompound'
  > | null | undefined,
): PowerExerciseCategory {
  if (exercise != null && exercise.powerCategory !== null) return exercise.powerCategory;
  if (exercise != null && exercise.accommodatingDevice !== null) {
    return 'accommodating_resistance_explosive';
  }
  if (exercise?.isCompound === false) return 'isolation';
  return 'conventional_non_ballistic_compound';
}

export function powerCategoryForExerciseId(
  exerciseId: string,
): PowerExerciseCategory {
  return powerCategoryForExercise(getExerciseById(exerciseId));
}
