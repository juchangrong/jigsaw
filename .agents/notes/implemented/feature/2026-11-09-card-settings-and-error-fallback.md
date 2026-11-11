# Agent Note: Saved card settings and a render error fallback

Status: implemented

## Problem

Two gaps from a review of the playground:

- The card list ([Card list demo page](2026-11-04-card-list-demo.md)) remembered the picked candidates and the colour set, but not the icon style or the Gradient and Tint switches. Every reload, and every visit to the other page and back, returned to Glass, so comparing a style across reloads meant choosing it again each time.
- Nothing caught an error thrown while a page rendered. React unmounts the whole tree in that case, which leaves a blank page with no way back except a manual reload.

## Decision

**Stored state.** `apps/playground/src/storage.ts` has `useStoredState(key, fallback, parse)`: `useState` backed by `localStorage` under the `jigsaw.` prefix. `parse` validates what was stored and returns `undefined` to reject it, so a value from an older version, or one edited by hand, falls back to the default instead of reaching the page. A blocked or failing storage behaves like plain state. The card list uses it for the icon style (`cardStyle`), the switches (`cardGradient`, `cardTint`, and later `cardPadding` and `cardGaps`) and the colour set (`cardColorSet`). Values are written as JSON. The colour set was written as a bare string before, so a stored value that is not JSON is read as that string, and existing choices carry over.

**Error boundary.** `apps/playground/src/ErrorBoundary.tsx` wraps each page in `main.tsx`. On a render error it shows the message with two actions: Try again, which renders the page again, and Clear saved picks and settings, then retry, which first removes every `jigsaw.` key. The second exists because saved state is the one input that survives a reload, so it is the likely cause of an error that Try again cannot clear. The boundary is keyed by page, so going to the other page leaves a failed one behind. The error is also logged to the console with its component stack.

## Alternatives considered

**One settings object under a single key.** It would be one read and one write. It lost because the colour set already had its own key, and separate keys let each value be validated and defaulted alone: one bad value does not discard the others.

**Put the style in the URL.** A link would then reproduce the view. The picks are too large for that, and a link that restored the style but not the picks would be misleading, so everything stays in storage.

**A dependency such as `react-error-boundary`.** The boundary is about 40 lines, and the playground has no other need for the package.

**Reload the page as the only recovery.** It is simpler, but a reload reads the same saved state, so an error caused by that state would repeat.

## Consequences

The card list reopens as it was left. A failed page shows what went wrong and a way to continue.

Checked in the browser:

- the style, Tint and the colour set survive a reload, and a colour set saved in the old bare-string form is still read;
- a forced render error shows the fallback, Try again keeps showing it while the error persists and restores the page once it is gone, and the picks are untouched;
- the clear action removes only `jigsaw.` keys, leaves another key alone, and the page returns with defaults.

Gaps:

- No automated test covers either part; the repository has no DOM test environment.
- The boundary catches render errors only. A failed icon render is asynchronous and still reaches `<PuzzleIcon>`'s `onError`.
- The playground page's own controls are not saved.

## Later change

The rendered piece and the pictogram were removed when [the project became mosaic-only](../simplification/2026-11-11-mosaic-only.md); what this note says about the mosaic, the colour sets and the registry still holds.
