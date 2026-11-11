// Dev server for the site. `bun ./index.html …` serves each page without a trailing slash,
// but the pages link to each other by relative paths that assume `/docs/`, as a static host serves the build.
import api from "./docs/api/index.html";
import docs from "./docs/index.html";
import registry from "./docs/registry/index.html";
import landing from "./index.html";
import playground from "./playground/index.html";

const pages = { "/docs/": docs, "/docs/api/": api, "/docs/registry/": registry, "/playground/": playground };
const redirects = Object.fromEntries(Object.keys(pages).map((path) => [path.slice(0, -1), Response.redirect(path)]));

const server = Bun.serve({
  port: 5174,
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
