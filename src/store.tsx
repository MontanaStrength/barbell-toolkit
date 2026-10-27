import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { analyze, defaultProbe, type Analysis, type Probe } from "./engine/analyze";
import { EXAMPLE_PROBE } from "./engine/example";
import { defaultUnit, type Unit } from "./format";

const KEY = "barbell-toolkit/probe/v1";
const UNIT_KEY = "barbell-toolkit/unit/v1";

function loadUnit(): Unit {
  try {
    const u = localStorage.getItem(UNIT_KEY);
    if (u === "lb" || u === "kg") return u;
  } catch {
    // Storage blocked: fall back to the locale default.
  }
  return defaultUnit();
}

function load(): Probe {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const p = JSON.parse(raw) as Probe;
      if (p && Array.isArray(p.reps)) return { ...defaultProbe(p.lift ?? "bench"), ...p };
    }
  } catch {
    // Storage blocked or corrupt: start empty.
  }
  return defaultProbe();
}

function save(p: Probe) {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    // Storage blocked: the probe lives for this visit only.
  }
}

export type Source = "mine" | "example";

interface Store {
  mine: Probe;
  setMine: (next: Probe | ((p: Probe) => Probe)) => void;
  hasMine: boolean;
  source: Source;
  setSource: (s: Source) => void;
  active: Probe;
  analysis: Analysis;
  unit: Unit;
  setUnit: (u: Unit) => void;
}

const Ctx = createContext<Store | null>(null);

/** A probe is usable once it has a max and at least two loads with reps. */
export const isUsable = (p: Probe) => p.e1rm > 0 && new Set(p.reps.map((r) => r.target ?? r.lb)).size >= 2;

export function StoreProvider({ children }: { children: ReactNode }) {
  const [mine, setMineState] = useState<Probe>(load);
  const hasMine = isUsable(mine);
  const [source, setSource] = useState<Source>(hasMine ? "mine" : "example");

  useEffect(() => save(mine), [mine]);

  const [unit, setUnitState] = useState<Unit>(loadUnit);
  const setUnit = useCallback((u: Unit) => {
    setUnitState(u);
    try {
      localStorage.setItem(UNIT_KEY, u);
    } catch {
      // Storage blocked: the choice lasts for this visit.
    }
  }, []);

  const setMine = useCallback((next: Probe | ((p: Probe) => Probe)) => {
    setMineState((p) => (typeof next === "function" ? next(p) : next));
  }, []);

  const active = source === "mine" && hasMine ? mine : EXAMPLE_PROBE;
  const analysis = useMemo(() => analyze(active), [active]);

  const value = useMemo(
    () => ({ mine, setMine, hasMine, source: hasMine ? source : "example", setSource, active, analysis, unit, setUnit }),
    [mine, setMine, hasMine, source, active, analysis, unit, setUnit],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore(): Store {
  const s = useContext(Ctx);
  if (!s) throw new Error("useStore outside StoreProvider");
  return s;
}
