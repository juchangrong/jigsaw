# Documentation standard

Use the consuming project's format. This reference owns document placement and structure; sentence-level editing belongs to [prose-standard.md](prose-standard.md).

## Document placement

Put project documentation under repository-root `./docs/`, organized by topic or module. Do not add standalone guides, architecture documents, reports or postmortems at the repository root. Keep Chinese counterparts beside their English originals in `docs/`.

Root `README.md` and its translations remain concise entry points linking to `docs/`; `AGENTS.md`, with its optional [`CLAUDE.md` discovery link](instruction-tiers.md#file-layout), remains at its discovery location. License and legal notices keep their conventional locations. Agent Notes stay in `.agents/notes/`, and skill entry points, bundled references and templates stay inside their skill directory so installed skills remain self-contained. These exceptions do not permit unrelated project documentation beside them.

The `docs-placement` gate rejects any other root Markdown, MDX, reStructuredText, AsciiDoc or text document. To keep such a document at the root, list its exact path in [`exclude`](gates.md#script-usage-and-configuration) and record the reason in an Agent Note; the exclusion also removes it from the link, wrap and language checks. Review placement of other formats and nested files manually. When moving documentation, update incoming links and move translated counterparts together.

## Document structure

Keep detail at its owning topic or module under `docs/`. Parent pages explain direct children by purpose and link to their detail; do not reproduce API, field, fixture or module inventories.

Give each page one mode. Two questions select it: does the reader act or try to understand, and is the reader learning or working?

| Mode | Reader | Content |
|---|---|---|
| Tutorial | Learning by doing | Ordered steps, each with a visible result and the expected output; explanation cut to a clause and a link |
| How-to | Working toward a goal | Steps for one task named by that task, such as “Rotate the signing key”; conditions before the steps they guard; no background |
| Reference | Looking up a fact | Options, limits and errors, structured like the thing described; no instructions or opinion; generated from source where possible |
| Explanation | Understanding a decision | One topic with its context, constraints and trade-offs; the only mode that states opinion |

When a page needs a second mode, split it and link the parts. Use only sections the reader needs. A short README does not require metadata, a table of contents, empty limitations or contributor guidance merely because a template provides them.

## Writing rules

- Describe current behavior. Route change history, PR references and decision rationale to notes or postmortems.
- Use one physical line per paragraph; tables, lists and code retain their structure.
- Use relative Markdown links for repository references so the link gate can check targets and anchors.
- Verify copied declarations and generated listings against their source. Prefer a compiler or freshness check to manual synchronization.

## Page structure

For projects that adopt a full documentation-page format, use the following order. Existing project templates own the details; adopting this skill does not automatically add that format to every page.

1. Frontmatter containing the consumed `description` and `kind` fields, followed by the title and any language switch.
2. A summary of reader-visible capability and its main limit; module summaries stay within 100 words.
3. A table of contents when navigation warrants one.
4. Usage and observable outcomes before configuration and operations; implementation concepts last, optionally in `<details>`.
5. Relevant limitations and a clearly non-authoritative Dev Note only when there is content for them.

If a project uses `kind` to select templates, each value needs an actual template and an owner. Do not invent unused metadata or maintain a parallel kind inventory in this skill.

## Fact-check: test, do not assume

Verify operational claims against the current checkout. Before writing installation guidance, inspect the package and entry point; directory names are not evidence of how a product installs.

Run asserted commands when authorized and available. If credentials, network access or another prerequisite prevent verification, identify the unchecked claim and its verification owner. Do not present inferred output as observed output. Compare existing pages with the main-branch version, but resolve discrepancies against the implementation.

## Postmortem

Write one only when the mechanism is non-obvious, the escape reflects a systemic gap, and rediscovery would be costly. Use [the template](../templates/postmortem.md) to retain impact, incident sequence, cause, why checks missed it and linked prevention measures. Put reusable design decisions in Agent Notes. If the project uses a numbered incident directory, maintain its index there.

## Bilingual documentation (optional)

Follow the [language requirement](prose-standard.md#language) for originals and Chinese counterparts; adopting covenant does not require translations. When the strict three-file scheme is adopted, keep `foo.md`, `foo.zh.md` and `foo.i18n.yaml` together. The sidecar records both git blob hashes at the last confirmed match.

For that scheme, update both languages together and preserve heading order and depth, list kinds and counts, table dimensions, exact code blocks, corresponding links and physical line counts. Keep note-format tokens in English. A matching sidecar records confirmation, not translation quality. The bundled gate exempts translated counterparts from note-format and language checks; it does not verify translation parity.
