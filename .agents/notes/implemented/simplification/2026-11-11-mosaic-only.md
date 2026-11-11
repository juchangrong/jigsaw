# Agent Note: The project draws only the mosaic

Status: implemented

## Problem

The project drew four kinds of icon from a seed: a rendered piece on a canvas (WebGPU, WebGL2 and CPU backends), a one-piece pictogram, the piece's outline, and the four-piece mosaic. The mosaic had become the default everywhere: the playground's first page, the card list, the landing page's list example and the only installable component. The maintainer asked for the rendered piece and the pictogram to be removed from the whole project.

## Decision

The mosaic is the only icon. Removed:

- `@jigsaw/renderer`: the three backends, both shaders, `PuzzleIconGenerator` and PNG/WebP encoding.
- From `@jigsaw/core`: options, piece geometry and layouts, the distance field, reference shading, stamps, materials and textures, named palettes, the assembly helper, the pictogram and the piece outline, with `pictogramColor` and `tileColor`.
- From `@jigsaw/react`: `<PuzzleIcon>`, `<PuzzlePictogram>`, `useRendererBackend` and the pixel-ratio store.
- From the site: the playground's Piece page and its `/playground/piece/` route, the app icon preview, and every example and section that showed the removed forms.
- Their tests and the golden image signatures.

What stays in `@jigsaw/core` is the PRNG, OKLCH colour, the colour sets with `tintColor`, and the mosaic, which moved from `pictogram.ts` to `mosaic.ts`. The mosaic's knob constants were the pictogram's at half scale; they are now its own (`0.09`, `0.03`, `0.045`), with the same values, so every design and every byte of markup is unchanged. `tests/registry.test.ts` still holds the installable copy to the library, and the built registry files did not change.

`docs/design.md` is rewritten as the mosaic's spec. `docs/usage.md`, `docs/api.md`, the README and `AGENTS.md` describe only the mosaic. The shader-parity and golden-signature conventions are removed from `AGENTS.md` with the code they governed.

## Alternatives considered

Keeping the rendered piece as an unlisted package would leave a GPU renderer, two shaders and their tests to maintain for something no page shows.

Archiving the removed code in a branch was not needed: it remains in the history before this change.

Keeping the pictogram for 24 px toolbars was declined by the request; the mosaic is legible from 24 px.

## Consequences

This is a breaking change for anything that imported the removed exports. The installable `PuzzleMosaic` and its registry URL are unaffected.

The project no longer produces raster files. A caller who needs a PNG rasterizes the SVG.

The earlier notes about the rendered piece, its geometry, materials, renderer and the pictogram record decisions about code that no longer exists; each carries a pointer to this note. The landing page, playground, card list, route table and naming notes are updated where they named a removed page or export.

Checked on the dev server after a restart: the landing page, the three documentation pages with their live examples, the playground and the card list render; `/playground/piece/` answers 404. Tests cover the mosaic, the PRNG and the registry copy. The production build was built but not opened in a browser.
