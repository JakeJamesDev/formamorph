// Fails a build whose output disagrees with FORMAMORPH_AVATARS: the app would fetch a file it lacks, or ship one it never seeds.
import { existsSync } from 'node:fs';
import path from 'node:path';

const AVATAR_SETS = { '': ['default-avatar.vrm'], nsfw: ['default-avatar.vrm', 'praline-avatar.vrm'] };
const ALL_FILES = [...new Set(Object.values(AVATAR_SETS).flat())];

/** What is wrong with `outDir` for this avatar set; empty when it matches. */
export function bundledAvatarProblems(avatarSet, outDir) {
  const expected = AVATAR_SETS[avatarSet];
  if (!expected) return [`FORMAMORPH_AVATARS must be unset or "nsfw", got "${avatarSet}"`];
  return ALL_FILES.flatMap((file) => {
    const held = existsSync(path.join(outDir, file));
    if (expected.includes(file) && !held) return [`${file} is missing from the output`];
    if (!expected.includes(file) && held) return [`${file} is in the output, and this avatar set doesn't hold it`];
    return [];
  });
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
      const problems = bundledAvatarProblems(avatarSet, outDir);
      if (problems.length) throw new Error(`Bundled Avatars: ${problems.join('; ')}`);
    },
  };
}
