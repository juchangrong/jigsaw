# jigsaw — Procedural Puzzle Icon Generator

Turns a **seed** into a jigsaw-puzzle-piece icon: strict top-down view, classic tab/socket outline, soft multi-color diffuse gradient, and a subtle soft-resin / matte-acrylic 3D look that comes from an SDF bevel and lighting.

> Geometry defines the shape, the SDF defines the bevel, shaders define the material, the seed defines the identity.

Design spec: [docs/design.md](docs/design.md).

## Quick start

```bash
pnpm install
pnpm dev        # playground at http://localhost:5173
pnpm test       # unit + determinism + rendering / visual regression tests
pnpm typecheck
pnpm lint       # ESLint
pnpm check      # lint, format check, typecheck, tests and convention gate, as CI runs them
pnpm build      # production build of the playground
```

## Packages

| Package | What it does |
| --- | --- |
| `@jigsaw/core` | Seeded PRNG (Mulberry32, separate `geometry` / `palette` / `gradient` / `layout` / `texture` streams), cubic-Bézier edge profiles, shared-edge layouts (`single`, `cluster`, `grid`), mask rasterization + exact EDT signed distance field, OKLCH palettes, Gaussian-spot gradients, material presets, render plan + reference shading. No GPU needed. |
| `@jigsaw/renderer` | WebGPU backend (`shaders/puzzle.wgsl`), WebGL2 fallback (`shaders/puzzle.frag.glsl`), CPU fallback, and the `PuzzleIconGenerator` API. One shared device, cached SDF textures. |
| `@jigsaw/export` | Pure-TS PNG encoder (with sRGB chunk, straight alpha) and WebP via the browser canvas. |
| `@jigsaw/react` | `<PuzzleIcon />` (rendered, on a canvas), `<PuzzlePictogram />` and `<PuzzleMosaic />` (inline SVG) and `useRendererBackend()`. |
| `apps/playground` | Vite + React playground. |

## Usage

### React

```tsx
import { PuzzleIcon } from "@jigsaw/react";

<PuzzleIcon seed="alpha" size={128} />
<PuzzleIcon seed="team-42" size={64} layout="cluster" pieceCount={3} gradient={{ palette: "dusk" }} />
<PuzzleIcon seed="board" size={256} layout="grid" pieceCount={9} material={{ preset: "matteAcrylic" }} background="#FFFFFF" />
```

`<PuzzleIcon>`s that ask for the same `renderer` share one generator (one GPU device). Rendered images are cached within a count and a memory limit, and the canvas is rendered at `size × devicePixelRatio`, again when that ratio changes. Icons that mount together are built in short slices, so the page keeps painting and responding, and an icon that changes or unmounts while it is queued is skipped.

Pass `title` to give an icon an accessible name; without one it is hidden from assistive technology, like the SVG components. On a server the canvas is emitted at a pixel ratio of 1 and corrected after hydration. If the GPU device or WebGL context is lost, the next render starts a new backend, so icons keep rendering without a reload.

### Pictograms, mosaics and outlines (SVG)

For lists, menus and other small or repeated uses, draw the piece as inline SVG instead: no canvas and no GPU.

```tsx
import { COLOR_SETS, pictogramColor, tileColor } from "@jigsaw/core";
import { PuzzleMosaic, PuzzlePictogram } from "@jigsaw/react";

const family = COLOR_SETS.find((s) => s.id === "studio")!.families[0]!;

<PuzzlePictogram seed="alpha" size={24} color={pictogramColor(family)} />                        // flat pictogram
<PuzzlePictogram seed="alpha" size={40} color="#fff" background={tileColor(family)} />           // white on a solid tile
<PuzzlePictogram seed="alpha" size={24} variant="outline" color="#7A7A8C" title="Alpha" />       // the realistic piece as a line
<PuzzleMosaic seed="alpha" size={40} colors={family.colors} />                                   // a tile cut into four pieces
<PuzzleMosaic seed="alpha" size={40} colors={family.colors} variant="accent" />                  // one deep piece on light ones
```

The pictogram reduces the piece to a sign built on one grid: a unit square whose corners, knobs and notches are all arcs of one radius, with a smaller arc easing each knob and notch into its side, in one flat colour. Seeds draw from the 30 side arrangements that still read as a puzzle piece at about 24 px. `variant="outline"` strokes the realistic piece's own Bézier outline. Without React, `vectorSvg(generatePictogram(seed), { size, color, background })` and `vectorSvg(pieceOutline({ seed }), { outline: true })` return standalone SVG strings.

A mosaic makes the tile itself the puzzle: four pieces, each a shade of one colour family, with the two deep shades on one diagonal so every seam has contrast. A seed picks one of 8 tone layouts and 16 knob layouts. The pieces are separated by thin transparent cuts with rounded corners, inside a squircle outline, so a mosaic sits on any background; `gap={0}`, `shape="round"` and `edge={false}` turn each of those off. `mosaicSvg(generateMosaic(seed), family.colors, { size, variant })` returns it as a standalone SVG string, and `mosaicDrawing` returns the parts for drawing it yourself.

`COLOR_SETS` holds nine sets of at most five colour families: six restrained ones (Studio, Aluminum, Titanium, Desktop, Mono, System) and three bright ones made for mosaics (Bright, Candy, and Ink, where every family's deepest shade is one navy); a family's `colors` also work as a gradient palette for `<PuzzleIcon>`.

### Install as source (shadcn registry)

`PuzzleMosaic` can also be copied into a project as one self-contained source file with the shadcn CLI, with no dependency on these packages:

```sh
npx shadcn@latest add /path/to/jigsaw/public/r/puzzle-mosaic.json
```

```tsx
import { PuzzleMosaic } from "@/components/puzzle-mosaic";

<PuzzleMosaic seed={app.id} title={app.name} />
```

See [Install PuzzleMosaic as source](docs/registry.md) and the [PuzzleMosaic reference](docs/puzzle-mosaic.md).

### Core API

```ts
import { PuzzleIconGenerator } from "@jigsaw/renderer";

const gen = new PuzzleIconGenerator({ renderer: "webgpu" }); // or "webgl2" | "cpu" | "auto"
// also: imageCacheSize (default 128 images) and imageCacheBytes (default 64 MB) bound the rendered-image cache

// Deterministic description: geometry, transforms, palette, spots, material. No GPU.
const description = gen.generate({ seed: "alpha", size: 128 });

// Render (falls back WebGPU → WebGL2 → CPU if the adapter/device is unavailable)
const { image, backend, ms } = await gen.render({ seed: "alpha", size: 128 });
// image: { width, height, data: Uint8ClampedArray } (straight-alpha sRGB RGBA)
// ms: time spent on this icon, not counting time queued behind others

// Renders queue in call order. Abort one that is still queued and it is skipped (rejects with an AbortError).
const abort = new AbortController();
gen.render({ seed: "beta", size: 128 }, { signal: abort.signal }).catch(() => {});
abort.abort();

// Export — large sizes regenerate the SDF at higher resolution
const png = await gen.toPNG({ seed: "alpha", size: 128 }, { size: 1024 });
const webp = await gen.toWebP({ seed: "alpha", size: 128 }, { size: 512, transparent: true });
const blob = await gen.export({ seed: "alpha" }, { format: "png", size: 256, transparent: false });
```

Without any renderer at all (e.g. on a server), `@jigsaw/core` gives you the description, and `renderPlanCpu(buildRenderPlan(description))` the pixels:

```ts
import { buildRenderPlan, generatePuzzleIcon } from "@jigsaw/core";
import { renderPlanCpu } from "@jigsaw/renderer";
import { encodePNG, unpremultiply } from "@jigsaw/export";

const plan = buildRenderPlan(generatePuzzleIcon({ seed: "alpha", size: 256 }));
const png = await encodePNG({ width: plan.width, height: plan.height, data: unpremultiply(renderPlanCpu(plan)) });
```

Single-piece icons fit each other. `assembleSinglePieces` picks icons, from seeds derived from yours, that close into a framed `cols × rows` puzzle (flat outside, tab against socket inside) and tells you where each one goes:

```ts
import { assembleSinglePieces } from "@jigsaw/core";

const set = assembleSinglePieces({ seed: "team", size: 128, cols: 3, rows: 3, gradient: { palette: "dusk" } });
// for each piece: draw <PuzzleIcon seed={p.description.metadata.seed} size={128} />
// with its icon's top-left at (cell − cellOrigin) × 128 px, cell = p.cell × p.cellSize × 128 px
```

The search reads only each seed's side kinds (`singlePieceKinds`) and generates just the chosen icons, so it takes a few milliseconds. The playground's Assembly section does exactly this with real `<PuzzleIcon>`s, and can scatter and reassemble the pieces.

### Options

```ts
interface PuzzleIconOptions {
  seed: string | number;
  size?: number;                       // px, default 128
  layout?: "single" | "cluster" | "grid";
  pieceCount?: number;                 // cluster 2–5, grid 4 (2×2) or 9 (3×3)
  geometry?: {
    tabSize?: number;                  // 0–1, bias within width/depth ranges
    curvature?: number;                // 0–1 → 0.5–0.9
    asymmetry?: number;                // 0–1 → up to ±0.08 (single pieces share one lean: 0.6 × that)
    separation?: number;               // gap between pieces (piece units)
    rotation?: number;                 // max degrees, cluster only
  };
  gradient?: { palette?: PaletteName | string[]; spots?: 3 | 4 | 5; softness?: number };
  // vivid (picked by seeds): dusk, tide, ember, orchid, meadow, glacier, bloom
  // muted (by name only): slate, sage, clay, plum, fog, moss
  // pastel (by name only): aurora, sunset, mint, candy, lagoon, peach
  material?: {
    preset?: "softResin" | "matteAcrylic" | "satinResin";
    bevelWidth?; bevelStrength?; roughness?; specularIntensity?; ambientOcclusion?; thickness?;
    texture?: "none" | "paper" | "linen" | "frosted" | "wood" | "brushedMetal" | "polishedMetal"; // default none
    textureStrength?: number;          // 0–1 bump and albedo variation (default 0.6)
    textureScale?: number;             // grain size, 0.25–4 (default 1, larger = coarser)
  };
  lighting?: { direction?: [x, y, z]; intensity?; ambient?; specular? }; // default [-0.5,-0.6,1], 0.85, 0.65, 0.28
  shadow?: { enabled?; opacity?; blur?; offset?: [x, y]; color? };      // off by default; when enabled 0.12, 0.04, [0.01, 0.025]
  stamp?: {                            // letter stamp, off by default
    text?: string;                     // character i goes on piece i, e.g. "R" or "ABC"
    style?: "deboss" | "emboss";       // pressed in (default) or raised
    size?: number;                     // glyph height, piece units (0.15–0.7, default 0.3)
    depth?: number;                    // 0–1 relief (default 0.5)
    ink?: number;                      // 0–1 darkening inside the letter (default 0.25)
    font?: string; weight?: number;    // CSS font family, 100–900 (default system sans, 700)
  };
  background?: string | "transparent";
}
```

## How it works

1. **Geometry.** Each side gets a `PuzzleEdge` (`flat` / `tab` / `socket` with center, width, depth, neck width, asymmetry, curvature and wave, all normalized to the side). Each connector is three cubic Béziers whose control points are closed-form in the edge parameters (see `tabProfile` in `packages/core/src/geometry/edge.ts`): corner → neck, around the head, neck → corner. The handles continue each other's tangents at the two neck points, so an edge is one continuous line from corner to corner, like a die-cut puzzle: the side bows in a gentle S, dips in before the neck, and the head is near-round (default head ≈ 0.30 of the side, narrowest neck ≈ 0.17, depth 0.27); heads lean with `asymmetry`; frame (flat) sides stay straight. A socket is the tab's point reflection (u → 1 − u, v → −v, walked backwards), so a neighbour sees it as exactly the tab even though the profile is not symmetric. The narrowest neck is widened to ≥ 3 output pixels at the final scale, so outlines never pinch or self-intersect. As on a real puzzle, a corner is rounded only where both of its sides are flat (a corner of the finished puzzle's frame), with a continuous-curvature curve that leaves each side 0.15 from the corner, handles at 0.72 (a circle is 0.55); every other corner is square, so pieces close to a point where they meet, with no hole or notch. Neighbors share one `SharedEdge` and walk it in opposite directions, so they fit exactly.
2. **Layouts.** `single` pieces all use one connector derived from `tabSize`, `curvature` and `asymmetry` (no seed), and one scale per output size, so a tab on any single piece fits a socket on any other and every single icon draws its cell at the same size; each single piece is centred on its area centroid rather than its bounding box, so a knob on one side does not push the body off-centre; the seed picks which sides are tabs, sockets or flat. `single` also enforces ≥ 1 non-flat edge, ≤ 3 tabs, not all equal, aspect < 1.3. `grid` keeps pieces interlocked and forms the gap by eroding the SDF (uniform, never overlaps). `cluster` grows a compact patch, then spreads and rotates pieces, damping until no two pieces overlap.
3. **SDF.** Flatten → scanline mask → exact Felzenszwalb EDT inside and out → signed field (positive inside), refined near the outline with exact point-to-segment distances so bevel normals are smooth. 128 to 1024 texels, about one per output pixel (`recommendedSdfResolution`), cached within a memory budget.
4. **Shading** (identical in WGSL, GLSL and TS). `h = H·smoothstep(0, b, d)`, normal from central differences of the SDF in piece units (resolution independent, uniform control flow). Lambert + Blinn–Phong normalized so the flat top keeps its color, which makes top/left bevels brighter and bottom/right ones darker. Gradient = normalized Gaussian spots + base color in linear RGB; palettes are varied in OKLCH. Spots are ranked along a seeded light-flow direction (top-left to bottom-right) and paired with palette colors by lightness, so lighter colors sit toward the light; a few neighbouring ranks swap so a second hue crosses the flow. Optional soft shadow from the offset SDF (off by default). SDF-based AA, dithered sRGB output, premultiplied "over" compositing.
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
