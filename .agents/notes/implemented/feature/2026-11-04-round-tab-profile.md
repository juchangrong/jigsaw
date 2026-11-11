# Agent Note: Round tab heads and soft socket lips

Status: implemented

[Formula-defined connector profile](2026-11-04-formula-connector-profile.md) later replaces this profile shape with three formula-defined cubics.

## Problem

After [Soft piece corners](2026-11-04-soft-piece-corners.md), the user marked three places that still looked sharp: a flat, mushroom-shaped tab head on a thin neck, and the lips of two sockets, which curled into pointed hooks. The cause was the tab profile in `edgeProfile`:

- Depth (0.12–0.22) was often smaller than head width (0.22–0.35), so the head was a wide, flat ellipse.
- The neck rose only 0.28 × depth before flaring into the head, so the flare was abrupt.
- The fillet from the side into the neck turned on a radius limited by that short neck height, so a socket's lips came to a point.

## Decision

`packages/core/src/geometry/edge.ts` reshapes the profile:

- **Depth:** depth is now 0.20–0.26. `sanitizeEdge` keeps the head no wider than `headAspect` (1.1) × depth. It deepens the tab first and narrows the head only when the tab cannot get deeper.
- **Neck and head:** the neck rises 0.33 × depth. The head's widest point is at 0.58 × depth, and its handle factor is 0.5 + 0.2 × curvature (0.6–0.68, close to a circle's 0.55). The neck-to-head S-curve has vertical tangents at both ends and handles at half its height.
- **Fillet:** the fillet where the neck leaves the side is 0.09 wide, with a horizontal tangent at the side.

Deeper tabs change the layout scale, so `buildLayout` repeats the neck-minimum pass (and, for clusters, the overlap spreading) until the scale settles. It aims 3% above `MIN_NECK_PX` so that a last small shrink cannot undercut the minimum. The cluster overlap check flattens curves at 0.01 instead of 0.02, because the rounder heads come closer to their neighbors.

The default stamp size drops from 0.42 to 0.36. Deeper sockets reach up to 0.26 into the piece, and a 0.42 letter could come within a bevel width of a socket.

Output changes. This builds on the same unmerged branch as the corner change, which already bumps `ALGORITHM_VERSION` to `1.1.0`, so no further bump is needed. `tests/golden/signatures.json` is re-baselined.

## Alternatives considered

**Only widen the fillets.** The first attempt widened the shoulder and the neck height while keeping the old depth range. In the 512 px renders, heads were still flat ovals and lips still came to points, because a flat head cannot be rounded without more depth.

**Narrow the heads instead of deepening the tabs.** This keeps the old depth range. It lost because heads must stay at least `headOverNeck` wider than the neck, and with narrow heads the knob stops reading as a jigsaw tab.

## Consequences

Tabs are round knobs, socket lips have rounded tips, and grids still interlock with no holes. These were checked in 512 px CPU renders of single, cluster and grid layouts, and in the playground on WebGPU. Pieces are a little taller or wider relative to their body, so the layout scale is slightly smaller.

Two tests change:

- The SDF-resolution test now checks the longer side of the field. A taller piece's field is not square.
- The stamp wall-lighting tests scan across each wall instead of reading one pixel. They now also require each wall to shade in only one direction, which is stricter than before.

All 107 tests pass.

Gap: the design spec's depth range in `docs/design.md` is updated to 0.20–0.26, which departs from the original 0.12–0.22.
