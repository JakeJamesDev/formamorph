// Writes src/lib/bundledFingerprints.json: the fingerprint of every revision of every bundled world, and the
// byte hash of every revision of both default Avatar files. Run with `npm run fingerprints`.
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { sha256Hex, worldFingerprint } from '@/lib/bundledFingerprint';
import { DEFAULT_WORLDS, seedWorldData } from '@/lib/defaultWorlds';
import { worldPublishPayload } from '@/lib/publishPayload';

const WORLDS_DIR = 'src/defaultworlds';
const AVATAR_FILES = ['public/default-avatar.vrm', 'build-assets/alternate-avatar.vrm'];
const OUT = 'src/lib/bundledFingerprints.json';

/** One file revision: where it came from, and a reader for its bytes. */
interface Revision {
  label: string;
  path: string;
  read: () => Buffer;
}

// core.quotePath=false keeps non-ASCII paths unquoted, so the path filters see the real name.
const git = (args: string[]): Buffer =>
  execFileSync('git', ['-c', 'core.quotePath=false', ...args], { maxBuffer: 1 << 30 });
const readBlob = (blob: string) => () => git(['cat-file', 'blob', blob]);

/**
 * Every blob that `git log` shows for the given paths, deduplicated. A deletion shows the zero blob, and
 * the walk skips it. `-m` adds blobs that only a merge produced.
 */
function historyRevisions(logArgs: string[], keep: (filePath: string) => boolean): Revision[] {
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
    byBlob.set(blob, { label: `${commit.slice(0, 8)}:${filePath}`, path: filePath, read: readBlob(blob) });
  }
  return [...byBlob.values()];
}

/** The working-tree copy, so an uncommitted edit is listed too. */
const onDisk = (filePath: string): Revision => ({
  label: `working tree:${filePath}`,
  path: filePath,
  read: () => readFileSync(filePath),
});

async function worldFingerprints(): Promise<string[]> {
  const revisions = [
    ...historyRevisions(['--no-renames', '--', WORLDS_DIR], (p) => p.endsWith('.json')),
    ...readdirSync(WORLDS_DIR).filter((f) => f.endsWith('.json')).map((f) => onDisk(`${WORLDS_DIR}/${f}`)),
  ];
  const fingerprints = new Set<string>();
  const mismatches: string[] = [];
  for (const revision of revisions) {
    const id = path.basename(revision.path, '.json');
    const seed = DEFAULT_WORLDS.find((w) => w.id === id) ?? { id, defaultName: id };
    const raw = JSON.parse(revision.read().toString('utf8')) as Record<string, unknown>;
    const fingerprint = await worldFingerprint(raw);
    const published = await worldFingerprint(worldPublishPayload(seedWorldData(raw, seed)).contentData);
    if (published !== fingerprint) mismatches.push(`${revision.label}: raw ${fingerprint}, published ${published}`);
    fingerprints.add(fingerprint);
  }
  if (mismatches.length) {
    throw new Error(`Publishing changes the fingerprint of ${mismatches.length} revision(s):\n${mismatches.join('\n')}`);
  }
  console.log(`${revisions.length} world revisions, ${fingerprints.size} fingerprints`);
  return [...fingerprints].sort();
}

async function avatarHashes(): Promise<string[]> {
  const revisions = AVATAR_FILES.flatMap((file) => [
    ...historyRevisions(['--follow', '--', file], () => true),
    onDisk(file),
  ]);
  const hashes = new Set<string>();
  for (const revision of revisions) hashes.add(await sha256Hex(new Uint8Array(revision.read())));
  console.log(`${revisions.length} Avatar revisions, ${hashes.size} byte hashes`);
  return [...hashes].sort();
}

if (git(['rev-parse', '--is-shallow-repository']).toString().trim() === 'true') {
  throw new Error('This clone is shallow, so its history is incomplete. Run `git fetch --unshallow` first.');
}
const list = { worlds: await worldFingerprints(), avatars: await avatarHashes() };
writeFileSync(OUT, `${JSON.stringify(list, null, 2)}\n`);
console.log(`Wrote ${OUT}`);
