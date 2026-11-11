# Agent Note: Icon builds that do not block the page

Status: implemented

## Problem

Changing a geometry control in the playground froze the page for about half a second. A profile of a Tab size change showed one main-thread task of 534–562 ms, and the main preview updated only when it ended. The page shows 35 icons, and four things added up:

- Every icon built its distance field in the same task. `PuzzleIconGenerator.render` did the synchronous work right after `await this.backend()`, so all the continuations ran back to back before the browser could paint.
- Fields were larger than the output needed: 1.5 texels per output pixel, rounded up to 256, 512 or 1024. A 512 px preview used a 1024 field, which takes 113 ms to build against 20 ms at 512.
- `assembleSinglePieces` generated 240 complete icons (59 ms) to read their side kinds, and ran again on every colour or material change.
- A cluster icon took 17 ms to lay out, most of it in `polygonsOverlap`, which tested every vertex of one piece against every edge of another.

Stale work also ran to completion: an icon whose options changed while it waited was still built, then discarded.

## Decision

**Slice and cancel in the generator.** `render` now queues its synchronous part (generation and plan building). After 8 ms of work the next build waits for a new task, so the page paints and handles input between slices. `render` takes a `signal`; an aborted render that has not started is skipped and rejects with an `AbortError`. `<PuzzleIcon>` aborts when its options change or it unmounts. `RenderResult.ms` now measures the work on that icon, without the time it waited in the queue.

**About one texel per pixel.** `recommendedSdfResolution` picks the smallest of 128, 192, 256, 384, 512, 768 and 1024 that covers the output, and `sdfResolutionFor` calls it instead of repeating the formula. Build time grows with the texel count. The field is read with bilinear filtering and holds exact distances near the outline, so the extra texels bought nothing visible: against a 1024 reference, at most 0.27% of bytes differ by more than 8 of 255 across single, cluster and grid icons from 32 to 512 px, and side-by-side renders at 4× zoom look the same. This changes pixels slightly, so `ALGORITHM_VERSION` is 1.8.0 and the golden signatures are re-baselined.

**Cache by memory.** `SdfCache` is bounded by total texels (16 million, 64 MB) instead of 64 entries. A page of small icons keeps many more fields, and a few 1024 exports can no longer hold 256 MB.

**Search the assembly on side kinds.** `singlePieceKinds` returns a single piece's side kinds from the seed and geometry options without building geometry. The assembly search uses it and generates only the chosen icons. `buildLayout` and `singlePieceKinds` share one `chooseKinds` helper, so the two cannot drift apart.

**Skip hopeless overlap tests.** `polygonsOverlap` tests a vertex only if it lies inside the other polygon's bounds. The result is the same.

## Alternatives considered

**`useDeferredValue` in the playground.** It would let React show the main preview first. It lost because the stall was not in React rendering: the builds run in promise continuations after the commit, so deferring the state would only have moved the same long task. Slicing in the generator also helps every product that mounts many icons.

**A Web Worker for distance fields.** It would take the work off the main thread entirely. It needs a worker bundle in each consuming app and a transfer protocol for fields. With smaller fields and slicing, no task exceeds 50 ms in the default layout, so the worker is left for later.

**Cache the assembly search by its options.** It would have fixed colour changes but still cost 59 ms on each geometry change. Reading kinds directly makes the search cheap enough to need no cache.

## Consequences

Measured in the playground on WebGPU, changing Tab size:

| Layout | Before | After |
| --- | --- | --- |
| Single: longest block | 534–562 ms | 34–47 ms |
| Single: preview updates after | 539–576 ms | 79–96 ms |
| Cluster: longest block | not measured | 57–82 ms |

The browser reports no task over 50 ms in the single layout. `assembleSinglePieces` for a 3×3 takes about 4 ms instead of 59 ms, and a three-piece cluster lays out in 2.5 ms instead of 17 ms.

The golden signatures pass unchanged after the assembly and overlap changes, and were re-baselined only for the resolution change. New tests cover the resolution steps, cache eviction by texels, `singlePieceKinds` against generated pieces for 600 option sets, the assembly's independence from colour, material and size, and the generator's queue order, yielding and aborting (`tests/generator.test.ts`). All 152 tests pass.

Gaps:

- Cluster and grid changes still block for up to about 80 ms, because one icon's generation and all of its fields are a single slice.
- The CPU backend renders synchronously inside its slice, so large CPU renders still block.
- Timings were taken with the browser pane in the background, using message-based polling and the long-task observer; timer-based polling was throttled there and is not reported.

## Superseded

The code this note describes was removed when [the project became mosaic-only](../simplification/2026-11-11-mosaic-only.md). The note is kept as history.
