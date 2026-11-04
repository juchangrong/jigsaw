# Agent Note: Adopt covenant conventions

Status: implemented

## Problem

The repository had no written agent instructions, decision records or convention checks. Agents had to rediscover from the code that the shaders mirror the TypeScript reference, that generation must stay deterministic and how changes reach `main`. Commit messages, prose and documentation placement followed no stated rule.

## Decision

The repository adopts covenant at level L0, with no CI and no host settings.

- `AGENTS.md` holds the project instructions, the commands and the conventions. `CLAUDE.md` is a symlink to it.
- The skill lives at `.agents/skills/covenant/`, copied from `juchangrong/skills` at `f61e477`. `.claude/skills` is a symlink to `../.agents/skills`, so Claude Code and other agents read one copy.
- Decision records live in `.agents/notes/`, whose README owns note naming, format and the note threshold. `formatAdopted` is 2026-11-04.
- `.agents/scripts/verify-covenant.mjs` runs the notes, budgets, links, wrap, language and docs-placement checks configured in `.agents/covenant.json`. `AGENTS.md` has a 1,500-word budget.
- Commit messages are English Conventional Commits, checked with the skill's `check-commit-message.mjs`.
- Changes reach `main` through a pull request merged with a merge commit, as PR #1 was.
- Three project rules move into `AGENTS.md`: shader parity across `shading.ts`, WGSL and GLSL; randomness only from `createRng`, with version bumps when output changes; and golden signatures re-baselined in the same change as an intended image change.

The hard-wrapped paragraphs in `README.md` and `docs/design.md` are joined into one line each so the wrap check passes. Their words are unchanged.

## Alternatives considered

**Adopt L1 now.** This adds the GitHub CI workflow, a PR template, merge-commit-only repository settings and a ruleset protecting `main`. It lost because it changes the GitHub repository's settings, and the user chose local files only. Until CI exists, the commands in `AGENTS.md` are the only enforcement, and nothing blocks a merge that skips them.

**Keep the skill under `.claude/skills/` only.** That is where the skill was first installed. It lost because covenant's layout puts the source in `.agents/skills/` and links Claude's directory to it, so agents other than Claude Code find the same copy.

**Exclude `README.md` and `docs/design.md` from the wrap check.** This would avoid touching existing documents. It lost because joining the lines is mechanical and keeps one rule for every Markdown file. A `wrapScan` exception would need a reason recorded for each file.

## Consequences

`node .agents/scripts/verify-covenant.mjs` passes on the adopted tree. A deliberate violation in an isolated copy is rejected: a note whose status does not match its directory. `pnpm typecheck` and `pnpm test` are unaffected.

Gaps: no CI runs the gate or the commit-message checker, and `main` is not protected. The copied skill does not update itself; refresh it from `juchangrong/skills` when the source changes. Notes dated before 2026-11-04 do not exist, so no decisions were migrated.
