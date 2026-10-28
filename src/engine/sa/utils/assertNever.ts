/**
 * Exhaustiveness guard for switches over closed unions.
 *
 * Call it from a switch's `default` branch. The parameter is `never`, so the
 * call only typechecks while every variant of the union has its own `case`.
 * Add a variant and the compiler rejects the file at that switch, which is
 * where the decision about the new variant belongs. If an unexpected value
 * reaches it anyway — data decoded from outside the type system, say — it
 * throws with that value instead of falling through and returning undefined
 * in the middle of someone's workout.
 */
export function assertNever(value: never): never {
  throw new Error(`Unhandled variant: ${String(value)}`);
}
