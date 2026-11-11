# Agent Note: Landing page and usage documentation

Status: implemented

## Problem

The project has a playground for people who already know what it is, and a README that mixes the entry point, the usage guide, the options listing and the internals. Someone meeting the project has no page that shows what a seed produces, and someone using it has to read the README from top to bottom to find a prop.

## Decision

`apps/site` is a second app that builds one static site: a landing page at `/`, three documentation pages under `/docs/`, the playground at `/playground/` and the registry files at `/r/`. `bun run build` now builds this site, so CI covers the playground through it. The playground keeps its own `index.html` and `bun run dev` on port 5173.

The landing page shows real output, as [the product context](../../../../docs/PRODUCT.md) asks: one seed field drives a rendered piece, a mosaic, a pictogram and an outline, a sample list uses mosaics, and a size row uses the renderer the visitor's device supports. Its install command is built from the address the page is served at, so it is correct wherever the site is hosted.

The usage text has one home in `docs/`: `usage.md` is the how-to, `api.md` is the reference, and `registry.md` is unchanged. The README keeps one example and links to them. The site's documentation pages are those same files, converted to HTML at bundle time by a Bun macro (`apps/site/src/markdown.ts`, using `Bun.markdown`), so there is no second copy to keep in step. Links between the three files are pointed at their pages; a link to any other repository file is shown as plain text.

Every page reaches the others through relative paths taken from a `data-root` attribute on its `<html>`, and the bundler writes relative asset paths, so the site works at a domain root or under a project path. `apps/site/dev.ts` serves the pages with trailing slashes, as a static host serves the build, because `bun ./docs/index.html` serves `/docs` and the relative paths would then resolve one level too high.

## Alternatives considered

Putting the landing page in the playground app as another hash route would make the playground's bundle and stylesheet carry the site, and would take the `#/` route that was just given to Mosaic mode.

Writing the documentation pages as React components would give them live examples, but the text would then exist twice, in `docs/` and in the site, and the docs standard keeps documentation under `docs/`.

A documentation framework such as VitePress or Docusaurus would add a second toolchain next to Bun for three pages.

Converting Markdown in the browser with a library such as `marked` would add a runtime dependency and ship the parser to every reader; the macro ships only the HTML.

Deploying the site, for example to GitHub Pages, is left out. The repository is private, and where it is hosted is the maintainer's decision.

## Consequences

The site is not deployed, so the install command on the landing page points at wherever the page is opened from; on `localhost` that is the dev server, which serves `public/r/` at `/r/`.

Code blocks in the documentation pages have no syntax colouring. The pages are rendered in the browser from inlined HTML, so they need JavaScript.

A new Markdown file in `docs/` appears on the site only after it is added to the `DOCS` table in `apps/site/src/docs.tsx` and given an HTML entry.

Checked in a browser against the dev server and against the production build served under a sub-path: the landing page's seed field and sample names, the five rendered sizes on WebGPU, links between the three documentation pages and their anchors, the playground page, a 375 px viewport with no horizontal scroll, and `/r/puzzle-mosaic.json`. The copy buttons were not clicked. No automated test covers the site; `bun run build` fails CI if it stops bundling.
