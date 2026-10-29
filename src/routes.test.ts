import { describe, expect, it } from "vitest";
import sitemap from "../public/sitemap.xml?raw";
// @ts-expect-error The worker is plain JavaScript outside the app's TypeScript project.
import { isAppRoute, isSitemapTypo } from "../worker/routes.js";

describe("the worker's routes", () => {
  const paths = [...sitemap.matchAll(/<loc>https:\/\/barbelltoolkit\.com([^<]*)<\/loc>/g)].map((m) => m[1]);

  it("answer every page in the sitemap, with or without a trailing slash", () => {
    expect(paths.length).toBe(13);
    for (const p of paths) {
      expect(isAppRoute(p), p).toBe(true);
      if (p !== "/") expect(isAppRoute(`${p}/`), `${p}/`).toBe(true);
    }
  });

  it("refuse addresses the app doesn't have", () => {
    for (const p of ["/sitemap", "/wp-login.php", "/report/nope", "/report/l-star/extra", "/probe/x"]) {
      expect(isAppRoute(p), p).toBe(false);
    }
  });

  it("send the sitemap's near misses to it, but not the sitemap itself", () => {
    for (const p of ["/sitemap", "/sitemap/", "/Sitemap.xml", "/sitemap.xml/", "/sitemaps.xml"]) expect(isSitemapTypo(p), p).toBe(true);
    expect(isSitemapTypo("/sitemap.xml")).toBe(false);
  });
});
