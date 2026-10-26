import type { Phase, Rep } from "./analyze";

// Probe-log CSV, the same columns the Performance Lab exports:
// round,date,phase,load_pct,load_lb,set,rep,peak_force_n,mean_vel,peak_vel
export const CSV_HEADER = "round,date,phase,load_pct,load_lb,set,rep,peak_force_n,mean_vel,peak_vel";

const cell = (v: unknown) => (v == null ? "" : String(v));

export function toCsv(reps: Rep[]): string {
  const body = reps.map((r) =>
    [r.round, r.date ?? "", r.phase, cell(r.target), r.lb, r.set, r.rep, r.forceN, cell(r.meanV), cell(r.peakV)].join(","),
  );
  return [CSV_HEADER, ...body].join("\n") + "\n";
}

// Header names accepted on import, so a CSV saved from the probe-log
// spreadsheet ("Load (lb)", "Peak Force (N)" …) works as well as the Lab's.
const ALIASES: Record<string, keyof Rep> = {
  round: "round",
  date: "date",
  phase: "phase",
  load_pct: "target",
  "load %": "target",
  load_lb: "lb",
  "load (lb)": "lb",
  set: "set",
  rep: "rep",
  peak_force_n: "forceN",
  "peak force (n)": "forceN",
  mean_vel: "meanV",
  "mean vel": "meanV",
  peak_vel: "peakV",
  "peak vel": "peakV",
};

export interface ImportResult {
  reps: Rep[];
  skipped: number;
  error?: string;
}

function splitLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let quoted = false;
  for (const ch of line) {
    if (ch === '"') quoted = !quoted;
    else if (ch === "," && !quoted) {
      out.push(cur);
      cur = "";
    } else cur += ch;
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

export function fromCsv(text: string): ImportResult {
  const lines = text.replace(/\r/g, "").split("\n").filter((l) => l.trim());
  if (!lines.length) return { reps: [], skipped: 0, error: "The file is empty." };
  const header = splitLine(lines[0]).map((h) => ALIASES[h.toLowerCase()]);
  const need: Array<keyof Rep> = ["round", "phase", "lb", "set", "rep", "forceN"];
  const missing = need.filter((k) => !header.includes(k));
  if (missing.length) {
    return {
      reps: [],
      skipped: 0,
      error: `The header is missing ${missing.length === 1 ? "a column" : "columns"} for ${missing.join(", ")}. Expected: ${CSV_HEADER}`,
    };
  }
  const num = (s: string | undefined) => {
    if (s == null || s === "") return null;
    const n = Number(s);
    return Number.isFinite(n) ? n : null;
  };
  const reps: Rep[] = [];
  let skipped = 0;
  for (const line of lines.slice(1)) {
    const cells = splitLine(line);
    const get = (k: keyof Rep) => {
      const i = header.indexOf(k);
      return i >= 0 ? cells[i] : undefined;
    };
    const phase = (get("phase") ?? "").toLowerCase();
    const round = num(get("round"));
    const lb = num(get("lb"));
    const set = num(get("set"));
    const rep = num(get("rep"));
    const forceN = num(get("forceN"));
    if ((phase !== "ladder" && phase !== "amrap") || round == null || lb == null || set == null || rep == null || forceN == null) {
      skipped++;
      continue;
    }
    reps.push({
      round,
      date: get("date") || undefined,
      phase: phase as Phase,
      target: num(get("target")),
      lb,
      set,
      rep,
      forceN,
      meanV: num(get("meanV")),
      peakV: num(get("peakV")),
    });
  }
  return { reps, skipped };
}
