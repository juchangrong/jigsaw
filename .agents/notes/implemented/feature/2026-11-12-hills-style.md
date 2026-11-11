# Agent Note: A second icon style, hills

Status: implemented

## Problem

After [the project became mosaic-only](../simplification/2026-11-11-mosaic-only.md), a seed could draw one kind of icon, and the maintainer asked for other styles a seed can generate. A first pick, petals (four leaves in a tile), was built in full and reverted the same day because the maintainer did not like how it looked in the playground. From a second set of six prototypes (duo, bento, dots, hills, hive, overlap) the maintainer chose hills.

## Decision

Hills are a second style beside the mosaic: `generateHills`, `hillsFills`, `hillsDrawing` and `hillsSvg` in `packages/core/src/hills.ts`, and `<PuzzleHills>` in `@jigsaw/react`.

The tile shows three hills under a sun. Each hill is the top of a circle of radius 0.42–0.54 whose centre lies below the tile. The back hill's crest is 0.5–0.6 above the bottom edge, the middle one 0.4–0.5 and the front one 0.24–0.32, so all three always show; the back two sit on opposite sides and the front one near the middle. The sun has radius 0.09 and sits in the upper half, drawn before the hills so a hill can cover part of it. Half the seeds mirror the scene. Positions come from the seed's own `hills` stream and are rounded to three decimals.

The sky is the lightest shade and the sun the light shade. `tonal` steps the hills from the light shade at the back to the deep one in front. `accent` keeps the deep front hill and makes the two behind it light, the back one a mix of the light shade and the sky.

Hills take the mosaic's props except `gap`, and reuse its outline and variant type. The playground's first page has an Icon choice between the two styles.

Because petals was reverted after being wired into the landing page and every document, hills went in two steps: first the library, its tests and the playground; then, once the maintainer had looked at it in the playground and approved it, the landing page, the usage guide, the API reference, the design spec and the README.

## Alternatives considered

Wiring hills into the site and the documents at once would repeat the cost of the petals revert if the look is rejected.

Choosing hill positions from a small fixed set would make the design space countable, as the mosaic's is, but the scenes would repeat visibly in a list; continuous positions make every seed's scene its own.

A `style` prop on `PuzzleMosaic` would hide two unrelated designs behind one component and make `gap` meaningless for one of them.

## Consequences

`PuzzleHills` is not in the registry; the documents say so. The card list still draws mosaics only.

The style reads as a landscape, which is further from the project's puzzle theme than the mosaic.

A seed's mosaic and its hills come from separate streams and are unrelated.

Tests cover determinism and variety, the ordering and placement of the hills, the sun's position, fills, the drawing plan, the standalone SVG and the React markup. Checked on the dev server: the playground's Icon choice draws hills at every size and in the gallery, and the landing page and the API page's live example draw hills.
