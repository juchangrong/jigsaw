# Agent Note: A second icon style, petals

Status: implemented

## Problem

After [the project became mosaic-only](../simplification/2026-11-11-mosaic-only.md), a seed could draw one kind of icon. The maintainer asked for other styles that a seed can generate, looked at six prototypes (quilt, arcs, blocks, petals, rings, strata) and chose petals, without the cross-shaped divider the prototype drew between its four cells.

## Decision

Petals are a second style beside the mosaic: `generatePetals`, `petalsOf`, `petalsFills`, `petalsDrawing` and `petalsSvg` in `packages/core/src/petals.ts`, and `<PuzzlePetals>` in `@jigsaw/react`.

The tile has the mosaic's four cells with one leaf in each. A leaf is the lens between two quarter circles of radius one cell, so it runs corner to corner and leans one of two ways. Nothing separates the cells: there are no cuts and no mask, and the ground is one fill, so the leaves meet at their tips and read as one figure.

A seed picks one of 12 tone layouts and 16 lean layouts from its own `petals` stream, 192 designs. The prototype gave leaves any of three shades at random; here every tile has one deep leaf, one middle and two light ones on the lightest shade as ground, so each tile has one clear lead and the same weight as its neighbours in a list. `accent` keeps the deep leaf and makes the other three light, matching the mosaic's variant of the same name.

Petals take the mosaic's props except `gap`, and reuse its outline and variant type. The playground's first page has an Icon choice between the two styles; the landing page and the docs show both. The card list still draws mosaics only.

## Alternatives considered

Keeping the divider would match the prototype, but the maintainer asked for it to go, and without it the leaves join into figures.

A `style` prop on `PuzzleMosaic` would hide two unrelated designs behind one component and make `gap` meaningless for one of them.

Adding petals to the registry now would mean a second self-contained file with its own copy of the palettes. It is left until someone needs to install it.

## Consequences

`PuzzlePetals` cannot be installed with the shadcn CLI yet; the docs say so.

Leaf tips that reach the tile's corners are clipped by the squircle outline.

A seed's mosaic and its petals are chosen from separate streams, so they are unrelated designs.

Tests cover the design space, tones, leaf geometry, fills, the drawing plan, the standalone SVG and the React markup. Checked on the dev server: the playground's Icon choice, the landing page and the API page's live example draw petals with no divider.
