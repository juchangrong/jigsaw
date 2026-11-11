# Agent Note: Card page trim

Status: implemented

## Problem

The card list page had grown to 666 lines through a series of experiments, and the look it was built to choose is settled. Part of the code no longer earned its place: a Preset row with one preset, a match check and an Undo for it; two readers for settings saved in older formats; and two hand-written radio groups that repeated the playground's `Segmented` control. The maintainer asked for the page to be trimmed, with every icon style kept and Mosaic as the default.

## Decision

All seven icon styles, the colour sets, the four switches, the candidate picker and Copy picks stay. This note supersedes the Presets part of [the card list demo note](../feature/2026-11-04-card-list-demo.md).

The Preset row, its match check and Undo are replaced by one `DEFAULT_LOOK` constant and a Reset button. A first visit and Reset both show that look: Mosaic in the Bright set, one accent piece per tile, Padding off, Gaps on, on the four default picks.

The readers for old saved formats are removed: the `mosaicTile` and `mosaicJoined` style names, and picks saved without a slot. A saved value in either format is ignored, so the style falls back to the default and such a pick is dropped.

`Segmented` moves from `App.tsx` to `apps/playground/src/Segmented.tsx`, and the card page uses it for the style and colour-set groups.

## Alternatives considered

**Keeping only the Mosaic style.** It would cut the page roughly in half. It lost because the maintainer chose to keep all seven styles for comparison.

**Keeping only the finished list, with no controls.** It is the smallest page. It lost for the same reason, and because the picker and Copy picks are how icons are chosen and taken to another project.

**Keeping Undo beside Reset.** Reset replaces the picks, and Undo would bring them back. It lost because it needs the match check and a saved copy of the previous look, which is most of what was removed; the default picks are four clicks to change.

**Keeping the old-format readers.** They cost about 30 lines. They lost because the page rewrites saved settings in the current format on every visit, so only a browser that has not opened the page since those formats changed still holds them.

## Consequences

`CardsPage.tsx` is 535 lines, down from 666. The two radio groups on the card page gain the Home and End keys that `Segmented` handles.

Reset has no undo: it replaces the saved style, colours, switches and picks at once.

Checked in the browser: the page opens with the saved look, switching to Glass and to Bare piece works, Reset returns to Mosaic in the Bright set with Padding off and Gaps on, and the playground page's controls still show their labels.

## Later change

The rendered piece and the pictogram were removed when [the project became mosaic-only](2026-11-11-mosaic-only.md); what this note says about the mosaic, the colour sets and the registry still holds.
