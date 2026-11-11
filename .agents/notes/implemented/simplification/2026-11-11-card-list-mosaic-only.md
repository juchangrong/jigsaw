# Agent Note: The card list shows only mosaic icons

Status: implemented

## Problem

The card list offered seven icon styles: Glass, Plain tile, Outline, Abstract, Solid, Mosaic and Bare piece. Mosaic has been the default since [the card page trim](2026-11-10-card-page-trim.md), which kept all seven at the maintainer's request. The maintainer has now asked for the piece and the other styles to go, keeping only what belongs to the mosaic.

## Decision

The card list draws every icon as a `PuzzleMosaic`. The Icon style selector is removed, with the code and styles of the other six looks.

The four switches stay, since each one is a way to draw a mosaic: Tonal (four tones in place of one deep piece), Padding (the mosaic inside a white tile), Tint (colours that tile, so it needs Padding) and Gaps. Colour sets, the candidate picker, Shuffle, Copy picks and Reset are unchanged. The copied payload keeps `style: "mosaic"` so its shape does not change.

A stored `cardStyle` value from an earlier visit is no longer read.

## Alternatives considered

Hiding the other styles behind a setting would keep six code paths that nothing shows.

Removing the rendered piece, pictogram and outline from the whole project was not part of this change: the request named styles, which is what the card list calls these looks. The maintainer asked for that next, and [the project became mosaic-only](2026-11-11-mosaic-only.md).

## Consequences

The card list no longer shows a rendered piece or a pictogram.

Checked on the dev server with the stored settings of an earlier visit: the picker and the cards draw mosaics, and the four switches are enabled as described.
