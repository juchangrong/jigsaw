# AGENTS.md

Seeded puzzle mosaic icons: a seed becomes a tile cut into four interlocking puzzle pieces in the shades of one colour, drawn as plain SVG. The design spec is [docs/design.md](docs/design.md), the product context for UI work is [docs/PRODUCT.md](docs/PRODUCT.md), and usage is in [README.md](README.md).

## Repository layout

```text
packages/core/      seeded PRNG, OKLCH colour, colour sets, the mosaic design and its SVG (no DOM)
packages/react/     <PuzzleMosaic> component
apps/site/          the one app: landing page, docs pages and playground (src/playground/), dev server and build
registry/           shadcn-format components, self-contained source (registry.json lists them)
public/r/           built registry files that consumers install; generated, committed
tests/              bun:test suites
docs/               project documentation
.agents/            skills, decision records and convention gates
.github/            CI workflow
```

## Commands

```sh
bun install
bun run dev                 # landing page, docs and playground on http://localhost:5173
bun run check               # everything CI runs except the build: format check, typecheck, test, verify-covenant
bun fmt                     # format in place; bun fmt --check only reports
bun run typecheck
bun run test                # bun:test
bun run build               # production build of the site, playground included
bun run registry:build      # rebuild public/r/ after editing registry/
bun .agents/skills/covenant/scripts/verify-covenant.mjs
git diff --cached --check
bun .agents/skills/covenant/scripts/check-commit-message.mjs <message-file>
```

Bun 1.4 is the only toolchain: package manager, script runner, test runner, formatter, bundler and dev server ([note](.agents/notes/implemented/process/2026-11-10-bun-toolchain.md)). Write `bun run test` and `bun run build`; bare `bun test` and `bun build` skip the scripts' flags.

Commit every change to the long-lived `dev` branch and push it; do not open a pull request per change. `dev` reaches `main` through one pull request, merged with a merge commit, only when the maintainer asks:

```sh
git switch dev && git pull --ff-only origin dev
git push origin dev
gh pr create --base main --head dev --title "<type(scope): description>" --body-file <file>
gh pr merge <number> --merge
git -C <main checkout> pull --ff-only origin main
```

The main checkout holds `main`; pull there after merging so new worktrees start from the merged state. CI ([`.github/workflows/ci.yml`](.github/workflows/ci.yml)) runs `bun run check` and `bun run build` on every push to `dev` and `main`, and [`pages.yml`](.github/workflows/pages.yml) deploys the built site to GitHub Pages on every push to `main`; run `bun run check` before pushing. See [the change workflow](.agents/skills/covenant/references/change-workflow.md#pushing-and-prs) and [the dev-branch note](.agents/notes/implemented/process/2026-11-04-dev-branch-workflow.md).

## Conventions

- **Documentation placement:** put project documentation in `./docs/`; keep only entry-point, discovery and legal files in the root, following the [placement rules and fixed-path exceptions](.agents/skills/covenant/references/docs-standard.md#document-placement).
- **Commit messages:** use English Conventional Commits (`type(scope): description`), following [message rules](.agents/skills/covenant/references/change-workflow.md#commit-messages); validate the prepared message before committing.
- **Decision records:** non-trivial changes follow [the note threshold](.agents/notes/README.md#when-to-write-one).
- **Instruction placement:** use [one home per fact](.agents/skills/covenant/references/instruction-tiers.md); add subtree files only under its necessity criterion.
- **Add code comments only when necessary**: explain non-obvious constraints, reasons or failure behavior that the code cannot express; omit comments that restate names, operations or control flow. Preserve required API documentation and script headers ([comment criteria](.agents/skills/covenant/references/prose-standard.md#coverage-requirements-by-location)).
- **Language:** write comments, instructions and documentation in English; put Chinese translations only in sibling `*.zh.md` files and update existing pairs together ([language requirement](.agents/skills/covenant/references/prose-standard.md#language)).
- **Prose:** follow [the prose standard](.agents/skills/covenant/references/prose-standard.md) and [documentation rules](.agents/skills/covenant/references/docs-standard.md#writing-rules).
- **Checks:** mechanically checkable requirements follow [the gate workflow](.agents/skills/covenant/references/gates.md#adding-a-gate); select evidence using [the change workflow](.agents/skills/covenant/references/change-workflow.md#choosing-evidence-before-pushing).
- **Names:** `jigsaw` names the project, package scope and registry; exports and registry items that draw a piece or icon start with `Puzzle` ([decision](.agents/notes/implemented/architecture/2026-11-11-jigsaw-and-puzzle-names.md)).
- **Determinism:** generation draws randomness only from `createRng` streams in `packages/core/src/prng.ts`, never `Math.random`; the same seed must keep drawing the same mosaic, so a change to the design is a breaking change and its note says so.
- **Registry copies:** `registry/jigsaw/*.tsx` are self-contained copies of library code that consumers install as source; change the library and the copy together and rebuild `public/r/` ([maintenance](docs/registry.md#maintain-the-registry)).

## Editing this file

Use one shared `AGENTS.md` filename without per-tool copies or symlinks; Claude Code reads it directly. Keep rules to 1–3 lines; follow [the budget policy](.agents/skills/covenant/references/instruction-tiers.md#word-budgets) before raising a ceiling.
