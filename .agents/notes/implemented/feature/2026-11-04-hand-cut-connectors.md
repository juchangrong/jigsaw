# Agent Note: Hand-cut connector edges

Status: implemented

[Formula-defined connector profile](2026-11-04-formula-connector-profile.md) later replaces this profile shape with three formula-defined cubics.

## Problem

After corners became square where pieces meet ([Soft corners only on the frame](2026-11-04-frame-only-soft-corners.md)), the user accepted square corners but shared the reference puzzle again and asked that pieces not be "ruler-straight". In the reference, the sides between a corner and a knob bow gently and the knobs lean. Only the outer frame is straight.

The old profile could not lean or wave and still let single pieces interlock. A socket was the tab flipped inward (v → −v), and a neighbour walks the shared side backwards, so a socket matched a tab only when the profile was symmetric about the side's middle. [Single pieces interlock](2026-11-04-single-pieces-interlock.md) therefore forced the shared connector to be centred with no asymmetry.

## Decision

`edgeProfile` in `packages/core/src/geometry/edge.ts` builds every connector as a tab and makes a socket its point reflection: u → 1 − u, v → −v, walked backwards. The neighbour walks that side the other way and sees exactly the tab, so tab and socket trace one curve for any profile.

The profile is now 10 cubic Béziers. Each side run between the corner and the connector's fillet is two curves that bow by `wave`, a new `PuzzleEdge` field. The run dips inward before the knob and bows outward after it, an S. Each curve is level at the corner, at its peak and at the fillet, so corners stay square and the bend sits mid-run. `wave` is 0.025–0.045, random per edge for grid and cluster pieces. The shared single connector uses 0.037 and a lean of 0.6 × the `asymmetry` range, so `asymmetry` affects single pieces again and the playground shows its slider for every layout. Flat (frame) sides stay straight.

`trimEdgeEnds` now rewrites only the ends it actually trims, so a curved end is never flattened.

This partly supersedes [Single pieces interlock](2026-11-04-single-pieces-interlock.md): pieces still share one connector, but it is no longer centred and symmetric. `ALGORITHM_VERSION` is `1.5.0`, and `tests/golden/signatures.json` is re-baselined.

## Alternatives considered

**Keep sockets as an inward flip and make waves symmetric.** A wave that is a mirror image about the side's middle would still fit, but every side would dip the same way at both ends, which reads as a ripple rather than the reference's S-shaped, leaning sides.

**One curve per side run.** The first attempt used a single cubic per run, which left each corner at a steep angle. In the 512 px render the corners became pointed flicks, so each run is now two curves that are level at the corner.

## Consequences

`tests/interlock.test.ts` still finds that a tab from one seed and a socket from another trace the same outline within 0.002 piece units on all four sides, and now requires the shared connector to lean and wave. `tests/assembly.test.ts` still assembles a framed 3×3 from nine seeds with zero overlap and no gaps except the four rounded frame corners. The tab-direction test allows a socket side to bow outward by at most the largest wave; flat sides must still be exactly straight. All 116 tests pass, and the single, grid and assembly renders and the playground on WebGPU look like the reference.
