# Install PuzzleMosaic as source

`PuzzleMosaic` is published the way shadcn/ui components are: the shadcn CLI copies one source file into your project, and from then on the file is yours to edit. It needs React 18 or later and nothing else: no package from this repository, no Tailwind, no canvas.

For its props and palettes, see the [PuzzleMosaic reference](puzzle-mosaic.md). To change the component or add another one to the registry, see [Maintain the registry](registry-maintenance.md).

## Before you start

Your project needs a `components.json`, which `npx shadcn@latest init` creates. The CLI writes the file to the `components` alias set there, for example `src/components/puzzle-mosaic.tsx`.

The repository is private, so its raw GitHub URLs need a token. Until the built files are served somewhere your project can reach, install from a checkout of this repository.

## Install from a checkout

Run this in your project, pointing at the built file in a checkout of this repository:

```sh
npx shadcn@latest add /path/to/jigsaw/public/r/puzzle-mosaic.json
```

The CLI reports the file it created:

```text
✔ Created 1 file:
  - src/components/puzzle-mosaic.tsx
```

## Install from a URL

Once `public/r/` is served over HTTP, pass the file's URL instead:

```sh
npx shadcn@latest add https://<host>/r/puzzle-mosaic.json
```

To install by name, add the registry to your `components.json`:

```json
{
  "registries": {
    "@jigsaw": "https://<host>/r/{name}.json"
  }
}
```

```sh
npx shadcn@latest add @jigsaw/puzzle-mosaic
```

## Use it

```tsx
import { PuzzleMosaic } from "@/components/puzzle-mosaic";

<PuzzleMosaic seed={app.id} title={app.name} />
```

The same seed always draws the same icon, so pass something stable such as an id. Nothing has to be stored.

## Update it

Run the same `add` command with `--overwrite`. It replaces the file, so move any edits you made into the new version afterwards; `--diff` shows what would change first.
