// Probe history: every probe a visitor runs, kept in this browser.
// A probe can hold several rounds (repeat days within a week or two, which
// measure day-to-day noise). A new probe is a new block: that's what the
// comparison reads across.

import { defaultProbe, type Probe } from "./engine/analyze";
import { fmtSpan, todayIso } from "./format";

export interface SavedProbe {
  id: string;
  /** Day the probe was started, YYYY-MM-DD. Stands in for the date until reps carry their own. */
  created: string;
  probe: Probe;
}

export interface ProbeBook {
  current: string;
  probes: SavedProbe[];
}

export const BOOK_KEY = "barbell-toolkit/probes/v1";
/** The single probe the site kept before history existed. Read once, to migrate; never written. */
export const LEGACY_KEY = "barbell-toolkit/probe/v1";

export const newId = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

const normalize = (p: Partial<Probe> | null | undefined): Probe | null =>
  p && Array.isArray(p.reps) ? { ...defaultProbe(p.lift ?? "bench"), ...p, reps: p.reps } : null;

export function blankProbe(from?: Probe): SavedProbe {
  const base = from
    ? { ...defaultProbe(from.lift), e1rm: from.e1rm, mvt: from.mvt, recruitLine: from.recruitLine }
    : defaultProbe();
  return { id: newId(), created: todayIso(), probe: { ...base, reps: [] } };
}

/** Rebuild the book from storage, migrating the old single probe if that's all there is. */
export function parseBook(raw: string | null, legacy: string | null): ProbeBook {
  try {
    if (raw) {
      const b = JSON.parse(raw) as Partial<ProbeBook>;
      const probes = (Array.isArray(b?.probes) ? b.probes : [])
        .map((s) => {
          const probe = normalize(s?.probe);
          return probe && typeof s.id === "string" ? { id: s.id, created: s.created || todayIso(), probe } : null;
        })
        .filter((s): s is SavedProbe => s != null);
      if (probes.length) {
        const current = probes.some((s) => s.id === b.current) ? (b.current as string) : probes[0].id;
        return { current, probes };
      }
    }
    if (legacy) {
      const probe = normalize(JSON.parse(legacy) as Partial<Probe>);
      if (probe) {
        const dates = probe.reps.map((r) => r.date).filter((d): d is string => !!d).sort();
        const s: SavedProbe = { id: newId(), created: dates[0] ?? todayIso(), probe };
        return { current: s.id, probes: [s] };
      }
    }
  } catch {
    // Corrupt storage: start over rather than break the page.
  }
  const s = blankProbe();
  return { current: s.id, probes: [s] };
}

/** First and last day the probe's reps were logged; the start date if none carry one. */
export function probeSpan(s: SavedProbe): [string, string] {
  const dates = s.probe.reps.map((r) => r.date).filter((d): d is string => !!d).sort();
  return dates.length ? [dates[0], dates[dates.length - 1]] : [s.created, s.created];
}

/** When the probe finished, for ordering: its last logged day. */
export const probeDate = (s: SavedProbe) => probeSpan(s)[1];

export const probeWhen = (s: SavedProbe) => {
  const [a, b] = probeSpan(s);
  return fmtSpan(a, b);
};

/** Newest first. */
export const byDateDesc = (a: SavedProbe, b: SavedProbe) =>
  probeDate(b).localeCompare(probeDate(a)) || b.created.localeCompare(a.created);

export function addProbe(book: ProbeBook): ProbeBook {
  const cur = book.probes.find((s) => s.id === book.current);
  const s = blankProbe(cur?.probe);
  return { current: s.id, probes: [...book.probes, s] };
}

export function removeProbe(book: ProbeBook, id: string): ProbeBook {
  const probes = book.probes.filter((s) => s.id !== id);
  if (!probes.length) {
    const s = blankProbe(book.probes.find((x) => x.id === id)?.probe);
    return { current: s.id, probes: [s] };
  }
  const current = book.current === id ? [...probes].sort(byDateDesc)[0].id : book.current;
  return { current, probes };
}

export function updateCurrent(book: ProbeBook, next: Probe | ((p: Probe) => Probe)): ProbeBook {
  return {
    ...book,
    probes: book.probes.map((s) =>
      s.id === book.current ? { ...s, probe: typeof next === "function" ? next(s.probe) : next } : s,
    ),
  };
}
