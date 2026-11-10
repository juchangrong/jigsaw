# Agent Note: Bun toolchain

Status: implemented

## Problem

Installing, linting, formatting, testing, bundling and serving took six tools: pnpm, ESLint, Prettier, Vitest and Vite, with Node under all of them. The maintainer asked for one toolchain, Bun, and for ESLint to be removed. This note supersedes the pnpm, Node, ESLint and Prettier parts of [the CI, lint and format note](2026-11-10-ci-lint-and-format.md).

## Decision

Bun 1.4 is the package manager, script runner, test runner, formatter, bundler and dev server. Nothing in the repository needs Node.

The root `package.json` lists the workspaces and sets `packageManager` to the Bun version, which CI reads through `oven-sh/setup-bun`. `bun.lock` replaces `pnpm-lock.yaml`. `bunfig.toml` pins the public npm registry, because a lockfile written against a private mirror records the mirror's URLs and CI cannot reach them. It also sets `run.bun`, so `tsc` and the shadcn CLI run on Bun instead of looking for Node.

The tests import from `bun:test`. `bunfig.toml` sets the test root to `tests/`, so the covenant skill's own `.test.mjs` file is not collected. `bun run test` passes `--timeout 60000`, the limit the Vitest configuration had.

The playground is served by `bun ./index.html` and built by `bun build ./index.html --production`. The two shader files are imported with the `with { type: "text" }` import attribute instead of Vite's `?raw` suffix, and `packages/renderer/src/shaders.d.ts` declares the modules.

ESLint, its configuration, its plugins and the four `eslint-disable-line` comments are removed. `bun fmt` replaces Prettier: the `[fmt]` section of `bunfig.toml` keeps the width of 160 and the ignored paths, and no file needed reformatting. `tsc` with the strict flags stays as the type checker, because Bun has none.

## Alternatives considered

**Keeping pnpm, Vite and Vitest.** A trial before this change measured small gains from Bun: a warm install of 0.25 s against 0.95 s, and tests in about 13 s against 22 s. It lost because the maintainer prefers one tool to the smaller change.

**Bun as the package manager only, with the tools still on Node.** It needs no source changes. It lost because it keeps four tools and a Node requirement, which is what the change is meant to remove.

**Keeping ESLint.** On Bun it ran three times slower than on Node and reported one false error, an "unnecessary" type assertion in `webgl2.ts` that the compiler needs, so keeping it means keeping Node. The maintainer chose to drop it.

**Another linter that needs no Node, such as Biome or oxlint.** Either would keep some lint coverage. Neither was added because the request was to remove linting, not to replace it; one can be added later without touching the rest of this decision.

**A Bun plugin that keeps the `?raw` imports.** The source would stay as it was. It lost because the import attribute is standard syntax that Bun's runtime, test runner and bundler all load without configuration.

**Setting the test timeout in the test files.** `bunfig.toml` has no timeout setting, and `setDefaultTimeout` in a preload file did not apply to every test file. Calling it in each of the twelve files would work with a bare `bun test`. It lost because one flag in one script is less to keep in step.

## Consequences

A contributor installs Bun and nothing else; CI no longer sets up Node or pnpm. `bunfig.toml` makes every install use the public registry, whatever mirror a user's `.npmrc` names.

No linter runs. The hook dependency rules, unhandled promises and unsafe use of `any` are no longer checked; `tsc` still reports unused names and type errors, and `bun fmt --check` still gates formatting. The four hook dependency arrays that carried disable comments are narrower than their closures on purpose, keyed by a serialized value.

The scripts carry flags, so `bun run test` and `bun run build` are the commands to use. A bare `bun test` applies Bun's 5 s limit, and one interlock test takes about 6 s.

The tests run on JavaScriptCore instead of V8. All 188 pass and the golden signatures did not need a new baseline. Three kinds of test code changed. The matchers of `bun:test` are typed more strictly, so a few assertions take a `!` or a type argument. `vi.stubGlobal` does not exist, so `tests/react.test.ts` defines and restores `window` itself. The test that the plan queue yields counts message tasks instead of timers, because Bun delivers queued `MessageChannel` messages before any timer; in a browser the generator behaves as before.

The renderer's source now needs a bundler that understands the `text` import attribute. The packages are private and the registry component has no such import, so no consumer is affected.

The dev server and the production build were checked in a browser with the WebGPU, WebGL2 and CPU backends, and `bun run registry:build` writes the same `public/r/` files as before. Bun has no browser test mode, so automated tests of the GPU backends, still missing, would need a separate tool.
