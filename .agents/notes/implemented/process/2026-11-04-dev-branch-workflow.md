# Agent Note: Commit to a dev branch

Status: implemented

## Problem

After adopting covenant, every change went out as its own branch and pull request, five PRs (#2 to #6) in one session. Each one-commit PR needed a separate review and merge, and parallel PRs touching the same golden file and version line conflicted with each other. The maintainer asked to stop opening frequent PRs and to commit all changes to a `dev` branch.

## Decision

All changes are committed to the long-lived `dev` branch and pushed. No pull request is opened per change. `dev` reaches `main` through one pull request, merged with a merge commit, only when the maintainer asks. This partly supersedes the merge flow in [Adopt covenant conventions](2026-11-04-adopt-covenant-conventions.md): pull requests into `main` are still merged with merge commits, but their head is `dev`. `AGENTS.md` lists the commands.

Separate agent sessions are started for tasks when that helps, without asking each time.

## Alternatives considered

**Keep one pull request per change.** This is the covenant default and gives each change its own review. It lost because the maintainer asked to stop. Changes that rewrite shared generated files, like the golden signatures, also conflict when they are open in parallel.

**Commit directly to `main`.** This is the simplest flow. It lost because `main` would stop being a reviewed state, and the maintainer named a `dev` branch.

## Consequences

Changes land on `dev` immediately and in order, so a change that rewrites the golden signatures sees the previous one's baseline. `main` moves only through a reviewed `dev` → `main` pull request. Without CI, the local checks in `AGENTS.md` are the only gate before pushing `dev`.

The open pull requests at the time of this note, #4 (playground polish) and #5 (vivid palettes), predate the flow and are not yet on `dev`.
