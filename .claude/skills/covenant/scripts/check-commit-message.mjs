// Validate messages from a file or Git range. Usage: node check-commit-message.mjs <message-file> | --range <base> <head>.
// Exit codes: 0 valid; 1 invalid message, unreadable file or invalid Git ref; 2 invalid arguments.
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

// Merge subjects that GitHub and Git generate carry no conventional type, so they skip the header and length rules.
const GENERATED_MERGE = [
  /^Merge pull request #\d+ from \S+$/,
  /^Merge (?:(?:remote-tracking )?branch(?:es)?|tags?|commits?) '[^'\r\n]+'(?:(?:, | and )'[^'\r\n]+')*(?: of \S+)?(?: into \S+)?$/,
];

export function validateMessage(message) {
  const [subject, second] = message.replace(/\r\n/g, '\n').split('\n');
  const errors = [];
  if (!GENERATED_MERGE.some(pattern => pattern.test(subject))) {
    if (!/^(feat|fix|docs|refactor|perf|test|build|ci|chore|style|revert)(\([a-z0-9][a-z0-9._/-]*\))?!?: \S(?:.*\S)?$/.test(subject)) {
      errors.push('use type(scope): description with a supported lowercase type and optional scope/!');
    }
    if ([...subject].length > 72) errors.push('shorten the subject to at most 72 characters');
    if (subject.endsWith('.')) errors.push('remove the final subject period');
  }
  if (second !== undefined && second !== '') errors.push('insert a blank line between the subject and body');
  if (/[\p{Script=Han}\u3000-\u303f\uff00-\uffef]/u.test(message)) errors.push('use English; remove CJK text from the message');
  return errors;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  if (args.length === 3 && args[0] === '--range') {
    try {
      const git = (...argv) => execFileSync('git', argv, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
      const [base, head] = args.slice(1).map(ref => git('rev-parse', '--verify', '--end-of-options', `${ref}^{commit}`).trim());
      const commits = git('rev-list', `${base}..${head}`).split('\n').filter(Boolean);
      let failures = 0;
      for (const commit of commits) {
        const errors = validateMessage(git('show', '-s', '--format=%B', commit));
        for (const error of errors) console.error(`${commit}: commit message: ${error}`);
        failures += errors.length;
      }
      process.exitCode = failures ? 1 : 0;
    } catch {
      console.error('check-commit-message: cannot read Git range; fetch both refs and run inside the repository');
      process.exitCode = 1;
    }
  } else if (args.length !== 1 || args[0].startsWith('--')) {
    console.error('check-commit-message: expected a message file or --range <base> <head>; usage: node check-commit-message.mjs <message-file> | --range <base> <head>');
    process.exitCode = 2;
  } else {
    try {
      const errors = validateMessage(readFileSync(args[0], 'utf8'));
      for (const error of errors) console.error(`${args[0]}: commit message: ${error}`);
      process.exitCode = errors.length ? 1 : 0;
    } catch (error) {
      console.error(`${args[0]}: cannot read commit message; provide a readable UTF-8 file (${error.code})`);
      process.exitCode = 1;
    }
  }
}
