// Every address the app answers. Anything else that falls through to the
// app's page gets a real 404, so search engines never index a non-page as a
// copy of the home page. Keep in step with the routes in src/App.tsx and the
// report sections in src/pages/Report.tsx; src/routes.test.ts checks the sitemap against it.
const SECTIONS = ["force-load", "l-star", "decay", "reliability", "sessions", "effective-sets", "compare"];

export function isAppRoute(pathname) {
  const p = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  if (p === "/" || p === "/rep" || p === "/probe" || p === "/metrics" || p === "/report") return true;
  const m = /^\/report\/([^/]+)$/.exec(p);
  return !!m && SECTIONS.includes(m[1]);
}

/** Near misses for the sitemap's address, which a phone keyboard makes easily. */
export function isSitemapTypo(pathname) {
  const p = pathname.toLowerCase().replace(/\/+$/, "");
  return pathname !== "/sitemap.xml" && (p === "/sitemap" || p === "/sitemap.xml" || p === "/sitemaps.xml" || p === "/sitemap_index.xml");
}
