# PuzzleMosaic registry

`PuzzleMosaic` is part of the `jigsaw` registry, which works the way shadcn/ui does: the shadcn CLI copies one source file into your project, and from then on the file is yours to edit. Nothing is published to npm, and installing adds no package to your project. It needs React 18 or later and nothing else: no package from this repository, no Tailwind, no canvas.

This page has three parts: [install the component](#install), [its props and palettes](#reference), and [maintain the registry](#maintain-the-registry).

## Install

### Before you start

Your project needs a `components.json`, which `npx shadcn@latest init` creates. The CLI writes the file to the `components` alias set there, for example `src/components/puzzle-mosaic.tsx`.

The built registry files are served by the project's site at `https://juchangrong.github.io/jigsaw/r/`.

### Install from the site

Run this in your project:

```sh
npx shadcn@latest add https://juchangrong.github.io/jigsaw/r/puzzle-mosaic.json
```

The CLI reports the file it created:

```text
✔ Created 1 file:
  - src/components/puzzle-mosaic.tsx
```

To install by name, add the registry to your `components.json`:

```json
{
  "registries": {
    "@jigsaw": "https://juchangrong.github.io/jigsaw/r/{name}.json"
  }
}
```

```sh
npx shadcn@latest add @jigsaw/puzzle-mosaic
```

### Use it

<!-- preview: registry -->

```tsx
import { PuzzleMosaic } from "@/components/puzzle-mosaic";

<PuzzleMosaic seed={app.id} title={app.name} />
```

The same seed always draws the same icon, so pass something stable such as an id. Nothing has to be stored.

### Update it

Run the same `add` command with `--overwrite`. It replaces the file, so move any edits you made into the new version afterwards; `--diff` shows what would change first.

## Reference

The component is `registry/jigsaw/puzzle-mosaic.tsx`.

It renders one inline `<svg>`. It uses no hook other than `useId`, so it works in a React Server Component.

### Props

| Prop | Type | Default | Effect |
|---|---|---|---|
| `seed` | `string \| number` | required | Selects the design: one of 8 tone layouts and 16 knob layouts. The same seed always gives the same icon. |
| `palette` | palette name, or four hex shades from deep to light | chosen from the seed | The colour. Left out, the seed picks one of `DEFAULT_MOSAIC_PALETTES`. |
| `variant` | `"accent" \| "tonal"` | `"accent"` | `accent`: one deep piece, the rest light. `tonal`: one shade per piece. |
| `size` | `number` | `40` | Width and height in px. |
| `gaps` | `boolean` | `true` | Thin transparent cuts between the four pieces. |
| `padding` | `boolean` | `false` | Sets the icon at 75% inside a rounded tile with a one-pixel edge. |
| `tile` | CSS colour | `"#ffffff"` | Fill of that tile, for example `var(--card)`. Used only with `padding`. |
| `title` | `string` | none | Accessible name. Without one the icon is `aria-hidden`. |

Any other SVG attribute, such as `className` or `style`, is passed to the `<svg>`.

### Palettes

`MOSAIC_PALETTES` holds eleven palettes of four shades each.

| Names | Character |
|---|---|
| `blue`, `coral`, `orange`, `green`, `purple` | Bright. These five are `DEFAULT_MOSAIC_PALETTES`. |
| `pink`, `yellow`, `teal`, `sky`, `caramel` | Softer and sweeter. |
| `gray` | Neutral. |

### Other exports

| Export | Purpose |
|---|---|
| `DEFAULT_MOSAIC_PALETTES` | The palette names a seed chooses from. Edit the list to change the mix of colours in a list. |
| `mosaicPaletteFor(seed)` | The shades a seed uses when no palette is given. |
| `generateMosaic(seed)` | The design for a seed: tones, layers and seams as SVG path data. |
| `mosaicFills(mosaic, shades, variant)` | The fill of each of the four cells. |

### Limits

- The cuts use an SVG mask. Browsers support it; a few other SVG rasterizers do not. `gaps={false}` avoids it.
- At 40 px on a 1× display a cut is under one pixel wide and looks soft. It is crisp from about 48 px, or on a 2× display.
- With `gaps={false}` and `variant="accent"`, the light pieces differ by half a shade, so the seams between them are faint.
- The component adds no shadow. Add one with `className` or `style` if the design calls for it.

## Maintain the registry

The registry is named `jigsaw` and follows the shadcn format: `registry.json` lists the items, `registry/jigsaw/` holds their source, and `bun run registry:build` writes the files the CLI installs to `public/r/`. Commit `public/r/`; it is what consumers fetch.

### Change PuzzleMosaic

`registry/jigsaw/puzzle-mosaic.tsx` is a self-contained copy of the mosaic in `packages/core/src/mosaic.ts`, and `tests/registry.test.ts` holds the two to the same output. When the design changes, change both.

1. Edit the library and the registry file together.
2. Rebuild the installable file:

   ```sh
   bun run registry:build
   ```

3. Run the tests. They fail if the copy and the library draw different icons, if a palette differs from the library's colour families, or if `public/r/puzzle-mosaic.json` is older than the source.

   ```sh
   bun run test
   ```

Keep the file's only import `react`. A file comment above the imports is dropped by the CLI on install, so put notes for consumers on the component itself.

### Add a component

1. Write the component as one file under `registry/jigsaw/`, importing nothing from this repository's packages.
2. Add an item to `registry.json` with `"type": "registry:component"` and the file's path.
3. Run `bun run registry:build`, then add tests beside the existing ones in `tests/registry.test.ts`.
4. Install it into a scratch project to confirm it compiles there:

   ```sh
   npx shadcn@latest add /path/to/jigsaw/public/r/<name>.json
   ```

### Publish

The site publishes `public/r/`: `bun run build` copies it to `apps/site/dist/r/`, and the [Pages workflow](../.github/workflows/pages.yml) deploys the built site from `main`, so the registry is at `https://juchangrong.github.io/jigsaw/r/` after a merge to `main`. No npm release is involved. Consumers install by URL or by registry name, as described in [Install from the site](#install-from-the-site).
