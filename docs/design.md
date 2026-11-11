# Mosaic design spec

> Seed → a tile cut into four interlocking puzzle pieces, in the shades of one colour, as plain SVG.

## 1. Goals

- An icon for every item of a list, drawn from the id the item already has: nothing to design and nothing to store.
- Legible from 24 px, calm beside text, and recognisably a puzzle.
- Plain SVG: no canvas, no GPU, no image files, complete when rendered on a server.
- Deterministic: the same seed draws the same icon everywhere.

**Non-goals:** animation, 3D or rendered materials, raster export, single-piece icons. (Earlier versions rendered a bevelled piece and drew a one-piece pictogram; both were removed.)

## 2. The design

- The tile is a unit square cut by two seams through its centre into four cells: top-left, top-right, bottom-left, bottom-right.
- Each of the four half-seams carries one knob at its midpoint. A knob is a circle of radius 0.09 centred 0.03 beyond the seam, and an arc of radius 0.045 eases it into the seam on each side, so the cut has no cusp. Everything is a straight line or a circular arc.
- A knob points into one of the two cells its half-seam separates. It is painted in the colour of the cell it grows from, over its neighbour.
- A seed picks one of 8 tone layouts and one of 16 knob layouts from the `mosaic` random stream: 128 designs.

## 3. Colour

- A mosaic takes four shades of one colour, deep (0) to light (3). Each cell takes one tone.
- The two deep tones share one diagonal and the two light ones the other, so every seam separates a deeper piece from a lighter one.
- `tonal` gives each cell its own shade. `accent` keeps the deepest cell, makes the cell diagonal to it the lightest shade, and gives the two cells that touch it an OKLab mix of the two light shades, so one piece stands out.
- `COLOR_SETS` in `packages/core/src/color/families.ts` holds nine sets of at most five families. A family is four shades generated in OKLCH: lightness steps from deep to light, chroma tapers toward the light end, and the hue drifts a little.
- `tintColor` gives a family's light tint (OKLCH lightness 0.955, low chroma) for a tile behind the icon.

## 4. Drawing

- The tile's outline is a superellipse of exponent 4 (`squircle`, one cubic per quadrant), or a rounded rectangle (`round`).
- The pieces are separated by transparent cuts 0.022 of the tile wide, made by masking the seams out. Where cuts cross or reach the edge, the pieces' corners are rounded with radius 0.03. A gap of 0 joins the pieces.
- Paint order inside the clip: a ground in the mix of the four fills, so antialiasing between two fills never shows the page; the four cells; the four knobs; then a hairline along the outline, so light pieces hold on a light page.
- `mosaicDrawing` returns these parts for any renderer; `mosaicSvg` writes a standalone SVG; `<PuzzleMosaic>` draws the same thing inline.

## 5. Determinism

- Randomness comes only from `createRng(seed, stream)` in `packages/core/src/prng.ts` (Mulberry32 seeded by a string hash). `Math.random` is never used.
- The design depends only on the seed. Colours and style are the caller's.

## 6. Repository layout

```
packages/core        PRNG, OKLCH colour, colour sets, the mosaic design and its SVG
packages/react       <PuzzleMosaic/>
registry/            the installable, self-contained copy of PuzzleMosaic
apps/site            landing page, docs pages and playground (src/playground), dev server and build
tests/               mosaic, PRNG and registry tests
```
