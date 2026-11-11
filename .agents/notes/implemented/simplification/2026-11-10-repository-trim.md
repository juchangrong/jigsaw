# Agent Note: Repository trim

Status: implemented

## Problem

A review of what each directory is for found five pieces that added files without adding much. `.agents/scripts/verify-covenant.mjs` was a byte-identical copy of the checker inside the covenant skill. `packages/export` was a workspace package of one 133-line file, used only by the renderer, the playground and two tests. `packages/core/src/sdf/` and `packages/core/src/stamp/` each held a single file. `.editorconfig` repeated the defaults of `bun fmt`. Three documents of 145 lines in total covered one registry component.

## Decision

The convention gate runs from the skill: `bun .agents/skills/covenant/scripts/verify-covenant.mjs`, in `bun run check`, in CI and in `AGENTS.md`. `.agents/scripts/` is removed.

The PNG and WebP encoding lives in `packages/renderer/src/export.ts` and is exported from `@jigsaw/renderer`. The `@jigsaw/export` package is removed.

`packages/core/src/sdf.ts` and `packages/core/src/stamp.ts` replace `sdf/sdf.ts` and `stamp/glyph.ts`. The exports of `@jigsaw/core` are unchanged.

`.editorconfig` is removed.

`docs/registry.md` holds installing, the reference and maintenance of the registry as three sections; `docs/puzzle-mosaic.md` and `docs/registry-maintenance.md` are removed. This is a maintainer-approved exception to [the documentation standard](../../../skills/covenant/references/docs-standard.md#document-structure), which gives each page one mode.

## Alternatives considered

**Keeping the checker copy at `.agents/scripts/`.** The covenant skill installs it there and its own documents name that path, so a copy lets the repository pin a checker version apart from the skill. It lost because the two files were identical, the repository adds no gates of its own, and `AGENTS.md` names the command to run.

**A symlink at `.agents/scripts/verify-covenant.mjs`.** It keeps the path the skill documents and removes the duplicate content. It lost because the aim was one directory fewer, and the commands in `AGENTS.md`, `package.json` and CI are the ones contributors use.

**Folding the encoder into `packages/core`.** The PNG encoder is pure TypeScript and would fit. It lost because `downloadBlob` and the WebP path need a browser canvas, while core has no browser dependency, and the renderer is the encoder's only library consumer.

**Keeping the three registry documents apart.** That follows the one-mode rule: two how-to pages for different readers and one reference page. It lost because the maintainer prefers one page for one small component, and each mode keeps its own section.

**Flattening `material/`, `geometry/` and `color/` as well.** They hold two, three and four files. They stay because each groups related modules.

## Consequences

Code that imported `@jigsaw/export` imports the same names from `@jigsaw/renderer`. The packages are private, so only this repository is affected.

The covenant skill's own documents still tell a reader to run `.agents/scripts/verify-covenant.mjs`, which no longer exists here; `AGENTS.md` gives the working command. Reinstalling the skill may put the copy back, and it can be deleted again.

Editors that read `.editorconfig` no longer get the indent and line-ending settings from it; `bun fmt --check` still enforces them.

The registry page mixes how-to and reference content, so an edit to it should keep the three sections separate instead of blending steps into the reference tables.
