# Agent Note: Smoother pictograms and a mosaic icon

Status: implemented

## Problem

The user asked for the icons to look more designed. In the card list ([Card list demo page](2026-11-04-card-list-demo.md)) the Abstract and Solid styles drew the pictogram from [Pictograms and colour families in the library](2026-11-09-pictogram-library-api.md): a rounded square with circles added and removed. Seen critically, three things kept it from looking finished:

- Each knob and notch met its side at a sharp inward or outward corner. The shape read as primitives joined by a union, not as one drawn outline.
- A single flat silhouette on a white tile is the look of a placeholder. Nothing in it was a second tone or a second element.
- The Solid tile was a flat swatch.

## Decision

Sixteen treatments were drawn side by side at 40 px and 96 px in the Mono and Studio sets before choosing: joins of two sizes, different knob and corner proportions, a tonal gradient, two duotones, a tinted tile with deep ink, a layered copy, a two-piece seam and a four-piece tile. Two changes came out of it.

**Joins.** An arc of radius `PICTOGRAM_FILLET` (0.09) now eases every knob and notch into its side. It touches the side and the knob circle, so the outline has no cusp. The knob keeps its radius, offset and reach, so pictograms keep their size and view box. The system is still lines and circular arcs on one grid. `pictogramContains` describes the same shape, and the centroid follows it.

**Mosaic.** A new vector form makes the tile itself the puzzle: four pieces separated by seams through the centre, each seam half carrying one knob, built from the pictogram's knob at half scale. Each piece takes one of a family's four shades. The two deep shades share a diagonal and the two light ones the other, so every seam separates a deep piece from a light one. A seed chooses one of 8 tone layouts and 16 knob layouts from its own `mosaic` random stream. `mosaicFills` gives the four colours in two variants: `tonal` (one shade per piece) and `accent` (one deep piece, the rest light). The library has `generateMosaic`, `mosaicOf`, `mosaicFills`, `mosaicSvg` and `<PuzzleMosaic>`.

A mosaic is painted as four squares and then four knobs over the neighbouring square, on top of a mid-tone rectangle. The rectangle is there because adjacent fills antialias separately, and the page would otherwise show through the seams as a light hairline.

In the card list, Mosaic is a seventh icon style. Its Gradient switch chooses tonal or accent, and the tile turns a quarter turn on hover like the other styles. The Solid tile gains a soft top-left sheen and a bright top edge.

`ALGORITHM_VERSION` is 1.9.0 because pictogram paths changed. Rendered icons are untouched, so the golden signatures stay.

## Alternatives considered

**A tonal gradient inside the pictogram.** It adds depth with no new shape. On the gray Mono family it looked smudged at list size, and the user had already asked for a switch to turn gradients off.

**Duotone knobs.** Knobs lighter or deeper than the body give a second tone. The lighter knobs disappeared at 22 px and the deeper ones made the body look like a background, so the piece stopped reading as one object.

**Deeper ink on a tinted tile.** It looked the most finished of the single-piece treatments. It lost because the user had asked for the Mono gray to be lighter, and deeper ink reverses that.

**A two-piece seam.** A tile split once by a knob is the simplest version of the mosaic idea. With one seam it read as an abstract badge more than as a puzzle.

**Smaller joins, or smaller knobs with larger corners.** A join of 0.05 was invisible at list size. Knobs of 0.16 with corners of 0.24 turned the piece into a blob.

**Exact outlines for the four mosaic pieces.** Each piece as its own closed path would let a product address one piece. The layered form is far simpler, and no use for single pieces exists yet.

## Consequences

Abstract and Solid icons have a continuous outline. The card list has an icon that looks like a small app icon and still says "puzzle", in every colour set including Mono.

`tests/pictogram.test.ts` now also covers:

- arc counts and directions including the joins, and that no arc is a large arc;
- that every vertex of the path lies on the edge of `pictogramContains`;
- that the area beside a knob's root is filled and the same area beside a notch is cut;
- mosaic determinism and variety, the diagonal rule, layer order and which cell owns each knob, both fill variants, a short palette, and the standalone SVG.

All 159 tests pass. Checked in the browser at 2.6× zoom: mosaics in Studio, Titanium and Mono, tonal and accent, show clean seams with no hairline; Abstract and Solid show the smoothed joins.

Gaps:

- A mosaic's four shades come from one family, so families whose shades are close (Titanium's dark family) give a low-contrast mosaic.
- The comparison sheet was a scratch page and is not kept.
- `<PuzzleMosaic>` has no test of its own; the repository has no DOM test environment.
