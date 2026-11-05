# Agent Note: Card list demo page

Status: implemented

## Problem

The user wanted to see generated puzzle icons in a real product context: a list of item cards like their own product's. Each card has a name, a muted ownership tag ("developed by me"), a description that falls back to a "no description yet" placeholder, and a "more" button. The playground had only single-page icon previews.

## Decision

The playground has a second page, `#/cards` (`apps/playground/src/CardsPage.tsx`), switched by the URL hash in `main.tsx`. The playground header links to it, and it links back. It lists 12 mock cards whose copy follows the product's style. Each card's icon is a single piece seeded by the card's name, so the same card always gets the same icon. "Shuffle icons" re-seeds all of them with a counter.

Icons appear either on a 48 px white rounded tile with a hairline inset edge (so it reads as a tile on a white card), or as a bare piece. At the user's request the list uses at most four palettes (tide, dusk, ember and meadow), rotated by card position plus the shuffle counter so neighbouring cards differ. A first version tinted each tile from its icon's palette and let every icon pick any palette, which the user found too busy. The cards follow the screenshot: white with a hairline border, 16 px radius, the name truncated before the tag, a one-line description with an ellipsis, and a 40 px "more" button. The grid fills columns of at least 320 px.

The mock copy is Chinese because it imitates the product UI. Page chrome stays English, and the language gate does not scan `.tsx` sources.

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
