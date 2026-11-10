# Agent Note: Card list demo page

Status: implemented

## Problem

The user wanted to see generated puzzle icons in a real product context: a list of item cards like their own product's. Each card has a name, a muted ownership tag ("developed by me"), a description that falls back to a "no description yet" placeholder, and a "more" button. The playground had only single-page icon previews.

## Decision

The playground has a second page, `#/cards` (`apps/playground/src/CardsPage.tsx`), switched by the URL hash in `main.tsx`. The playground header links to it, and it links back. It lists 12 mock cards whose copy follows the product's style. Each card's icon is a single piece seeded by the card's name, so the same card always gets the same icon. "Shuffle icons" re-seeds all of them with a counter.

Icons appear either on a 48 px white rounded tile with a hairline inset edge (so it reads as a tile on a white card), or as a bare piece. At the user's request the list uses at most four palettes, rotated by card position plus the shuffle counter so neighbouring cards differ. They were first the vivid tide, dusk, ember and meadow. The user found those too bright, so they are now the low-saturation `slate`, `plum`, `clay` and `sage` from the new `MUTED_PALETTES` in core, in that order so each candidate tile keeps its colour family. Saved picks that name a vivid palette keep their seed and move to the matching muted one (tide → slate, dusk → plum, ember → clay, meadow → sage). A first version tinted each tile from its icon's palette and let every icon pick any palette, which the user found too busy. The layout follows an app-directory reference the user shared: a white page with no card borders or backgrounds, items grouped into sections by their tag, each section with a heading and a chevron. Each row has a 40 px white icon tile with a hairline edge, the name, a one-line muted description with an ellipsis, and a borderless "more" button. Rows sit in columns of at least 340 px (two on desktop, one on phones). A first version used bordered white cards on a grey page, after the user's own product screenshot. The user then asked to drop the card borders and follow the directory reference.

The mock copy was first Chinese, to imitate the product UI. At the user's request it is now English, with sections "Built by me", "Contributing" and "Shared with team" and a "No description yet" placeholder. The type is lighter: section headings at weight 500 and card names at 400.

An Icon candidates picker above the list shows candidate icons in batches of 24: fixed seeds derived from `card-candidates`, rotating through the same four palettes. Clicking a tile picks or unpicks it (`aria-pressed`, with a numbered badge for pick order). Once anything is picked, the cards use only the picks, cycling in pick order by on-screen position, so neighbouring rows differ. Picks are saved in `localStorage` as a per-viewer convenience: a storage failure just starts empty. They can be cleared or copied as JSON (`seed` and `palette` per pick), which is enough to reproduce each icon.

A Gradient switch (a `role="switch"` checkbox, on by default) turns the diffuse gradient off for both the candidates and the cards. Each palette then collapses to its main tone, its second color (tide blue, dusk purple, ember orange or meadow green), passed as a two-color custom palette. The piece is one solid color, shaded only by the bevel and lighting, apart from the generator's small per-spot jitter.

A Tint switch, off by default, gives each tile, both candidates and cards, a light tint of its icon's palette instead of white: the palette's OKLab mix at lightness 0.955, with its chroma scaled by 0.35. With the muted palettes the tints are soft blue, green, peach and lilac.

A Colors control switches between six color sets of at most five families each, with swatches for the active set:

- Studio: the muted slate, plum, clay and sage, still the default.
- Aluminum: graphite, silver, champagne, navy and sky.
- Titanium: dark, natural, white, blue and desert, at very low chroma.
- Desktop: soft blue, green, pink, orange and purple.
- System: refined blue, indigo, teal, orange and pink.
- Mono: a single gray-white family (OKLCH L 0.66 → 0.96, chroma 0.008 with a faint cool hue), added when the user asked to try one colour in a gray-white style, so only the shapes differ. It started at L 0.52 → 0.93 and was lightened at the user's request; the bevel's edge shading still separates the piece from a white tile.

The user asked for combinations in an Apple-like style. The sets take their cue from restrained product finishes, but the names and values are original. Each family except Studio's is generated in `CardsPage.tsx` from OKLCH: four shades from a deep to a light lightness, chroma tapering toward the light end, and a small hue drift. Titanium's white family stops at lightness 0.64–0.9 so it stays visible on a white tile.

Candidates now carry a slot instead of a palette, and the active set colours slot `i` with family `i mod set size`. Switching sets therefore recolours the same shapes and keeps the picks. Picks saved earlier as seed and palette get their slot back by looking up the seed among the first 5,000 candidates. The chosen set is remembered in `localStorage`, and so are the icon style and the Gradient and Tint switches ([Saved card settings and a render error fallback](2026-11-09-card-settings-and-error-fallback.md)).

The Icon control offers Glass (the default), Plain tile, Outline and Bare piece. Outline follows a line-icon reference the user shared. It draws the piece as an SVG path built from the same Bézier outline the renderer fills (`generatePuzzleIcon` plus `applyTransform` into icon units), stroked at 1.1 px in a mid gray (`#7A7A8C`, about 4:1 on white) with round joins. It was first 1.6 px in the text colour; the user found that too thick and too dark. Joins are round and a non-scaling stroke. It sits on a white tile with a hairline edge and fills about half the tile. The candidates switch to outlines too, and the hover quarter-turn applies to the outline. Glass follows the Liquid Glass look of recent app icons, built in CSS from four layers:

- a translucent body: a white sheen from 0.92 to 0.35 alpha over `--glass-tint`, which is the palette tint when Tint is on, with an 8 px backdrop blur;
- a 1 px masked rim, brightest at the top-left and bottom-right;
- a gloss over the upper half, above the piece;
- a small two-step lift shadow with at most 8 px blur.

Candidate tiles stay plain, because there the tile is a selection control.

Hovering a card icon turns the piece a quarter turn (90°) over 420 ms with an ease-out-quart curve, and it eases back when the pointer leaves. The tile, rim and gloss stay still. It is a CSS transition on the canvas that keeps its centring translate, and there is no rotation under `prefers-reduced-motion`. A first version spun the piece a full 360° on hover; the user asked for 90°. With a quarter turn a one-shot animation would snap back, so it is a transition held while hovering. The baked lighting turns with the piece.

An Abstract icon style redraws the piece as a pictogram, because the user found the realistic shape too literal for an icon and asked for a designed, less generated look. It follows the modernist practice of building signs on a grid from basic shapes: a unit square with rounded corners, and knobs and notches that are the same circle, centred 0.06 outside or inside the side (the radii are given in the refinements below). The glyph is one SVG path of straight lines and circular arcs, filled with one flat colour, with no wave, lean, gradient, bevel or gloss. The seed only decides which sides carry a knob, a notch or nothing.

The colour is the lightest shade of the family at OKLCH lightness 0.68 or below, so it stands clear of a white tile. The view is centred on the glyph's area centroid, found by sampling, and the glyph fills about 60% of the tile. Candidates switch to the glyph too, and the hover quarter-turn applies.

A review of the abstract glyphs led to four refinements:

- **Curated shapes.** Only arrangements with one or two knobs, one or two notches and at most one flat side are drawn: 30 of the 81 possible. At about 24 px, three knobs read as a cross, three notches as an X and two flat sides as a blob. A seed keeps its own piece's arrangement when it qualifies, and otherwise takes one from the set by hash.
- **One radius.** Corners, knobs and notches all use radius 0.18, replacing the earlier 0.2 corners and 0.165 knobs.
- **Solid style.** A white glyph on a tile filled with the family's colour (its lightest shade at lightness 0.6 or below, else its deepest), which is the usual app-icon treatment. With the Mono set the white glyph has 3.09:1 against its tile.
- **Mosaic style.** The tile itself as a four-piece puzzle in the family's shades, added with smoother pictogram joins and a sheen on the Solid tile ([Smoother pictograms and a mosaic icon](2026-11-09-pictogram-joins-and-mosaic.md)). The Gradient switch chooses four tones or one accent piece.
- **Distinct candidates.** In Outline, Abstract and Solid, candidates that would look identical are skipped: the same side arrangement in Outline, or the same glyph and family in the glyph styles. A picked candidate always stays visible. The picker looks through up to 400 candidates and disables "Show more candidates" when no distinct ones remain.

The Gradient and Tint switches are disabled in styles where they change nothing. "Copy picks" now copies the style, the colour set and, for each pick, its seed, family and colours, plus the glyph or outline path, view box and fill for the vector styles, so a pick can be redrawn outside the playground. Picks are still stored as seed and slot.

## Alternatives considered

**A section on the playground page.** That page is already long. A separate page shows the cards alone, closer to how the list appears in the product.

**A router library.** Two pages need only a hash check, so no dependency was added.

## Consequences

Checked in the browser on WebGPU:

- all 12 cards render with distinct icons in both styles;
- at 375 px wide there is no horizontal scroll and no card overflows, and long names and descriptions truncate;
- the links work in both directions;
- the console has no errors.

This is playground-only; the library is unchanged.
