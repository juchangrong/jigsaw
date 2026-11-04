# Convention gates

## Conventions mapped to gates

The bundled [checker](../scripts/verify-covenant.mjs) requires Node 20+ and no dependencies. It exits 1 on violations and reports the failing file, rule and correction.

| Check | Coverage and limits |
|---|---|
| `docs-placement` | Root `.md`, `.mdx`, `.rst`, `.adoc` and `.txt` files outside `exclude`; permits README/AGENTS Markdown counterparts, LICENSE/LICENCE/NOTICE/COPYING legal files and a `CLAUDE.md` symlink whose real path is the root `AGENTS.md`; other formats and nested placement require review |
| `notes` | Note paths and format from [the note rules](../templates/notes-README.md); archived notes and translated counterparts skip format checks |
| `budgets` | Whitespace-delimited word counts; missing files and invalid ceilings fail |
| `links` | Relative Markdown targets and anchors; external URLs are not fetched |
| `wrap` | One physical line per paragraph, detected heuristically; not a complete Markdown parser |
| `language` | CJK ideographs and punctuation outside translated counterparts; language-switch links to counterparts are exempt |

The checker does not establish prose quality, behavioral accuracy, translation parity, archive immutability, declaration freshness or skill-client metadata compatibility. Add project-specific checks only for requirements the project adopts.

## Script usage and configuration

Run from the consuming checkout:

```sh
node .agents/scripts/verify-covenant.mjs
node .agents/scripts/verify-covenant.mjs --only notes,links
node .agents/scripts/verify-covenant.mjs --list --only budgets
```

`--root <dir>` selects another checkout; `--config <file>` selects a configuration path relative to it. Defaults come from the checker and are overridden by `.agents/covenant.json`; start with [the configuration template](../templates/covenant.json).

| Field | Purpose |
|---|---|
| `checks` | Enabled checks |
| `notesRoot`, `noteClasses` | Note location and allowed classes |
| `formatAdopted` | Earliest date requiring recorded alternatives |
| `budgets` | Existing file paths and word ceilings |
| `markdown` | Files scanned for links and paragraph wrapping, unless `linksScan` or `wrapScan` gives that check its own list |
| `linksScan`, `wrapScan` | Optional file lists for the links and wrap checks alone |
| `languageScan` | Files scanned for CJK text |
| `exclude` | Paths no check reads; a pattern ending in `/**` prunes that subtree from the walk; unused templates must be excluded |
| `counterpartPattern` | Translated filenames exempt from note-format and language checks |

File lists take `*`, `**` and `?` globs. An entry starting with `!` removes the paths that earlier entries selected, and the last entry matching a path decides, as in `.gitignore`, so a later entry can re-include one file under a removed directory. `exclude` takes no negation, because the walk never enters a pruned subtree. The walk never enters a symlinked directory, a `.git` or `node_modules` directory, or a nested checkout: a directory holding its own `.git`, such as another repository, a submodule or a worktree. Nested checkouts therefore need no `exclude` entry.

## Example hook and CI layout

Keep local hooks narrow: staged whitespace and fast note/link checks fit pre-commit. Run the full configured convention gate and other project checks in CI. Choose pre-push checks using [the change workflow](change-workflow.md#choosing-evidence-before-pushing); do not add a typechecker to a project that has none.

On GitHub, [github-ci.yml](../templates/github-ci.yml) runs the convention gate, a whitespace check of the whole tree and validation of incoming commit messages in its `verify` job. Its `pr-title` job validates the pull request title independently. The checkout fetches full history so the commit checker can enumerate `base..head`, including intermediate commits. Add the project's own checks to `verify`, and require both jobs with [github-ruleset.json](../templates/github-ruleset.json) as [bootstrap.md](bootstrap.md#l1-local-automation) describes. A required check is matched by job name, so renaming a job also updates the ruleset. A required job must report on every pull request: a workflow skipped by path or branch filters leaves its check pending and blocks the merge.

## Choosing the enforcement level

Fix a recurring mistake at the highest level that works. A mistake becomes a class when it happens twice. Recent commits, reverts, review comments and repeated corrections are the evidence. The consuming project owns its design rules; this order only selects where a correction lives.

1. **Structure.** Give each piece of state one owner and each task one supported way. Hide internals so a wrong import fails. Generate hand-synchronized lists from one source. Delete obsolete code that an agent can copy.
2. **Types.** Make the invalid state impossible to write.
3. **Gate.** Add a lint, checker or CI check whose diagnostic names the file, type or function to use instead. When existing code already contains the pattern, reject only additions.
4. **Test.** Assert observable behavior. The test fails when the behavior breaks and passes when only the internals change.
5. **Instruction.** Write an `AGENTS.md` rule or skill text only for judgment that levels 1–4 cannot decide. Nothing fails when an agent skips an instruction.

When a correction repeats a rule that exists without an enforcer, move the rule to a higher level in the same change. Delete an instruction when a higher level makes its mistake impossible. Record the chosen level, and the reason each higher level does not work, in the Agent Note.

## Adding a gate

1. Put the requirement in its owning instructions and the rationale in its Agent Note.
2. Implement diagnostics naming the failing subject, rule and correction.
3. Keep valid and invalid fixtures proving both acceptance and rejection. When the gate targets a mistake that already happened, build the invalid fixture from that real case. For this checker, extend [selftest.mjs](../scripts/selftest.mjs).
4. Register the command and appropriate hook or CI entry with the requirement. Prefer narrow, explained exceptions to disabling a check.
