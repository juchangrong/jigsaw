# jigsaw — Seeded Puzzle Mosaic Icons

Turns a **seed** into an icon: a tile in the shades of one colour, drawn as plain SVG. A mosaic is cut into four interlocking puzzle pieces; petals hold four leaves. The same seed always draws the same icon, so an item's id is all an icon needs.

## Quick start

The only tool to install is [Bun](https://bun.sh) 1.4 or later; Node is not needed.

```bash
bun install
bun run dev        # landing page, docs and playground at http://localhost:5173
bun run test       # mosaic, petals, PRNG and registry tests
bun run typecheck
bun run check      # format check, typecheck, tests and convention gate, as CI runs them
bun run build      # production build of the site, playground included
```

## Packages

| Package | What it does |
| --- | --- |
| `@jigsaw/core` | Seeded PRNG (Mulberry32), OKLCH colour, colour sets, the mosaic and petals designs and their standalone SVG. No DOM needed. |
| `@jigsaw/react` | `<PuzzleMosaic />` and `<PuzzlePetals />`, inline SVG. |
| `registry/` | The installable `PuzzleMosaic`: one self-contained source file in shadcn format, built into `public/r/`. |
| `apps/site` | The one app, bundled and served by Bun: landing page at `/`, documentation at `/docs/`, `/docs/registry/` and `/docs/api/`, the playground at `/playground/` with a card list at `/playground/cards/`, and the registry files at `/r/`. |

## Usage

```tsx
import { COLOR_SETS } from "@jigsaw/core";
import { PuzzleMosaic, PuzzlePetals } from "@jigsaw/react";

const family = COLOR_SETS.find((s) => s.id === "bright")!.families[0]!;

<PuzzleMosaic seed="alpha" size={40} colors={family.colors} variant="accent" />
<PuzzlePetals seed="alpha" size={40} colors={family.colors} />
```

The packages are not published to npm: use them inside this workspace, or copy `PuzzleMosaic` into another project with the shadcn CLI.

| Document | What it covers |
| --- | --- |
| [Use jigsaw icons](docs/usage.md) | Drawing an icon, colouring a list, tiles, accessible names, SVG without React. |
| [API reference](docs/api.md) | `PuzzleMosaic` and `PuzzlePetals` props, SVG functions and colour sets. |
| [PuzzleMosaic registry](docs/registry.md) | Installing `PuzzleMosaic` as source, its props and palettes, and maintaining the registry. |
| [Design spec](docs/design.md) | How a mosaic and petals are cut, coloured and drawn. |

The same documents are on the site at https://juchangrong.github.io/jigsaw/, next to a landing page and the playground. To run it locally: `bun run dev`, then http://localhost:5173.

## Tests

- `tests/mosaic.test.ts`: mosaic designs, fills, seams, outline, the drawing plan, standalone SVG, and colour families.
- `tests/petals.test.ts`: petals designs, fills, the drawing plan, standalone SVG and the React markup.
- `tests/prng.test.ts`: PRNG pinning, independent streams, no `Math.random`.
- `tests/registry.test.ts`: the installable `PuzzleMosaic` against the library (designs, fills, palettes), its rendered markup, and the built registry file.
