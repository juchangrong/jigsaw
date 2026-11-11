# Agent Note: The project is jigsaw and the things it draws are Puzzle

Status: implemented

## Problem

Two names are in use and nothing says why. The repository, the package scope (`@jigsaw/core`, `@jigsaw/react`), the registry and the site are `jigsaw`. The component is `Puzzle`: `PuzzleMosaic`, and the registry item `puzzle-mosaic`. When this was decided the API also had `PuzzleIcon`, `PuzzlePictogram`, `PuzzleIconGenerator`, `PuzzleIconOptions` and `generatePuzzleIcon`, since removed.

The split was not designed. The generator was named after its subject, a puzzle icon, and the repository was named separately. Without a rule, a new export could take either name.

## Decision

Both names stay, and each has one job.

`jigsaw` is where something comes from: the project, the repository, the package scope, the registry name and its folder (`registry/jigsaw/`), the site's wordmark, and prefixes for stored keys such as `jigsaw.cardCandidates` and `jigsaw-site-theme`.

`Puzzle` is what something draws or describes: every exported component, class, type and function that concerns a puzzle piece or icon, and every registry item (`puzzle-mosaic`).

So an import reads as the full term, split in two: `import { PuzzleMosaic } from "@jigsaw/react"`. No exported identifier starts with `Jigsaw`, and no package or registry is named `puzzle`.

In prose, "jigsaw" is the project and "puzzle piece", "puzzle icon" or "mosaic" is the drawing.

## Alternatives considered

Renaming the exports to `Jigsaw*` would make one name everywhere. It breaks every caller, and for registry consumers it changes the installed file name and the item URL (`/r/puzzle-mosaic.json`). It also repeats the scope in every import (`JigsawMosaic` from `@jigsaw/react`) and says less about what is drawn: what is drawn is puzzle pieces, not a jigsaw.

Renaming the project to `puzzle` would change the repository URL, the three package names and the registry name for a word that is too common to find or to claim as a scope.

Leaving the split unexplained costs nothing today, but the next export would be named by guess.

## Consequences

No code changes. `AGENTS.md` carries the rule in one line and links here.

The words stay close enough that the question will come up again; this note is the answer to point to.
