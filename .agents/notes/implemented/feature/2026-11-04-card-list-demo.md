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

A Colors control switches between five color sets of at most five families each, with swatches for the active set:

- Studio: the muted slate, plum, clay and sage, still the default.
- Aluminum: graphite, silver, champagne, navy and sky.
- Titanium: dark, natural, white, blue and desert, at very low chroma.
- Desktop: soft blue, green, pink, orange and purple.
- System: refined blue, indigo, teal, orange and pink.

The user asked for combinations in an Apple-like style. The sets take their cue from restrained product finishes, but the names and values are original. Each family except Studio's is generated in `CardsPage.tsx` from OKLCH: four shades from a deep to a light lightness, chroma tapering toward the light end, and a small hue drift. Titanium's white family stops at lightness 0.64–0.9 so it stays visible on a white tile.

Candidates now carry a slot instead of a palette, and the active set colours slot `i` with family `i mod set size`. Switching sets therefore recolours the same shapes and keeps the picks. Picks saved earlier as seed and palette get their slot back by looking up the seed among the first 5,000 candidates. The chosen set is remembered in `localStorage`.

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
