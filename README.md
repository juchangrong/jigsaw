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
pnpm build      # production build of the playground
```

## Packages

| Package | What it does |
| --- | --- |
| `@jigsaw/core` | Seeded PRNG (Mulberry32, separate `geometry` / `palette` / `gradient` / `layout` streams), cubic-Bézier edge profiles, shared-edge layouts (`single`, `cluster`, `grid`), mask rasterization + exact EDT signed distance field, OKLCH palettes, Gaussian-spot gradients, material presets, render plan + reference shading. No GPU needed. |
| `@jigsaw/renderer` | WebGPU backend (`shaders/puzzle.wgsl`), WebGL2 fallback (`shaders/puzzle.frag.glsl`), CPU fallback, and the `PuzzleIconGenerator` API. One shared device, cached SDF textures. |
| `@jigsaw/export` | Pure-TS PNG encoder (with sRGB chunk, straight alpha) and WebP via the browser canvas. |
| `@jigsaw/react` | `<PuzzleIcon />` component and `useRendererBackend()`. |
| `apps/playground` | Vite + React playground. |

## Usage

### React

```tsx
import { PuzzleIcon } from "@jigsaw/react";

<PuzzleIcon seed="alpha" size={128} />
<PuzzleIcon seed="team-42" size={64} layout="cluster" pieceCount={3} gradient={{ palette: "sunset" }} />
<PuzzleIcon seed="board" size={256} layout="grid" pieceCount={9} material={{ preset: "matteAcrylic" }} background="#FFFFFF" />
```

All `<PuzzleIcon>`s share one generator (one GPU device). Rendered images are cached, and the canvas is rendered at `size × devicePixelRatio`.

### Core API

```ts
import { PuzzleIconGenerator } from "@jigsaw/renderer";

const gen = new PuzzleIconGenerator({ renderer: "webgpu" }); // or "webgl2" | "cpu" | "auto"

// Deterministic description: geometry, transforms, palette, spots, material. No GPU.
const description = gen.generate({ seed: "alpha", size: 128 });

// Render (falls back WebGPU → WebGL2 → CPU if the adapter/device is unavailable)
const { image, backend, ms } = await gen.render({ seed: "alpha", size: 128 });
// image: { width, height, data: Uint8ClampedArray } (straight-alpha sRGB RGBA)

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
    asymmetry?: number;                // 0–1 → up to ±0.08
    separation?: number;               // gap between pieces (piece units)
    rotation?: number;                 // max degrees, cluster only
  };
  gradient?: { palette?: "aurora" | "sunset" | "mint" | "candy" | "lagoon" | "peach" | string[]; spots?: 3 | 4 | 5; softness?: number };
  material?: { preset?: "softResin" | "matteAcrylic" | "satinResin"; bevelWidth?; bevelStrength?; roughness?; specularIntensity?; ambientOcclusion?; thickness? };
  lighting?: { direction?: [x, y, z]; intensity?; ambient?; specular? }; // default [-0.5,-0.6,1], 0.85, 0.65, 0.28
  shadow?: { enabled?; opacity?; blur?; offset?: [x, y]; color? };      // off by default; when enabled 0.12, 0.04, [0.01, 0.025]
  stamp?: {                            // letter stamp, off by default
    text?: string;                     // character i goes on piece i, e.g. "R" or "ABC"
    style?: "deboss" | "emboss";       // pressed in (default) or raised
    size?: number;                     // glyph height, piece units (0.15–0.7, default 0.42)
    depth?: number;                    // 0–1 relief (default 0.5)
    ink?: number;                      // 0–1 darkening inside the letter (default 0.25)
    font?: string; weight?: number;    // CSS font family, 100–900 (default system sans, 700)
  };
  background?: string | "transparent";
}
```

## How it works

1. **Geometry.** Each side gets a `PuzzleEdge` (`flat` / `tab` / `socket` with center, width, depth, neck width, asymmetry, curvature, all normalized to the side). Profiles are 8 cubic Béziers; head ≥ neck + 0.07 and the neck is widened to ≥ 3 output pixels, so outlines never pinch or self-intersect. Outer corners use a continuous-curvature curve that leaves each side 0.15 from the corner, with handles at 0.72 (a circle is 0.55), so they read as soft squircle corners; where interlocked grid pieces meet, corners stay tight so no holes open between them. The fillet where a tab's neck leaves the side is 0.075 wide. Neighbors share one `SharedEdge` and walk it in opposite directions, so they fit exactly.
2. **Layouts.** `single` enforces ≥ 1 non-flat edge, ≤ 3 tabs, not all equal, aspect < 1.3. `grid` keeps pieces interlocked and forms the gap by eroding the SDF (uniform, never overlaps). `cluster` grows a compact patch, then spreads and rotates pieces, damping until no two pieces overlap.
3. **SDF.** Flatten → scanline mask → exact Felzenszwalb EDT inside and out → signed field (positive inside), refined near the outline with exact point-to-segment distances so bevel normals are smooth. 256 / 512 / 1024 texels chosen from the output size, and cached.
4. **Shading** (identical in WGSL, GLSL and TS). `h = H·smoothstep(0, b, d)`, normal from central differences of the SDF in piece units (resolution independent, uniform control flow). Lambert + Blinn–Phong normalized so the flat top keeps its color, which makes top/left bevels brighter and bottom/right ones darker. Gradient = normalized Gaussian spots + base color in linear RGB; palettes are varied in OKLCH. Optional soft shadow from the offset SDF (off by default). SDF-based AA, dithered sRGB output, premultiplied "over" compositing.
5. **Stamp.** The letter is drawn with Canvas 2D, fitted to its ink box, thresholded and run through the same EDT, giving a second SDF centred on the piece. It adds a relief `h_s = ±height·smoothstep(0, w, d_s)` on top of the bevel, so the walls of the letter take the same light as the outline. The walls sit just inside the letter's edge, so the surface around it is untouched. Glyphs depend on the platform's fonts, so stamped pixels are not promised to match across machines. Without a canvas (Node) no stamp is drawn unless a rasterizer is set with `setGlyphRasterizer`.
6. **Backends.** WebGPU (one device, r32float SDF textures in an LRU, dynamic-offset uniforms, readback so preview == export), WebGL2 (same shader math), CPU (reference). All three agree within 1/255.

## Tests

- `tests/geometry.test.ts`: closed paths, no self-intersection, area, tab/socket direction, neck limits, shared edges match in reverse, bounds, no overlaps.
- `tests/deterministic.test.ts`: PRNG pinning, independent streams, no `Math.random`, same seed gives the same description and pixels, variety across seeds.
- `tests/rendering.test.ts`: 32–512 px × white / dark / transparent × single / cluster / grid golden signatures (`tests/golden/signatures.json`; delete it to re-baseline), bevel lighting direction, albedo preservation, no banding, AA, shadow alpha on transparent, PNG round-trip. Images land in `tests/__output__/`.

## Determinism

Identical options produce an identical description (`GeneratorMetadata { seed, algorithmVersion, presetVersion }` is embedded). Pixels are identical per backend and machine; across GPUs they match within float precision, but per-pixel identity isn't promised. For production, prefer exported (cached) PNG/WebP assets.
