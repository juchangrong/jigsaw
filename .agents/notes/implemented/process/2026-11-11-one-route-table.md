# Agent Note: One route table for the site and the playground

Status: implemented

## Problem

The pages were reached in three different ways. The landing page and the docs had paths on the site server (port 5174). The playground ran on its own server (port 5173) and also as `/playground/` on the site. Inside the playground, the rendered piece and the card list were hash routes (`#/piece`, `#/cards`), so they had no title of their own, the site could not link to them, and the playground had no link back to the site or the docs.

## Decision

Every page has a path, and one server serves all of them:

```text
/                      landing page
/docs/                 Use jigsaw icons
/docs/registry/        Install PuzzleMosaic
/docs/api/             API reference
/playground/           Mosaic
/playground/piece/     rendered piece
/playground/cards/     card list
/r/<name>.json         registry files
```

`apps/site` owns the HTML entry for every route, the dev server and the build. `bun run dev` starts it on port 5173; `dev:site` and port 5174 are gone. Port 5173 is kept because the playground stores its settings in `localStorage`, which belongs to the origin.

The playground is no longer an app of its own: its source lives in `apps/site/src/playground/`, and `apps/playground` is removed. Each HTML entry names its page in `data-page`, and `main.tsx` renders that page. The three headers share one `PlaygroundNav`: a home link, links to Mosaic, Piece and Cards, and a link to the docs. An old `#/piece` or `#/cards` link is replaced by the page's path on load.

## Alternatives considered

Keeping the hash routes and only adding links leaves two URL schemes and pages that cannot be linked from the site with a plain path.

Client-side routing with the History API still needs an HTML file per path on a static host, so it adds a router without removing the entries.

Moving the card list out of the playground to a top-level path was not done: it is a demo of the same icons with the same stored settings, and it reads as a playground page.

## Consequences

Switching between Mosaic and Piece is now a page load instead of a hash change; both pages restore their stored settings, and the rendered piece starts its renderer again.

The playground can no longer be served or built alone; the repository has one app.

The route list exists twice: the route table in `apps/site/dev.ts` and the entry list in the `build` script of `apps/site/package.json`. A new page is added to both.

Checked on the dev server: every route answers 200, the no-slash forms redirect, an unknown path and an unknown registry file answer 404, the playground links move between the three pages and mark the current one, and `/playground/#/cards` lands on `/playground/cards/`. The production build was built and its seven HTML files listed, but not opened in a browser.
