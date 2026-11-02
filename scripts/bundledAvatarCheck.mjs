// Removes the tracked default from a `none` build, then fails a build whose output disagrees with FORMAMORPH_AVATARS:
// the app would fetch a file it lacks, or ship one it never seeds.
import { existsSync, readdirSync, rmSync } from 'node:fs';
import path from 'node:path';

const DEFAULT_FILE = 'default-avatar.vrm';
const AVATAR_SETS = { '': [DEFAULT_FILE], nsfw: [DEFAULT_FILE, 'praline-avatar.vrm'], none: [] };

/** Every `.vrm` under `outDir`, as paths from it with forward slashes. */
const heldFiles = (outDir) => (existsSync(outDir) ? readdirSync(outDir, { recursive: true, encoding: 'utf8' }) : [])
  .filter((file) => /\.vrm$/i.test(file))
  .map((file) => file.split(path.sep).join('/'));

/** What is wrong with `outDir` for this avatar set; empty when it matches. */
export function bundledAvatarProblems(avatarSet, outDir) {
  const expected = AVATAR_SETS[avatarSet];
  if (!expected) return [`FORMAMORPH_AVATARS must be unset, "nsfw" or "none", got "${avatarSet}"`];
  const held = heldFiles(outDir);
  return [
    ...expected.filter((file) => !held.includes(file)).map((file) => `${file} is missing from the output`),
    ...held.filter((file) => !expected.includes(file)).map((file) => `${file} is in the output, and this avatar set doesn't hold it`),
  ];
}

export function bundledAvatarCheck(avatarSet = process.env.FORMAMORPH_AVATARS ?? '') {
  let outDir;
  return {
    name: 'bundled-avatar-check',
    apply: 'build',
    configResolved(config) {
      outDir = path.resolve(config.root, config.build.outDir);
    },
    closeBundle() {
      // `public/` copies the tracked default into every dist. Only that file is removed, so any other `.vrm` fails below.
      if (avatarSet === 'none') rmSync(path.join(outDir, DEFAULT_FILE), { force: true });
      const problems = bundledAvatarProblems(avatarSet, outDir);
      if (problems.length) throw new Error(`Bundled Avatars: ${problems.join('; ')}`);
    },
  };
}
