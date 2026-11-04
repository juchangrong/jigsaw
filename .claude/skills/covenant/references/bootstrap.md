# Adopt covenant

## L0: required files

1. Adapt [AGENTS.root.md](../templates/AGENTS.root.md) to the project's actual paths, commands and rules. Remove unused sections and placeholder links.
2. Install this skill at `.agents/skills/covenant/`. When this repository owns the skill source, use a symlink instead of a duplicate. For shared Claude discovery, create `.claude/` and link `.claude/skills` to `../.agents/skills`. A root `CLAUDE.md`, when wanted, is the [approved discovery link](instruction-tiers.md#file-layout): `ln -s AGENTS.md CLAUDE.md`.
3. Create `.agents/notes/` with [notes-README.md](../templates/notes-README.md) as its README. Record the adopted conventions in an implemented process note using [the note workflow](agent-notes.md).
4. Install the bundled checker at `.agents/scripts/verify-covenant.mjs` and adapt [covenant.json](../templates/covenant.json) at `.agents/covenant.json`. Budget existing files only; exclude unused skill templates, not the skill's instructions or references. Choose language checks to match the project's policy.
5. Register the gate command and note requirement in the root instructions. Run the gate, then confirm it rejects a deliberate violation in an isolated fixture.
6. If migrating existing decisions, apply the note format and set `formatAdopted` to the adoption date. Do not invent unrecorded alternatives.

## L1: local automation

- Add subtree instructions only under the [necessity criterion](instruction-tiers.md#file-layout), with a budget when each file is created.
- Wire applicable hooks and CI using [the gate guidance](gates.md#example-hook-and-ci-layout).
- On GitHub, copy [github-ci.yml](../templates/github-ci.yml) to `.github/workflows/`, then allow only merge commits and protect the default branch with [the ruleset](../templates/github-ruleset.json). Raise its `required_approving_review_count` when the project has reviewers. Its `require_extra_approval_for_unattributed_changes` states GitHub's default: a pull request containing a commit that GitHub cannot attribute to an account needs one more approval, from someone other than its author.

  ```sh
  gh api -X PATCH repos/{owner}/{repo} -F allow_squash_merge=false -F allow_merge_commit=true -F allow_rebase_merge=false -F delete_branch_on_merge=true -f merge_commit_title=MERGE_MESSAGE -f merge_commit_message=PR_TITLE
  gh api -X POST repos/{owner}/{repo}/rulesets --input .agents/skills/covenant/templates/github-ruleset.json
  ```
- Rulesets depend on the repository plan and visibility. If GitHub rejects the ruleset API as unsupported, record the missing enforcement and require maintainers to check CI before merging; changing visibility or billing requires a separate decision.
- Adapt [the PR template](../templates/pull_request_template.md) to the host and project's review process.

## L2: as needed

Adopt [full documentation pages or bilingual pairing](docs-standard.md), postmortems, generated references or [frozen note archives](agent-notes.md#superseding-merging-and-archiving) only when the project needs them and their checks exist. A larger note count or a template's availability is not itself a reason to add infrastructure.

Language-specific checks, coverage thresholds, replay systems, vendoring rules and plugin architectures belong to the adopting project. Do not copy them from an example project into a general convention.

On Windows without symlink permission, copy `.agents/skills/` to `.claude/skills/` and refresh the copy when skills change. The `CLAUDE.md` link has no copy fallback: Git checks it out there as a regular file, which `docs-placement` rejects.
