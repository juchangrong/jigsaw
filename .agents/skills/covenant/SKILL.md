---
name: covenant
description: Use when editing repository instructions, decision records, docs or comments; reviewing repository conventions; choosing pre-push checks; driving a pull request to merge; pausing or resuming work; or adopting covenant.
---

# covenant

Read the consuming checkout's root and applicable subtree `AGENTS.md` files. For notes, read its `.agents/notes/README.md`. These paths belong to the checkout, not the installed skill directory. Product, testing and release rules remain with that project.

## Task routing

Load the relevant reference, not the whole collection.

| Task | Reference | Templates |
|---|---|---|
| Instructions or skills | [instruction-tiers.md](references/instruction-tiers.md) | [root](templates/AGENTS.root.md), [subtree](templates/AGENTS.subtree.md), [skill](templates/skill.SKILL.md) |
| Testing whether a skill or instruction change alters agent behavior | [skill-evaluation.md](references/skill-evaluation.md) | — |
| Decision records | [agent-notes.md](references/agent-notes.md) | [proposed](templates/agent-note.proposed.md), [implemented](templates/agent-note.implemented.md), [rejected](templates/agent-note.rejected.md) |
| Comments, prompts or prose | [prose-standard.md](references/prose-standard.md) | — |
| Documentation structure | [docs-standard.md](references/docs-standard.md) | [postmortem](templates/postmortem.md) |
| Gates and configuration | [gates.md](references/gates.md) | [configuration](templates/covenant.json), [GitHub CI](templates/github-ci.yml), [GitHub ruleset](templates/github-ruleset.json) |
| Commits, scope, verification, review, PR follow-up or handoff | [change-workflow.md](references/change-workflow.md) | [PR](templates/pull_request_template.md) |
| Adoption | [bootstrap.md](references/bootstrap.md) | Follow the selected adoption level |

## Workflow

1. Establish [scope and authorization](references/change-workflow.md#scope-and-authorization).
2. For edits, apply the [note threshold](templates/notes-README.md#when-to-write-one) and update the owning note when required. For reviews, report note gaps as findings.
3. Apply the task reference. For any prose you write or review, load and apply [Writing philosophy](references/prose-standard.md#writing-philosophy), including its pre-delivery review, [Patterns of generated prose](references/prose-standard.md#patterns-of-generated-prose), [One reading per sentence](references/prose-standard.md#one-reading-per-sentence) and the [language requirement](references/prose-standard.md#language). Keep affected docs and output expectations consistent with the change.
4. Run [matching checks](references/change-workflow.md#choosing-evidence-before-pushing) and report results using [the reporting guidance](references/change-workflow.md#reporting).

## Verification

In a checkout with covenant installed:

```sh
node .agents/scripts/verify-covenant.mjs
git diff --check
```

Also run staged checks required by the project. Gate coverage and limits are in [gates.md](references/gates.md).
