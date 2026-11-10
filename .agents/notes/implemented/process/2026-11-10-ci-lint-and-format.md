# Agent Note: CI, lint and format checks

Status: implemented

## Problem

The only gate before a push was a list of commands in `AGENTS.md` that the author ran by hand, and nothing ran them again on the pushed commit. No linter was installed, although four `eslint-disable-line react-hooks/exhaustive-deps` comments assumed one, so the hook rules were never checked. No formatter was configured, and line length drifted up to 225 characters. The four workspace packages export TypeScript source and Vite-only `?raw` imports but were not marked private, so `pnpm publish -r` would have tried to publish them. The Node version was not pinned.

## Decision

A GitHub Actions workflow, `.github/workflows/ci.yml`, runs on every push to `dev` and `main`: `pnpm install --frozen-lockfile`, lint, format check, typecheck, tests, `verify-covenant` and the playground build, on the Node version in `.nvmrc`. Actions are pinned by commit SHA with the release tag in a comment. `pnpm check` runs the same steps locally, except the build.

ESLint uses the flat config in `eslint.config.js`: `@eslint/js` recommended, the type-checked `typescript-eslint` recommended set, and the React hooks recommended set for `.tsx` files. Unused disable comments are errors. Three rules are adjusted, each with its reason in the config: unused names starting with `_` are allowed, `require-await` is off, and promise-returning JSX event handlers are allowed.

Prettier formats code, JSON, YAML and CSS at a print width of 160. Markdown is excluded because the covenant prose rules own it, and `public/r/`, the golden signatures and `.agents/` are excluded as generated or vendored. The one-time reformat is its own commit, listed in `.git-blame-ignore-revs`.

`tsconfig.json` turns on `noUncheckedIndexedAccess` and `noImplicitOverride`. The workspace packages are `"private": true`. The root `package.json` declares `engines.node >= 22` and `.nvmrc` holds 24. `.editorconfig` records the indent, line ending and final newline that the files already use.

## Alternatives considered

**Biome instead of ESLint and Prettier.** It is one dependency and faster. It lost because the existing disable comments are ESLint's, the type-checked `typescript-eslint` rules found real defects that Biome does not check, and lint takes about five seconds here.

**The untyped `typescript-eslint` recommended set.** It needs no type information and runs faster. It lost because the type-checked set reported only 33 problems on the whole repository, including an unhandled promise and unsafe use of parsed JSON, so the stricter set costs little.

**A print width of 200, which matches how the code was written.** It changes the fewest lines (85 added, against 356 at 160). It lost because it leaves most of the long lines in place; 160 breaks the lines over 160 characters while leaving the dense data tables mostly on one line each. A width of 120 adds about 1,100 lines.

**A `pull_request` trigger.** It would also test the merge result of `dev` into `main`. It lost because every pull request here has `dev` as its head, so the push run already reports on the same commit, and a second trigger would run every check twice.

**Turning on `exactOptionalPropertyTypes`.** It reports 10 errors, all from passing `undefined` for an optional option. It lost because the options API accepts an explicit `undefined` on purpose, so the flag would force conditional spreads at every call site.

## Consequences

A push that fails lint, format, types, tests, the convention gate or the build is reported on the commit. A direct push to `dev` is still accepted when checks fail, because the branch has no protection rule; the run only reports.

`eslint --fix` once removed a type assertion that the compiler needs (`getContext("webgl2") as WebGL2RenderingContext | null` in `webgl2.ts`), so run `pnpm typecheck` after an automatic fix.

The lint fixes change two behaviours slightly. `<PuzzleIcon>` updates its `onRender` and `onError` callbacks in an effect instead of during render. The playground's assembly demo resets to scattered during render when a new set arrives, instead of in an effect; shuffling still scatters and then assembles, checked in the browser.

The action pins do not update themselves; no Dependabot or Renovate configuration exists yet. The GPU backends are still not exercised by any automated test, in CI or locally.

## Later changes

[The Bun toolchain note](2026-11-10-bun-toolchain.md) supersedes the parts of this decision about pnpm, Node, `.nvmrc` and ESLint: Bun runs every step, and no linter is installed. The workflow triggers, the pinned actions, Prettier at a width of 160, the two TypeScript flags and the private packages stay as described here.
