// The only server code on the site. It keeps one canonical address, forgives
// near misses for the sitemap, and gives addresses the app doesn't have a real
// 404. Everything else is a file from ./dist, served unchanged.
import { isAppRoute, isSitemapTypo } from "./routes.js";

const CANONICAL = "barbelltoolkit.com";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.hostname === `www.${CANONICAL}`) {
      url.protocol = "https:";
      url.hostname = CANONICAL;
      return Response.redirect(url.toString(), 301);
    }
    if (isSitemapTypo(url.pathname)) {
      return Response.redirect(`https://${CANONICAL}/sitemap.xml`, 301);
    }
    const res = await env.ASSETS.fetch(request);
    // A path with no file gets the app's page so it can show its own "not
    // found" screen; say so in the status too, unless it's one of the app's routes.
    const html = (res.headers.get("content-type") || "").includes("text/html");
    if (html && res.status === 200 && !isAppRoute(url.pathname) && url.pathname !== "/index.html") {
      return new Response(res.body, { status: 404, headers: res.headers });
    }
    return res;
  },
};
