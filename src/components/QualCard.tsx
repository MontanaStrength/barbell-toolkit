import { QUAL } from "../content/qualification";

export default function QualCard({ id }: { id: keyof typeof QUAL }) {
  const q = QUAL[id];
  if (!q) return null;
  return (
    <div className="qual-wrap">
      <section className="qual" aria-label="When to trust this reading">
        <div>
          <h3>Use it for</h3>
          <ul>
            {q.useFor.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        </div>
        <div className="qual-breaks">
          <h3>Breaks when</h3>
          <ul>
            {q.breaksWhen.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  );
}
