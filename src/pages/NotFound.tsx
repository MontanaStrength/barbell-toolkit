import { Link } from "react-router-dom";
import { usePageTitle } from "../format";

export default function NotFound() {
  usePageTitle("Not found");
  return (
    <div className="stack">
      <h1>That page isn't here</h1>
      <p className="lede">The old calculators were retired when the toolkit was rebuilt around force–velocity profiling.</p>
      <div className="btn-row">
        <Link to="/" className="btn">
          Go to the home page
        </Link>
        <Link to="/report" className="btn btn-quiet">
          Read the example report
        </Link>
      </div>
    </div>
  );
}
