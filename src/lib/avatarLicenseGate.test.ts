import { describe, it, expect } from 'vitest';
import { gateAvatarLicense, type AvatarLicenseRequirement } from './avatarLicenseGate';
import type { VrmLicense } from '@/types';

/** A license that clears every requirement, matching the bundled avatars' verified metadata. */
const PASSING: VrmLicense = {
  metaVersion: '1',
  avatarPermission: 'everyone',
  allowRedistribution: true,
  modification: 'allowModificationRedistribution',
  commercialUse: 'corporation',
};

describe('gateAvatarLicense', () => {
  it('allows a license meeting every requirement', () => {
    expect(gateAvatarLicense(PASSING)).toEqual({ allowed: true, failedRequirements: [] });
  });

  it('allows personalProfit as well as corporation for commercial use', () => {
    const verdict = gateAvatarLicense({ ...PASSING, commercialUse: 'personalProfit' });
    expect(verdict).toEqual({ allowed: true, failedRequirements: [] });
  });

  const singleFailures: [string, Partial<VrmLicense>, AvatarLicenseRequirement][] = [
    ['not VRM 1.0', { metaVersion: '0' }, 'metaVersion'],
    ['avatarPermission is not everyone', { avatarPermission: 'onlyAuthor' }, 'avatarPermission'],
    ['redistribution is not allowed', { allowRedistribution: false }, 'allowRedistribution'],
    ['modification does not allow redistribution', { modification: 'allowModification' }, 'modification'],
    ['commercial use is personalNonProfit', { commercialUse: 'personalNonProfit' }, 'commercialUsage'],
  ];

  it.each(singleFailures)('reports only %s as failed, with every other requirement passing', (_desc, override, requirement) => {
    const verdict = gateAvatarLicense({ ...PASSING, ...override });
    expect(verdict).toEqual({ allowed: false, failedRequirements: [requirement] });
  });

  it('rejects a VRM 0.0 license outright, even one flagged fully permissive by its own fields', () => {
    // VRM 0.0 has no avatarPermission/modification concept at all; a 0.0 file must fail on metaVersion alone,
    // not be waved through because the unrelated fields happen to be unset rather than explicitly false.
    const verdict = gateAvatarLicense({
      metaVersion: '0',
      allowRedistribution: true,
      commercialUse: 'corporation',
    });
    expect(verdict.allowed).toBe(false);
    expect(verdict.failedRequirements).toContain('metaVersion');
  });

  it('rejects a plain glTF with no VRM metadata at all', () => {
    const verdict = gateAvatarLicense({ metaVersion: null });
    expect(verdict.allowed).toBe(false);
    expect(verdict.failedRequirements).toEqual(
      expect.arrayContaining(['metaVersion', 'avatarPermission', 'allowRedistribution', 'modification', 'commercialUsage']),
    );
  });

  it('treats every missing field on an otherwise-VRM-1.0 license as a failure, never as permission', () => {
    const verdict = gateAvatarLicense({ metaVersion: '1' });
    expect(verdict).toEqual({
      allowed: false,
      failedRequirements: ['avatarPermission', 'allowRedistribution', 'modification', 'commercialUsage'],
    });
  });
});
