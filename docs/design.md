# Icon design spec

> Seed → a tile in the shades of one colour, as plain SVG: a mosaic of four interlocking puzzle pieces, or a small landscape of hills.

## 1. Goals

- An icon for every item of a list, drawn from the id the item already has: nothing to design and nothing to store.
- Legible from 24 px, calm beside text, and recognisably a puzzle.
- Plain SVG: no canvas, no GPU, no image files, complete when rendered on a server.
- Deterministic: the same seed draws the same icon everywhere.

**Non-goals:** animation, 3D or rendered materials, raster export, single-piece icons. (Earlier versions rendered a bevelled piece and drew a one-piece pictogram; both were removed.)

## 2. The mosaic

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

## 5. Hills

- A small landscape in the same unit tile and outline: three hills under a sun.
- A hill is the top of a circle of radius 0.42–0.54 whose centre lies below the tile, so only its crest shows. The back hill's crest is 0.5–0.6 above the bottom edge, the middle one 0.4–0.5 and the front one 0.24–0.32, so all three always show.
- The back hill is centred at x 0.1–0.35, the middle one at 0.65–0.9 and the front one at 0.35–0.65. Half the seeds mirror the scene left to right.
- The sun is a circle of radius 0.09 centred at x 0.25–0.75 and y 0.22–0.34. It is painted before the hills, so a hill can cover part of it.
- Positions and radii come from the `hills` random stream and are rounded to three decimals. They are continuous, so every seed has its own scene; there is no fixed count of designs.
- The sky takes the lightest shade and the sun the light shade. `tonal` steps the hills from the light shade at the back through the middle shade to the deep one in front. `accent` keeps the deep front hill, gives the middle hill the light shade and the back hill an OKLab mix of the light shade and the sky.
- Paint order inside the clip: the sky, the sun, the hills from back to front, then the hairline along the outline.

## 6. Determinism

- Randomness comes only from `createRng(seed, stream)` in `packages/core/src/prng.ts` (Mulberry32 seeded by a string hash). `Math.random` is never used.
- A design depends only on the seed and the style's own stream, so a seed's mosaic and its hills are chosen independently. Colours and options are the caller's.

## 7. Repository layout

```
packages/core        PRNG, OKLCH colour, colour sets, the mosaic and hills designs and their SVG
packages/react       <PuzzleMosaic/>, <PuzzleHills/>
registry/            the installable, self-contained copy of PuzzleMosaic
apps/site            landing page, docs pages and playground (src/playground), dev server and build
tests/               mosaic, hills, PRNG and registry tests
```
