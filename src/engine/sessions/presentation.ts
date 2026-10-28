import type { CardSet } from "./card";
import type { Reps } from "./designs";
import type { WorkspaceSet } from "./workspace";
import { toUnit, type Unit } from "../../weights";

const decimal = (value: number, places = 2) =>
  Number(value.toFixed(places)).toString();

export function repsLabel(reps: Reps): string {
  switch (reps.kind) {
    case "fixed":
      return `${reps.n}`;
    case "upTo":
      return `up to ${reps.n}`;
    case "toStop":
      return `to the stop, ≈${reps.about}`;
    case "cluster":
      return `${reps.parts.join(" + ")} · ${decimal(reps.intraRest)}s inside`;
    case "timed":
      return `${decimal(reps.minutes)} min of work`;
  }
}

function duration(seconds: number): string {
  if (seconds < 60) return `${decimal(seconds)}s`;
  const minutes = Math.floor(seconds / 60);
  const remainder = Number((seconds - minutes * 60).toFixed(2));
  if (remainder === 60) return `${minutes + 1}:00`;
  return `${minutes}:${remainder < 10 ? "0" : ""}${decimal(remainder)}`;
}

/** Zero recovery is valid between work bouts; only actual position means finish. */
export function thenLabel(set: CardSet, isLast: boolean): string {
  if (isLast) return "Finish";
  if (set.next === 0) return set.clock ? "Start next immediately" : "No rest";
  return set.clock
    ? `Start every ${duration(set.next)}`
    : `Rest ${duration(set.next)}`;
}

/** A prescribed guide/stop is independent of whether a velocity profile exists. */
export function effortInstruction(set: CardSet): string {
  if (set.ceiling) return `RPE ceiling ${decimal(set.rpe)}`;
  if (set.reps.kind === "toStop" || set.reps.kind === "upTo")
    return `Stop at RPE ${decimal(set.rpe)}`;
  return `RPE guide ${decimal(set.rpe)}`;
}

/** A compressed row is only known when every member has projected effort. */
export function projectedEffortText(values: (number | null)[]): string | null {
  if (
    !values.length ||
    values.some((value) => value == null || !Number.isFinite(value))
  )
    return null;
  const numbers = values as number[];
  const low = Math.min(...numbers).toFixed(1);
  const high = Math.max(...numbers).toFixed(1);
  return low === high ? low : `${low}–${high}`;
}

export interface GymCardOptions {
  name: string;
  liftName: string;
  e1rm: number;
  unit: Unit;
  sets: WorkspaceSet[];
  rules: string[];
  rulesLabel: string;
  warnings: string[];
  summary: string;
}

export function gymCardText(options: GymCardOptions): string {
  const weight = (lb: number) =>
    `${decimal(toUnit(lb, options.unit))} ${options.unit}`;
  const lines = [
    `${options.name} — ${options.liftName}`,
    `e1RM ${weight(options.e1rm)}`,
    ...options.sets.map((set, index) => {
      const velocity =
        set.stopV == null || !Number.isFinite(set.stopV)
          ? ""
          : ` ${set.single ? "Velocity check" : "Velocity guide"} ${set.stopV.toFixed(2)} m/s.`;
      const tempo = set.tempo ? ` Tempo ${set.tempo}.` : "";
      return `Set ${index + 1}, ${set.group}: ${repsLabel(set.reps)} @ ${weight(set.loadLb)} (${decimal(set.pct)}%). ${effortInstruction(set)}. ${thenLabel(set, index === options.sets.length - 1)}.${velocity}${tempo}`;
    }),
    ...(options.rules.length
      ? [options.rulesLabel, ...options.rules.map((rule) => `• ${rule}`)]
      : []),
    ...(options.warnings.length
      ? [
          "Checks before using this session:",
          ...options.warnings.map((warning) => `• ${warning}`),
        ]
      : []),
    options.summary,
    "Time is estimated; warm-up is additional. No rest is counted after the final set.",
  ];
  return lines.join("\n");
}
