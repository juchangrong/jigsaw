# Use jigsaw icons

This guide covers the tasks of putting a jigsaw icon on a page or into a file. Props, options and methods are listed in [the API reference](api.md).

## Choose a form

One seed draws four kinds of icon. Pick by where the icon appears.

| Form | Component | Drawn as | Use it for |
|---|---|---|---|
| Rendered piece | `<PuzzleIcon>` | Canvas, through WebGPU, WebGL2 or the CPU | App icons, avatars and hero images from 32 px to 1024 px |
| Mosaic | `<PuzzleMosaic>` | Inline SVG | Lists, cards and menus from 24 px to 128 px |
| Pictogram | `<PuzzlePictogram>` | Inline SVG | Toolbars and dense lists at about 24 px |
| Outline | `<PuzzlePictogram variant="outline">` | Inline SVG | A quiet line icon beside text |

## Get the code

The packages are not published to npm. There are two ways to use them.

- **Copy `PuzzleMosaic` into your project.** The shadcn CLI installs it as one source file that depends only on React. Follow [Install](registry.md#install).
- **Work inside this repository.** `@jigsaw/core`, `@jigsaw/renderer` and `@jigsaw/react` are workspace packages that export TypeScript source. Add the one you need to a workspace package's `dependencies` as `"workspace:*"` and run `bun install`.

The rest of this guide imports from the workspace packages.

## Render a piece

<!-- preview: piece -->

```tsx
import { PuzzleIcon } from "@jigsaw/react";

<PuzzleIcon seed="alpha" size={128} />
<PuzzleIcon seed="team-42" size={64} layout="cluster" pieceCount={3} gradient={{ palette: "dusk" }} />
<PuzzleIcon seed="board" size={256} layout="grid" pieceCount={9} material={{ preset: "matteAcrylic" }} background="#FFFFFF" />
```

The same seed and options always draw the same icon, so pass something stable such as an id. Every option besides `seed` is optional; [the options](api.md#puzzleiconoptions) list them.

Icons that ask for the same `renderer` share one generator and one GPU device. Rendered images are cached, and icons that mount together are built in short slices, so a page with many icons keeps responding.

## Draw SVG icons

The SVG components need no canvas and no GPU, and their markup is complete when rendered on a server.

<!-- preview: svg -->

```tsx
import { COLOR_SETS, pictogramColor, tileColor } from "@jigsaw/core";
import { PuzzleMosaic, PuzzlePictogram } from "@jigsaw/react";

const family = COLOR_SETS.find((s) => s.id === "bright")!.families[0]!;

<PuzzleMosaic seed="alpha" size={40} colors={family.colors} variant="accent" />              // one deep piece on light ones
<PuzzleMosaic seed="alpha" size={40} colors={family.colors} />                               // one shade per piece
<PuzzlePictogram seed="alpha" size={24} color={pictogramColor(family)} />                    // flat pictogram
<PuzzlePictogram seed="alpha" size={40} color="#fff" background={tileColor(family)} />       // white on a solid tile
<PuzzlePictogram seed="alpha" size={24} variant="outline" color="#7A7A8C" />                 // the piece as a line
```

A mosaic takes four shades of one colour, deep to light. A [colour family](api.md#colour-sets) supplies them.

## Give each item in a list its own colour

Pick the family from the seed, so an item keeps its colour wherever it appears:

<!-- preview: list -->

```tsx
import { COLOR_SETS, hashString } from "@jigsaw/core";
import { PuzzleMosaic } from "@jigsaw/react";

const families = COLOR_SETS.find((s) => s.id === "bright")!.families;
const familyFor = (seed: string) => families[hashString(`${seed}:palette`) % families.length]!;

{apps.map((app) => (
  <PuzzleMosaic key={app.id} seed={app.id} size={40} colors={familyFor(app.id).colors} variant="accent" title={app.name} />
))}
```

The installable `PuzzleMosaic` makes the same pick when `palette` is left out.

## Name an icon for assistive technology

Pass `title` to any of the components. Without one the icon is hidden from assistive technology, which suits an icon that sits beside its own label.

```tsx
<PuzzleIcon seed={agent.id} size={64} title={agent.name} />
```

## Get SVG without React

`@jigsaw/core` returns standalone SVG strings:

```ts
import { COLOR_SETS, generateMosaic, generatePictogram, mosaicSvg, pieceOutline, vectorSvg } from "@jigsaw/core";

const family = COLOR_SETS.find((s) => s.id === "bright")!.families[0]!;

const mosaic = mosaicSvg(generateMosaic("alpha"), family.colors, { size: 40, variant: "accent" });
const pictogram = vectorSvg(generatePictogram("alpha"), { size: 24, color: "#607D9B" });
const outline = vectorSvg(pieceOutline({ seed: "alpha" }), { size: 24, outline: true });
```

## Export PNG or WebP files

```ts
import { PuzzleIconGenerator } from "@jigsaw/renderer";

const gen = new PuzzleIconGenerator({ renderer: "auto" });

const png = await gen.toPNG({ seed: "alpha" }, { size: 1024 });
const webp = await gen.toWebP({ seed: "alpha" }, { size: 512, transparent: true });
const blob = await gen.export({ seed: "alpha" }, { format: "png", size: 256, transparent: false });
```

Large sizes rebuild the distance field at a higher resolution, so a 1024 px export is as sharp as a 128 px preview. WebP encoding uses the browser's canvas; PNG encoding is plain TypeScript and runs anywhere.

For production, export once and serve the files. Pixels match within float precision across GPUs, but not byte for byte.

## Render without a browser

On a server or in a script, `@jigsaw/core` builds the description and the CPU renderer draws it:

```ts
import { buildRenderPlan, generatePuzzleIcon } from "@jigsaw/core";
import { encodePNG, renderPlanCpu, unpremultiply } from "@jigsaw/renderer";

const plan = buildRenderPlan(generatePuzzleIcon({ seed: "alpha", size: 256 }));
const png = await encodePNG({ width: plan.width, height: plan.height, data: unpremultiply(renderPlanCpu(plan)) });
```

A letter stamp needs a canvas to draw its glyph. Without one no stamp is drawn unless you set a rasterizer with `setGlyphRasterizer`.

## Fit single pieces into one puzzle

Single-piece icons from different seeds fit each other. `assembleSinglePieces` picks icons, from seeds derived from yours, that close into a framed puzzle and reports where each one goes:

```ts
import { assembleSinglePieces } from "@jigsaw/core";

const set = assembleSinglePieces({ seed: "team", size: 128, cols: 3, rows: 3, gradient: { palette: "dusk" } });
// for each piece: draw <PuzzleIcon seed={p.description.metadata.seed} size={128} />
// with its icon's top-left at (cell − cellOrigin) × 128 px, cell = p.cell × p.cellSize × 128 px
```
