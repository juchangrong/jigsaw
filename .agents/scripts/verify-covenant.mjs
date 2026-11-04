#!/usr/bin/env node
/**
 * verify-covenant.mjs — zero-dependency gate for the repository conventions (Node >= 20).
 *
 * Checks (enabled by `checks` in .agents/covenant.json):
 *   notes         Agent Note tree is closed, file names, first four lines, Status matches the directory, lifecycle skeleton, Alternatives considered.
 *   docs-placement root documents belong in docs/ except README, AGENTS, legal files and a CLAUDE.md symlink to AGENTS.md.
 *   budgets       `wc -w` word ceilings for standing documents; a missing file also fails.
 *   links         relative Markdown link targets exist; `#anchor` matches a real heading slug or an `<a id>`.
 *   wrap          one paragraph is one physical line (heuristic, no AST parsing).
 *   language      no CJK outside a translated counterpart such as <name>.zh.md; a link pointing at one may use its native name.
 *
 * Usage: node verify-covenant.mjs [--root <dir>] [--config <file>] [--only a,b] [--list]
 * Any violation exits 1; every diagnostic reads "file — rule — fix".
 */

import { existsSync, readFileSync, readdirSync, readlinkSync, realpathSync, statSync } from 'node:fs'
import { basename, dirname, resolve } from 'node:path'
import { parseArgs } from 'node:util'

const { values: args } = parseArgs({
  options: {
    root: { type: 'string' },
    config: { type: 'string' },
    only: { type: 'string' },
    list: { type: 'boolean', default: false },
    help: { type: 'boolean', default: false },
  },
})

if (args.help) {
  process.stdout.write(readFileSync(new URL(import.meta.url), 'utf8').split('\n').slice(1, 16).map(l => l.replace(/^ \*\/?\s?/, '')).join('\n') + '\n')
  process.exit(0)
}

const ROOT = resolve(args.root ?? process.cwd())
const CONFIG_PATH = resolve(ROOT, args.config ?? '.agents/covenant.json')

const DEFAULTS = {
  checks: ['notes', 'budgets', 'links', 'wrap', 'language', 'docs-placement'],
  notesRoot: '.agents/notes',
  noteClasses: ['feature', 'bug-fix', 'simplification', 'architecture', 'process', 'testing'],
  noteTitlePrefix: '# Agent Note: ',
  formatAdopted: '2026-01-01',
  counterpartPattern: '\\.[a-z]{2}(?:-[A-Za-z]{2,4})?\\.md$',
  budgets: {},
  markdown: ['*.md', 'docs/**/*.md', '.agents/**/*.md'],
  languageScan: ['**/*.md', '**/*.mjs', '**/*.cjs', '**/*.js', '**/*.ts', '**/*.json', '**/*.yml', '**/*.yaml', '**/*.sh'],
  exclude: ['node_modules/**', 'vendor/**', '.agents/notes/archived/**'],
}

const cfg = { ...DEFAULTS, ...(existsSync(CONFIG_PATH) ? JSON.parse(readFileSync(CONFIG_PATH, 'utf8')) : {}) }
const counterpartRe = new RegExp(cfg.counterpartPattern)
const selected = new Set(args.only ? args.only.split(',').map(s => s.trim()).filter(Boolean) : cfg.checks)
const violations = []
const rel = abs => (abs.startsWith(ROOT) ? abs.slice(ROOT.length + 1) : abs).split('\\').join('/')

/** Turn a glob (supporting `**`, `*` and `?`) into a regex that matches a whole POSIX relative path. */
function globToRegExp(glob) {
  let re = ''
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i]
    if (c === '*') {
      if (glob[i + 1] === '*') {
        const slashAfter = glob[i + 2] === '/'
        re += slashAfter ? '(?:.*/)?' : '.*'
        i += slashAfter ? 2 : 1
      }
      else re += '[^/]*'
    }
    else if (c === '?') re += '[^/]'
    else re += c.replace(/[.+^${}()|[\]\\]/g, '\\$&')
  }
  return new RegExp(`^${re}$`)
}
/**
 * Compile a file list into a predicate. An entry starting with `!` removes the paths that earlier entries selected;
 * as in .gitignore, the last entry matching a path decides, so a later entry can re-include a file under a removed directory.
 */
function listMatcher(globs) {
  const rules = globs.map(glob => (glob.startsWith('!') ? [false, globToRegExp(glob.slice(1))] : [true, globToRegExp(glob)]))
  return relPath => rules.reduce((selected, [keep, re]) => (re.test(relPath) ? keep : selected), false)
}

const ALWAYS_PRUNED = new Set(['.git', 'node_modules'])
const excludeRes = cfg.exclude.map(globToRegExp)
const isExcluded = relPath => excludeRes.some(re => re.test(relPath))
/** An exclude pattern ending in `/**` describes a whole subtree; the walk prunes it instead of entering it. */
const pruneRes = cfg.exclude.filter(g => g.endsWith('/**')).map(g => globToRegExp(g.slice(0, -3)))
const isPruned = relDir => ALWAYS_PRUNED.has(basename(relDir)) || pruneRes.some(re => re.test(relDir))

/**
 * Hand-written directory walk replacing fs.globSync: it never descends into a symlinked directory, which avoids
 * cycles and duplicates, nor into a nested checkout (a directory holding its own `.git`: another repository, a
 * submodule or a worktree), whose files follow that checkout's conventions. A symlink to a file is returned as a
 * file, and an excluded subtree is pruned whole. Returns POSIX relative paths.
 */
function* walk(dirAbs, relDir = '') {
  let entries
  try { entries = readdirSync(dirAbs, { withFileTypes: true }) }
  catch { return } // No permission, or the directory vanished: treat it as empty.
  if (relDir && entries.some(entry => entry.name === '.git')) return
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const relPath = relDir ? `${relDir}/${entry.name}` : entry.name
    const abs = resolve(dirAbs, entry.name)
    if (entry.isSymbolicLink()) {
      let target
      try { target = statSync(abs) }
      catch { continue } // Dangling symlink: nothing to read, so it is not a checkable document.
      if (target.isFile()) yield { abs, rel: relPath }
      continue
    }
    if (entry.isDirectory()) {
      if (!isPruned(relPath)) yield* walk(abs, relPath)
      continue
    }
    if (entry.isFile()) yield { abs, rel: relPath }
  }
}

let tree = null
/** Every file outside the pruned subtrees, walked once and shared by the file checks. */
const allFiles = () => (tree ??= [...walk(ROOT)])

/**
 * Files that `globs` selects outside `exclude`, one per real path so a symlink and its target are read once.
 * `skip` drops files before that deduplication.
 */
function scanFiles(globs, skip = () => false) {
  const selects = listMatcher(globs)
  const seen = new Set()
  const out = []
  for (const file of allFiles()) {
    if (!selects(file.rel) || isExcluded(file.rel) || skip(file.rel)) continue
    const real = realpathSync(file.abs)
    if (seen.has(real)) continue
    seen.add(real)
    out.push(file)
  }
  return out
}

/** Absolute paths of the Markdown files a link or wrap file list selects. */
const markdownFiles = globs => scanFiles(globs, relPath => !relPath.endsWith('.md')).map(file => file.abs).sort()

/** Split into lines and drop the ones inside fenced code blocks, keeping the original line numbers. */
function proseLines(text) {
  const out = []
  let fence = null // { char, length }: per CommonMark a closing fence uses the same character, is no shorter than the opener and carries no info string.
  text.split('\n').forEach((line, index) => {
    const m = /^\s{0,3}(`{3,}|~{3,})(.*)$/.exec(line)
    if (m) {
      const marker = m[1]
      if (fence === null) {
        fence = { char: marker[0], length: marker.length }
        return
      }
      if (marker[0] === fence.char && marker.length >= fence.length && m[2].trim() === '') {
        fence = null
        return
      }
    }
    if (fence === null) out.push({ line, number: index + 1 })
  })
  return out
}

// ---------------------------------------------------------------- notes

const LIFECYCLES = ['proposed', 'implemented', 'rejected']
const ARCHIVE = 'archived'
const ROOT_ALLOWLIST = new Set(['AGENTS.md', 'README.md'])
const GRANDFATHER = '<!-- agent-note-format: alternatives-not-recorded (pre-format Agent Note) -->'
const STATUS = {
  proposed: /^Status: proposed$/,
  implemented: /^Status: implemented$/,
  rejected: /^Status: rejected — .+$/,
}
const REQUIRED = {
  proposed: ['## Proposal', '## Acceptance criteria', '## Risks'],
  implemented: ['## Decision', '## Consequences'],
  rejected: ['## Proposal'],
}
const BANNED_IMPLEMENTED = /^## (?:Proposal\b|Plan\b|Migration plan\b|Acceptance criteria\b)/i

function checkNoteFormat(lifecycle, abs, date) {
  const file = rel(abs)
  const fail = msg => violations.push(`notes: ${file} — ${msg}`)
  const lines = readFileSync(abs, 'utf8').split('\n')
  const prose = proseLines(lines.join('\n')).map(l => l.line)

  if (!(lines[0] ?? '').startsWith(cfg.noteTitlePrefix) || (lines[0] ?? '').length <= cfg.noteTitlePrefix.length) fail(`line 1 must be \`${cfg.noteTitlePrefix}<title>\``)
  if (lines[1] !== '') fail('line 2 must be empty')
  if (!STATUS[lifecycle].test(lines[2] ?? '')) fail(`line 3 must match the ${lifecycle} status form ${String(STATUS[lifecycle])}`)
  if (lines[3] !== '') fail('line 4 must be empty')
  const statusLines = prose.filter(l => l.startsWith('Status:'))
  if (statusLines.length !== 1) fail('`Status:` must appear exactly once, on line 3')

  const h2s = prose.filter(l => l.startsWith('## ')).map(l => l.trimEnd())
  if (h2s[0] !== '## Problem') fail(`the first section must be \`## Problem\` (found ${JSON.stringify(h2s[0] ?? '<none>')})`)
  for (const required of REQUIRED[lifecycle]) {
    if (!h2s.includes(required)) fail(`missing the \`${required}\` section that ${lifecycle} requires`)
  }
  if (lifecycle === 'implemented') {
    for (const h2 of h2s.filter(h => BANNED_IMPLEMENTED.test(h))) {
      fail(`\`${h2}\` is a proposal-era heading; an implemented note describes the current state, so fold it into Decision/Consequences/Testing`)
    }
  }
  const hasSection = h2s.includes('## Alternatives considered')
  const hasGrandfather = prose.includes(GRANDFATHER)
  if (hasSection && hasGrandfather) fail('has both `## Alternatives considered` and the grandfather comment; delete the comment')
  if (!hasSection && !hasGrandfather) fail('missing `## Alternatives considered`; only a note older than formatAdopted whose alternatives cannot be reconstructed may use the grandfather comment instead')
  if (hasGrandfather && date >= cfg.formatAdopted) fail(`the grandfather comment is only valid for notes older than ${cfg.formatAdopted}`)
}

function checkNotes() {
  const notesRoot = resolve(ROOT, cfg.notesRoot)
  if (!existsSync(notesRoot)) {
    violations.push(`notes: ${cfg.notesRoot} — directory does not exist; create it or remove "notes" from checks`)
    return 0
  }
  let count = 0
  for (const entry of readdirSync(notesRoot, { withFileTypes: true })) {
    if (entry.name === 'INDEX.md') violations.push(`notes: ${cfg.notesRoot}/INDEX.md — a central index is forbidden; the directory tree is the list`)
    if (entry.isDirectory() && entry.name !== ARCHIVE && !LIFECYCLES.includes(entry.name)) {
      violations.push(`notes: ${cfg.notesRoot}/${entry.name}/ — unknown lifecycle directory (allowed: ${LIFECYCLES.join(', ')}, and ${ARCHIVE}/)`)
    }
  }
  for (const lifecycle of LIFECYCLES) {
    const dir = resolve(notesRoot, lifecycle)
    if (!existsSync(dir)) continue
    for (const { abs, rel: match } of [...walk(dir)].filter(f => f.rel.endsWith('.md'))) {
      const segs = match.split('/')
      const relPath = `${cfg.notesRoot}/${lifecycle}/${match}`
      if (segs.length === 1 && ROOT_ALLOWLIST.has(segs[0])) continue
      if (counterpartRe.test(match)) continue
      if (segs.length !== 2) {
        violations.push(`notes: ${relPath} — the path must be {lifecycle}/{class}/yyyy-mm-dd-topic.md (actual depth ${segs.length + 1})`)
        continue
      }
      const [cls, base] = segs
      if (!cfg.noteClasses.includes(cls)) {
        violations.push(`notes: ${relPath} — unknown class directory "${cls}" (allowed: ${cfg.noteClasses.join(', ')})`)
        continue
      }
      if (!/^\d{4}-\d{2}-\d{2}-.+\.md$/.test(base)) {
        violations.push(`notes: ${relPath} — the file name must be yyyy-mm-dd-topic.md`)
        continue
      }
      count++
      checkNoteFormat(lifecycle, abs, base.slice(0, 10))
    }
  }
  return count
}

// ---------------------------------------------------------------- budgets

const countWords = text => text.split(/\s+/).filter(Boolean).length

function checkBudgets() {
  const rows = []
  for (const [path, ceiling] of Object.entries(cfg.budgets)) {
    if (!Number.isInteger(ceiling) || ceiling <= 0) {
      violations.push(`budgets: ${path} — the ceiling must be a positive integer (found ${ceiling})`)
      continue
    }
    const abs = resolve(ROOT, path)
    if (!existsSync(abs)) {
      rows.push(`MISS  ${'—'.padStart(6)} / ${String(ceiling).padEnd(6)} ${path}`)
      violations.push(`budgets: ${path} — the budgeted file does not exist; if it was renamed or deleted, update covenant.json in the same change`)
      continue
    }
    const words = countWords(readFileSync(abs, 'utf8'))
    rows.push(`${words <= ceiling ? 'ok  ' : 'OVER'}  ${String(words).padStart(6)} / ${String(ceiling).padEnd(6)} ${path}`)
    if (words > ceiling) violations.push(`budgets: ${path} — ${words} words exceed the ceiling of ${ceiling}; first push content down to its own tier, then compress, and only last raise the ceiling with a reason in the PR`)
  }
  if (args.list) process.stdout.write(rows.join('\n') + (rows.length ? '\n' : ''))
  return rows.length
}

// ---------------------------------------------------------------- links

const isExternal = url => url.startsWith('//') || url.startsWith('/') || /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(url)

/** GitHub-style heading slug: lowercase, strip punctuation, spaces to hyphens, duplicates get -1, -2. */
function slugify(text) {
  return text.trim().toLowerCase()
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[`*_~]/g, m => m === '_' ? '_' : '')
    .replace(/[^\p{L}\p{N}\p{M}\s_-]/gu, '')
    .replace(/ /g, '-')
}

const anchorCache = new Map()
function anchorsOf(abs) {
  if (anchorCache.has(abs)) return anchorCache.get(abs)
  const anchors = new Set()
  const counts = new Map()
  const text = readFileSync(abs, 'utf8')
  for (const { line } of proseLines(text)) {
    const h = /^\s{0,3}#{1,6}\s+(.+?)\s*#*\s*$/.exec(line)
    if (h) {
      const base = slugify(h[1])
      const n = counts.get(base) ?? 0
      counts.set(base, n + 1)
      anchors.add(n === 0 ? base : `${base}-${n}`)
    }
  }
  for (const m of text.matchAll(/\bid\s*=\s*["']([^"']+)["']/g)) anchors.add(m[1])
  anchorCache.set(abs, anchors)
  return anchors
}

function checkLinks(files) {
  let count = 0
  for (const abs of files) {
    const file = rel(abs)
    for (const { line, number } of proseLines(readFileSync(abs, 'utf8'))) {
      const stripped = line.replace(/`[^`]*`/g, '')
      const targets = []
      for (const m of stripped.matchAll(/!?\[[^\]]*\]\((?:<([^>]*)>|([^)\s]+))(?:\s+"[^"]*")?\)/g)) targets.push(m[1] ?? m[2])
      const def = /^\s{0,3}\[[^\]]+\]:\s*(?:<([^>]*)>|(\S+))/.exec(stripped)
      if (def) targets.push(def[1] ?? def[2])
      for (const target of targets) {
        if (isExternal(target)) continue
        count++
        const hashAt = target.indexOf('#')
        const fragment = hashAt >= 0 ? target.slice(hashAt + 1) : ''
        let pathPart = (hashAt >= 0 ? target.slice(0, hashAt) : target).replace(/\?.*$/, '')
        try { pathPart = decodeURIComponent(pathPart) }
        catch { /* Keep it as-is: an invalid escape sequence is reported as a missing target. */ }
        const targetAbs = pathPart === '' ? abs : resolve(dirname(abs), pathPart)
        if (!existsSync(targetAbs)) {
          violations.push(`links: ${file}:${number} — link target does not exist: ${target}`)
          continue
        }
        if (fragment && (pathPart === '' || targetAbs.endsWith('.md')) && !anchorsOf(targetAbs).has(decodeURIComponent(fragment))) {
          violations.push(`links: ${file}:${number} — anchor #${fragment} has no matching heading or <a id> in ${rel(targetAbs)}`)
        }
      }
    }
  }
  return count
}

// ---------------------------------------------------------------- wrap

/** Classify a line as prose, list (a paragraph start) or a structural line that takes no part in paragraph detection. */
function classify(line, prevIsProse) {
  const t = line.replace(/^\s*(?:>\s?)+/, '')
  if (t.trim() === '') return 'blank'
  if (/^\s{0,3}#{1,6}(\s|$)/.test(t)) return 'heading'
  if (/^\s*(?:[-*_]\s*){3,}$/.test(t) || /^\s*=+\s*$/.test(t)) return 'rule'
  if (/^\s*\|/.test(t)) return 'table'
  if (/^\s*<[a-zA-Z/!]/.test(t)) return 'html'
  if (/^\s*:::/.test(t)) return 'container'
  if (/^\s{0,3}\[[^\]]+\]:\s/.test(t)) return 'definition'
  if (/^\s*(?:[-*+]|\d+[.)])\s/.test(t)) return 'list'
  if (/^(?: {4,}|\t)/.test(line) && !prevIsProse) return 'code'
  return 'prose'
}

function checkWrap(files) {
  let count = 0
  for (const abs of files) {
    const file = rel(abs)
    const lines = readFileSync(abs, 'utf8').split('\n')
    let skipUntil = -1
    if (lines[0] === '---') skipUntil = lines.indexOf('---', 1)
    let prevIsProse = false
    let prevQuoted = false
    let reported = false
    for (const { line, number } of proseLines(lines.join('\n'))) {
      if (number - 1 <= skipUntil) continue
      const kind = classify(line, prevIsProse)
      const quoted = /^\s*>/.test(line)
      if (kind === 'prose') {
        count++
        // A `>` breaks the preceding paragraph and starts a new block quote; only the second line inside the quote is a continuation.
        const continuation = prevIsProse && !(quoted && !prevQuoted)
        if (continuation && !reported) {
          violations.push(`wrap: ${file}:${number} — paragraph spans several physical lines; use editor soft-wrapping so one paragraph is one line (heuristic)`)
          reported = true
        }
        prevIsProse = true
        prevQuoted = quoted
        continue
      }
      prevIsProse = kind === 'list'
      prevQuoted = quoted
      reported = false
    }
  }
  return count
}

// ---------------------------------------------------------------- language

/** CJK ideographs plus the CJK and fullwidth punctuation blocks. Latin text with em dashes or curly quotes stays legal. */
const CJK = /[\u3000-\u303F\u4E00-\u9FFF\uFF00-\uFFEF]/
const INLINE_LINK = /\[([^\]]*)\]\(([^)\s]+)\)/g

/** A language-switch link naming its target language, as in `[中文](README.zh.md)`, is the one place CJK survives on an English page. */
const withoutCounterpartLinks = line => line.replace(INLINE_LINK, (whole, _text, target) => (counterpartRe.test(target) ? '' : whole))

function checkLanguage() {
  let count = 0
  for (const { abs, rel: relPath } of scanFiles(cfg.languageScan, relPath => counterpartRe.test(relPath))) {
    count++
    const hits = readFileSync(abs, 'utf8').split('\n')
      .map((line, index) => (CJK.test(withoutCounterpartLinks(line)) ? index + 1 : 0))
      .filter(Boolean)
    if (hits.length > 0) {
      violations.push(`language: ${relPath}:${hits[0]} — CJK text on ${hits.length} line(s); translate it, or move the passage into a translated counterpart named <name>.zh.md beside its English original`)
    }
  }
  return count
}

// ---------------------------------------------------------------- docs-placement

/**
 * Describes a root CLAUDE.md that is not the approved discovery link, or returns null for that link: a symlink whose
 * real path is the root AGENTS.md. The markdown and language scanners deduplicate by the same real path, so they read
 * the link's content once, as AGENTS.md.
 */
function claudeLinkDefect(entry) {
  if (!entry.isSymbolicLink()) return 'a regular file'
  const link = resolve(ROOT, entry.name)
  if (!existsSync(link)) return `a broken symlink to ${readlinkSync(link)}`
  const agents = resolve(ROOT, 'AGENTS.md')
  return existsSync(agents) && realpathSync(link) === realpathSync(agents) ? null : `a symlink to ${readlinkSync(link)}`
}

function checkDocsPlacement() {
  let count = 0
  for (const entry of readdirSync(ROOT, { withFileTypes: true })) {
    if (entry.isDirectory() || !/\.(md|mdx|rst|adoc|txt)$/i.test(entry.name) || isExcluded(entry.name)) continue
    count++
    if (/^(README|AGENTS)(\.[a-z]{2}(?:-[A-Za-z]{2,4})?)?\.md$/i.test(entry.name)) continue
    if (/^(LICENSE|LICENCE|NOTICE|COPYING)(\.(md|txt|rst|adoc))$/i.test(entry.name)) continue
    if (entry.name === 'CLAUDE.md') {
      const defect = claudeLinkDefect(entry)
      if (defect) violations.push(`docs-placement: CLAUDE.md — a root CLAUDE.md must be a symlink resolving to AGENTS.md, found ${defect}; move any unique instructions into AGENTS.md, then run \`ln -sfn AGENTS.md CLAUDE.md\``)
      continue
    }
    violations.push(`docs-placement: ${entry.name} — project documentation belongs in docs/; move the file and update its links`)
  }
  return count
}

// ---------------------------------------------------------------- run

const summary = []
for (const glob of cfg.exclude.filter(g => g.startsWith('!'))) {
  violations.push(`config: exclude "${glob}" — exclude takes no negation, because the walk never enters a pruned subtree; move the exclusion this entry overrides into the file lists (markdown, linksScan, wrapScan, languageScan) as a "!" entry, then list "${glob.slice(1)}" after it`)
}
if (selected.has('notes')) summary.push(`notes: ${checkNotes()} notes`)
if (selected.has('budgets')) summary.push(`budgets: ${checkBudgets()} budgeted files`)
if (selected.has('links')) {
  const files = markdownFiles(cfg.linksScan ?? cfg.markdown)
  summary.push(`links: ${files.length} files, ${checkLinks(files)} relative links`)
}
if (selected.has('wrap')) {
  const files = markdownFiles(cfg.wrapScan ?? cfg.markdown)
  summary.push(`wrap: ${files.length} files, ${checkWrap(files)} paragraph lines`)
}
if (selected.has('language')) summary.push(`language: ${checkLanguage()} scanned files`)

if (selected.has('docs-placement')) summary.push(`docs-placement: ${checkDocsPlacement()} root documents`)

const unknown = [...selected].filter(s => !['notes', 'budgets', 'links', 'wrap', 'language', 'docs-placement'].includes(s))
for (const u of unknown) violations.push(`config: unknown check "${u}" (available: notes, budgets, links, wrap, language, docs-placement)`)

if (violations.length > 0) {
  process.stderr.write(`verify-covenant: ${violations.length} violation(s)\n`)
  for (const v of violations) process.stderr.write(`  ${v}\n`)
  process.exit(1)
}
process.stdout.write(`verify-covenant: pass (${summary.join('; ')})\n`)
