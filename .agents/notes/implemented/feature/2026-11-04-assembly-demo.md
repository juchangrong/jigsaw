# Agent Note: Assembly helper and playground demo

Status: implemented

## Problem

Single pieces from different seeds now interlock with no gaps ([Single pieces interlock](2026-11-04-single-pieces-interlock.md), [Soft corners only on the frame](2026-11-04-frame-only-soft-corners.md)), but only a test showed it. The user asked for an assembly demo in the playground. Finding a set of seeds whose sides fit was test-only code.

## Decision

`assembleSinglePieces` in `packages/core/src/assembly.ts` takes the usual icon options plus `cols` and `rows`. It generates a pool of single pieces from seeds derived from `options.seed` (600 by default), indexes them by their side kinds, and backtracks row by row. Outer sides must be flat, and every interior seam must be a tab against a socket. It returns, for each cell, the piece's description, its grid cell, and where that cell sits inside the piece's own icon (`cellOrigin`, `cellSize` in icon units), or null when the pool has no fitting set. The result is deterministic for the same options.

The playground's Assembly section (`apps/playground/src/AssemblyDemo.tsx`) uses it with the current look: palette, material, lighting and stamp, at a 132 px icon size. It places one real `<PuzzleIcon>` per cell so the cells line up, which shows that the icons themselves fit and not a special render. It offers 2×2, 3×3 and 4×3 sizes. "Scatter pieces" moves the pieces apart with seeded offsets and up to ±14° rotation, and "Shuffle pieces" picks another set, which arrives scattered and snaps together. The transitions run 620 ms with the ease-out-quart token and a 35 ms stagger per piece, and are disabled under `prefers-reduced-motion`. The board is one labeled image, and the piece canvases are hidden from assistive tech. If a 240-seed pool has no fit, the search retries with 600 and then 1,500 seeds.

## Alternatives considered

**Render the assembled puzzle as one multi-piece description.** One canvas would be cheaper, but it would demonstrate the renderer, not that separate single icons fit. The `tests/assembly.test.ts` render already covers that view.

**Keep the search in the playground.** Other apps that show single icons together would need the same search, and the test already duplicated it, so it lives in core with its own tests.

## Consequences

The search takes about 85–145 ms per change in the playground, on the main thread, which is acceptable for a demo. `tests/assembly.test.ts` now builds its 3×3 with `assembleSinglePieces` and checks the frame and seam rule for 2×2, 3×3 and 4×3, determinism, `cellOrigin`, and that a 1×1 has no answer. Checked in the playground on WebGPU: 3×3 and 4×3 close with no gaps, scatter and reassembly animate, and the console has no errors. All 119 tests pass.
