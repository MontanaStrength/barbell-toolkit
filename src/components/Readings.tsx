import type { ReactNode } from "react";

export function KV({ rows }: { rows: Array<[ReactNode, ReactNode]> }) {
  return (
    <dl className="kv">
      {rows.map(([k, v], i) => (
        <div key={i}>
          <dt>{k}</dt>
          <dd>{v}</dd>
        </div>
      ))}
    </dl>
  );
}

export function Reading({ label, value, note }: { label: ReactNode; value: ReactNode; note?: ReactNode }) {
  return (
    <div className="reading">
      <div className="reading-label">{label}</div>
      <div className="reading-value">{value}</div>
      {note ? <div className="reading-note">{note}</div> : null}
    </div>
  );
}
