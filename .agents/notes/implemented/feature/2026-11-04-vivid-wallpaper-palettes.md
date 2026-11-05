# Agent Note: Vivid palettes with light-ordered gradients

Status: implemented

## Problem

Every default palette was pastel, with high lightness and low chroma, and the gradient shuffled colors into random spots. Icons looked like candy. The user wanted diffuse gradients in the style of system wallpapers and app icons: saturated, deep colors blending into luminous highlights, with a clear lit-from-above flow.

## Decision

`packages/core/src/color/palettes.ts` adds seven vivid palettes in `VIVID_PALETTES`: `dusk`, `tide`, `ember`, `orchid`, `meadow`, `glacier` and `bloom`. Each is an analogous hue sweep of four colors, ordered from a saturated deep anchor to a light highlight. Seeds pick only from these (`SEED_PALETTE_NAMES`). The six pastel palettes move to `PASTEL_PALETTES` and stay selectable by name. `PALETTES` holds both sets, vivid first.

`generateGradient` places spots as before, then ranks them along a light-flow direction: top-left to bottom-right, tilted by up to ±0.6 rad per seed. It pairs that ranking with the palette colors sorted by OKLCH lightness, so lighter colors sit toward the default light and the deep anchor sits opposite. Each pair of neighboring ranks swaps with a probability of 0.3, so a second hue sometimes crosses the flow and the blend stays diffuse rather than a straight two-tone sweep. Spot radius changes from `0.24 + 0.22·softness` to `0.2 + 0.22·softness`, which keeps the separate color pools visible.

Generated output changes, so `PRESET_VERSION` is `1.2.0`, `ALGORITHM_VERSION` is bumped (`1.3.0` on `dev`, after the corner and interlock changes), and `tests/golden/signatures.json` is re-baselined.

## Alternatives considered

**Add the vivid palettes alongside and keep seeds on the pastel set.** This leaves default output unchanged. It lost because the user chose to make the new look the default.

**Keep random color placement and only change the palettes.** The first render tried brighter colors with the old shuffled placement. It lost because deep and light spots landed anywhere, which fights the bevel lighting and loses the lit-from-above depth that the reference look relies on.

**Strict light-to-deep ordering with no swaps.** It lost in the browser: every piece became a clean linear two-tone gradient, and the diffuse, multi-hue quality was gone.

## Consequences

Default icons are vivid and lit from the top-left. Images and descriptions cached under the old versions are not reused. Pastel icons remain available with `gradient: { palette: "aurora" }` and the other pastel names, but their colors are now also ordered by lightness, so a pastel icon does not match its old rendering.

`tests/palette.test.ts` checks four things: seeds pick only vivid palettes, pastel palettes resolve by name, each vivid palette is ordered deep to light, and spot lightness falls toward the bottom-right across 200 seeds. The flat-top albedo test now compares against the gradient's own color at the sampled pixel, because the new pairing changed which per-spot jitter lands there. All 109 tests pass, and the new palettes were reviewed in the playground on WebGPU.

The palette names and values are original and do not use any platform's wallpaper names.
