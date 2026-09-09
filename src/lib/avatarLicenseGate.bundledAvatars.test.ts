import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { readVrmMeta } from './vrmMeta';
import { gateAvatarLicense } from './avatarLicenseGate';

/**
 * Both avatars Formamorph ships must clear the Permissive License gate — one is swapped for the other at
 * build time (see `docs-internal/specs/community-avatar-uploads/spec.md`), and either must be publishable.
 * Reads the real shipped files rather than a fixture, so a re-export that drops a required flag is caught here
 * instead of surfacing as "Not shareable" on the player's own player-avatar model.
 */
describe.each([
  ['public/default-avatar.vrm'],
  ['build-assets/alternate-avatar.vrm'],
])('%s', (path) => {
  it('passes the Permissive License gate', async () => {
    const blob = new Blob([readFileSync(path)]);
    const { license } = await readVrmMeta(blob);
    expect(gateAvatarLicense(license)).toEqual({ allowed: true, failedRequirements: [] });
  });
});
