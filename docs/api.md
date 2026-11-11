# API reference

The exports of `@jigsaw/react` and `@jigsaw/core` that draw icons. `PuzzlePetals` is not in the registry yet. The installable `PuzzleMosaic` has its own props, listed in [the registry reference](registry.md#reference).

## PuzzleMosaic

From `@jigsaw/react`. Renders a tile cut into four pieces as one inline `<svg>`.

<!-- preview: puzzle-mosaic -->

```tsx
<PuzzleMosaic seed="alpha" size={64} colors={family.colors} variant="accent" />
<PuzzleMosaic seed="alpha" size={64} colors={family.colors} />
<PuzzleMosaic seed="alpha" size={64} colors={family.colors} variant="accent" gap={0} />
<PuzzleMosaic seed="alpha" size={64} colors={family.colors} shape="round" />
```

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

## PuzzlePetals

From `@jigsaw/react`. Renders a tile of four leaves as one inline `<svg>`. The leaves meet at their tips and nothing separates the cells.

<!-- preview: puzzle-petals -->

```tsx
<PuzzlePetals seed="alpha" size={64} colors={family.colors} />
<PuzzlePetals seed="alpha" size={64} colors={family.colors} variant="accent" />
<PuzzlePetals seed="beta" size={64} colors={family.colors} />
<PuzzlePetals seed="alpha" size={64} colors={family.colors} shape="round" />
```

| Prop | Type | Default | Effect |
|---|---|---|---|
| `seed` | `string \| number` | required | Selects one of 12 tone layouts and 16 lean layouts. |
| `colors` | `readonly string[]` | required | Four shades of one colour, deep to light. The lightest is the ground. |
| `size` | `number` | `24` | Width and height in CSS px. |
| `variant` | `"tonal" \| "accent"` | `"tonal"` | `tonal`: one deep leaf, one middle and two light. `accent`: one deep leaf among light ones. |
| `shape` | `"squircle" \| "round"` | `"squircle"` | The tile's outline. |
| `radius` | `number` | `0.25` | Corner radius of a `round` tile, as a fraction of its side. |
| `edge` | `boolean` | `true` | A hairline around the tile, so a light ground holds on a light page. |
| `title` | `string` | none | Accessible name. Without one the icon is `aria-hidden`. |
| `className`, `style` | | | Passed to the `<svg>`. |

## SVG functions

From `@jigsaw/core`. None of them needs a DOM.

| Function | Returns |
|---|---|
| `generateMosaic(seed)` | The mosaic design for a seed: its tones, paint layers, seams and a `key` that identifies the design. |
| `mosaicOf(tones, knobs)` | The design with the given tone layout and knob directions. |
| `mosaicSvg(mosaic, colors, { size?, variant?, shape?, radius?, gap?, edge?, title? })` | A standalone SVG string. |
| `mosaicDrawing(mosaic, colors, style?)` | The outline, fills, seams and cut widths, for drawing a mosaic yourself. |
| `mosaicFills(mosaic, colors, variant?)` | The fill of each of the four cells. |
| `mosaicOutline(shape?, radius?)` | The tile's outline as path data; petals use the same outline. |
| `generatePetals(seed)` | The petals design for a seed: its leaf tones, leans, leaf paths and a `key` that identifies the design. |
| `petalsOf(tones, leans)` | The design with the given leaf tones and leans. |
| `petalsSvg(petals, colors, { size?, variant?, shape?, radius?, edge?, title? })` | A standalone SVG string. |
| `petalsDrawing(petals, colors, style?)` | The outline, ground and leaf fills, for drawing petals yourself. |
| `petalsFills(petals, colors, variant?)` | The fill of the ground and of each of the four leaves. |

## Colour sets

`COLOR_SETS` from `@jigsaw/core` holds nine sets. Each set has an `id`, a `label` and up to five `families`; a family has an `id` and four hex `colors`, deep to light.

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
| `colorFamily(id, hue, chroma, deep, light, drift?)` | A family of four shades built in OKLCH. |
| `tintColor(family)` | A light tint for the tile behind an icon. |

## Seeds

| Function | Returns |
|---|---|
| `hashString(text)` | A 32-bit hash, for picking a colour family from a seed. |
| `deriveSeed(seed, counter)` | A new seed derived from another. |
| `createRng(seed, stream)` | A seeded random stream. |

## Determinism

The same seed gives the same design, and the same design, colours and options give the same markup, on every machine. Nothing uses `Math.random`.
