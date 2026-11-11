# Agent Note: App icon preview in the playground

Status: implemented

## Problem

The user asked to see a single puzzle piece used as an app icon, both as a rounded square and as a circle. The playground only showed icons on a transparent, white or dark backdrop, never on the opaque masked tile that launchers and home screens use.

## Decision

The playground's App icon section (`apps/playground/src/AppIconPreview.tsx`) draws the current icon on an opaque tile, clipped like an icon mask. It shows two shapes, a rounded square with a 22.5% corner radius (the app-icon proportion) and a circle, each at 120, 80, 60 and 40 px.

The tile background is Tint or Deep, derived from the icon's own palette (its OKLab mix at lightness 0.955 or 0.24 with low chroma), or White. The icon canvas is 0.95× the tile for the rounded square and 0.88× for the circle (first 1.04× and 0.96×; the user asked for the piece a little smaller, about 9%). A single icon keeps room for a tab on every side (its reach is about 0.89 of the canvas), so the piece fills the tile without its tabs or corners being clipped. The section follows the global preview backdrop, and the tile-background control is a keyboard radio group like the others.

## Alternatives considered

**Fit the icon canvas inside the tile with padding.** The piece then filled only about half the tile, because of the margin the fixed single scale reserves for tabs. That is far smaller than real app icon artwork.

**CSS `corner-shape: squircle` for the rounded square.** It matches the continuous app-icon corner more closely, but browser support is still limited, so a 22.5% radius is used everywhere.

## Consequences

Users can judge an icon as an app icon at real launcher sizes and on light or dark tiles. Checked in the playground on WebGPU: all eight tiles render with the piece fully inside both masks, the backgrounds switch, and the console has no errors. This is playground-only; the library API is unchanged.

## Superseded

The code this note describes was removed when [the project became mosaic-only](../simplification/2026-11-11-mosaic-only.md). The note is kept as history.
