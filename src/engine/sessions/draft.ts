import type { Probe } from "../analyze";
import type { Unit } from "../../weights";
import { designByKey, type Values } from "./designs";
import { validateWorkspaceSets, type WorkspaceSet } from "./workspace";

export interface PinnedSession {
  name: string;
  recipeKey: string;
  scope: string;
  unit: Unit;
  sets: WorkspaceSet[];
  rules: string[];
  warnings: string[];
}

export interface SessionDraft {
  version: 1;
  scope: string;
  unit: Unit;
  recipeKey: string;
  inputs: Record<string, Partial<Values>>;
  customSets: WorkspaceSet[] | null;
  customByRecipe: Record<string, WorkspaceSet[]>;
  customRules: Record<string, string[]>;
  pinned: PinnedSession | null;
}

export type DraftStorage = Pick<Storage, "getItem" | "setItem">;
const isRecord = (x: unknown): x is Record<string, unknown> =>
  !!x && typeof x === "object" && !Array.isArray(x);
const finite = (x: unknown): x is number =>
  typeof x === "number" && Number.isFinite(x);
const unitValue = (x: unknown): x is Unit => x === "lb" || x === "kg";
const textList = (x: unknown): x is string[] =>
  Array.isArray(x) &&
  x.length <= 100 &&
  x.every((s) => typeof s === "string" && s.length <= 10000);

/** Identity plus every profile input, excluding display units. Changed evidence starts a fresh draft. */
export function profileSignature(probe: Probe, probeId: string): string {
  const text = JSON.stringify([
    probeId,
    probe.lift,
    probe.e1rm,
    probe.mvt,
    probe.recruitLine,
    probe.reps.map((r) => [
      r.round,
      r.date ?? null,
      r.phase,
      r.target,
      r.lb,
      r.set,
      r.rep,
      r.forceN,
      r.meanV,
      r.peakV,
    ]),
  ]);
  let hash = 14695981039346656037n;
  for (let i = 0; i < text.length; i++) {
    hash ^= BigInt(text.charCodeAt(i));
    hash = BigInt.asUintN(64, hash * 1099511628211n);
  }
  return `${probe.lift}:${hash.toString(16).padStart(16, "0")}`;
}

export const draftStorageKey = (scope: string): string =>
  `barbell-toolkit/session-drafts/v1/${encodeURIComponent(scope)}`;

export function createDraft(scope: string, unit: Unit): SessionDraft {
  return {
    version: 1,
    scope,
    unit,
    recipeKey: "topSetBackoff",
    inputs: {},
    customSets: null,
    customByRecipe: {},
    customRules: {},
    pinned: null,
  };
}

function readSets(value: unknown): WorkspaceSet[] | null {
  if (!Array.isArray(value) || value.length > 300 || !value.every(isRecord))
    return null;
  // Authoritative fields are checked below. Derived values are checked as well,
  // then recalculated by materializeWorkspace against this profile before use.
  if (
    value.some(
      (s) =>
        !finite(s.n) ||
        !Number.isInteger(s.n) ||
        s.n < 1 ||
        !finite(s.pct) ||
        s.pct <= 0 ||
        !finite(s.next) ||
        s.next < 0 ||
        (s.fresh !== null && !finite(s.fresh)) ||
        (s.stopV !== null && !finite(s.stopV)) ||
        typeof s.single !== "boolean" ||
        (s.road !== null && s.road !== "load" && s.road !== "fatigue"),
    )
  )
    return null;
  const sets = value as unknown as WorkspaceSet[];
  if (validateWorkspaceSets(sets).length) return null;
  // Copy only the supported fields. Do not retain arbitrary storage properties.
  return sets.map((s) => ({
    id: s.id,
    n: s.n,
    group: s.group,
    pct: s.pct,
    loadLb: s.loadLb,
    requestedPct: s.requestedPct,
    recoverySeconds: s.recoverySeconds,
    reps:
      s.reps.kind === "cluster"
        ? { ...s.reps, parts: [...s.reps.parts] }
        : { ...s.reps },
    rpe: s.rpe,
    next: s.next,
    fresh: s.fresh,
    stopV: s.stopV,
    single: s.single,
    road: s.road,
    ...(s.ceiling != null ? { ceiling: s.ceiling } : {}),
    ...(s.clock != null ? { clock: s.clock } : {}),
    ...(s.tempo != null ? { tempo: s.tempo } : {}),
  }));
}

/** Reject stale or malformed drafts as a whole, rather than quietly changing an authored workout. */
export function parseDraft(
  raw: string | null,
  scope: string,
  unit: Unit,
): SessionDraft {
  const fallback = () => createDraft(scope, unit);
  if (!raw || raw.length > 2_000_000) return fallback();
  try {
    const data: unknown = JSON.parse(raw);
    if (
      !isRecord(data) ||
      data.version !== 1 ||
      data.scope !== scope ||
      !unitValue(data.unit) ||
      typeof data.recipeKey !== "string" ||
      !designByKey(data.recipeKey) ||
      !isRecord(data.inputs) ||
      !isRecord(data.customByRecipe)
    )
      return fallback();
    const inputs: SessionDraft["inputs"] = {};
    for (const [key, values] of Object.entries(data.inputs)) {
      const design = designByKey(key);
      if (
        !design ||
        !isRecord(values) ||
        Object.entries(values).some(
          ([k, v]) => !design.params.some((p) => p.key === k) || !finite(v),
        )
      )
        return fallback();
      inputs[key] = { ...values } as Partial<Values>;
    }
    const customByRecipe: SessionDraft["customByRecipe"] = {};
    for (const [key, value] of Object.entries(data.customByRecipe)) {
      if (!designByKey(key)) return fallback();
      const sets = readSets(value);
      if (!sets) return fallback();
      customByRecipe[key] = sets;
    }
    // Earlier version-1 drafts predate editable execution rules.
    const customRules: SessionDraft["customRules"] = {};
    if (data.customRules !== undefined) {
      if (!isRecord(data.customRules)) return fallback();
      for (const [key, rules] of Object.entries(data.customRules)) {
        if (!designByKey(key) || !textList(rules)) return fallback();
        customRules[key] = [...rules];
      }
    }
    const customSets =
      data.customSets === null ? null : readSets(data.customSets);
    if (data.customSets !== null && customSets === null) return fallback();
    let pinned: PinnedSession | null = null;
    if (data.pinned !== null) {
      const p = data.pinned;
      if (
        !isRecord(p) ||
        p.scope !== scope ||
        typeof p.name !== "string" ||
        !p.name.trim() ||
        p.name.length > 200 ||
        typeof p.recipeKey !== "string" ||
        !designByKey(p.recipeKey) ||
        !unitValue(p.unit) ||
        !textList(p.rules) ||
        !textList(p.warnings)
      )
        return fallback();
      const sets = readSets(p.sets);
      if (!sets) return fallback();
      pinned = {
        name: p.name,
        recipeKey: p.recipeKey,
        scope,
        unit: p.unit,
        sets,
        rules: [...p.rules],
        warnings: [...p.warnings],
      };
    }
    // Explicit custom and pinned loads remain pounds; generated recipes will
    // materialize on the new unit's plates when the workspace is next built.
    return {
      version: 1,
      scope,
      unit,
      recipeKey: data.recipeKey,
      inputs,
      customSets,
      customByRecipe,
      customRules,
      pinned,
    };
  } catch {
    return fallback();
  }
}

function browserStorage(): DraftStorage | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

export function loadDraft(
  scope: string,
  unit: Unit,
  storage?: DraftStorage | null,
): SessionDraft {
  try {
    return parseDraft(
      (storage === undefined ? browserStorage() : storage)?.getItem(
        draftStorageKey(scope),
      ) ?? null,
      scope,
      unit,
    );
  } catch {
    return createDraft(scope, unit);
  }
}

/** Storage denial/quota exhaustion must not break the working editor. */
export function saveDraft(
  draft: SessionDraft,
  storage?: DraftStorage | null,
): boolean {
  try {
    const target = storage === undefined ? browserStorage() : storage;
    if (!target) return false;
    target.setItem(draftStorageKey(draft.scope), JSON.stringify(draft));
    return true;
  } catch {
    return false;
  }
}
