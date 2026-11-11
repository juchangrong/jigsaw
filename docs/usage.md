# Use jigsaw icons

This guide covers the tasks of putting a jigsaw icon on a page or into a file. Props and functions are listed in [the API reference](api.md).

A jigsaw icon is a tile in the shades of one colour, drawn as inline SVG from about 24 px to 128 px and larger. It suits lists, cards, menus and avatars. There are two styles: a mosaic is cut into four interlocking puzzle pieces, and petals hold four leaves that meet at their tips.

## Get the code

The packages are not published to npm. There are two ways to use them.

- **Copy `PuzzleMosaic` into your project.** The shadcn CLI installs it as one source file that depends only on React. Follow [Install](registry.md#install). `PuzzlePetals` is not in the registry yet.
- **Work inside this repository.** `@jigsaw/core` and `@jigsaw/react` are workspace packages that export TypeScript source. Add the one you need to a workspace package's `dependencies` as `"workspace:*"` and run `bun install`.

The rest of this guide imports from the workspace packages.

## Draw an icon

<!-- preview: mosaic -->

```tsx
import { COLOR_SETS } from "@jigsaw/core";
import { PuzzleMosaic, PuzzlePetals } from "@jigsaw/react";

const family = COLOR_SETS.find((s) => s.id === "bright")!.families[0]!;

<PuzzleMosaic seed="alpha" size={40} colors={family.colors} variant="accent" />   // one deep piece on light ones
<PuzzleMosaic seed="alpha" size={40} colors={family.colors} />                    // one shade per piece
<PuzzlePetals seed="alpha" size={40} colors={family.colors} />                    // four leaves, three shades
<PuzzlePetals seed="alpha" size={40} colors={family.colors} variant="accent" />   // one deep leaf among light ones
```

The same seed always draws the same icon, so pass something stable such as an id. Both styles take the same props, except that only a mosaic has `gap`. Use one style throughout a list, so the icons differ by design and colour, not by kind. An icon takes four shades of one colour, deep to light; a [colour family](api.md#colour-sets) supplies them.

The component needs no canvas and no GPU, and its markup is complete when rendered on a server.

## Give each item in a list its own colour

Pick the family from the seed, so an item keeps its colour wherever it appears:

<!-- preview: list -->

```tsx
import { COLOR_SETS, hashString } from "@jigsaw/core";
import { PuzzleMosaic } from "@jigsaw/react";

const families = COLOR_SETS.find((s) => s.id === "bright")!.families;
const familyFor = (seed: string) => families[hashString(`${seed}:palette`) % families.length]!;

{apps.map((app) => (
  <PuzzleMosaic key={app.id} seed={app.id} size={40} colors={familyFor(app.id).colors} variant="accent" title={app.name} />
))}
```

The installable `PuzzleMosaic` makes the same pick when `palette` is left out.

## Set the icon on a tile

The cuts between the pieces are transparent, so the icon sits on any background. To give it a ground of its own, put it inside a tile and turn its hairline edge off; `tintColor` returns a light tint of the family for the tile.

```tsx
import { tintColor } from "@jigsaw/core";

<span style={{ display: "inline-grid", placeItems: "center", width: 40, height: 40, borderRadius: 10, background: tintColor(family) }}>
  <PuzzleMosaic seed="alpha" size={30} colors={family.colors} variant="accent" edge={false} />
</span>
```

## Name an icon for assistive technology

Pass `title`. Without one the icon is hidden from assistive technology, which suits an icon that sits beside its own label.

```tsx
<PuzzleMosaic seed={agent.id} size={40} colors={family.colors} title={agent.name} />
```

## Get SVG without React

`@jigsaw/core` returns a standalone SVG string, on a server or in a script:

```ts
import { COLOR_SETS, generateMosaic, mosaicSvg } from "@jigsaw/core";

const family = COLOR_SETS.find((s) => s.id === "bright")!.families[0]!;

const svg = mosaicSvg(generateMosaic("alpha"), family.colors, { size: 40, variant: "accent" });
```

`petalsSvg(generatePetals(seed), colors, options)` does the same for petals.

Write the string to a `.svg` file, or inline it in HTML.
