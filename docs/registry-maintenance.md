# Maintain the registry

The registry is named `jigsaw` and follows the shadcn format: `registry.json` lists the items, `registry/jigsaw/` holds their source, and `pnpm registry:build` writes the files the CLI installs to `public/r/`. Commit `public/r/`; it is what consumers fetch.

## Change PuzzleMosaic

`registry/jigsaw/puzzle-mosaic.tsx` is a self-contained copy of the mosaic in `packages/core/src/pictogram.ts`, and `tests/registry.test.ts` holds the two to the same output. When the design changes, change both.

1. Edit the library and the registry file together.
2. Rebuild the installable file:

   ```sh
   pnpm registry:build
   ```

3. Run the tests. They fail if the copy and the library draw different icons, if a palette differs from the library's colour families, or if `public/r/puzzle-mosaic.json` is older than the source.

   ```sh
   pnpm test
   ```

Keep the file's only import `react`. A file comment above the imports is dropped by the CLI on install, so put notes for consumers on the component itself.

## Add a component

1. Write the component as one file under `registry/jigsaw/`, importing nothing from this repository's packages.
2. Add an item to `registry.json` with `"type": "registry:component"` and the file's path.
3. Run `pnpm registry:build`, then add tests beside the existing ones in `tests/registry.test.ts`.
4. Install it into a scratch project to confirm it compiles there:

   ```sh
   npx shadcn@latest add /path/to/jigsaw/public/r/<name>.json
   ```

## Publish

Serve `public/r/` over HTTP; any static host works, and no npm release is involved. Consumers then install by URL or by registry name, as described in [Install PuzzleMosaic as source](registry.md#install-from-a-url).
