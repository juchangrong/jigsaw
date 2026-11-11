# API reference

The exports of `@jigsaw/react`, `@jigsaw/renderer` and `@jigsaw/core` that draw icons. The installable `PuzzleMosaic` has its own props, listed in [the registry reference](registry.md#reference).

## Components

All three are exported from `@jigsaw/react`.

### PuzzleIcon

Renders a piece on a `<canvas>` at `size × devicePixelRatio`. It accepts every field of [`PuzzleIconOptions`](#puzzleiconoptions) as a prop, and these:

| Prop | Type | Default | Effect |
|---|---|---|---|
| `seed` | `string \| number` | required | Selects the icon. |
| `size` | `number` | `128` | Width and height in CSS px. |
| `renderer` | `"auto" \| "webgpu" \| "webgl2" \| "cpu"` | `"auto"` | Backend to try first. `auto` tries WebGPU, then WebGL2, then the CPU. |
| `title` | `string` | none | Accessible name. Without one the canvas is `aria-hidden`. |
| `className`, `style` | | | Passed to the `<canvas>`. |
| `onRender` | `(result: RenderResult) => void` | none | Called after each draw with the backend, the time taken and the image. |
| `onError` | `(error: Error) => void` | none | Called when a render fails. |

On a server the canvas is emitted at a pixel ratio of 1 and corrected after hydration. If the GPU device or WebGL context is lost, the next render starts a new backend.

`useRendererBackend(renderer?)` returns the backend the shared generator ended up with: `"webgpu"`, `"webgl2"`, `"cpu"`, or `null` until it is known.

### PuzzleMosaic

Renders a tile cut into four pieces as one inline `<svg>`.

| Prop | Type | Default | Effect |
|---|---|---|---|
| `seed` | `string \| number` | required | Selects one of 8 tone layouts and 16 knob layouts. |
| `colors` | `readonly string[]` | required | Four shades of one colour, deep to light. |
| `size` | `number` | `24` | Width and height in CSS px. |
| `variant` | `"tonal" \| "accent"` | `"tonal"` | `tonal`: one shade per piece. `accent`: one deep piece on light ones. |
| `shape` | `"squircle" \| "round"` | `"squircle"` | The tile's outline. |
| `radius` | `number` | `0.25` | Corner radius of a `round` tile, as a fraction of its side. |
| `gap` | `number` | `0.022` | Width of the cuts between pieces, as a fraction of the tile. `0` joins the pieces. |
| `edge` | `boolean` | `true` | A hairline around the pieces, so light ones hold on a light page. |
| `title` | `string` | none | Accessible name. Without one the icon is `aria-hidden`. |
| `className`, `style` | | | Passed to the `<svg>`. |

### PuzzlePictogram

Renders one piece as one inline `<svg>`.

| Prop | Type | Default | Effect |
|---|---|---|---|
| `seed` | `string \| number` | required | Selects one of the 30 side arrangements that read as a puzzle piece at about 24 px. |
| `size` | `number` | `24` | Width and height in CSS px. |
| `variant` | `"filled" \| "outline"` | `"filled"` | `filled`: the geometric pictogram. `outline`: the realistic piece drawn as a line. |
| `color` | `string` | `currentColor` | Fill, or the line colour of an outline. |
| `strokeWidth` | `number` | `1.1` | Line width in px for `outline`. |
| `background` | `string` | none | Fills a rounded tile behind the shape. |
| `radius` | `number` | `0.25` | Tile corner radius, as a fraction of its side. |
| `scale` | `number` | `0.8` with a background, else `1` | Shape size relative to the tile. |
| `title` | `string` | none | Accessible name. Without one the icon is `aria-hidden`. |
| `className`, `style` | | | Passed to the `<svg>`. |

## PuzzleIconOptions

The options of a rendered piece, from `@jigsaw/core`. Only `seed` is required.

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

## PuzzleIconGenerator

The renderer behind `<PuzzleIcon>`, from `@jigsaw/renderer`. One generator owns one backend and its caches; reuse it for every icon.

```ts
const gen = new PuzzleIconGenerator({ renderer: "auto", imageCacheSize: 128, imageCacheBytes: 64 * 1024 * 1024 });
```

| Method | Returns | Notes |
|---|---|---|
| `generate(options)` | `PuzzleIconDescription` | The deterministic description: geometry, transforms, palette, spots and material. Uses no GPU. |
| `render(options, { size?, transparent?, signal? })` | `Promise<RenderResult>` | Renders queue in call order. Aborting `signal` skips one that has not started and rejects with an `AbortError`. |
| `toPNG(options, { size?, transparent? })` | `Promise<Blob>` | |
| `toWebP(options, { size?, transparent?, quality? })` | `Promise<Blob>` | Needs a browser canvas. |
| `export(options, { format?, size?, transparent?, quality? })` | `Promise<Blob>` | `format` is `"png"` or `"webp"`. |
| `backend()` | `Promise<RenderBackend>` | Its `kind` is `"webgpu"`, `"webgl2"` or `"cpu"`. |
| `dispose()` | `Promise<void>` | Releases the backend. |

`RenderResult` holds `image` (`{ width, height, data }`, straight-alpha sRGB RGBA), `backend`, `description`, `ms` (time spent on this icon, not counting time queued) and `cached`.

`getSharedGenerator({ renderer? })` returns the generator that `<PuzzleIcon>` uses for that renderer.

## SVG functions

From `@jigsaw/core`. None of them needs a DOM.

| Function | Returns |
|---|---|
| `generateMosaic(seed)` | The mosaic design for a seed. |
| `mosaicSvg(mosaic, colors, { size?, variant?, shape?, radius?, gap?, edge?, title? })` | A standalone SVG string. |
| `mosaicDrawing(mosaic, colors, style?)` | The outline, fills, seams and cut widths, for drawing a mosaic yourself. |
| `generatePictogram(seed)` | The pictogram shape for a seed. |
| `pieceOutline(options)` | The realistic single piece's outline as a shape. Takes `PuzzleIconOptions`. |
| `vectorSvg(shape, { size?, color?, outline?, strokeWidth?, background?, radius?, scale?, title? })` | A standalone SVG string for a pictogram or an outline. |

## Colour sets

`COLOR_SETS` from `@jigsaw/core` holds nine sets. Each set has an `id`, a `label` and up to five `families`; a family has an `id` and four hex `colors`, deep to light. A family's `colors` also work as a `gradient.palette` for `<PuzzleIcon>`.

| Set `id` | Families | Character |
|---|---|---|
| `studio` | slate, plum, clay, sage | Restrained |
| `aluminum` | graphite, silver, champagne, navy, sky | Restrained, metallic |
| `titanium` | dark, natural, white, blue, desert | Restrained, metallic |
| `desktop` | blue, green, pink, orange, purple | Restrained |
| `mono` | gray | Neutral |
| `system` | blue, indigo, teal, orange, pink | Restrained |
| `bright` | blue, coral, orange, green, purple | Bright, made for mosaics |
| `candy` | pink, yellow, teal, sky, caramel | Bright and sweet, made for mosaics |
| `ink` | coral, orange, blue, green, purple | Bright; every family's deepest shade is one navy |

| Function | Returns |
|---|---|
| `pictogramColor(family)` | A shade for a flat pictogram on a light page. |
| `tileColor(family)` | A deeper shade for a solid tile under a white pictogram. |
| `tintColor(family)` | A light tint for the tile behind an icon. |

## Determinism

Identical options produce an identical description, which embeds `{ seed, algorithmVersion, presetVersion }`. Pixels are identical per backend and machine. Across GPUs they match within float precision, and the three backends agree within 1/255. Letter stamps depend on the platform's fonts, so stamped pixels can differ between machines.
