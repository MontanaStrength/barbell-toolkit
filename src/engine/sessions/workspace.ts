import { NEURAL_TARGET, STRENGTH_SWEET } from "../constants";
import { neuralLoad } from "../metrics";
import { suggestBarLb, type Unit } from "../../weights";
import { repCount, type Card, type CardSet } from "./card";
import {
  DESIGNS,
  resolve,
  type Design,
  type DesignCtx,
  type PlanSet,
  type Reps,
  type Values,
} from "./designs";

export interface WorkspaceSet extends CardSet {
  id: string;
  /** Authoritative physical weight. It is not re-rounded by a display-unit change. */
  loadLb: number;
  /** Original recipe request, retained to explain plate rounding. */
  requestedPct: number;
  /** Authored rest/interval, retained even when this is currently the final set. */
  recoverySeconds: number;
}

export type RepSummaryKind = "fixed" | "ceiling" | "estimate" | "timed";
export interface Workspace extends Omit<Card, "sets" | "totals"> {
  sets: WorkspaceSet[];
  totals: Card["totals"] & { seconds: number; repKind: RepSummaryKind };
  warnings: string[];
}

export const CUSTOM_RULE_WARNING =
  "Custom changes: review the recipe's conditional rules before using this session.";

export class WorkspaceValidationError extends Error {
  constructor(public readonly issues: string[]) {
    super(issues.join(" "));
    this.name = "WorkspaceValidationError";
  }
}

const positive = (x: unknown): x is number =>
  typeof x === "number" && Number.isFinite(x) && x > 0;
const count = (x: unknown): x is number =>
  positive(x) && Number.isInteger(x) && x <= 1000;
const seconds = (x: unknown): x is number =>
  typeof x === "number" && Number.isFinite(x) && x >= 0 && x <= 86400;
const cloneReps = (r: Reps): Reps =>
  r.kind === "cluster" ? { ...r, parts: [...r.parts] } : { ...r };
const cloneSet = (s: WorkspaceSet): WorkspaceSet => ({
  ...s,
  reps: cloneReps(s.reps),
});

export function validReps(value: unknown): value is Reps {
  if (!value || typeof value !== "object") return false;
  const r = value as Partial<Reps> & {
    n?: unknown;
    about?: unknown;
    parts?: unknown;
    intraRest?: unknown;
    minutes?: unknown;
  };
  switch (r.kind) {
    case "fixed":
    case "upTo":
      return count(r.n);
    case "toStop":
      return count(r.about);
    case "cluster":
      return (
        Array.isArray(r.parts) &&
        r.parts.length > 0 &&
        r.parts.length <= 50 &&
        r.parts.every(count) &&
        seconds(r.intraRest)
      );
    case "timed":
      return positive(r.minutes) && r.minutes <= 1440;
    default:
      return false;
  }
}

export function validateWorkspaceSets(sets: readonly WorkspaceSet[]): string[] {
  const issues: string[] = [];
  const ids = new Set<string>();
  if (sets.length > 300)
    issues.push("A session may contain at most 300 work entries.");
  sets.forEach((s, i) => {
    const at = `Set ${i + 1}`;
    if (typeof s.id !== "string" || !s.id || s.id.length > 200 || ids.has(s.id))
      issues.push(`${at} needs a unique identity.`);
    ids.add(s.id);
    if (!positive(s.loadLb))
      issues.push(`${at} needs a positive, finite bar weight.`);
    if (!positive(s.requestedPct))
      issues.push(`${at} has an invalid requested percentage.`);
    if (typeof s.group !== "string" || !s.group.trim() || s.group.length > 200)
      issues.push(`${at} needs a group label.`);
    if (!validReps(s.reps))
      issues.push(`${at} has an invalid rep or duration instruction.`);
    if (!positive(s.rpe) || s.rpe < 1 || s.rpe > 10)
      issues.push(`${at} effort must be between RPE 1 and 10.`);
    if (!seconds(s.recoverySeconds))
      issues.push(`${at} has an invalid recovery interval.`);
    if (s.clock != null && typeof s.clock !== "boolean")
      issues.push(`${at} has an invalid timing rule.`);
    if (s.ceiling != null && typeof s.ceiling !== "boolean")
      issues.push(`${at} has an invalid effort rule.`);
    if (
      s.tempo != null &&
      (typeof s.tempo !== "string" ||
        !/^\d+(?:\.\d+)?-\d+(?:\.\d+)?-\d+(?:\.\d+)?-\d+(?:\.\d+)?$/.test(
          s.tempo,
        ))
    )
      issues.push(`${at} has an invalid tempo.`);
  });
  return issues;
}

/** Estimated work time, using the existing four-second rep convention. */
export function workspaceWorkSeconds(s: PlanSet): number {
  if (s.reps.kind === "timed") return s.reps.minutes * 60;
  const extraEccentric = s.tempo
    ? Math.max(0, Number(s.tempo.split("-")[0]) - 1.5)
    : 0;
  const intra =
    s.reps.kind === "cluster"
      ? (s.reps.parts.length - 1) * s.reps.intraRest
      : 0;
  return (repCount(s.reps) ?? 0) * (4 + extraEccentric) + intra;
}

function summarize(
  sets: WorkspaceSet[],
  target: [number, number],
): Workspace["totals"] {
  let repKind: RepSummaryKind = "fixed";
  let reps: number | null = 0;
  let neural: number | null = 0;
  let duration = 0;
  for (const [i, s] of sets.entries()) {
    const n = repCount(s.reps);
    if (n == null) {
      repKind = "timed";
      reps = null;
      neural = null;
    } else {
      if (repKind !== "timed") {
        if (s.reps.kind === "toStop") repKind = "estimate";
        else if (s.reps.kind === "upTo" && repKind === "fixed")
          repKind = "ceiling";
      }
      if (reps != null) reps += n;
      // The old diagnostic has a pole at 100%; do not turn that into a plausible score.
      if (neural != null)
        neural = s.pct >= 100 ? null : neural + neuralLoad(n, 1, s.pct);
    }
    const work = workspaceWorkSeconds(s);
    duration +=
      i === sets.length - 1
        ? work
        : s.clock
          ? Math.max(work, s.next)
          : work + s.next;
  }
  return {
    sets: sets.length,
    reps,
    neural,
    target,
    seconds: duration,
    minutes: Math.round(duration / 60),
    approximate: repKind !== "fixed",
    repKind,
  };
}

/** Plain-language distinction between planned, bounded, estimated and timed work. */
export function workspaceRepsText(t: Workspace["totals"]): string {
  if (t.repKind === "timed")
    return "Rep count is determined during the timed work";
  if (t.repKind === "estimate")
    return `About ${t.reps} reps; stop-driven sets are estimates`;
  if (t.repKind === "ceiling") return `Up to ${t.reps} reps`;
  return `${t.reps} planned reps`;
}

function finalize(
  base: Pick<Card, "values" | "options" | "rules"> & {
    totals: Pick<Card["totals"], "target">;
  },
  input: readonly WorkspaceSet[],
  ctx: DesignCtx,
  e1rm: number,
  warnings: string[],
): Workspace {
  if (!positive(e1rm))
    throw new WorkspaceValidationError([
      "A positive e1RM is required to resolve this session.",
    ]);
  const issues = validateWorkspaceSets(input);
  if (issues.length) throw new WorkspaceValidationError(issues);
  const sets = input.map((source, i): WorkspaceSet => {
    const s = cloneSet(source);
    const pct = (s.loadLb / e1rm) * 100;
    return {
      ...s,
      pct,
      n: i + 1,
      next: i === input.length - 1 ? 0 : s.recoverySeconds,
      fresh: ctx.fresh(pct),
      stopV: ctx.stop(pct, s.rpe),
      single: s.reps.kind === "fixed" && s.reps.n === 1,
      road: ctx.lstar == null ? null : pct >= ctx.lstar ? "load" : "fatigue",
    };
  });
  for (const s of sets.slice(0, -1)) {
    if (s.clock && s.next < workspaceWorkSeconds(s))
      warnings.push(
        `Set ${s.n}: the estimated work exceeds the start interval. Increase the interval or reduce the work.`,
      );
  }
  if (sets.some((s) => s.pct >= 100))
    warnings.push(
      "Some work is at or above the entered e1RM; review feasibility before using the session.",
    );
  if (!sets.length) warnings.push("Add work to this session before using it.");
  return {
    values: { ...base.values },
    options: { ...base.options },
    rules: [...base.rules],
    sets,
    totals: summarize(sets, base.totals.target),
    warnings: [...new Set(warnings)],
  };
}

/** The terminal zero is presentation, not an instruction to remove recovery after a future reorder. */
function authoredRecovery(sets: PlanSet[], index: number): number {
  const s = sets[index];
  if (s.next > 0 || index !== sets.length - 1) return s.next;
  const prior = sets.slice(0, index).reverse();
  const same = prior.find(
    (p) =>
      p.group === s.group &&
      p.clock === s.clock &&
      p.pct === s.pct &&
      JSON.stringify(p.reps) === JSON.stringify(s.reps) &&
      p.next > 0,
  );
  // A unique terminal stage has no authored following rest. Keep zero and let
  // the editor expose it if another stage is later appended.
  return same?.next ?? 0;
}

export function buildWorkspace(
  d: Design,
  ctx: DesignCtx,
  input: Partial<Values> = {},
  e1rm: number,
  unit: Unit,
): Workspace {
  const unavailable =
    d.lifts && !d.lifts.includes(ctx.lift)
      ? "This recipe is unavailable for the selected lift."
      : d.unavailable?.(ctx);
  if (unavailable) throw new WorkspaceValidationError([unavailable]);
  if (!positive(e1rm))
    throw new WorkspaceValidationError([
      "A positive e1RM is required to resolve this session.",
    ]);
  const resolved = resolve(d, ctx, input);
  const actual = (pct: number) => (suggestBarLb(e1rm, pct, unit) / e1rm) * 100;
  // All velocities embedded in conditional prose refer to the bar actually loaded.
  const roundedCtx: DesignCtx = {
    ...ctx,
    fresh: (pct) => ctx.fresh(actual(pct)),
    stop: (pct, rpe) => ctx.stop(actual(pct), rpe),
  };
  const built = d.build(resolved.values, roundedCtx);
  const sets = built.sets.map(
    (s, i): WorkspaceSet => ({
      ...s,
      reps: cloneReps(s.reps),
      id: `${d.key}:${i + 1}`,
      n: i + 1,
      requestedPct: s.pct,
      loadLb: suggestBarLb(e1rm, s.pct, unit),
      recoverySeconds:
        d.key === "recoveryIslands" && i === built.sets.length - 1
          ? resolved.values.block
          : authoredRecovery(built.sets, i),
      fresh: null,
      stopV: null,
      road: null,
      single: false,
    }),
  );
  const warnings = Object.entries(input).some(
    ([key, value]) => value != null && resolved.values[key] !== value,
  )
    ? [
        "A recipe option changed because it no longer fits the selected recipe settings.",
      ]
    : [];
  return finalize(
    {
      ...resolved,
      rules: built.rules,
      totals: {
        target: d.family === "strength" ? STRENGTH_SWEET : NEURAL_TARGET,
      },
    },
    sets,
    ctx,
    e1rm,
    warnings,
  );
}

/** Reprice explicit edits; never round them again, trim reps, or replace the chosen structure. */
export function materializeWorkspace(
  base: Card,
  sets: readonly WorkspaceSet[],
  ctx: DesignCtx,
  e1rm: number,
): Workspace {
  const warnings =
    "warnings" in base && Array.isArray(base.warnings)
      ? [...(base.warnings as string[])]
      : [];
  if (base.rules.length) warnings.push(CUSTOM_RULE_WARNING);
  return finalize(base, sets, ctx, e1rm, warnings);
}

export type WorkspaceSetPatch = Partial<
  Pick<
    WorkspaceSet,
    | "group"
    | "loadLb"
    | "reps"
    | "rpe"
    | "ceiling"
    | "clock"
    | "tempo"
    | "recoverySeconds"
  >
>;

function normalizeOrder(input: WorkspaceSet[]): WorkspaceSet[] {
  const issues = validateWorkspaceSets(input);
  if (issues.length) throw new WorkspaceValidationError(issues);
  return input.map((s, i) => ({
    ...cloneSet(s),
    n: i + 1,
    next: i === input.length - 1 ? 0 : s.recoverySeconds,
  }));
}

export function editWorkspaceSet(
  sets: readonly WorkspaceSet[],
  id: string,
  patch: WorkspaceSetPatch,
): WorkspaceSet[] {
  if (!sets.some((s) => s.id === id))
    throw new WorkspaceValidationError([
      "The selected work entry no longer exists.",
    ]);
  return normalizeOrder(
    sets.map((s) => (s.id === id ? { ...s, ...patch } : s)),
  );
}

export function duplicateWorkspaceSet(
  sets: readonly WorkspaceSet[],
  id: string,
  newId: string,
): WorkspaceSet[] {
  const at = sets.findIndex((s) => s.id === id);
  if (at < 0)
    throw new WorkspaceValidationError([
      "The selected work entry no longer exists.",
    ]);
  const out = sets.map(cloneSet);
  out.splice(at + 1, 0, { ...cloneSet(sets[at]), id: newId });
  return normalizeOrder(out);
}

export function moveWorkspaceSet(
  sets: readonly WorkspaceSet[],
  id: string,
  delta: number,
): WorkspaceSet[] {
  const at = sets.findIndex((s) => s.id === id);
  const to = at + delta;
  if (at < 0 || !Number.isInteger(delta) || to < 0 || to >= sets.length)
    throw new WorkspaceValidationError([
      "That work entry cannot move to this position.",
    ]);
  const out = sets.map(cloneSet);
  const [set] = out.splice(at, 1);
  out.splice(to, 0, set);
  return normalizeOrder(out);
}

export function removeWorkspaceSet(
  sets: readonly WorkspaceSet[],
  id: string,
): WorkspaceSet[] {
  if (!sets.some((s) => s.id === id))
    throw new WorkspaceValidationError([
      "The selected work entry no longer exists.",
    ]);
  return normalizeOrder(sets.filter((s) => s.id !== id));
}

export const STRUCTURE_TAGS = {
  steady: "Same load",
  rising: "Rising load",
  falling: "Falling load",
  alternating: "Alternating",
  grouped: "Grouped work",
  clocked: "On a clock",
  adaptive: "Stop-driven",
  tempo: "Tempo",
  timed: "Timed work",
} as const;
export type StructureTag = keyof typeof STRUCTURE_TAGS;
export const RECIPE_TAGS: Readonly<Record<string, readonly StructureTag[]>> = {
  strengthPrescriptionTable: ["steady"],
  sawtooth: ["steady", "alternating"],
  topSetBackoff: ["falling"],
  pureCluster: ["steady", "grouped"],
  doublePyramid: ["rising", "falling"],
  singles: ["steady", "clocked"],
  rampingSingles: ["rising", "falling"],
  threadedSingles: ["alternating"],
  routeSwap: ["rising", "falling", "adaptive"],
  recruitmentCrossover: ["falling", "adaptive"],
  boundedDescent: ["falling", "grouped"],
  tapered: ["steady", "adaptive"],
  ascendingPyramid: ["rising"],
  reversePyramid: ["falling"],
  volumePyramid: ["rising", "falling"],
  straightSets: ["steady"],
  dropSet: ["falling", "grouped"],
  mechanicalTension: ["steady"],
  eccentricAccentuated: ["steady", "tempo"],
  forceMetabolic: ["steady", "alternating"],
  hypertrophyCluster: ["steady", "grouped"],
  densitySet: ["steady", "timed", "adaptive"],
  clockedSets: ["steady", "clocked", "adaptive"],
  restPauseHarvest: ["steady", "grouped", "adaptive"],
  shrinkingSets: ["steady", "clocked", "adaptive"],
  recoveryIslands: ["steady", "grouped"],
};
export const recipeTags = (key: string): readonly StructureTag[] =>
  RECIPE_TAGS[key] ?? [];
/** Tags overlap; none is a strength/hypertrophy membership gate. */
export const filterDesigns = (tags: readonly StructureTag[] = []): Design[] =>
  DESIGNS.filter((d) => tags.every((tag) => recipeTags(d.key).includes(tag)));
