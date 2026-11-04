# Prose standard

## Writing philosophy

Write according to the philosophy of Paul Graham and William Zinsser (*On Writing Well*): think clearly, write simply, be precise, be intellectually honest, and make every word earn its place. Optimize for the reader's understanding, not for sounding impressive. Apply the following requirements when drafting and reviewing prose; naming the authors alone does not satisfy them.

- **Resolve the thought before polishing the sentence.** Identify the claim, its evidence and what the reader needs to understand or do. If the claim is vague or contradictory, resolve it instead of covering it with fluent wording.
- **Lead with the point.** State the result, requirement or recommendation early, then supply the explanation needed to assess it. Order supporting facts so each sentence builds on what the reader already knows. Keep each paragraph focused on one idea; use lists for genuinely parallel items or steps.
- **Use direct, concrete language.** Prefer familiar words, active verbs and named actors. Replace abstract phrases with the actual action: “The checker rejects missing files” instead of “Validation of file presence is performed.” Keep a technical term when it is the most precise name for the mechanism, and explain it when the intended reader needs that context.
- **Match confidence to evidence.** Distinguish observed facts, inferences, recommendations and unknowns. State meaningful limits and trade-offs where they affect the conclusion. Remove unsupported certainty, promotional claims and vague hedges; identify the uncertainty itself. Do not imply that a check ran or a result was verified without evidence.
- **Make detail serve the reader.** Include explanations, examples and qualifications that help the reader decide, act or avoid a likely mistake. Remove ceremony, decorative transitions and repetition that add no information. Apply [Keep complete propositions](#keep-complete-propositions) when shortening; word count alone is not a quality measure.
- **Write with a natural, candid voice.** Use the tone of a thoughtful colleague. Avoid inflated praise, canned conclusions, rhetorical question-and-answer framing, and unprompted “not X, but Y” contrasts. State the intended point directly; use a contrast only when distinguishing real alternatives matters.

Before delivering text, check the opening for a clear point, each claim for appropriate evidence, and each paragraph for a distinct contribution. Read it once as the intended reader: revise any sentence that requires reconstructing an omitted connection or decoding unnecessary jargon. Resolve failures before delivery. This semantic review is required even when mechanical gates pass; do not add a compliance recital to the output.

## Language

Write code comments, doc comments, `AGENTS.md`, `README.md`, `SKILL.md` and other repository documentation in English by default. Chinese documentation belongs only in a sibling `<name>.zh.md` counterpart, such as `README.zh.md`; keep the unsuffixed original in English and update existing pairs together. Translations are optional. This rule governs repository content, not the language used to reply to the user. See [bilingual documentation](docs-standard.md#bilingual-documentation-optional) for optional translation checks.

## Inputs and exclusions

Use [scope and authorization](change-workflow.md#scope-and-authorization). Exclude vendor code and frozen archives; change generated content through its owning source or scenario.

## Keep complete propositions

Preserve conditions, ordering, modality, exceptions, ownership, side effects and failure guarantees when cutting text. Keep a non-obvious reason only when its omission invites misuse or incorrect simplification. Link architecture and rationale to their owner; local contract facts may repeat when needed at the point of use.

For example, shorten “carefully serializes writes, flushes before disposal completes, and reports backend failures” by deleting “carefully”. “Serializes persistence” loses ordering and failure guarantees.

## Coverage requirements by location

Add prose for facts the surrounding code or structure cannot express. Do not fill every location merely because it appears below.

| Location | Information worth retaining |
|---|---|
| Public API docs | Return distinctions, errors, side effects, ownership, timing, cancellation and persistence; each parameter and non-void return, using the project's doc-comment syntax |
| Internal or module comments | Non-local relationships, invariants, surprising failure behavior and reasons an obvious simplification is unsafe |
| Test comments | Why a fixture, indirect assertion or platform adaptation is necessary; not a test walkthrough |
| Configuration examples | Non-obvious access, wiring, ordering or compatibility constraints |
| Diagnostics | Failing subject, violated rule and actionable correction |
| Skills and instructions | Local conventions, decision criteria, operational constraints and task-specific exceptions |

Decision-record evidence belongs in [Agent Notes](agent-notes.md); document structure and incident criteria belong in [docs-standard.md](docs-standard.md).

Prompts and visible strings are behavior: review related labels, tooltips, placeholders and templates together. Update the owning snapshot or scenario when changing their meaning. If that scenario is outside the authorized scope, retain the wording and report the deferral rather than treating it as cosmetic editing.

Explain what an empty `catch` intentionally swallows and why unrelated errors cannot reach it. General exception-handling design belongs to the project's code rules.

## Remove redundant prose

- Give explanations one home; replace repeated explanations with links.
- Delete narrated control flow, obvious proofs, test walkthroughs, manual inventories derived from source, and generic advice the model already follows.
- In instructions, retain a sentence only if it changes a decision. Definitions of familiar concepts, motivational claims about agents and repeated warnings do not qualify.
- Remove decorative emphasis and implementation-status annotations. Keep searchable mechanism names and emphasis that marks a requirement or exception.

## Term check

Prefer “response fields”, “JSON validation” and “ESM exports” to vague uses of “shape” or “boundary”. Keep technical terms when they name an actual mechanism or obligation; do not ban them mechanically. Avoid metaphors in technical instructions.

Write the real symbol, file, flag or command name, not a synonym or a description of it. Call each thing by one name in a document; three names for one check teach the reader three checks. Replace metaphor nouns such as “substrate”, “wedge”, “vector”, “north star”, “flywheel” or “ratchet” with the plain word or the mechanism's name, unless the term is the mechanism's real name. A new coined term is acceptable when the document defines it at first use.

## Patterns of generated prose

Review drafts for these patterns. Each one adds words without information. Rewrite the sentence; do not only delete the marker word.

- **Inflated verbs and vocabulary.** “Serves as”, “stands as” and “boasts” mean “is” or “has”. “Leverage”, “utilize” and “facilitate” mean “use” or “help”. “Delve”, “pivotal”, “crucial”, “showcase”, “underscore” and “testament” rarely name anything the plain word does not.
- **Trailing participle phrases.** A clause such as “…, ensuring reliability” or “…, highlighting the need for X” claims an effect without evidence. State the effect as a fact with its cause, or delete it.
- **Unnamed sources.** Name the source of “experts say” or “it is widely known”, or delete the claim.
- **Forced structure.** Use the real count instead of a group of three, and the real items instead of a false range such as “from setup to scale”. Do not give a list item a bold label that only repeats the line; a bold lead-in is useful when the text after it adds new detail.
- **Feelings instead of mechanisms.** “Types that follow your schema” names a feeling; “a column rename fails the build” names the mechanism. If a sentence could appear unchanged in another project's documentation, it says nothing about this one: replace it with a fact, an instruction or a number, or cut it.
- **Stacked hedges and adverbs.** “Could potentially possibly” means “may”. Replace “significantly faster” with the measured change.
- **Conversation residue.** Remove greetings, offers of further help, praise of the question and title-case or emoji headings.
- **Over-compression.** Arrows, dropped articles and verbless fragments make the reader decode. Write “The parser rejects the date, exits with code 2 and writes nothing”, not “bad date → exit 2, no write”.

## One reading per sentence

Write each sentence so it has one reading. Readers include non-native speakers and translation tools.

- Put “only” and “not” next to the word they change: “fails only on growth” and “only fails on growth” differ.
- Break long noun strings: “the script that checks the import budget”, not “the import budget check script”.
- Make each “it”, “they” and “this” point at one noun. Repeat the noun when two candidates exist. Do not use “this” or “which” for a whole clause.
- Give each clause its own verb: “Phase 1 moves the converters and Phase 2 moves the runtime”.
- Write “a, b or both” instead of “a/b” or “and/or”. Do not form plurals with “(s)”.
- Repeat the article when two nouns name two things: “the client and the host”.

## Reasoning leakage

A reader at HEAD must be able to resolve every reference without the session transcript, review conversation or uncommitted draft. Remove “decision 7”, “the next PR”, reviewer rebuttals and narrated derivations; keep the resulting fact or invariant. Documentation's current-state rule is in [docs-standard.md](docs-standard.md#writing-rules).

Preserve resolvable issue references, reasons for suppressions and empty catches, measured limits, regression explanations such as “without X, Y happens”, and evidence cited in notes or postmortems. These can carry facts unavailable from the code alone.

## TODO marker semantics

`FIXME` blocks release unless explicitly accepted by a reviewer; `TODO` means soon; `XXX` means optional future work. A local cleanup marker names the safe condition and intended action, preferably with a stable tag. Decisions needing alternatives or trade-offs belong in an Agent Note.
