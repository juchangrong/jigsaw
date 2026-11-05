# Agent Note: Formula-defined connector profile

Status: implemented

## Problem

The user found the edges from [Hand-cut connector edges](2026-11-04-hand-cut-connectors.md) still not continuous. The profile was ten short curves: wavy side runs, a fillet, a vertical neck, an S-flare and a head. Each was level where it met the next, so the outline was smooth at every joint but still read as a chain of pieces. The user asked to match the reference puzzle strictly and to generate each curve from a mathematical formula. In the reference, every edge is one flowing line from corner to corner with a round knob on a narrow neck.

## Decision

`tabProfile` in `packages/core/src/geometry/edge.ts` is now three cubic Béziers whose control points are closed-form in the edge parameters. The formulas are in the function's doc comment:

- corner → neck point P3, around the head to neck point P6, then P6 → corner;
- P4 and P5 continue the incoming tangents at P3 and P6 (P4 = P3 + λ·(P3 − P2)), so the edge is one continuous G¹ line;
- `width` sets the head handle length λ (1.1–1.6), `curvature` sets the inward pull k of P2 before the neck (1.2–2.4), `neckWidth` sets the neck-point spacing, `asymmetry` leans the head, and `wave` bows the side near the corners;
- the tab scale t is solved so the head's top lands exactly on `depth`, which keeps the single-piece scale and layout bounds exact.

The proportions were fitted numerically to the reference: head about 0.30 of the side, narrowest neck about 0.17, and the head's rise above its widest point about 0.77 of its half-width. A single cubic head cannot get much rounder while staying continuous with the neck. The parameter ranges are now depth 0.24–0.30 and neckWidth 0.18–0.26. `NECK_WAIST` (0.78) converts the neck-point spacing to the narrowest neck, and `sanitizeEdge` applies the 3-pixel neck minimum to that narrowest point. `headAspect` is removed.

Sockets stay point reflections of tabs, so leaning formula profiles still interlock. The default stamp size drops from 0.36 to 0.30 so letters clear the deeper sockets. The layout margin is 0.06 for every layout, because deeper knobs shrank 32 px clusters below the 20% coverage check.

This supersedes the profile shape in [Round tab heads and soft socket lips](2026-11-04-round-tab-profile.md) and the side-run construction in [Hand-cut connector edges](2026-11-04-hand-cut-connectors.md). Point-reflected sockets, square corners and frame-only soft corners are unchanged. `ALGORITHM_VERSION` is `1.6.0`, and `tests/golden/signatures.json` is re-baselined.

## Alternatives considered

**Keep the multi-segment profile and smooth its joints further.** Every joint was already tangent-continuous. The segmented look came from the many level points and the short straight-ish runs between them, not from kinks, so more smoothing would not make one flowing line.

**Exact original proportions of the three-cubic form.** The first formula put the neck points at ±t with a centred P2. In the render the heads were only about as wide as the neck points, about 0.16, so the knobs looked thin. A flare term m and a head handle λ were added and fitted to the reference.

## Consequences

Edges are continuous like the reference, knobs are near-round on narrow necks, and the interlock and gapless 3×3 assembly tests still pass on the new geometry. The tab-direction test now bounds a socket's outward bulge by its tab's deepest inward dip, computed from the profile, since that dip reflects into the socket's lips. All 116 tests pass.
