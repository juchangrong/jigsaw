# Agent Note: Renderer and PuzzleIcon runtime fixes

Status: implemented

## Problem

A review of the renderer and the React component found five defects, all by reading the code.

A lost GPU device or WebGL context was never noticed. `PuzzleIconGenerator` kept its backend promise for good, so after a loss every WebGPU render rejected until the page was reloaded. A lost WebGL2 context was worse: it draws nothing and reads back zeros without an error, so blank images were returned and cached.

`getSharedGenerator` kept a single generator and disposed it whenever a different `renderer` was requested. Two `<PuzzleIcon>`s with different `renderer` props on one page disposed each other's backend, failing renders that were in flight.

`<PuzzleIcon>` read `window.devicePixelRatio` while rendering. Server markup used a ratio of 1 and the first client render used the device's, so the canvas `width` and `height` mismatched on hydration. The ratio was also read once, so a window moved to another display kept a canvas at the old resolution. The module had no `"use client"` directive.

The rendered-image cache was limited to 128 entries of any size. Each entry holds the image twice, straight and premultiplied, so 128 exports at 1024 px would hold about 1 GB.

`<PuzzleIcon>` without a `title` announced itself as "Puzzle icon <seed>", while `<PuzzlePictogram>` and `<PuzzleMosaic>` without one are hidden from assistive technology. A list of decorative icons was read out one by one.

## Decision

`RenderBackend` gains `lost`, a promise that resolves with a reason when the device or context is lost for any cause other than `dispose`. The WebGPU backend resolves it from `device.lost`; the WebGL2 backend from the `webglcontextlost` event, and from `isContextLost()` after reading pixels, where it also throws instead of returning zeros. The generator drops a lost backend, so the next render creates a new one through the same WebGPU, WebGL2, CPU fallback as at startup. A render that fails is retried once on the new backend if its backend was lost; the generator waits one task before deciding, because the loss is reported in its own task. `GeneratorConfig.createBackend` replaces the backend factory, for a custom backend or a test.

`getSharedGenerator` keeps one generator per renderer preference and never disposes one. With no renderer it returns the `auto` generator.

`<PuzzleIcon>` reads the pixel ratio through `useSyncExternalStore`, with a server snapshot of 1 and a subscription to a `resolution` media query that is replaced after each change. `packages/react/src/index.tsx` starts with `"use client"`.

The image cache keeps its count limit and adds a byte limit, `imageCacheBytes`, 64 MB by default. `LruMap` takes an optional weight function and maximum weight; a value heavier than the whole limit is not kept.

`<PuzzleIcon>` without a `title` is `aria-hidden` with no role. With one it is `role="img"` with that label. The playground gives its main preview a title.

## Alternatives considered

**A typed `BackendLostError` thrown by `render`, with no `lost` promise.** The generator would retry on that error alone. It lost because a device lost while idle would then be found only by a failed render, and because WebGPU has no synchronous way to ask whether the device is lost when `mapAsync` rejects.

**Restoring the WebGL context on `webglcontextrestored`.** This reuses the canvas. It lost because every texture and the program must be rebuilt either way, WebGPU has no equivalent, and creating a new backend covers both with one path.

**Keeping one shared generator and waiting for in-flight renders before disposing it.** This keeps a single GPU device. It lost because two icons with different renderers would still take turns creating and destroying devices on every render.

**Reading the pixel ratio in an effect and storing it in state.** It lost because it renders every icon twice on the client, and `useSyncExternalStore` gives the same hydration behaviour with the change subscription included.

**Dropping the straight-alpha copy from the image cache to halve it.** It lost because `RenderResult` exposes both arrays and a cache hit returns the same arrays as the first render, which a test relies on.

## Consequences

Icons keep rendering after a device or context loss. This was checked in the browser by destroying the WebGPU device and losing the WebGL2 context, both while idle and during a render; each time the next image was non-blank and came from a new backend. Canvases that were already drawn are 2D canvases and are not affected by a loss. `useRendererBackend` reports the backend chosen when it first resolved and does not update after a loss.

A page that uses several renderer preferences holds one generator, and one device or context, per preference for its lifetime. `auto` and `webgpu` are separate generators even when both run on WebGPU.

Code that relied on `getSharedGenerator()` with no argument returning the most recently requested renderer now gets the `auto` generator.

A `<PuzzleIcon>` without a `title` is no longer exposed to assistive technology. Callers that relied on the default label must pass `title`.

The hydration fix is covered by server-markup tests only; no test hydrates in a DOM. The pixel-ratio subscription is tested against a fake `matchMedia`, not a real display change. Every `<PuzzleIcon>` holds its own media-query listener.

## Superseded

The code this note describes was removed when [the project became mosaic-only](../simplification/2026-11-11-mosaic-only.md). The note is kept as history.
