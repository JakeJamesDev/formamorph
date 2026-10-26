// Writes src/lib/bundledFingerprints.json: the fingerprint of every revision of every bundled world, source
// and shipped form, and the byte hash of every revision of both default Avatar files. A world carries a
// shipped form as it stood at SHIPPED_SINCE, at every later commit that touched it, and in the working tree.
// Run with `npm run fingerprints`.
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { sha256Hex, worldFingerprint } from '@/lib/bundledFingerprint';
import { DEFAULT_WORLDS, seedWorldData } from '@/lib/defaultWorlds';
import { worldPublishPayload } from '@/lib/publishPayload';
import { shippedWorldText } from '@/lib/shippedWorld';
import { git, historyRevisions, onDisk, worldRevisions } from './bundledRevisions';

const AVATAR_FILES = ['public/default-avatar.vrm', 'build-assets/alternate-avatar.vrm'];
const OUT = 'src/lib/bundledFingerprints.json';

async function worldFingerprints(): Promise<string[]> {
  const { revisions, shippable } = worldRevisions();
  const fingerprints = new Set<string>();
  const mismatches: string[] = [];
  const add = async (label: string, filePath: string, text: string) => {
    const id = path.basename(filePath, '.json');
    const seed = DEFAULT_WORLDS.find((w) => w.id === id) ?? { id, defaultName: id };
    const raw = JSON.parse(text) as Record<string, unknown>;
    const fingerprint = await worldFingerprint(raw);
    const published = await worldFingerprint(worldPublishPayload(seedWorldData(raw, seed)).contentData);
    if (published !== fingerprint) mismatches.push(`${label}: raw ${fingerprint}, published ${published}`);
    fingerprints.add(fingerprint);
  };
  for (const revision of revisions) await add(revision.label, revision.path, revision.read().toString('utf8'));
  for (const revision of shippable) {
    await add(`shipped ${revision.label}`, revision.path, await shippedWorldText(revision.read().toString('utf8')));
  }
  if (mismatches.length) {
    throw new Error(`Publishing changes the fingerprint of ${mismatches.length} revision(s):\n${mismatches.join('\n')}`);
  }
  console.log(`${revisions.length} world revisions, ${shippable.length} shipped forms, ${fingerprints.size} fingerprints`);
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
