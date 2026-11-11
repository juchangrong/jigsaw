# Agent Note: Soft corners only on the frame

Status: implemented

## Problem

The user asked to check that single pieces assemble with no gaps. A 2×2 of four single seeds (`asm-0`, `asm-2`, `asm-7`, `asm-9`), rasterized at 0.002 cell units, showed that the connectors fit exactly: zero overlap and no gap along any tab or socket. The corners did not. Every corner was soft, per [Soft piece corners](2026-11-04-soft-piece-corners.md), so the four pieces left an enclosed diamond hole of 3,260 texels (about 1.3% of a cell) where they met, plus V notches where seams reached the outer edge. The user then shared a reference puzzle: square corners wherever pieces meet, and rounded corners only on the outer frame.

## Decision

A corner is rounded (`SOFT_CORNER`) only when both of its sides on that piece are flat. That makes it a corner of the finished puzzle's frame. Every other corner is square (`SQUARE_CORNER`, trim 0), so the sides meet at the exact vertex. Shared edges are never flat, so both their ends are square. The rule is the same for single, grid and cluster pieces and replaces the grid-only tight corner, which left pinholes.

In a valid assembly, interior seams are always tab against socket and flat sides lie only on the frame, as on a real puzzle. Two flat sides therefore never meet inside an assembly.

This partly supersedes [Soft piece corners](2026-11-04-soft-piece-corners.md): the soft corner shape is unchanged, but it now applies only to frame corners. `ALGORITHM_VERSION` is `1.4.0`, and `tests/golden/signatures.json` is re-baselined.

## Alternatives considered

**A `corners: "soft" | "square"` option.** This keeps soft corners on standalone icons and offers square ones for assembly. It was offered, but the user answered with the reference image, which settles on frame-only rounding as the single behaviour.

**A small radius everywhere.** The old 0.045 tight corner still leaves a pinhole where four pieces meet, about 0.1% of a cell, so assemblies would not be gapless.

## Consequences

`tests/assembly.test.ts` assembles a framed 3×3 from nine different single seeds, with flat outer sides and tab-against-socket interior seams. It checks zero overlap, and that the only uncovered texels inside the outline are at the four rounded frame corners. It writes `tests/__output__/assembly-3x3.png`, which matches the reference: one closed rectangle with rounded frame corners and seamless interior seams. The corner tests in `tests/geometry.test.ts` now check the rule directly: frame corners are soft, and every other corner of 60 single seeds is exactly square. All 116 tests pass.

Cost: standalone single icons mostly have square corners again, softened only by the bevel. A single icon has rounded corners only where two flat sides meet.

## Superseded

The code this note describes was removed when [the project became mosaic-only](../simplification/2026-11-11-mosaic-only.md). The note is kept as history.
