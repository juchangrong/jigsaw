// Test message validation and CLI failures. Usage: node --test check-commit-message.test.mjs.
// Exit codes: 0 tests pass; 1 a test fails.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { validateMessage } from './check-commit-message.mjs';

const valid = [
  'docs: clarify setup',
  'fix(covenant): reject missing references\n',
  'feat(installer)!: change install location\n\nBREAKING CHANGE: reinstall skills.',
  'fix: change behavior\n\nBREAKING CHANGE: remove the fallback.',
  'feat(covenant): check pull request titles (#12)',
  'Merge pull request #12 from octocat/feat-export',
  'Merge pull request #12 from octocat/feat-export\n\nfeat(api): add export',
  "Merge branch 'main' into feat/export",
  "Merge branch 'main' of github.com:octocat/skills",
  "Merge remote-tracking branch 'origin/main'",
  "Merge branches 'feat/a' and 'feat/b'",
  "Merge tag 'v1.2.0'",
  'docs: ' + 'a'.repeat(66),
  'test: add coverage\r\n\r\nCheck rejection paths.\r\n',
];
const invalid = [
  '', 'update docs', 'Docs: update docs', 'unknown: update docs', 'fix:',
  'fix: ', 'fix: update docs ', 'fix(scope with spaces): update docs',
  'fix: update docs.', 'docs: ' + 'a'.repeat(67),
  'fix: update docs\nBody without separator',
  'docs: update docs\n\n\u4e2d\u6587',
  'Revert "feat: add export"',
  'Merge the export feature',
  'Merge pull request from octocat/feat-export',
  'Merge pull request #12 from octocat/feat-export extra',
  'Merge branch main into feat/export',
  "Merge branch 'main' into feat/export extra",
  'Merge pull request #12 from octocat/feat-export\nfeat(api): add export',
  "Merge branch 'main'\n\n\u4e2d\u6587",
];

test('accept valid messages and reject invalid messages', () => {
  for (const message of valid) assert.deepEqual(validateMessage(message), [], message);
  for (const message of invalid) assert.ok(validateMessage(message).length, message);
});

test('CLI exit codes and diagnostics identify failures', () => {
  const dir = mkdtempSync(join(tmpdir(), 'commit-message-'));
  const file = join(dir, 'message');
  const script = fileURLToPath(new URL('./check-commit-message.mjs', import.meta.url));
  const run = (...args) => spawnSync(process.execPath, [script, ...args], { encoding: 'utf8' });
  try {
    writeFileSync(file, valid[0]);
    assert.equal(run(file).status, 0);
    writeFileSync(file, invalid[1]);
    const failed = run(file);
    assert.equal(failed.status, 1);
    assert.ok(failed.stderr.includes(file));
    assert.ok(failed.stderr.includes('type(scope): description'));
    assert.equal(run(join(dir, 'missing')).status, 1);
    assert.equal(run().status, 2);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('Git ranges validate every incoming commit and reject unavailable refs', () => {
  const dir = mkdtempSync(join(tmpdir(), 'commit-range-'));
  const script = fileURLToPath(new URL('./check-commit-message.mjs', import.meta.url));
  const git = (...args) => {
    const result = spawnSync('git', args, { cwd: dir, encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    return result.stdout.trim();
  };
  const run = (...args) => spawnSync(process.execPath, [script, ...args], { cwd: dir, encoding: 'utf8' });
  const commit = message => git('-c', 'commit.gpgsign=false', 'commit', '--allow-empty', '-m', message);
  try {
    git('init');
    git('config', 'user.name', 'Fixture');
    git('config', 'user.email', 'fixture@example.com');
    commit('legacy baseline');
    const base = git('rev-parse', 'HEAD');
    commit('feat: add a check');
    commit('Merge pull request #12 from fixture/check');
    assert.equal(run('--range', base, 'HEAD').status, 0);
    assert.equal(run('--range', 'HEAD', 'HEAD').status, 0);
    commit('invalid intermediate message');
    const invalidCommit = git('rev-parse', 'HEAD');
    commit('fix: finish the change');
    const rejected = run('--range', base, 'HEAD');
    assert.equal(rejected.status, 1);
    assert.ok(rejected.stderr.includes(invalidCommit));
    assert.ok(rejected.stderr.includes('type(scope): description'));
    const missing = run('--range', 'missing-ref', 'HEAD');
    assert.equal(missing.status, 1);
    assert.ok(missing.stderr.includes('fetch both refs'));
    assert.equal(run('--range', base).status, 2);
    assert.equal(run('--range').status, 2);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
