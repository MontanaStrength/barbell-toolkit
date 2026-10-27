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
  // A loaded bar from the side, drawn to Olympic proportions (plate height
  // 23 = 450 mm), with the shaft and sleeves shortened to fit. From each end
  // inward: sleeve, clamp, a 25, two 45s, then the inner collar and shaft.
  return (
    <svg viewBox="0 0 68 24" aria-hidden="true">
      <g fill="var(--steel)">
        <rect x="1.5" y="10.7" width="8" height="2.6" rx="0.4" />
        <rect x="58.5" y="10.7" width="8" height="2.6" rx="0.4" />
        <rect x="9.5" y="9.7" width="1.1" height="4.6" rx="0.4" />
        <rect x="57.4" y="9.7" width="1.1" height="4.6" rx="0.4" />
        <rect x="19.45" y="9.6" width="1.2" height="4.8" rx="0.4" />
        <rect x="47.35" y="9.6" width="1.2" height="4.8" rx="0.4" />
        <rect x="20.65" y="11.25" width="26.7" height="1.5" rx="0.4" />
      </g>
      <g fill="currentColor">
        <rect x="10.95" y="4.5" width="1.8" height="15" rx="0.8" />
        <rect x="55.25" y="4.5" width="1.8" height="15" rx="0.8" />
        <rect x="13.2" y="0.5" width="2.7" height="23" rx="0.8" />
        <rect x="52.1" y="0.5" width="2.7" height="23" rx="0.8" />
        <rect x="16.35" y="0.5" width="2.7" height="23" rx="0.8" />
        <rect x="48.95" y="0.5" width="2.7" height="23" rx="0.8" />
      </g>
    </svg>
  );
}

export default function Layout() {
  const { pathname } = useLocation();
  const { unit, setUnit } = useStore();
  useEffect(() => {
    window.scrollTo(0, 0);
    // One address per page for search engines: the bare domain and this path.
    if (__PREVIEW__) return;
    let link = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!link) {
      link = document.createElement("link");
      link.rel = "canonical";
      document.head.appendChild(link);
    }
    link.href = `https://barbelltoolkit.com${pathname === "/" ? "/" : pathname.replace(/\/$/, "")}`;
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
