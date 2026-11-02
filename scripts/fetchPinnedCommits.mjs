#!/usr/bin/env node
// Fetches every commit the tests read by sha into a shallow clone. CI runs it before the suite.
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const pins = createRequire(import.meta.url)('./pinnedCommits.json');

const isHere = (sha) => spawnSync('git', ['cat-file', '-e', `${sha}^{commit}`], { stdio: 'ignore' }).status === 0;

/** The `git` arguments that fetch every pinned commit not here yet, or null when all are. A shallow fetch would make a full clone shallow. */
export function fetchArgs(commitIsHere = isHere) {
  const missing = Object.values(pins).filter((sha) => !commitIsHere(sha));
  return missing.length ? ['fetch', '--depth=1', 'origin', ...missing] : null;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = fetchArgs();
  process.exit(args ? spawnSync('git', args, { stdio: 'inherit' }).status ?? 1 : 0);
}
