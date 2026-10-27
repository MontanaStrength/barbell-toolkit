import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { analyze, type Analysis, type Probe } from "./engine/analyze";
import { EXAMPLE_PROBE } from "./engine/example";
import { defaultUnit, type Unit } from "./format";
import {
  addProbe,
  BOOK_KEY,
  byDateDesc,
  LEGACY_KEY,
  parseBook,
  removeProbe,
  updateCurrent,
  type ProbeBook,
  type SavedProbe,
} from "./probes";

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

function loadBook(): ProbeBook {
  let raw: string | null = null;
  let legacy: string | null = null;
  try {
    raw = localStorage.getItem(BOOK_KEY);
    legacy = raw ? null : localStorage.getItem(LEGACY_KEY);
  } catch {
    // Storage blocked: start empty.
  }
  return parseBook(raw, legacy);
}

function saveBook(b: ProbeBook) {
  try {
    localStorage.setItem(BOOK_KEY, JSON.stringify(b));
  } catch {
    // Storage blocked: the probes live for this visit only.
  }
}

export type Source = "mine" | "example";

interface Store {
  /** The probe being logged into on the probe page. */
  mine: Probe;
  setMine: (next: Probe | ((p: Probe) => Probe)) => void;
  /** True once any of the visitor's probes is complete enough to report on. */
  hasMine: boolean;
  /**
   * The probe the report shows. Kept apart from the one being logged into, so
   * looking at an old probe never sends new reps into it.
   */
  viewed: SavedProbe | null;
  viewProbe: (id: string | null) => void;
  /** Every probe in this browser, and which one is current. */
  probes: SavedProbe[];
  currentId: string;
  selectProbe: (id: string) => void;
  /** Start a fresh probe with the current one's lift and settings; the current one is kept. */
  newProbe: () => void;
  deleteProbe: (id: string) => void;
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
  const [book, setBook] = useState<ProbeBook>(loadBook);
  const current = book.probes.find((s) => s.id === book.current) ?? book.probes[0];
  const mine = current.probe;
  const [viewId, setViewId] = useState<string | null>(null);
  const viewed = useMemo(() => {
    const usable = book.probes.filter((s) => isUsable(s.probe));
    return (
      usable.find((s) => s.id === viewId) ??
      (isUsable(current.probe) ? current : null) ??
      [...usable].sort(byDateDesc)[0] ??
      null
    );
  }, [book.probes, viewId, current]);
  const hasMine = viewed != null;
  const [source, setSource] = useState<Source>(hasMine ? "mine" : "example");

  useEffect(() => saveBook(book), [book]);

  const [unit, setUnitState] = useState<Unit>(loadUnit);
  const setUnit = useCallback((u: Unit) => {
    setUnitState(u);
    try {
      localStorage.setItem(UNIT_KEY, u);
    } catch {
      // Storage blocked: the choice lasts for this visit.
    }
  }, []);

  const setMine = useCallback((next: Probe | ((p: Probe) => Probe)) => setBook((b) => updateCurrent(b, next)), []);
  const selectProbe = useCallback((id: string) => setBook((b) => (b.probes.some((s) => s.id === id) ? { ...b, current: id } : b)), []);
  const newProbe = useCallback(() => setBook(addProbe), []);
  const deleteProbe = useCallback((id: string) => setBook((b) => removeProbe(b, id)), []);

  const active = source === "mine" && viewed ? viewed.probe : EXAMPLE_PROBE;
  const analysis = useMemo(() => analyze(active), [active]);

  const value = useMemo(
    () => ({
      mine,
      setMine,
      hasMine,
      viewed,
      viewProbe: setViewId,
      probes: book.probes,
      currentId: current.id,
      selectProbe,
      newProbe,
      deleteProbe,
      source: hasMine ? source : "example",
      setSource,
      active,
      analysis,
      unit,
      setUnit,
    }),
    [mine, setMine, hasMine, viewed, book.probes, current.id, selectProbe, newProbe, deleteProbe, source, active, analysis, unit, setUnit],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore(): Store {
  const s = useContext(Ctx);
  if (!s) throw new Error("useStore outside StoreProvider");
  return s;
}
