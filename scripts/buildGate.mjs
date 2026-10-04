#!/usr/bin/env node
// Ticket build gate: runs the Vite build unless every file changed since <base> is outside the bundle's inputs.
// Usage: node scripts/buildGate.mjs <base>
import { spawnSync } from 'node:child_process';
import { classifyChange, describeSkip } from './buildDecision.mjs';
import { gitFiles } from './testSelection.mjs';

const [base] = process.argv.slice(2);
if (!base) {
  console.error('Usage: node scripts/buildGate.mjs <base>');
  process.exit(2);
}

// Deleted files count: removing a doc or a source file changes the bundle.
const changed = [...gitFiles('diff', '--name-only', base), ...gitFiles('ls-files', '--others', '--exclude-standard')];
const { build, forcing } = classifyChange(changed);
if (!build) {
  console.log(describeSkip(changed, base));
  process.exit(0);
}

console.log(`building: ${forcing.length} of ${changed.length} changed files force the build:\n${forcing.map((file) => `  ${file}`).join('\n')}`);
const result = spawnSync('npm', ['run', 'build'], { stdio: 'inherit', shell: true });
process.exit(result.status ?? 1);
