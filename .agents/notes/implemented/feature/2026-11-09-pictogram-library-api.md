# Agent Note: Pictograms and colour families in the library

Status: implemented

## Problem

The card list in the playground ([Card list demo page](2026-11-04-card-list-demo.md)) grew three things a product needs in order to use the icons it shows: a geometric pictogram, a line outline of the piece, and colour sets with flat-colour choices. All of it lived in `apps/playground/src/CardsPage.tsx`. A product could not draw what the user picked there, and "Copy picks" had to carry raw path data.

## Decision

The vector forms and colours move into the library. The playground uses them like any other consumer.

- `packages/core/src/pictogram.ts`: `generatePictogram(seed)` and `pictogramOf(kinds)` return a pictogram's path, view box, arrangement and shape key. `PICTOGRAM_ARRANGEMENTS`, `isIconicArrangement`, `pieceArrangement` and `pictogramContains` expose the rules behind it. `pieceOutline(options)` returns the realistic piece's Bézier path. `vectorSvg(shape, options)` returns a standalone SVG string, optionally on a rounded tile, with an escaped accessible name.
- `packages/core/src/color/families.ts`: `colorFamily`, `COLOR_SETS`, `pictogramColor`, `tileColor` and `tintColor`.
- `packages/react/src/PuzzlePictogram.tsx`: `<PuzzlePictogram seed size variant color background radius scale strokeWidth title />` draws inline SVG. It is hidden from assistive technology unless it has a `title`.

The name is "pictogram", not "glyph", because `packages/core/src/stamp/glyph.ts` already uses "glyph" for stamped letters.

The geometry and colours are the ones the card list already used, so the page looks the same. The centroid sampling grid is finer (160 instead of 120 per side), which moves view boxes by under 0.001. Rendered icons are untouched, so no version changes.

## Alternatives considered

**A separate `@jigsaw/pictogram` package.** It would keep core smaller, but the pictogram reads a seed's arrangement from `generatePuzzleIcon`, so it would depend on core anyway, and one more package is one more thing to wire up.

**Give `<PuzzleIcon>` a `variant` prop.** One component would be simpler to discover. It lost because `<PuzzleIcon>` owns a canvas and a GPU-backed generator, while the pictogram's point is to need neither. Separate components keep the SVG path free of that cost.

## Consequences

Products can draw the same pictograms, outlines and colours as the card list, as React components or as SVG strings, with no renderer. `CardsPage.tsx` drops from 544 to 397 lines.

`tests/pictogram.test.ts` covers:

- the 30 arrangements and the rules that exclude the rest;
- that every seed gets an iconic arrangement and keeps its own when it qualifies;
- the path: lines and arcs only, with the right arc count and sweep for knobs and notches (the arcs gained joins later: [Smoother pictograms and a mosaic icon](2026-11-09-pictogram-joins-and-mosaic.md));
- containment at knobs, notches, flat sides and corners;
- that each view is centred on the area centroid (checked on an independent grid) and nothing touches its edge;
- the outline path, the SVG string with and without a tile, and title escaping;
- family construction, set limits and the flat-colour choices.

All 144 tests pass. The card list was checked in the browser after the switch.

Gap: `vectorSvg` uses a non-scaling stroke for outlines, so the line width is in rendered pixels and does not scale if the SVG is resized later.
