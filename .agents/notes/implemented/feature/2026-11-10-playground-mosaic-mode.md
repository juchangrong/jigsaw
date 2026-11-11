# Agent Note: Playground Mosaic mode

Status: implemented

## Problem

The playground opened on the rendered resin piece, with eight groups of controls, an app icon preview and an assembly demo. The icon the maintainer settled on for product use is the four-piece mosaic, which the playground showed only inside the card list page. The maintainer asked for the playground to be trimmed and to default to the mosaic.

## Decision

The playground has two modes, switched by a Mosaic and Piece control in the header. Mosaic is the default at `#/`; the rendered piece moves to `#/piece` with its controls unchanged. The hash holds the mode, so a reload or a link keeps it. `#/cards` stays the card list.

Mosaic mode (`apps/playground/src/MosaicPage.tsx`) draws the library's `<PuzzleMosaic>` as inline SVG: one at 256 px, a row at 24, 32, 40, 64 and 128 px, and twelve seeds derived from the current one to pick from. Its controls are the seed, the backdrop, the colour set and family, Accent or Tonal shading, and the Gaps, Padding and Tint switches. It opens with the settled look: the Bright set, Accent, Gaps on, Padding off. "From seed" picks a family with the same hash as the installable component, so in the Bright set the playground and the component agree.

The assembly demo is removed from the Piece page, at the maintainer's choice among the sections offered for removal. This supersedes the demo part of [the assembly note](2026-11-04-assembly-demo.md); `assembleSinglePieces` and its tests stay.

`Section`, `Slider`, `Choice`, the display names and `Segmented` live in `apps/playground/src/controls.tsx`, shared by the three pages.

`main.tsx` keeps its React root in `import.meta.hot.data`, because Bun's hot reload runs the entry module again when it changes and a second `createRoot` on the same element logs an error.

## Alternatives considered

**Making the card list the first page.** It needs no new page. It lost because the card list judges icons in a product list, while a mode of its own shows one mosaic at every size with its options, which is what the playground is for.

**Removing the rendered piece page.** It is the largest cut. It lost because the page is the only place to try the WebGPU, WebGL2 and CPU backends by hand.

**Keeping the mode in component state.** It is a few lines shorter. It lost because a reload would always return to Mosaic while tuning a piece, and the hash already selects the card list.

**Also removing the app icon preview, the size row and gallery, or the Stamp, Texture and Lighting groups.** They were offered together with the assembly demo. They stay because the maintainer chose only the demo.

**Export buttons in Mosaic mode.** Copying the SVG fits the product goal of leaving with a file. It was left out of a change meant to trim: the seed reproduces the icon, and the card list page copies picks with their drawing data.

## Consequences

Opening the playground no longer starts a GPU device; that happens on the Piece page. Mosaic mode stores nothing in the browser.

The app icon preview's heading class is `demo-head`, renamed from `assembly-head` when the assembly styles were removed.

Checked in the browser on the dev server: Mosaic mode with each switch, a family pick, a set change, the dark backdrop, the R shortcut and a gallery pick; the Piece page on WebGPU without the assembly section; and switching between modes. The production build was checked on all three pages.

## Later change

The rendered piece and the pictogram were removed when [the project became mosaic-only](../simplification/2026-11-11-mosaic-only.md); what this note says about the mosaic, the colour sets and the registry still holds.
