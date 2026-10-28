// Toolkit's three supported lifts: exact relevant catalog fields from SA f6fc5ac.
// See PROVENANCE.md for source entries. No other exercises are admitted by the adapter.
import { MovementPattern, type PowerExerciseCategory } from '../types';
export interface EvaluationExercise {
  primaryMuscles: string[];
  secondaryMuscles: string[];
  movementPattern: MovementPattern;
  powerCategory: PowerExerciseCategory | null;
  accommodatingDevice: null;
  isCompound: boolean;
}
const exercises: Record<string, EvaluationExercise> = {
  bench_press: { primaryMuscles: ['Chest'], secondaryMuscles: ['Triceps', 'Shoulders'], movementPattern: MovementPattern.HORIZONTAL_PUSH, powerCategory: null, accommodatingDevice: null, isCompound: true },
  back_squat: { primaryMuscles: ['Quads', 'Glutes'], secondaryMuscles: ['Hamstrings', 'Core'], movementPattern: MovementPattern.SQUAT, powerCategory: null, accommodatingDevice: null, isCompound: true },
  conventional_deadlift: { primaryMuscles: ['Hamstrings', 'Glutes', 'Back'], secondaryMuscles: ['Quads', 'Core', 'Forearms', 'Traps'], movementPattern: MovementPattern.HINGE, powerCategory: null, accommodatingDevice: null, isCompound: true },
};
export function getExerciseById(id: string): EvaluationExercise | undefined { return exercises[id]; }
// Exact constant from engine/modeling/volume/plannedVolume.ts.
export const SECONDARY_CREDIT = 0.5;
