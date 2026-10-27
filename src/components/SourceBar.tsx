import { Link } from "react-router-dom";
import { LIFTS } from "../engine/constants";
import { EXAMPLE_LABEL } from "../engine/example";
import { wt } from "../format";
import { byDateDesc, probeWhen } from "../probes";
import { isUsable, useStore } from "../store";

export default function SourceBar() {
  const { hasMine, source, setSource, active, unit, probes, viewed, viewProbe } = useStore();
  const showingExample = source === "example";
  const usable = probes.filter((s) => isUsable(s.probe)).sort(byDateDesc);
  return (
    <div className="source-bar">
      <div className="source-meta">
        {showingExample || !viewed ? (
          <span>
            Showing <strong>{EXAMPLE_LABEL}</strong> (the worked example)
          </span>
        ) : usable.length > 1 ? (
          <label className="source-pick">
            <span>Showing your probe</span>
            <select value={viewed.id} onChange={(e) => viewProbe(e.target.value)}>
              {usable.map((s) => (
                <option key={s.id} value={s.id}>
                  {LIFTS[s.probe.lift].name}, {probeWhen(s)}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <span>
            Showing <strong>your probe</strong>, {probeWhen(viewed)}
          </span>
        )}
        <span>
          {LIFTS[active.lift].name}, e1RM <strong>{wt(active.e1rm, unit)}</strong>
        </span>
        <span>
          MVT <strong>{active.mvt.toFixed(2)} m/s</strong>, line <strong>{active.recruitLine}%</strong>
        </span>
      </div>
      {hasMine ? (
        <div className="segmented" role="group" aria-label="Which data to show">
          <button type="button" aria-pressed={!showingExample} onClick={() => setSource("mine")}>
            My probe
          </button>
          <button type="button" aria-pressed={showingExample} onClick={() => setSource("example")}>
            Example
          </button>
        </div>
      ) : (
        <Link to="/probe" className="btn btn-small">
          Run your own probe
        </Link>
      )}
    </div>
  );
}
