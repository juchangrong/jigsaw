# Agent Note workflow

The consuming checkout's `.agents/notes/README.md` owns naming, format and the note threshold; [notes-README.md](../templates/notes-README.md) is its installable template. This reference owns supersession and archival judgment.

## Editing a note

1. Find the note owning the decision before creating another. Follow its current paths and mechanisms; do not rewrite it into a different decision.
2. For a new decision, use the matching [proposed](../templates/agent-note.proposed.md), [implemented](../templates/agent-note.implemented.md) or [rejected](../templates/agent-note.rejected.md) template and check related notes for supersession.
3. When changing lifecycle, update the path, status and required sections together. The transition rules are in [the format owner](../templates/notes-README.md#file-format).
4. Verify note format and links using [the gates](gates.md).

## Superseding, merging and archiving

Search related decisions, mechanisms and rejected alternatives before adding a note.

- Partial supersession: retain both notes, link them in both directions and update facts that remain valid.
- Full supersession: transfer every unique rationale, alternative, consequence, verification result and named coverage gap before deleting the old note. Repair inbound links and move or delete translated counterparts together. Git history alone is not a substitute for preserved rationale.

A removal decision fully supersedes an addition only when no production behavior, configuration, persisted or wire format, compatibility path, current documentation or test still treats the feature as supported. Keep the original motivation, why it no longer applies, alternatives to removal, capability lost, reintroduction conditions and removal evidence. A remaining migration or compatibility obligation makes supersession partial.

Archive only implemented decisions with no remaining value for future choices. Keep notes containing relevant alternatives, ownership, negative guarantees, persistence semantics, security constraints or reintroduction conditions, regardless of length or age. For example, a short persistence decision can remain authoritative while a long obsolete argument-parser note has no further value.

When archiving is adopted, move the complete file group to `archived/{class}/`, add `Archived: YYYY-MM-DD` immediately after the status, repair links and freeze the contents. The note-format gate skips archives; an append-only content-hash check must enforce immutability. Proposed notes are resolved or rejected, never archived. Delete rejected notes only when their rationale can no longer prevent a recurring mistake.
