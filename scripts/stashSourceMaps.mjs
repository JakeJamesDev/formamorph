// Moves the build's source maps out of the output, so no shipped bundle carries them; scripts/mapStack.mjs reads them.
import { mkdirSync, readdirSync, renameSync, rmSync } from 'node:fs';
import path from 'node:path';

/**
 * Move every `.map` under `outDir` to the same relative path under `stashDir`, emptying `stashDir` first.
 *
 * @returns The moved paths, relative to `outDir`
 */
export function stashMaps(outDir, stashDir) {
  rmSync(stashDir, { recursive: true, force: true });
  const moved = [];
  for (const entry of readdirSync(outDir, { recursive: true, withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith('.map')) continue;
    const from = path.join(entry.parentPath, entry.name);
    const relative = path.relative(outDir, from);
    const to = path.join(stashDir, relative);
    mkdirSync(path.dirname(to), { recursive: true });
    renameSync(from, to);
    moved.push(relative.split(path.sep).join('/'));
  }
  return moved;
}

export function stashSourceMaps(stashName = 'sourcemaps') {
  let outDir;
  let stashDir;
  return {
    name: 'stash-source-maps',
    apply: 'build',
    configResolved(config) {
      outDir = path.resolve(config.root, config.build.outDir);
      stashDir = path.resolve(config.root, stashName);
    },
    // Sequential and first, so the output checks that read every file never meet a map mid-move.
    closeBundle: {
      order: 'pre',
      sequential: true,
      handler() {
        stashMaps(outDir, stashDir);
      },
    },
  };
}
