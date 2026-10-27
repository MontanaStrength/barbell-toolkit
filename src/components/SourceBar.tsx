import { Link } from "react-router-dom";
import { LIFTS } from "../engine/constants";
import { EXAMPLE_LABEL } from "../engine/example";
import { wt } from "../format";
import { useStore } from "../store";

export default function SourceBar() {
  const { hasMine, source, setSource, active, unit } = useStore();
  const showingExample = source === "example";
  return (
    <div className="source-bar">
      <div className="source-meta">
        <span>
          Showing <strong>{showingExample ? EXAMPLE_LABEL : "your probe"}</strong>
          {showingExample ? " (the worked example)" : ""}
        </span>
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
