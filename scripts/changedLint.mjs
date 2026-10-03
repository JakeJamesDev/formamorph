#!/usr/bin/env node
// Ticket lint gate: lints the files changed since <base>, or everything when the lint setup itself changed.
// Usage: node scripts/changedLint.mjs <base>
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { MAX_ARGS_LENGTH, changedSince } from './testSelection.mjs';

const LINTED = /\.(js|jsx|ts|tsx|mjs|cjs)$/;

const [base, extra] = process.argv.slice(2);
if (!base || extra) {
  console.error('Usage: node scripts/changedLint.mjs <base>');
  process.exit(2);
}

const changed = changedSince(base);
// The config, the rule files it imports, and the installed plugin versions decide every file's result.
const configImports = [...readFileSync('eslint.config.js', 'utf8').matchAll(/from '\.\/([^']+)'/g)].map(([, file]) => file);
const setup = new Set(['eslint.config.js', 'package.json', 'package-lock.json', ...configImports]);
const files = changed.filter((file) => LINTED.test(file));
const all = changed.some((file) => setup.has(file)) || files.join(' ').length > MAX_ARGS_LENGTH;

if (!all && !files.length) {
  console.log(`No lintable files changed since ${base}.`);
  process.exit(0);
}
const eslint = path.join(path.dirname(createRequire(import.meta.url).resolve('eslint/package.json')), 'bin', 'eslint.js');
console.log(all ? 'Linting everything.' : `Linting ${files.length} changed files since ${base}.`);
const args = all ? ['.'] : ['--no-warn-ignored', ...files];
const result = spawnSync(process.execPath, [eslint, ...args], { stdio: 'inherit' });
process.exit(result.status ?? 1);
