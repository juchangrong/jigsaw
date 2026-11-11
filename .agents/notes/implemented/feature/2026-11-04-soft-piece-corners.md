# Agent Note: Soft piece corners

Status: implemented

[Soft corners only on the frame](2026-11-04-frame-only-soft-corners.md) later limits the soft corner to frame corners; the shape below is unchanged.

## Problem

The user found the piece corners too sharp. Every corner was a circular arc with a radius of 0.045 side units, so at icon sizes it read almost as a right angle. The fillet where a tab's neck leaves the side was 0.06 wide and also looked tight.

## Decision

`packages/core/src/geometry/edge.ts` defines two corner shapes, applied per grid vertex in `buildLayout`:

- `SOFT_CORNER`: the curve leaves each side 0.15 from the sharp corner, and its control points sit 0.72 of the way to that corner. A circle would use 0.55. The longer handles ease the curvature in from the sides, like the continuous-curvature (squircle) corners used for app icons, instead of a straight line meeting a tight arc.
- `TIGHT_CORNER`: the old 0.045 circular arc.

Single pieces, cluster pieces and the outer corners of a grid use `SOFT_CORNER`. In a grid, a vertex touched by more than one piece uses `TIGHT_CORNER`. Interlocked pieces meet there, and large corners would open diamond-shaped holes between them. `trimEdgeEnds` now trims each end of an edge separately, so a shared edge can have one soft end and one tight end.

The neck fillet widens from 0.06 to 0.075; [Round tab heads and soft socket lips](2026-11-04-round-tab-profile.md) widens it again to 0.09.

Output changes, so `ALGORITHM_VERSION` is `1.1.0` and `tests/golden/signatures.json` is re-baselined.

## Alternatives considered

**Use a larger circular radius only.** A bigger arc also rounds the corner, but it still meets the straight side with a jump in curvature. Corner-smoothing references (Figma's corner smoothing, and the squircle used for app icons) treat that jump as what makes a rounded rectangle look stiff. Longer handles cost nothing extra.

**Round every corner the same, including grid junctions.** It lost because soft corners at the vertex where four grid pieces meet leave a visible hole in an interlocked grid.

**A user-facing roundness option.** It was not requested, and the safe range is limited by the neck position: the corner trim must stay below the straight run before the neck fillet. A fixed value keeps that constraint out of the API.

## Consequences

Pieces look softer at every size, and grids still close up with no holes. The two corner-rounding tests in `tests/geometry.test.ts` check that every single-piece corner leaves more than 0.045 between the outline and the sharp corner (the old arc left 0.019), and that a grid's centre vertex stays tight (under 0.025) while its outer corner is soft. The existing geometry tests still pass: no self-intersection, no thin necks, shared edges matching, and pieces in bounds. All 107 tests pass, and single, cluster and grid were checked in the playground on WebGPU.

This change and the vivid-palette change (PR #5) both rewrite `tests/golden/signatures.json` and the version line in `options.ts`. Whichever merges second needs those two files regenerated.

## Superseded

The code this note describes was removed when [the project became mosaic-only](../simplification/2026-11-11-mosaic-only.md). The note is kept as history.
