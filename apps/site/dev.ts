// Dev server for the site. `bun ./index.html …` serves each page without a trailing slash,
// but the pages link to each other by relative paths that assume `/docs/`, as a static host serves the build.
import api from "./docs/api/index.html";
import docs from "./docs/index.html";
import registry from "./docs/registry/index.html";
import landing from "./index.html";
import cards from "./playground/cards/index.html";
import playground from "./playground/index.html";
import piece from "./playground/piece/index.html";

// the whole route table; `build` in package.json lists the same pages
const pages = {
  "/docs/": docs,
  "/docs/registry/": registry,
  "/docs/api/": api,
  "/playground/": playground,
  "/playground/piece/": piece,
  "/playground/cards/": cards,
};
const redirects = Object.fromEntries(Object.keys(pages).map((path) => [path.slice(0, -1), Response.redirect(path)]));

const server = Bun.serve({
  port: 5173,
  development: true,
  routes: {
    "/": landing,
    ...pages,
    ...redirects,
    // the built registry files, which the build copies to `dist/r/`
    "/r/:file": async (req) => {
      const file = Bun.file(new URL(`../../public/r/${req.params.file.replace(/[^\w.-]/g, "")}`, import.meta.url));
      return (await file.exists()) ? new Response(file) : new Response("Not found", { status: 404 });
    },
  },
});
console.log(`site on ${server.url}`);
