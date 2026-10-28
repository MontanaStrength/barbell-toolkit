import { describe, expect, it } from "vitest";
import { EXAMPLE_PROBE } from "../example";
import { designByKey, type DesignCtx } from "./designs";
import { buildWorkspace, editWorkspaceSet } from "./workspace";
import {
  createDraft,
  draftStorageKey,
  loadDraft,
  parseDraft,
  profileSignature,
  saveDraft,
  type DraftStorage,
  type SessionDraft,
} from "./draft";

const ctx: DesignCtx = {
  lift: "bench",
  lstar: 64,
  fresh: (p) => 1.5 - p / 100,
  stop: (p) => 1.2 - p / 100,
};
const scope = profileSignature(EXAMPLE_PROBE, "example");
function authoredDraft(): SessionDraft {
  const w = buildWorkspace(designByKey("pureCluster")!, ctx, {}, 365, "lb");
  const sets = editWorkspaceSet(w.sets, w.sets[0].id, { loadLb: 319.125 });
  return {
    ...createDraft(scope, "lb"),
    recipeKey: "pureCluster",
    inputs: { pureCluster: { load: 87, clusters: 4 } },
    customSets: sets,
    customByRecipe: { pureCluster: sets },
    customRules: {
      pureCluster: [
        "Rest 30 seconds between singles.",
        "End after three clusters.",
      ],
    },
    pinned: {
      name: "Before editing",
      recipeKey: "pureCluster",
      scope,
      unit: "lb",
      sets: w.sets,
      rules: w.rules,
      warnings: [],
    },
  };
}
function memoryStorage(): DraftStorage {
  const data = new Map<string, string>();
  return {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => {
      data.set(key, value);
    },
  };
}

describe("session draft persistence", () => {
  it("restores recipe options, per-recipe edits and the pinned plan after reload", () => {
    const draft = authoredDraft();
    const storage = memoryStorage();
    expect(saveDraft(draft, storage)).toBe(true);
    expect(loadDraft(scope, "lb", storage)).toEqual(draft);
    expect(loadDraft(scope, "lb", storage).customSets).not.toBe(
      draft.customSets,
    );
  });

  it("preserves authored physical weights on a unit toggle", () => {
    const draft = authoredDraft();
    const restored = parseDraft(JSON.stringify(draft), scope, "kg");
    expect(restored.unit).toBe("kg");
    expect(restored.customSets?.[0].loadLb).toBe(319.125);
    expect(restored.customByRecipe.pureCluster[0].loadLb).toBe(319.125);
    expect(restored.pinned?.sets[0].loadLb).toBe(draft.pinned!.sets[0].loadLb);
    expect(restored.pinned?.unit).toBe("lb");
  });

  it("isolates profiles and regenerates when any input evidence changes", () => {
    expect(profileSignature({ ...EXAMPLE_PROBE }, "example")).toBe(scope);
    expect(profileSignature(EXAMPLE_PROBE, "other-probe-id")).not.toBe(scope);
    expect(
      profileSignature({ ...EXAMPLE_PROBE, e1rm: 370 }, "example"),
    ).not.toBe(scope);
    expect(
      profileSignature({ ...EXAMPLE_PROBE, mvt: 0.2 }, "example"),
    ).not.toBe(scope);
    expect(
      profileSignature({ ...EXAMPLE_PROBE, recruitLine: 90 }, "example"),
    ).not.toBe(scope);
    const changed = {
      ...EXAMPLE_PROBE,
      reps: EXAMPLE_PROBE.reps.map((r, i) => (i ? r : { ...r, meanV: 0.8 })),
    };
    expect(profileSignature(changed, "example")).not.toBe(scope);
    const storage = memoryStorage();
    saveDraft(authoredDraft(), storage);
    expect(loadDraft("other-profile", "kg", storage)).toEqual(
      createDraft("other-profile", "kg"),
    );
    expect(
      parseDraft(JSON.stringify(authoredDraft()), "other-profile", "lb"),
    ).toEqual(createDraft("other-profile", "lb"));
  });

  it("rejects corrupt, stale or unsupported records without partial restoration", () => {
    const draft = authoredDraft();
    for (const raw of [
      null,
      "{broken",
      "[]",
      JSON.stringify({ ...draft, version: 2 }),
      JSON.stringify({ ...draft, recipeKey: "gone" }),
      JSON.stringify({ ...draft, inputs: { pureCluster: { nonexistent: 5 } } }),
      JSON.stringify({ ...draft, customSets: [null] }),
      JSON.stringify({
        ...draft,
        customSets: [{ ...draft.customSets![0], loadLb: -10 }],
      }),
      JSON.stringify({
        ...draft,
        customSets: [draft.customSets![0], draft.customSets![0]],
      }),
      JSON.stringify({ ...draft, customByRecipe: { gone: [] } }),
      JSON.stringify({ ...draft, customRules: { gone: ["Unknown recipe"] } }),
      JSON.stringify({ ...draft, customRules: { pureCluster: [42] } }),
      JSON.stringify({
        ...draft,
        customRules: { pureCluster: Array(101).fill("Too many rules") },
      }),
      JSON.stringify({ ...draft, customRules: null }),
      JSON.stringify({
        ...draft,
        pinned: { ...draft.pinned, scope: "another" },
      }),
    ])
      expect(parseDraft(raw, scope, "lb")).toEqual(createDraft(scope, "lb"));
  });

  it("migrates earlier version-1 drafts without custom rules and preserves an explicit empty rule list", () => {
    const draft = authoredDraft();
    const legacy = { ...draft } as Partial<SessionDraft>;
    delete legacy.customRules;
    expect(parseDraft(JSON.stringify(legacy), scope, "lb")).toEqual({
      ...draft,
      customRules: {},
    });
    const noRules = { ...draft, customRules: { pureCluster: [] } };
    expect(parseDraft(JSON.stringify(noRules), scope, "lb")).toEqual(noRules);
  });

  it("keeps an intentionally empty edited session distinct from recipe defaults", () => {
    const draft = {
      ...createDraft(scope, "lb"),
      customSets: [],
      customByRecipe: { topSetBackoff: [] },
    };
    expect(parseDraft(JSON.stringify(draft), scope, "lb")).toEqual(draft);
  });

  it("survives storage denial and quota exhaustion without claiming to save", () => {
    const blocked: DraftStorage = {
      getItem: () => {
        throw new Error("denied");
      },
      setItem: () => {
        throw new Error("quota");
      },
    };
    expect(loadDraft(scope, "lb", blocked)).toEqual(createDraft(scope, "lb"));
    expect(saveDraft(authoredDraft(), blocked)).toBe(false);
    expect(saveDraft(authoredDraft(), null)).toBe(false);
    const storage = memoryStorage();
    storage.setItem(draftStorageKey(scope), "broken");
    expect(loadDraft(scope, "lb", storage)).toEqual(createDraft(scope, "lb"));
  });
});
