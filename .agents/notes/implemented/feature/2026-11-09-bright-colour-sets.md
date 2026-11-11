# Agent Note: Bright colour sets for mosaics

Status: implemented

## Problem

The six colour sets were built for single pieces on a white tile and are restrained on purpose: muted presets, near-neutral metals, soft hues. A mosaic ([Smoother pictograms and a mosaic icon](2026-11-09-pictogram-joins-and-mosaic.md)) shows four shades of one family at once and can carry much more colour. The user asked for a few mosaic colour schemes that take their cue from the app icons of their vidmind project.

Those icons are of two kinds. Glyph icons come in seven flat colours. Mascot characters, the default, are drawn in bright, friendly hues (orange, yellow, green, coral, pink, purple, blue, with some brown, teal and gray), and every one has eyes in the same deep navy.

## Decision

Three sets join `COLOR_SETS`, each with five families:

- **Bright**: blue, coral, orange, green, purple.
- **Candy**: pink, yellow, teal, sky, caramel.
- **Ink**: coral, orange, blue, green, purple, where the deepest shade of every family is one navy and the other three step from the full colour to a tint. In a mosaic one piece is navy, which repeats the pairing the mascots have: a bright body with navy eyes.

The hues and chroma were measured from the reference colours in OKLCH and rounded. Bright and Candy use `colorFamily`, so each family still steps evenly from deep to light with chroma tapering toward the tint, and the reference colours fall near the two middle shades. The reference colours themselves are not copied.

Yellow cannot go deep without turning olive, so its deep end leans toward amber (a hue drift of 24°) and stops at lightness 0.76.

The sets are in the library, so every style can use them. Nothing existing changes, so no version changes.

## Alternatives considered

**One set of seven or eight families.** It would match the reference's seven glyph colours directly. A set is limited to five families, a rule the user set earlier so that a list never shows too many colours at once.

**Copy the reference hex values as the shades.** It would be the closest match. Each reference colour comes as a pair, not four even steps, and a mosaic needs a deep diagonal and a light one, so the families are generated around the measured hue and chroma.

**Ink as a separate mosaic option that recolours one piece in any family.** It would work with every set. It adds an option to the library for one look, and navy beside the muted sets was not asked for.

## Consequences

The card list offers nine colour sets; the control still fits on one row at desktop width and wraps on a phone. `tests/pictogram.test.ts` checks that the bright families are vivid at the deep end and reach a pale tint, and that the Ink families share one navy with three rising shades of one hue. All 163 tests pass. Checked in the browser as mosaics, tonal and accent.

Gaps:

- The sets were tuned as mosaics and not reviewed in the other styles. As flat pictograms the Ink families are uneven: `pictogramColor` takes the lightest shade at lightness 0.68 or below, which is the colour for blue and purple and the navy for coral, orange and green.
- Yellow has the narrowest lightness range of any family (0.19), so its mosaic relies on the cuts and the hue drift for separation.

## Later change

The rendered piece and the pictogram were removed when [the project became mosaic-only](../simplification/2026-11-11-mosaic-only.md); what this note says about the mosaic, the colour sets and the registry still holds.
