import { useId } from "react";
import type { SessionEvaluation } from "../engine/sessions/evaluation";

const credit = (value: number | null | undefined) =>
  value == null || !Number.isFinite(value) ? "–" : value.toFixed(2);

/** Different credit units share a session, not a percentage pie. Unknown
 * whole-session values stay absent, even if an initial set could be priced. */
export default function SessionProfile({
  evaluation,
}: {
  evaluation: SessionEvaluation;
}) {
  const id = useId();
  const { benefits, rawBenefits, costs, warnings } = evaluation;
  const known = evaluation.status === "estimated" && benefits != null;
  const shown = known ? benefits : null;
  return (
    <aside
      className="session-profile panel stack"
      aria-labelledby={`${id}-heading`}
    >
      <h3 id={`${id}-heading`}>Session profile</h3>
      <p className="small muted">
        Modeled credits after session diminishing returns. Both contributions
        count; each uses its own reference unit.
      </p>
      <div className="session-credits" aria-live="polite">
        <div>
          <span>
            Strength<small>reference-set credits</small>
          </span>
          <strong
            aria-label={
              shown
                ? `${credit(shown.strength)} strength reference-set credits`
                : "Strength estimate unavailable"
            }
          >
            {credit(shown?.strength)}
          </strong>
        </div>
        <div>
          <span>
            Hypertrophy<small>hard-set equivalents</small>
          </span>
          <strong
            aria-label={
              shown
                ? `${credit(shown.hypertrophy)} hypertrophy hard-set equivalents`
                : "Hypertrophy estimate unavailable"
            }
          >
            {credit(shown?.hypertrophy)}
          </strong>
        </div>
      </div>
      {!known ? (
        <p className="small">
          Full-session estimates are unavailable for this prescription. Unknown
          work is not counted as zero.
        </p>
      ) : null}
      {warnings.length > 0 ? (
        <div className="stack-sm">
          <ul className="session-warnings small">
            {warnings.slice(0, 2).map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
          {warnings.length > 2 ? (
            <details className="session-details">
              <summary>
                {warnings.length - 2} more{" "}
                {warnings.length - 2 === 1 ? "check" : "checks"}
              </summary>
              <ul className="session-warnings small">
                {warnings.slice(2).map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            </details>
          ) : null}
        </div>
      ) : null}
      <details className="session-details">
        <summary>Model details</summary>
        <p>
          Before session diminishing returns, set and group credits add up to
          the raw totals below. The session model reduces overlapping
          contributions; these scores are estimates, not measured adaptation.
        </p>
        <dl className="session-metrics">
          <dt>Raw strength credits</dt>
          <dd>{credit(known ? rawBenefits?.strength : null)}</dd>
          <dt>Raw hypertrophy credits</dt>
          <dd>{credit(known ? rawBenefits?.hypertrophy : null)}</dd>
          <dt>Power credits</dt>
          <dd>{credit(shown?.power)}</dd>
          <dt>Local endurance credits</dt>
          <dd>{credit(shown?.localEndurance)}</dd>
          <dt>Central cost points</dt>
          <dd>{credit(known ? costs?.central : null)}</dd>
          <dt>Local muscular cost points</dt>
          <dd>{credit(known ? costs?.peripheral : null)}</dd>
        </dl>
        <p className="small">
          Cost points are modeled workload costs, not a recovery time or a
          personal readiness score.
        </p>
        <p className="small">{evaluation.basis}</p>
        <p className="small">
          Source:{" "}
          <a href={evaluation.source.url} target="_blank" rel="noreferrer">
            {evaluation.source.name} · {evaluation.source.commit.slice(0, 7)}
          </a>
          .
        </p>
      </details>
    </aside>
  );
}
