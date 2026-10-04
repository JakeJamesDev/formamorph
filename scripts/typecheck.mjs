#!/usr/bin/env node
// Typecheck gate: incremental tsc with a build-info file at the checkout root, shared between worktrees.
// Usage: node scripts/typecheck.mjs
import { execFileSync, spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, renameSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

/** Lives at the checkout root, never under node_modules, which worktrees share through a junction. */
export const BUILD_INFO = 'typecheck.tsbuildinfo';

/**
 * The worktrees' shared file in the main checkout, apart from its own: tsc resolves the node_modules junction, so a
 * worktree's file holds node_modules paths that fit only checkouts at worktree depth.
 */
export const SEED = 'typecheck.seed.tsbuildinfo';

const tsc = path.join(path.dirname(createRequire(import.meta.url).resolve('typescript/package.json')), 'bin', 'tsc');

/** TypeScript stores absolute paths across drives, so a build-info file only carries over on one drive. */
export const sameDrive = (a, b) => path.parse(path.resolve(a)).root.toLowerCase() === path.parse(path.resolve(b)).root.toLowerCase();

/** The main checkout's root, or null outside a git repo. */
export const mainCheckoutRoot = (root) => {
  try {
    const common = execFileSync('git', ['rev-parse', '--path-format=absolute', '--git-common-dir'], { cwd: root, encoding: 'utf8' });
    return path.dirname(common.trim());
  } catch {
    return null;
  }
};

/** Copies `from` to `to`; false when `from` is missing or busy, as when another worktree writes it. */
const copied = (from, to) => {
  try {
    copyFileSync(from, to);
    return true;
  } catch {
    return false;
  }
};

/** Copies `buildInfo` to `target` through a temp file, so a seeding reader never sees half a file. */
const publish = (buildInfo, target) => {
  const temp = `${target}.${process.pid}.tmp`;
  try {
    copyFileSync(buildInfo, temp);
    renameSync(temp, target);
    return true;
  } catch {
    rmSync(temp, { force: true });
    return false;
  }
};

/**
 * Runs `tsc --noEmit --incremental` on `root`. When `mainRoot` is another checkout on the same drive, a run without
 * a local build-info file seeds from its seed file, and a clean run writes the result back to it. Returns the run
 * state (`cold`, `warm` or `seeded`), tsc's exit status and output, whether the seed was written, and the wall time.
 */
export const typecheck = ({ root, mainRoot }) => {
  const started = performance.now();
  const buildInfo = path.join(root, BUILD_INFO);
  const shared = Boolean(mainRoot) && path.resolve(mainRoot) !== path.resolve(root) && sameDrive(root, mainRoot);
  const seed = shared ? path.join(mainRoot, SEED) : null;
  let state = 'warm';
  if (!existsSync(buildInfo)) {
    state = seed && copied(seed, buildInfo) ? 'seeded' : 'cold';
  }
  const result = spawnSync(
    process.execPath,
    [tsc, '--noEmit', '--incremental', '--tsBuildInfoFile', buildInfo, '-p', path.join(root, 'tsconfig.json')],
    { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 },
  );
  const status = result.status ?? 1;
  const published = Boolean(seed) && status === 0 && publish(buildInfo, seed);
  const seconds = (performance.now() - started) / 1000;
  const output = `${result.stdout ?? ''}${result.stderr ?? ''}${result.error ? `${result.error.message}\n` : ''}`;
  return { state, status, output, published, seconds };
};

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const root = process.cwd();
  const { state, status, output, published, seconds } = typecheck({ root, mainRoot: mainCheckoutRoot(root) });
  process.stdout.write(output);
  console.log(`typecheck ${state}: ${seconds.toFixed(1)} s, exit ${status}${published ? ', seed saved to the main checkout' : ''}`);
  process.exit(status);
}
