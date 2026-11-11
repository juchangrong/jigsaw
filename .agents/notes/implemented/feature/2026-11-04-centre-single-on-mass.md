# Agent Note: Centre single pieces on their mass

Status: implemented

## Problem

The user said the piece was not centred in the App icon tiles. Measured in the playground, it was off in two ways:

- **Canvas placement.** In the rounded-square tiles the canvas was offset by about 2.5 px. The canvas is slightly larger than its tile, and CSS grid centring keeps an oversized item "safe", so it spilled to the bottom right only.
- **Visual centre.** In every tile the piece's visual centre sat up to 9.4 px below the tile centre at 120 px. The layout centred the piece's bounding box, and a knob on one side widens the box, so the body, where most of the weight is, sat low under a top knob.

## Decision

`fit` in `packages/core/src/geometry/layout.ts` centres a single piece on the area centroid of its outline instead of its bounding-box centre. The offset is then clamped so the whole piece stays at least 0.02 inside the canvas. `polygonCentroid` is added to `packages/core/src/geometry/bezier.ts`. Cluster and grid layouts keep bounding-box centring.

In the playground, App icon canvases are positioned absolutely at 50%/50% with a −50% translate, so an oversized canvas overflows its tile equally on all sides.

Output changes for single pieces, so `ALGORITHM_VERSION` is `1.7.0` and `tests/golden/signatures.json` is re-baselined.

## Alternatives considered

**Centre only inside the playground tiles.** Shifting each canvas by its piece's centroid would fix the preview, but the main preview and exported icons would stay off-centre in the same way.

**Centre the body cell.** This ignores the knobs entirely, so a piece with two knobs on one side would look shifted toward them. The centroid weighs the knobs by their real area.

## Consequences

In the playground, every App icon tile is now centred on the piece's visual mass to within 0.4 px (it was up to 9.4 px), and the canvases are exactly centred. Single icons everywhere, including exports, are centred the same way. The assembly helper reads cell positions from the same transforms, so assemblies still close.

`tests/geometry.test.ts` checks that the area centroid of 40 single pieces lands at the icon centre within 0.001 and that every piece stays inside the canvas.

The stamp lighting tests now render at 512 px. At 256 px a default stamp wall is only about 1.6 px wide, and the centring shift moved sub-pixel sampling enough to flip the emboss result.

All 131 tests pass.

## Superseded

The code this note describes was removed when [the project became mosaic-only](../simplification/2026-11-11-mosaic-only.md). The note is kept as history.
