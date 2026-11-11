# Agent Note: A rendered piece has one colour

Status: implemented

## Problem

A rendered piece blended 3–5 Gaussian colour spots into a diffuse gradient. The maintainer asked for the gradient to be removed from the piece entirely, not turned off by default: the piece should be one colour, shaped only by its bevel and lighting.

## Decision

The gradient is removed from the generator, the three shading implementations, the API and the documents.

Each piece has one `color`. It comes from the icon's palette: a `color` stream picks a start, and piece `i` takes colour `(start + i) mod n`. A single piece therefore takes one seeded colour of its palette, and the pieces of a cluster or grid differ.

`PuzzleIconOptions.gradient` (`palette`, `spots`, `softness`) is replaced by a top-level `palette`. A named preset is still varied per seed in OKLCH. A custom hex list is now used exactly as given and may hold a single colour, so a caller who passes `["#A49CF0"]` gets that colour; before, a custom list needed two colours and was varied like a preset.

The per-piece uniform block drops the ten spot vectors and goes from 27 to 17 `vec4`s; `shading.ts`, `puzzle.wgsl`, `puzzle.frag.glsl` and `packPieceUniforms` changed together. `ALGORITHM_VERSION` is 2.0.0 because every rendered piece changes and the option is removed. `tests/golden/signatures.json` is re-baselined for the same reason.

In the playground, the Piece page's Gradient section is now Colour, without the Spots and Softness sliders, and its palette swatches are hard-edged stripes. In the card list, a rendered piece takes its family's main tone, and the switch that used to be called Gradient is now Tonal and applies to mosaics only; it keeps its storage key.

## Alternatives considered

Making the solid colour the default and keeping the gradient as an option was offered and declined.

Giving a single piece a fixed colour of its palette, such as the second shade, would make every seed of one palette the same colour. A seeded pick keeps seeds apart.

Keeping the OKLCH variation for custom lists would leave no way to ask for an exact colour now that a piece shows only one.

## Consequences

This is a breaking change for callers: `gradient` no longer exists, and `evalGradientLinear`, `gradientToLinear`, `generateGradient` and the gradient types are gone from `@jigsaw/core`. `PuzzleMosaic` and `PuzzlePictogram` and the registry are untouched.

The light end of a vivid palette is pale, so some seeds now give a pale piece.

The tests for spot placement and light flow are replaced by tests that a piece's colour belongs to its palette, that a custom colour is exact, and that the pieces of one icon differ.

Checked in the playground: single and cluster pieces render in one colour each under WebGPU and WebGL2, and the CPU renderer is covered by the tests. The dev server had to be restarted after the shader files changed, because its hot reload handed the renderer the shader's asset path instead of its text.

## Superseded

The code this note describes was removed when [the project became mosaic-only](../simplification/2026-11-11-mosaic-only.md). The note is kept as history.
