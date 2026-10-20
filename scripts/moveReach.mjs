#!/usr/bin/env node
// Move probe for ticket prepare: can the commits that reached main during the gates change this ticket's verdicts?
// Reads a JSON file `{ moved, changed }`: the files main's new commits touched (inert paths already dropped) and the
// ticket's files on the new main. Exit 0 when no moved file reaches a changed file through imports in either
// direction, so a typecheck and lint rerun covers the combination. Exit 1 when one can (it prints which). Exit 2
// on a usage error. Usage: node scripts/moveReach.mjs <probe.json>
import { readFileSync } from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { isSkippable } from './buildDecision.mjs';

/** Files that are gate inputs on their own: the gates, their tooling, and the compiler and bundler configs. */
export const TOOLING_PATTERNS = ['scripts/**', 'package.json', 'package-lock.json', 'tsconfig*.json', 'vite.config.*', 'eslint.config.*'];

// JSON counts as a module: the compiler resolves JSON imports, so a fixture nothing imports stays unreachable.
const MODULE = /\.(?:[cm]?[jt]sx?|json)$/;
const isTooling = (file) => TOOLING_PATTERNS.some((glob) => path.posix.matchesGlob(file, glob));

/**
 * The verdict for a move: `reaches` is false only when every moved file is a skippable non-module or a module whose
 * import closure, in either direction, misses the ticket's files. `closureOf(files)` returns the set of files the
 * given modules transitively import, themselves included.
 */
export function moveReach(moved, changed, closureOf) {
  const tooling = moved.filter(isTooling);
  if (tooling.length) return { reaches: true, reason: `tooling changed: ${tooling.join(', ')}` };
  const inputs = moved.filter((file) => !MODULE.test(file) && !isSkippable(file));
  if (inputs.length) return { reaches: true, reason: `bundle inputs outside the module graph changed: ${inputs.join(', ')}` };
  const movedModules = moved.filter((file) => MODULE.test(file));
  const changedModules = changed.filter((file) => MODULE.test(file));
  if (!movedModules.length || !changedModules.length) return { reaches: false, reason: 'no module on both sides' };
  const fromMove = closureOf(movedModules);
  const hit = changedModules.filter((file) => fromMove.has(file));
  if (hit.length) return { reaches: true, reason: `main's new commits import the ticket's ${hit.join(', ')}` };
  const fromTicket = closureOf(changedModules);
  const back = movedModules.filter((file) => fromTicket.has(file));
  if (back.length) return { reaches: true, reason: `the ticket imports main's changed ${back.join(', ')}` };
  return { reaches: false, reason: `${movedModules.length} moved modules and ${changedModules.length} ticket modules share no import` };
}

/** The transitive import closure of `files` under the repo's tsconfig, as repo-relative posix paths. */
export function tsClosure(files, cwd = process.cwd()) {
  const configPath = ts.findConfigFile(cwd, ts.sys.fileExists, 'tsconfig.json');
  const { config } = ts.readConfigFile(configPath, ts.sys.readFile);
  const { options } = ts.parseJsonConfigFileContent(config, ts.sys, cwd);
  const program = ts.createProgram(files.map((file) => path.resolve(cwd, file)), options);
  const closure = new Set();
  for (const source of program.getSourceFiles()) {
    const relative = path.relative(cwd, source.fileName).replaceAll('\\', '/');
    if (!relative.startsWith('..') && !relative.includes('node_modules/')) closure.add(relative);
  }
  return closure;
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'))) {
  const [probe] = process.argv.slice(2);
  if (!probe) {
    console.error('Usage: node scripts/moveReach.mjs <probe.json>');
    process.exit(2);
  }
  const { moved = [], changed = [] } = JSON.parse(readFileSync(probe, 'utf8'));
  const { reaches, reason } = moveReach(moved, changed, tsClosure);
  console.log(`move probe: ${reaches ? 'reaches the ticket' : 'independent'} (${reason})`);
  process.exit(reaches ? 1 : 0);
}
