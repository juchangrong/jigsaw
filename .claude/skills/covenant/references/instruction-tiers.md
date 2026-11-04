# Instruction tiers and one home per fact

Give each rule one owner. Elsewhere, link to it; retain only the short local requirement needed at the point of use.

## File layout

Root `AGENTS.md` holds repository-wide instructions. Keep each rule to 1–3 lines with a link to its details or rationale. Use [the root template](../templates/AGENTS.root.md), filling only sections the project needs.

Subtree `AGENTS.md` files are optional: create one only for distinct, recurring local instructions whose separation materially reduces irrelevant root context. A concise root rule or link is preferable when sufficient. Directory size, depth and template availability do not justify a file. A justified subtree file links the root and adds only local rules; remove it when those rules fit the root, repairing links and budgets.

Use `AGENTS.md` as the shared instruction filename, without per-tool copies. A root `CLAUDE.md` symlink to `AGENTS.md` is the approved discovery link for Claude Code because it has no content of its own; a regular `CLAUDE.md`, or one linking elsewhere, is a second instruction file. Skill discovery links such as `.claude/skills` are separate from instruction files; installation is covered by [bootstrap.md](bootstrap.md).

## Tier table: each kind of content has one home

| Content | Owner |
|---|---|
| Standing requirements | Root or justified subtree `AGENTS.md` |
| Behavior, configuration, failures and compatibility | Source docs or the owning module page under `docs/` |
| Cross-module structure | Architecture document |
| Decisions, alternatives and trade-offs | Agent Note |
| Incident sequence, cause and prevention | Postmortem |
| Reusable workflows and judgment | Skill |
| Generated inventories | Generator; prose links to its output |

## Word budgets

Set budgets in `.agents/covenant.json` for standing instructions, including each subtree file. Suggested starting ceilings: root 1500 words, subtree 600, architecture 2000. Exhaustive references and decision records need no word ceiling.

Before raising a ceiling, move misplaced content to its owner and remove redundancy. Preserve conditions, exceptions and ordering. Keep 5% headroom while under budget; do not raise an exceeded ceiling without explaining why the remaining content needs it. Count semantics and missing-file behavior are documented in [gates.md](gates.md).

## Skills directory conventions

- Use `.agents/skills/<name>/SKILL.md`, with a project prefix unless the repository specifies another layout or naming convention.
- Frontmatter requires `name` and a description beginning with “Use when”. Describe distinct triggers and ownership exclusions, not a synonym list. Preserve the existing invocation policy; manual-only skills use `disable-model-invocation: true` and `user-invocable: true` where supported by the consuming client.
- State scope and where to find the consuming checkout's rules. Keep relative resource links inside the installed skill directory.
- Link every bundled reference directly from `SKILL.md`, with a condition for loading it. Put ordered actions in steps; use examples only for judgments likely to be misapplied.
- Include verification and the expected report. Use [the skill template](../templates/skill.SKILL.md) without retaining empty sections.
- When a skill change claims to alter agent behavior, test the claim with a [behavior evaluation](skill-evaluation.md); gates check only the form.

A sentence earns its place only if it changes the agent's decision: a local convention, non-obvious constraint, operational fact or useful distinction. Delete background definitions, generic competence reminders and repeated rules rather than paraphrasing them. If deleting a sentence leaves the same behavior, delete it.
