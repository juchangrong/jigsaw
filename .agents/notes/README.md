# Agent Notes

This file owns note naming and format. `bun .agents/skills/covenant/scripts/verify-covenant.mjs --only notes` checks the mechanical requirements.

## Layout and naming

Use `{lifecycle}/{class}/yyyy-mm-dd-topic-title.md`, dated when first proposed.

- Lifecycle: `proposed` for unimplemented or partial proposals; `implemented` for shipped decisions; `rejected` for rejected proposals whose rationale remains useful.
- Class: `feature`, `bug-fix`, `simplification`, `architecture`, `process`, or `testing`. Adding a class also updates `noteClasses` in `.agents/covenant.json`.
- Use relative Markdown links between notes. No `INDEX.md`; the directory tree is the list.

## When to write one

Every non-trivial change adds or updates an owning note in the same change. This includes behavior, architecture, cross-file contracts, process or tooling, test strategy, persisted or wire formats, and decisions worth revisiting. Only purely mechanical, local edits changing neither behavior nor rationale are exempt.

Keep implemented facts current. A different decision needs a new note with reciprocal supersession links, not a rewrite of the old conclusion. Delete a fully superseded note only after transferring its unique rationale, alternatives, consequences, verification evidence and coverage gaps, repairing links and handling translated counterparts together.

## File format

The first four lines are fixed:

```markdown
# Agent Note: <title>

Status: <status>

```

Status must match the directory: `proposed`, `implemented`, or `rejected — <one-line reason>`. Keep exactly one status line, with no date or parentheses. Format tokens stay in English.

| Lifecycle | Required sections, in order |
|---|---|
| `proposed` | Problem, Proposal, Alternatives considered, Acceptance criteria, Risks |
| `implemented` | Problem, Decision, Alternatives considered, Consequences |
| `rejected` | Preserve the proposal; put the verdict on the status line |

Sections use H2 headings and start with `## Problem`. Additional sections are allowed. Implemented decisions use present tense and cannot contain Proposal, Plan, Migration plan or Acceptance criteria headings.

Every note records real alternatives and why they lost, one paragraph per alternative. For notes dated before `formatAdopted` whose alternatives cannot be recovered, replace that section with `<!-- agent-note-format: alternatives-not-recorded (pre-format Agent Note) -->`; do not fabricate alternatives.

For proposed-to-implemented transitions, move the file, update status, rewrite Proposal as Decision and fold acceptance criteria and risks into consequences or verification evidence. For rejection, change path and status while freezing the proposal. Never archive a proposed note.
