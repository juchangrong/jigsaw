# Agent Note: A shadcn-format registry for installable source

Status: implemented

## Problem

The user asked to take stock of the project and package the mosaic component the way shadcn/ui does, so that another project can install its source directly.

The project as it stands has three layers:

| Layer | Where | Can a product use it today? |
|---|---|---|
| Generation: seeded randomness, geometry, colour, the vector forms | `packages/core` | Only inside this workspace |
| Rendering and React components | `packages/renderer`, `packages/react`, `packages/export` | Only inside this workspace |
| Design decisions tuned by eye: which style, palettes, padding, gaps, the Bright mosaic preset | `apps/playground/src/CardsPage.tsx` and its CSS | No; they are demo code |

The packages are `workspace:*` dependencies with no build and no npm release, so nothing outside the repository can import them. The look the user settled on in the card list is spread over the third layer. And of everything in the library, the mosaic is the one piece that suits copying: it is plain SVG, about 300 lines with its helpers, and needs no GPU, canvas or cache.

## Decision

The repository gains a registry in the shadcn format, with one item.

- `registry/jigsaw/puzzle-mosaic.tsx` is `PuzzleMosaic` as one self-contained file whose only import is `react`. It carries its own seeded randomness, geometry, OKLab mixing and eleven palettes as hex values.
- `registry.json` lists the item, and `pnpm registry:build` (the shadcn CLI, pinned to 4.23.0) writes `public/r/puzzle-mosaic.json`, the file consumers install. The built file is committed, because it is what a URL serves.
- The component's defaults are the look the user chose: the accent variant, gaps on, no padding, and a palette picked from the seed among the five Bright ones. The playground's Padding and Gaps switches are its `padding` and `gaps` props; with `padding` it draws the tile itself in SVG, so it needs no CSS.
- It uses no hook other than `useId`, so it also renders in a React Server Component and needs no `"use client"`.

The file is a copy of library code, so `tests/registry.test.ts` holds the two together: the same tones, layers and seams as `generateMosaic` for over 300 seeds, the same fills in both variants, palettes equal to the library's Bright, Candy and Mono families, and the same outline, cut width, cut corners and ground as `mosaicDrawing`. It also renders the component to markup with `react-dom/server`, and fails when `public/r/` is older than the source. `react` and `react-dom` are root dev dependencies for that.

## Alternatives considered

**Publish the packages to npm.** That is the usual way to share a library and keeps one copy of the code. It needs a build, versioning and a registry account for four packages, and the user asked for source that a product owns and can edit. It remains open for the rendered icons, which are too large to copy.

**Split the registry item into several files** (`lib/mosaic.ts`, `lib/palettes.ts`, the component). It mirrors the library's structure. The CLI then has to rewrite import aliases to the consumer's layout, and one file has no such step to go wrong.

**Generate the registry file from the library with a bundler.** No hand-kept copy would exist. The output would be bundler-shaped code with the library's unused exports, which is poor source to hand someone to own. A readable copy held by tests was preferred.

**Write a build script instead of using the shadcn CLI.** No download at build time. The CLI defines the format, so using it keeps the output correct as the format changes; the version is pinned.

**Compute the palettes from OKLCH in the component.** That needs the gamut-mapping code as well. Hex values are what a product edits anyway, and a test ties them to the library's families.

## Consequences

A project with a `components.json` installs the component with one command and gets `components/puzzle-mosaic.tsx`. Verified with shadcn 4.23.0 into a scratch project three ways: from the built file's path, from a URL served locally, and by name through a `registries` entry. The installed file is byte-identical to the source and typechecks there under `strict`, `noUnusedLocals` and `noUnusedParameters`.

The CLI drops a comment placed above the imports, so the usage notes sit on the component.

All 176 tests pass.

Gaps:

- The repository is private. Installing by URL from GitHub needs a token, and no public host serves `public/r/` yet; installing from a checkout works now.
- The padded tile's look (75% scale, corner radius, edge colour) exists twice, in the playground's CSS and in the registry file, and no test compares them.
- Only the mosaic is installable. The pictogram would copy as easily; the rendered piece would not.
- Tint, the Ink palettes and the playground's drop shadow are not part of the component.
- The scratch project checked types, not pixels; the markup is covered by the tests here.
