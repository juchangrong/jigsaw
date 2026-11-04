# AGENTS.md

<One-sentence project purpose. Link only the owning documents required for specific changes.>

## Repository layout

```text
<directory>/  <responsibility>
.agents/      skills, decision records and convention gates
```

## Commands

```sh
<project's actual build and focused test commands>
node .agents/scripts/verify-covenant.mjs
git diff --cached --check
```

<For a protected branch, include the host's create/check/merge commands. Replace this GitHub CLI example when using another host or merge method.>

```sh
gh pr create --base main --head <branch> --title "<type(scope): description>" --body-file <file>
gh pr checks <number> --watch
gh pr merge <number> --merge
git -C <main-checkout> pull --ff-only origin main
```

Replace `<main-checkout>` with the path from `git worktree list` that holds `main`, or adapt the branch name to the project's target branch. After merging, pull there so new worktrees based on the local target branch include the merged changes. `--ff-only` refuses diverged history; pulling in a feature worktree updates its branch instead. See [the change workflow](.agents/skills/covenant/references/change-workflow.md#pushing-and-prs).

## Configuration

<Project-specific environment, dependencies and constraints; omit this section if none.>

## Conventions

- **Documentation placement:** put project documentation in `./docs/`; keep only entry-point, discovery and legal files in the root, following the [placement rules and fixed-path exceptions](.agents/skills/covenant/references/docs-standard.md#document-placement).

- **Commit messages:** use English Conventional Commits (`type(scope): description`), following [message rules](.agents/skills/covenant/references/change-workflow.md#commit-messages); validate the prepared message before committing.

- **Decision records:** non-trivial changes follow [the note threshold](.agents/notes/README.md#when-to-write-one).
- **Instruction placement:** use [one home per fact](.agents/skills/covenant/references/instruction-tiers.md); add subtree files only under its necessity criterion.
- **Add code comments only when necessary**: explain non-obvious constraints, reasons or failure behavior that the code cannot express; omit comments that restate names, operations or control flow. Preserve required API documentation and script headers ([comment criteria](.agents/skills/covenant/references/prose-standard.md#coverage-requirements-by-location)).
- **Language:** write comments, instructions and documentation in English; put Chinese translations only in sibling `*.zh.md` files and update existing pairs together ([language requirement](.agents/skills/covenant/references/prose-standard.md#language)).
- **Prose:** follow [the prose standard](.agents/skills/covenant/references/prose-standard.md) and [documentation rules](.agents/skills/covenant/references/docs-standard.md#writing-rules).
- **Checks:** mechanically checkable requirements follow [the gate workflow](.agents/skills/covenant/references/gates.md#adding-a-gate); select evidence using [the change workflow](.agents/skills/covenant/references/change-workflow.md#choosing-evidence-before-pushing).
- <Other project-specific requirements that change agent behavior, with links to their owners.>

## Editing this file

Use one shared `AGENTS.md` filename without per-tool copies. Keep rules to 1–3 lines; follow [the budget policy](.agents/skills/covenant/references/instruction-tiers.md#word-budgets) before raising a ceiling.
