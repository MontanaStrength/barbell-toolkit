// The only server code on the site. It answers on two addresses; this keeps
// one canonical address, so search engines index a single site rather than
// two copies. Everything else is a file from ./dist, served unchanged.
const CANONICAL = "barbelltoolkit.com";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.hostname === `www.${CANONICAL}`) {
      url.protocol = "https:";
      url.hostname = CANONICAL;
      return Response.redirect(url.toString(), 301);
    }
    return env.ASSETS.fetch(request);
  },
};
