# PuzzleMosaic reference

The installable component in `registry/jigsaw/puzzle-mosaic.tsx`. To add it to a project, see [Install PuzzleMosaic as source](registry.md).

It renders one inline `<svg>`. It uses no hook other than `useId`, so it works in a React Server Component.

## Props

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

## Palettes

`MOSAIC_PALETTES` holds eleven palettes of four shades each.

| Names | Character |
|---|---|
| `blue`, `coral`, `orange`, `green`, `purple` | Bright. These five are `DEFAULT_MOSAIC_PALETTES`. |
| `pink`, `yellow`, `teal`, `sky`, `caramel` | Softer and sweeter. |
| `gray` | Neutral. |

## Other exports

| Export | Purpose |
|---|---|
| `DEFAULT_MOSAIC_PALETTES` | The palette names a seed chooses from. Edit the list to change the mix of colours in a list. |
| `mosaicPaletteFor(seed)` | The shades a seed uses when no palette is given. |
| `generateMosaic(seed)` | The design for a seed: tones, layers and seams as SVG path data. |
| `mosaicFills(mosaic, shades, variant)` | The fill of each of the four cells. |

## Limits

- The cuts use an SVG mask. Browsers support it; a few other SVG rasterizers do not. `gaps={false}` avoids it.
- At 40 px on a 1× display a cut is under one pixel wide and looks soft. It is crisp from about 48 px, or on a 2× display.
- With `gaps={false}` and `variant="accent"`, the light pieces differ by half a shade, so the seams between them are faint.
- The component adds no shadow. Add one with `className` or `style` if the design calls for it.
