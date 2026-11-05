# Agent Note: Single pieces interlock

Status: implemented

## Problem

The user asked that single-piece icons fit each other. They did not: each side of a single piece drew its own center, width, depth, neck and asymmetry from the seed, so a tab from one seed did not match a socket from another. Each icon was also scaled to its own bounds, so the body cell was a different size in every icon.

## Decision

Single pieces share one connector, `standardEdge` in `packages/core/src/geometry/edge.ts`. It is derived from the `tabSize` and `curvature` options with no randomness. Its center is 0.5 and its asymmetry is 0. Walking a side backwards mirrors the profile, and a centred symmetric profile is its own mirror, so a tab and the neighbouring socket trace the same curve. The seed still picks which sides are tabs, sockets or flat, and still drives the palette, gradient and stamp.

Single pieces also share one scale per output size. The widest a single piece can be is its cell plus a tab on each side, so `fit` uses `(1 − 2·margin) / (1 + 2·depth)` with the connector's depth. Every single icon then draws its cell at the same size. The single margin drops from 0.10 to 0.06, because this scale already leaves room for tabs on all sides, and the shadow is now off by default.

The playground hides the Asymmetry slider for single pieces, where it has no effect. Cluster and grid layouts keep per-seed edges. Their pieces only need to fit their own neighbours, which share edge geometry.

Output changes, so `ALGORITHM_VERSION` is `1.2.0` and `tests/golden/signatures.json` is re-baselined.

## Alternatives considered

**A small set of connector families.** This keeps more shape variety, but a tab from one family would not fit a socket from another, so "any single fits any single" would fail.

**Keep per-icon scaling.** Pieces with few tabs would look bigger and pieces with many tabs smaller, so two icons would not line up when placed side by side even though their connectors match.

## Consequences

`tests/interlock.test.ts` checks three things across 120 seeds:

- Every tab and socket has identical parameters, with center 0.5 and asymmetry 0.
- The scale is identical in every icon.
- On all four sides, a tab from one seed and a socket from another trace the same outline within 0.002 piece units, in both directions, across the connector band.

Cost: single outlines now vary only by their side kinds, about 44 valid combinations, instead of 100 distinct outlines per 100 seeds. The Phase 1 acceptance line in `docs/design.md` is updated. The geometry test now checks that an outline is set by its side kinds and that 100 seeds reach at least 30 combinations.

The neck widening for very small sizes depends on the output size, so at 32 px and below the connector is identical only between icons generated at the same size. From 48 px up the minimum is not reached, and connectors match across sizes too (neck 0.16, depth 0.259, scale 0.580 at default options).

All 110 tests pass, and the playground was checked on WebGPU.
