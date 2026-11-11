# jigsaw — Procedural Puzzle Icon Generator

Turns a **seed** into a jigsaw-puzzle-piece icon: strict top-down view, classic tab/socket outline, one colour per piece, and a subtle soft-resin / matte-acrylic 3D look that comes from an SDF bevel and lighting.

> Geometry defines the shape, the SDF defines the bevel, shaders define the material, the seed defines the identity.

## Quick start

The only tool to install is [Bun](https://bun.sh) 1.4 or later; Node is not needed.

```bash
bun install
bun run dev        # landing page, docs and playground at http://localhost:5173
bun run test       # unit + determinism + rendering / visual regression tests
bun run typecheck
bun run check      # format check, typecheck, tests and convention gate, as CI runs them
bun run build      # production build of the site, playground included
```

## Packages

| Package | What it does |
| --- | --- |
| `@jigsaw/core` | Seeded PRNG (Mulberry32, separate `geometry` / `palette` / `color` / `layout` / `texture` streams), cubic-Bézier edge profiles, shared-edge layouts (`single`, `cluster`, `grid`), mask rasterization + exact EDT signed distance field, OKLCH palettes, material presets, render plan + reference shading. No GPU needed. |
| `@jigsaw/renderer` | WebGPU backend (`shaders/puzzle.wgsl`), WebGL2 fallback (`shaders/puzzle.frag.glsl`), CPU fallback, and the `PuzzleIconGenerator` API. One shared device, cached SDF textures. Also the pure-TS PNG encoder (with sRGB chunk, straight alpha) and WebP via the browser canvas. |
| `@jigsaw/react` | `<PuzzleIcon />` (rendered, on a canvas), `<PuzzlePictogram />` and `<PuzzleMosaic />` (inline SVG) and `useRendererBackend()`. |
| `apps/site` | The one app, bundled and served by Bun: landing page at `/`, documentation at `/docs/`, `/docs/registry/` and `/docs/api/`, the playground (Mosaic at `/playground/`, the rendered Piece at `/playground/piece/`, a card list at `/playground/cards/`) and the registry files at `/r/`. |

## Usage

```tsx
import { COLOR_SETS } from "@jigsaw/core";
import { PuzzleIcon, PuzzleMosaic } from "@jigsaw/react";

const family = COLOR_SETS.find((s) => s.id === "bright")!.families[0]!;

<PuzzleIcon seed="alpha" size={128} />                                              // rendered piece, on a canvas
<PuzzleMosaic seed="alpha" size={40} colors={family.colors} variant="accent" />     // four-piece tile, inline SVG
```

The same seed always draws the same icon. The packages are not published to npm: use them inside this workspace, or copy `PuzzleMosaic` into another project with the shadcn CLI.

| Document | What it covers |
| --- | --- |
| [Use jigsaw icons](docs/usage.md) | Choosing a form, rendering pieces, SVG icons, exporting files, rendering without a browser. |
| [API reference](docs/api.md) | Component props, `PuzzleIconOptions`, the generator, SVG functions and colour sets. |
| [PuzzleMosaic registry](docs/registry.md) | Installing `PuzzleMosaic` as source, its props and palettes, and maintaining the registry. |
| [Design spec](docs/design.md) | The geometry, distance field, shading and material model. |

The same documents are served by the site in `apps/site`, next to a landing page and the playground: `bun run dev`, then http://localhost:5173.

## How it works

1. **Geometry.** Each side gets a `PuzzleEdge` (`flat` / `tab` / `socket` with center, width, depth, neck width, asymmetry, curvature and wave, all normalized to the side). Each connector is three cubic Béziers whose control points are closed-form in the edge parameters (see `tabProfile` in `packages/core/src/geometry/edge.ts`): corner → neck, around the head, neck → corner. The handles continue each other's tangents at the two neck points, so an edge is one continuous line from corner to corner, like a die-cut puzzle: the side bows in a gentle S, dips in before the neck, and the head is near-round (default head ≈ 0.30 of the side, narrowest neck ≈ 0.17, depth 0.27); heads lean with `asymmetry`; frame (flat) sides stay straight. A socket is the tab's point reflection (u → 1 − u, v → −v, walked backwards), so a neighbour sees it as exactly the tab even though the profile is not symmetric. The narrowest neck is widened to ≥ 3 output pixels at the final scale, so outlines never pinch or self-intersect. As on a real puzzle, a corner is rounded only where both of its sides are flat (a corner of the finished puzzle's frame), with a continuous-curvature curve that leaves each side 0.15 from the corner, handles at 0.72 (a circle is 0.55); every other corner is square, so pieces close to a point where they meet, with no hole or notch. Neighbors share one `SharedEdge` and walk it in opposite directions, so they fit exactly.
2. **Layouts.** `single` pieces all use one connector derived from `tabSize`, `curvature` and `asymmetry` (no seed), and one scale per output size, so a tab on any single piece fits a socket on any other and every single icon draws its cell at the same size; each single piece is centred on its area centroid rather than its bounding box, so a knob on one side does not push the body off-centre; the seed picks which sides are tabs, sockets or flat. `single` also enforces ≥ 1 non-flat edge, ≤ 3 tabs, not all equal, aspect < 1.3. `grid` keeps pieces interlocked and forms the gap by eroding the SDF (uniform, never overlaps). `cluster` grows a compact patch, then spreads and rotates pieces, damping until no two pieces overlap.
3. **SDF.** Flatten → scanline mask → exact Felzenszwalb EDT inside and out → signed field (positive inside), refined near the outline with exact point-to-segment distances so bevel normals are smooth. 128 to 1024 texels, about one per output pixel (`recommendedSdfResolution`), cached within a memory budget.
4. **Shading** (identical in WGSL, GLSL and TS). `h = H·smoothstep(0, b, d)`, normal from central differences of the SDF in piece units (resolution independent, uniform control flow). Lambert + Blinn–Phong normalized so the flat top keeps its color, which makes top/left bevels brighter and bottom/right ones darker. Each piece has one colour, taken from the palette: pieces walk the palette from a seeded start, so the pieces of one icon differ. Named palettes are varied in OKLCH per seed; a custom colour list is used as given. Optional soft shadow from the offset SDF (off by default). SDF-based AA, dithered sRGB output, premultiplied "over" compositing.
5. **Stamp.** The letter is drawn with Canvas 2D, fitted to its ink box, thresholded and run through the same EDT, giving a second SDF centred on the piece. It adds a relief `h_s = ±height·smoothstep(0, w, d_s)` on top of the bevel, so the walls of the letter take the same light as the outline. The walls sit just inside the letter's edge, so the surface around it is untouched. Glyphs depend on the platform's fonts, so stamped pixels are not promised to match across machines. Without a canvas (Node) no stamp is drawn unless a rasterizer is set with `setGlyphRasterizer`.
6. **Backends.** WebGPU (one device, r32float SDF textures in an LRU, dynamic-offset uniforms, readback so preview == export), WebGL2 (same shader math), CPU (reference). All three agree within 1/255.

## Tests

- `tests/geometry.test.ts`: closed paths, no self-intersection, area, tab/socket direction, neck limits, shared edges match in reverse, bounds, no overlaps.
- `tests/deterministic.test.ts`: PRNG pinning, independent streams, no `Math.random`, same seed gives the same description and pixels, variety across seeds.
- `tests/rendering.test.ts`: 32–512 px × white / dark / transparent × single / cluster / grid golden signatures (`tests/golden/signatures.json`; delete it to re-baseline), bevel lighting direction, albedo preservation, no banding, AA, shadow alpha on transparent, PNG round-trip. Images land in `tests/__output__/`.

- `tests/stamp.test.ts`, `tests/texture.test.ts`, `tests/palette.test.ts`: letter stamps, surface textures and palettes.
- `tests/interlock.test.ts`, `tests/assembly.test.ts`: single pieces from different seeds fit each other and assemble into a framed puzzle with no gaps.
- `tests/generator.test.ts`, `tests/react.test.ts`: render queueing and aborts, recovery from a lost device, the image cache's memory limit, and `<PuzzleIcon>`'s server markup, accessibility defaults and pixel-ratio tracking.
- `tests/registry.test.ts`: the installable `PuzzleMosaic` against the library (designs, fills, palettes), its rendered markup, and the built registry file.
- `tests/pictogram.test.ts`: pictogram arrangements and geometry, mosaics, the piece outline, standalone SVG, and colour families.

## Determinism

Identical options produce an identical description (`GeneratorMetadata { seed, algorithmVersion, presetVersion }` is embedded). Pixels are identical per backend and machine; across GPUs they match within float precision, but per-pixel identity isn't promised. For production, prefer exported (cached) PNG/WebP assets.
