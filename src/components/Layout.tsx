import { useEffect } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { useStore } from "../store";

const NAV = [
  { to: "/rep", label: "Read a rep" },
  { to: "/probe", label: "Run the probe" },
  { to: "/report", label: "Report" },
  { to: "/metrics", label: "Metrics" },
];

function Mark() {
  // A loaded bar seen end-on: two plates and the sleeve.
  return (
    <svg viewBox="0 0 30 18" aria-hidden="true">
      <rect x="0" y="8" width="30" height="2" rx="1" fill="currentColor" opacity="0.45" />
      <rect x="5" y="1" width="4" height="16" rx="1.5" fill="currentColor" />
      <rect x="21" y="1" width="4" height="16" rx="1.5" fill="currentColor" />
      <rect x="10" y="4" width="2" height="10" rx="1" fill="var(--signal)" />
      <rect x="18" y="4" width="2" height="10" rx="1" fill="var(--signal)" />
    </svg>
  );
}

export default function Layout() {
  const { pathname } = useLocation();
  const { unit, setUnit } = useStore();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return (
    <>
      <header className="site-header">
        <div className="page site-header-inner">
          <Link to="/" className="wordmark">
            <Mark />
            Barbell Toolkit
          </Link>
          <nav className="nav" aria-label="Main">
            {NAV.map((n) => (
              <NavLink key={n.to} to={n.to} className={({ isActive }) => (isActive ? "active" : undefined)}>
                {n.label}
              </NavLink>
            ))}
          </nav>
          <div className="segmented unit-toggle" role="group" aria-label="Weight unit">
            {(["lb", "kg"] as const).map((u) => (
              <button key={u} type="button" aria-pressed={unit === u} onClick={() => setUnit(u)}>
                {u}
              </button>
            ))}
          </div>
        </div>
      </header>
      <main>
        <div className="page">
          <Outlet />
        </div>
      </main>
      <footer className="site-footer">
        <div className="page site-footer-inner">
          <p>Built by Montana Strength in Bozeman, Montana.</p>
          <p>Free to use. Your probe stays in this browser; nothing is uploaded.</p>
        </div>
      </footer>
    </>
  );
}
