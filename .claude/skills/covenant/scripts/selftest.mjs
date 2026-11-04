#!/usr/bin/env node
/**
 * selftest.mjs — prove gate checks and the copied L0 adoption defaults can both pass and turn red.
 * Usage: node selftest.mjs   (the fixtures are built in a temporary directory and removed afterwards)
 * Exit 0 when every fixture behaves as specified; exit 1 on an unexpected result.
 */

import { spawnSync } from 'node:child_process'
import { cpSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const CHECKER = resolve(dirname(fileURLToPath(import.meta.url)), 'verify-covenant.mjs')

function write(root, relPath, content) {
  const abs = resolve(root, relPath)
  mkdirSync(dirname(abs), { recursive: true })
  writeFileSync(abs, content)
}

function run(root, extra = [], checker = CHECKER) {
  const r = spawnSync(process.execPath, [checker, '--root', root, ...extra], { encoding: 'utf8' })
  return { status: r.status, out: r.stdout + r.stderr }
}

const proposed = `# Agent Note: A valid proposal

Status: proposed

## Problem

Motivation that stands without the solution.

## Proposal

What changes.

## Alternatives considered

**Do nothing.** Rejected because the problem persists.

## Acceptance criteria

- Observable end state.

## Risks

What could go wrong.
`

const implemented = `# Agent Note: A valid decision

Status: implemented

## Problem

Motivation.

## Decision

Present-tense shipped reality. See [the proposal](../../proposed/feature/2026-09-14-valid-proposal.md#proposal).

## Alternatives considered

**Alternative A.** Lost because of X.

## Consequences

Cost and benefit.
`

const rejected = `# Agent Note: A valid rejection

Status: rejected — premise gone

## Problem

Motivation.

## Proposal

The frozen proposal.

## Alternatives considered

**Alternative B.** Was judged worse.
`

const grandfathered = `# Agent Note: An old note

Status: implemented

## Problem

Old motivation.

## Decision

Old decision.

## Consequences

Old consequences.

<!-- agent-note-format: alternatives-not-recorded (pre-format Agent Note) -->
`

function validFixture() {
  const root = mkdtempSync(resolve(tmpdir(), 'covenant-valid-'))
  write(root, '.agents/covenant.json', JSON.stringify({
    checks: ['notes', 'budgets', 'links', 'wrap', 'language', 'docs-placement'],
    formatAdopted: '2026-01-01',
    budgets: { 'AGENTS.md': 200 },
    markdown: ['*.md', 'docs/**/*.md', '.agents/**/*.md'],
    exclude: ['node_modules/**', '.agents/notes/archived/**'],
  }))
  write(root, 'AGENTS.md', '# AGENTS.md\n\nOne rule per line. See [docs](docs/guide.md#usage).\n')
  // The approved Claude Code discovery link; every check must accept it.
  symlinkSync('AGENTS.md', resolve(root, 'CLAUDE.md'))
  write(root, 'docs/AGENTS.md', '# AGENTS.md — docs\n\nSubtree rules only; root rules live in [AGENTS.md](../AGENTS.md).\n')
  write(root, 'docs/guide.md', `---
description: "front matter is masked
across lines"
---

# Guide

English | [\u4e2d\u6587](guide.zh.md)

## Usage

One paragraph on one physical line, with a [same-file anchor](#usage) and a [root link](../AGENTS.md).

- list item one
  - nested item with \`inline [not a link](nope.md) code\`
- list item two

| a | b |
|---|---|
| 1 | 2 |

> a one-line blockquote

<details>
<summary>Folded</summary>

Folded prose on one line.

</details>

\`\`\`md
hard wrapped text inside a fence
is not a paragraph and [broken](missing.md) is not checked
\`\`\`

A paragraph immediately followed by a blockquote is two blocks, not one wrapped paragraph.
> Measured: the quote starts a new block.

\`\`\`\`markdown
outer fence opened with four backticks so three-backtick fences nest inside it:
\`\`\`text
inner content stays inside the outer fence [broken](missing.md)
\`\`\`
still inside: a closing fence must be bare and at least as long as the opener
\`\`\`\`

[ref]: ../AGENTS.md
`)
  // CJK is written with escapes so this file stays free of it, as the language check requires outside *.zh.md.
  write(root, 'docs/guide.zh.md', '# \u6307\u5357\n\n[English](guide.md) | \u4e2d\u6587\n')
  write(root, '.agents/notes/README.md', '# Agent Notes\n\nRules.\n')
  write(root, '.agents/notes/implemented/AGENTS.md', '# AGENTS.md — implemented\n\nKeep notes current.\n')
  write(root, '.agents/notes/proposed/feature/2026-09-14-valid-proposal.md', proposed)
  write(root, '.agents/notes/implemented/process/2026-09-14-valid-decision.md', implemented)
  write(root, '.agents/notes/implemented/process/2026-09-14-valid-decision.zh.md', '# Agent Note: A valid decision\n\nStatus: implemented\n\n## Problem\n\nA translated counterpart skips the note format checks.\n')
  write(root, '.agents/notes/implemented/process/2025-01-01-old-note.md', grandfathered)
  write(root, '.agents/notes/rejected/architecture/2026-09-14-valid-rejection.md', rejected)
  write(root, '.agents/notes/archived/process/2025-01-01-frozen.md', 'not a valid note\nand hard wrapped\n[broken](nope.md)\n')
  return root
}

function invalidFixture() {
  const root = validFixture()
  write(root, '.agents/covenant.json', JSON.stringify({
    checks: ['notes', 'budgets', 'links', 'wrap', 'language'],
    formatAdopted: '2026-01-01',
    budgets: { 'AGENTS.md': 5, 'docs/missing.md': 100 },
    markdown: ['*.md', 'docs/**/*.md', '.agents/**/*.md'],
    exclude: ['node_modules/**', '.agents/notes/archived/**'],
  }))
  write(root, '.agents/notes/INDEX.md', '# index\n')
  write(root, '.agents/notes/drafts/feature/2026-09-14-x.md', proposed)
  write(root, '.agents/notes/implemented/misc/2026-09-14-x.md', implemented)
  write(root, '.agents/notes/implemented/process/no-date.md', implemented)
  write(root, '.agents/notes/proposed/feature/sub/2026-09-14-deep.md', proposed)
  write(root, '.agents/notes/implemented/process/2026-09-14-bad-format.md', `# Agent Note: Bad format

Status: proposed

## Decision

Starts with the wrong section.

## Plan

Proposal-era heading.

Status: implemented
`)
  write(root, '.agents/notes/implemented/process/2026-09-14-new-grandfather.md', grandfathered)
  write(root, 'docs/broken.md', `# Broken

A paragraph that continues
on a second physical line.

[missing target](nope.md) and [missing anchor](guide.md#nope) and [same-file](#nope).

> a quoted paragraph whose second line
> is a real continuation inside the quote.
`)
  write(root, 'docs/untranslated.md', '# Untranslated\n\n\u8fd9\u6bb5\u662f\u4e2d\u6587\u3002\n\n[\u4e2d\u6587](AGENTS.md) does not point at a counterpart.\n')
  return root
}

function bootstrapFixture() {
  const root = mkdtempSync(resolve(tmpdir(), 'covenant-bootstrap-'))
  const skill = resolve(dirname(CHECKER), '..')
  cpSync(skill, resolve(root, '.agents/skills/covenant'), { recursive: true })
  cpSync(resolve(skill, 'templates/covenant.json'), resolve(root, '.agents/covenant.json'))
  mkdirSync(resolve(root, '.agents/scripts'), { recursive: true })
  cpSync(CHECKER, resolve(root, '.agents/scripts/verify-covenant.mjs'))
  mkdirSync(resolve(root, '.agents/notes/implemented/process'), { recursive: true })
  cpSync(resolve(skill, 'templates/notes-README.md'), resolve(root, '.agents/notes/README.md'))
  write(root, 'AGENTS.md', '# AGENTS.md\n\nFollow [the note format](.agents/notes/README.md).\n')
  write(root, '.agents/notes/implemented/process/2026-09-18-adopt-covenant.md', `# Agent Note: Adopt repository conventions

Status: implemented

## Problem

Repository rules need mechanical checks.

## Decision

L0 uses the supplied gate and config.

## Alternatives considered

Review alone cannot detect every broken link.

## Consequences

Conventions are verified locally.
`)
  return root
}

const EXPECTED_INVALID = [
  'INDEX.md — a central index is forbidden',
  'drafts/ — unknown lifecycle directory',
  'implemented/misc/2026-09-14-x.md — unknown class directory "misc"',
  'implemented/process/no-date.md — the file name must be yyyy-mm-dd-topic.md',
  'proposed/feature/sub/2026-09-14-deep.md — the path must be {lifecycle}/{class}/yyyy-mm-dd-topic.md',
  '2026-09-14-bad-format.md — line 3 must match the implemented status form',
  '2026-09-14-bad-format.md — `Status:` must appear exactly once',
  '2026-09-14-bad-format.md — the first section must be `## Problem`',
  '2026-09-14-bad-format.md — missing the `## Consequences` section that implemented requires',
  '2026-09-14-bad-format.md — `## Plan` is a proposal-era heading',
  '2026-09-14-bad-format.md — missing `## Alternatives considered`',
  '2026-09-14-new-grandfather.md — the grandfather comment is only valid for notes older than 2026-01-01',
  'budgets: AGENTS.md — ',
  'budgets: docs/missing.md — the budgeted file does not exist',
  'links: docs/broken.md:6 — link target does not exist: nope.md',
  'links: docs/broken.md:6 — anchor #nope has no matching heading or <a id> in docs/guide.md',
  'links: docs/broken.md:6 — anchor #nope has no matching heading or <a id> in docs/broken.md',
  'wrap: docs/broken.md:4 — paragraph spans several physical lines',
  'wrap: docs/broken.md:9 — paragraph spans several physical lines',
  'language: docs/untranslated.md:3 — CJK text on 2 line(s)',
]

let failures = 0
const valid = validFixture()
const invalid = invalidFixture()
const bootstrap = bootstrapFixture()
try {
  const ok = run(valid)
  if (ok.status !== 0 || !ok.out.includes('verify-covenant: pass')) {
    failures++
    console.error(`FAIL valid fixture: exit ${ok.status}\n${ok.out}`)
  }
  else console.log(`ok   valid fixture passes: ${ok.out.trim()}`)

  const bad = run(invalid)
  if (bad.status !== 1) {
    failures++
    console.error(`FAIL invalid fixture: expected exit 1, got ${bad.status}\n${bad.out}`)
  }
  for (const expected of EXPECTED_INVALID) {
    if (bad.out.includes(expected)) console.log(`ok   rejects: ${expected}`)
    else { failures++; console.error(`FAIL missing violation: ${expected}`) }
  }
  const unexpected = bad.out.split('\n').filter(l => l.startsWith('  ') && !EXPECTED_INVALID.some(e => l.includes(e)))
  for (const line of unexpected) console.log(`note unexpected extra violation: ${line.trim()}`)

  // Per-check file lists: a "!" entry removes earlier matches, and the last matching entry decides.
  write(valid, 'docs/legacy/old.md', '# Old\n\nA paragraph that is\nhard wrapped, in \u4e2d\u6587.\n\n[broken](nope.md)\n')
  write(valid, 'docs/legacy/kept.md', '# Kept\n\nAlso hard\nwrapped.\n')
  const scopes = {
    markdown: ['*.md', 'docs/**/*.md', '.agents/**/*.md'],
    wrapScan: ['*.md', 'docs/**/*.md', '!docs/legacy/**', 'docs/legacy/kept.md', '.agents/**/*.md'],
    languageScan: ['**/*.md', '!docs/legacy/**'],
    exclude: ['node_modules/**', '.agents/notes/archived/**'],
  }
  write(valid, '.agents/scoped.json', JSON.stringify(scopes))
  write(valid, '.agents/links-scoped.json', JSON.stringify({ ...scopes, linksScan: ['*.md', 'docs/**/*.md', '!docs/legacy/old.md', '.agents/**/*.md'] }))
  write(valid, '.agents/unscoped.json', JSON.stringify({ markdown: scopes.markdown, exclude: scopes.exclude }))
  for (const [config, present, absent] of [
    ['.agents/scoped.json', ['links: docs/legacy/old.md:6 — link target does not exist', 'wrap: docs/legacy/kept.md:4'], ['wrap: docs/legacy/old.md', 'language: docs/legacy/old.md']],
    ['.agents/links-scoped.json', ['wrap: docs/legacy/kept.md:4'], ['links: docs/legacy/old.md', 'wrap: docs/legacy/old.md', 'language: docs/legacy/old.md']],
    ['.agents/unscoped.json', ['links: docs/legacy/old.md:6', 'wrap: docs/legacy/old.md:4', 'wrap: docs/legacy/kept.md:4', 'language: docs/legacy/old.md:4'], []],
  ]) {
    const out = run(valid, ['--only', 'links,wrap,language', '--config', config]).out
    for (const expected of present) if (!out.includes(expected)) { failures++; console.error(`FAIL ${config} misses: ${expected}\n${out}`) }
    for (const stray of absent) if (out.includes(stray)) { failures++; console.error(`FAIL ${config} still reports: ${stray}\n${out}`) }
  }
  rmSync(resolve(valid, 'docs/legacy'), { recursive: true })
  write(valid, '.agents/negated-exclude.json', JSON.stringify({ exclude: ['docs/**', '!docs/guide.md'] }))
  const negated = run(valid, ['--only', 'links', '--config', '.agents/negated-exclude.json'])
  if (negated.status !== 1 || !negated.out.includes('config: exclude "!docs/guide.md" — exclude takes no negation')) {
    failures++; console.error(`FAIL negation in exclude is accepted\n${negated.out}`)
  }
  console.log('checked per-check file lists and negation')

  // A directory holding its own .git is another checkout (a worktree or submodule has a .git file, a repository a .git directory).
  const nestedDoc = '# Nested\n\nHard\nwrapped [broken](nope.md), \u4e2d\u6587.\n'
  write(valid, 'docs/worktree/.git', 'gitdir: /elsewhere/.git/worktrees/worktree\n')
  write(valid, 'docs/worktree/nested.md', nestedDoc)
  write(valid, 'docs/repository/.git/HEAD', 'ref: refs/heads/main\n')
  write(valid, 'docs/repository/nested.md', nestedDoc)
  const nested = run(valid, ['--only', 'links,wrap,language'])
  if (nested.status !== 0) { failures++; console.error(`FAIL nested checkouts are scanned\n${nested.out}`) }
  rmSync(resolve(valid, 'docs/worktree/.git'))
  rmSync(resolve(valid, 'docs/repository/.git'), { recursive: true })
  const unnested = run(valid, ['--only', 'links,wrap,language']).out
  for (const dir of ['docs/worktree', 'docs/repository']) {
    for (const expected of [`links: ${dir}/nested.md:4`, `wrap: ${dir}/nested.md:4`, `language: ${dir}/nested.md:4`]) {
      if (!unnested.includes(expected)) { failures++; console.error(`FAIL without .git, missing: ${expected}\n${unnested}`) }
    }
    rmSync(resolve(valid, dir), { recursive: true })
  }
  console.log('checked nested checkouts')

  for (const file of ['README.md', 'README.zh.md', 'LICENSE.txt', 'docs/guide.md', 'CHANGELOG.md']) write(valid, file, '# Allowed\n')
  write(valid, '.agents/changelog-excluded.json', JSON.stringify({ exclude: ['CHANGELOG.md'] }))
  const placement = (config = '.agents/changelog-excluded.json') => run(valid, ['--only', 'docs-placement', '--config', config])
  const placementOk = placement()
  if (placementOk.status !== 0) { failures++; console.error(`FAIL allowed document placement: ${placementOk.out}`) }
  const notExcluded = placement('.agents/covenant.json')
  if (notExcluded.status !== 1 || !notExcluded.out.includes('docs-placement: CHANGELOG.md')) {
    failures++; console.error(`FAIL root document outside exclude: CHANGELOG.md\n${notExcluded.out}`)
  }
  for (const file of ['guide.md', 'guide.zh.md', 'architecture.mdx', 'report.rst', 'design.adoc', 'manual.txt']) {
    write(valid, file, '# Misplaced\n')
    const misplaced = placement()
    if (misplaced.status !== 1 || !misplaced.out.includes(`docs-placement: ${file}`)) {
      failures++; console.error(`FAIL misplaced document rejection: ${file}\n${misplaced.out}`)
    }
    rmSync(resolve(valid, file))
  }
  const claudeMd = resolve(valid, 'CLAUDE.md')
  for (const [found, create] of [
    ['a regular file', () => cpSync(resolve(valid, 'AGENTS.md'), claudeMd)],
    ['a symlink to docs/guide.md', () => symlinkSync('docs/guide.md', claudeMd)],
    ['a broken symlink to missing.md', () => symlinkSync('missing.md', claudeMd)],
  ]) {
    rmSync(claudeMd)
    create()
    const rejected = placement()
    if (rejected.status !== 1 || !rejected.out.includes(`docs-placement: CLAUDE.md — a root CLAUDE.md must be a symlink resolving to AGENTS.md, found ${found};`)) {
      failures++; console.error(`FAIL CLAUDE.md rejection: ${found}\n${rejected.out}`)
    }
  }
  console.log('checked root document acceptance and rejection')

  const list = run(valid, ['--list', '--only', 'budgets'])
  if (!/ok\s+\d+ \/ 200\s+AGENTS\.md/.test(list.out)) { failures++; console.error(`FAIL --list output:\n${list.out}`) }
  else console.log('ok   --list prints budget rows')

  const copiedChecker = resolve(bootstrap, '.agents/scripts/verify-covenant.mjs')
  const adopted = run(bootstrap, [], copiedChecker)
  if (adopted.status !== 0 || !adopted.out.includes('verify-covenant: pass')) {
    failures++
    console.error(`FAIL L0 adoption fixture: exit ${adopted.status}\n${adopted.out}`)
  }
  else console.log(`ok   copied L0 adoption passes: ${adopted.out.trim()}`)

  write(bootstrap, '.agents/skills/covenant/references/broken.md', '# Broken reference\n\n[Missing target](missing.md).\n')
  const brokenReference = run(bootstrap, [], copiedChecker)
  if (brokenReference.status !== 1 || !brokenReference.out.includes('links: .agents/skills/covenant/references/broken.md:3 — link target does not exist: missing.md')) {
    failures++
    console.error(`FAIL L0 adoption reference check: expected a broken-link violation and exit 1, got ${brokenReference.status}\n${brokenReference.out}`)
  }
  else console.log('ok   copied skill references still reject broken links')
}
finally {
  rmSync(valid, { recursive: true, force: true })
  rmSync(invalid, { recursive: true, force: true })
  rmSync(bootstrap, { recursive: true, force: true })
}

if (failures > 0) {
  console.error(`selftest: ${failures} failure(s)`)
  process.exit(1)
}
console.log('selftest: all checks behave as specified')
