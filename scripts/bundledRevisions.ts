// Lists the file revisions that scripts/genBundledFingerprints.ts fingerprints.
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';

export const WORLDS_DIR = 'src/defaultworlds';
/** The last commit before the ship-time Downscale. Builds up to it bundled the source files. */
export const SHIPPED_SINCE = 'cd6fe508c480fa5921f48dd65befc892ac73fb4b';

/** One file revision: where it came from, and a reader for its bytes. `blob` is absent for the working tree. */
export interface Revision {
  label: string;
  path: string;
  blob?: string;
  read: () => Buffer;
}

// core.quotePath=false keeps non-ASCII paths unquoted, so the path filters see the real name.
export const git = (args: string[]): Buffer =>
  execFileSync('git', ['-c', 'core.quotePath=false', ...args], { maxBuffer: 1 << 30 });
const readBlob = (blob: string) => () => git(['cat-file', 'blob', blob]);
const blobRevision = (commit: string, filePath: string, blob: string): Revision => ({
  label: `${commit.slice(0, 8)}:${filePath}`,
  path: filePath,
  blob,
  read: readBlob(blob),
});

/**
 * Every blob that `git log` shows for the given paths, deduplicated. A deletion shows the zero blob, and
 * the walk skips it. `-m` adds blobs that only a merge produced.
 */
export function historyRevisions(logArgs: string[], keep: (filePath: string) => boolean): Revision[] {
  const byBlob = new Map<string, Revision>();
  let commit = '';
  for (const line of git(['log', '-m', '--raw', '--no-abbrev', '--format=%H', ...logArgs]).toString('utf8').split('\n')) {
    if (/^[0-9a-f]{40}$/.test(line)) {
      commit = line;
      continue;
    }
    const match = /^:\d+ \d+ [0-9a-f]+ ([0-9a-f]+) \w+\t(?:[^\t]*\t)?(.+)$/.exec(line);
    if (!match) continue;
    const [, blob, filePath] = match;
    if (/^0+$/.test(blob) || !keep(filePath) || byBlob.has(blob)) continue;
    byBlob.set(blob, blobRevision(commit, filePath, blob));
  }
  return [...byBlob.values()];
}

/** Every file under `dir` as it stood at `commit`. */
export function treeRevisions(commit: string, dir: string, keep: (filePath: string) => boolean): Revision[] {
  return git(['ls-tree', '-r', '--full-tree', commit, '--', dir])
    .toString('utf8')
    .split('\n')
    .flatMap((line) => {
      const match = /^\d+ blob ([0-9a-f]+)\t(.+)$/.exec(line);
      return match && keep(match[2]) ? [blobRevision(commit, match[2], match[1])] : [];
    });
}

/** The working-tree copy, so an uncommitted edit is listed too. */
export const onDisk = (filePath: string): Revision => ({
  label: `working tree:${filePath}`,
  path: filePath,
  read: () => readFileSync(filePath),
});

export const isWorldFile = (filePath: string) => filePath.endsWith('.json');

const uniqueBlobs =(revisions: Revision[]) =>
  [...new Map(revisions.map((r) => [r.blob ?? r.label, r])).values()];

/**
 * Every world revision in history, and the ones a build could have shipped: the tree at SHIPPED_SINCE,
 * every later commit that touched a world, and the working tree.
 */
export function worldRevisions(): { revisions: Revision[]; shippable: Revision[] } {
  const worldFile = isWorldFile;
  const working = readdirSync(WORLDS_DIR).filter(worldFile).map((f) => onDisk(`${WORLDS_DIR}/${f}`));
  const revisions = [...historyRevisions(['--no-renames', '--', WORLDS_DIR], worldFile), ...working];
  const shippable = uniqueBlobs([
    ...treeRevisions(SHIPPED_SINCE, WORLDS_DIR, worldFile),
    ...historyRevisions(['--no-renames', `${SHIPPED_SINCE}..HEAD`, '--', WORLDS_DIR], worldFile),
    ...working,
  ]);
  return { revisions, shippable };
}
