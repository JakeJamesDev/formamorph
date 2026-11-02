import { describe, it, expect } from 'vitest';
import { gateAvatarLicense, type AvatarLicenseRequirement } from './avatarLicenseGate';
import type { VrmLicense } from '@/types';
import { PASSING_LICENSE as PASSING } from '@/test/avatarLicenseFixtures';

describe('gateAvatarLicense', () => {
  it('allows a license meeting every requirement', () => {
    expect(gateAvatarLicense(PASSING)).toEqual({ allowed: true, failedRequirements: [] });
  });

  it('allows an empty or absent otherLicenseUrl', () => {
    expect(gateAvatarLicense({ ...PASSING, otherLicenseUrl: undefined }).allowed).toBe(true);
    expect(gateAvatarLicense({ ...PASSING, otherLicenseUrl: '' }).allowed).toBe(true);
  });

  const singleFailures: [string, Partial<VrmLicense>, AvatarLicenseRequirement][] = [
    ['avatarPermission is not everyone', { avatarPermission: 'onlyAuthor' }, 'avatarPermission'],
    ['redistribution is not allowed', { allowRedistribution: false }, 'allowRedistribution'],
    ['modification does not allow redistribution', { modification: 'allowModification' }, 'modification'],
    ['commercial use is personalNonProfit', { commercialUse: 'personalNonProfit' }, 'commercialUsage'],
    ['commercial use is personalProfit', { commercialUse: 'personalProfit' }, 'commercialUsage'],
    ['sexual use is not allowed', { allowExcessivelySexualUsage: false }, 'allowExcessivelySexualUsage'],
    ['violent use is not allowed', { allowExcessivelyViolentUsage: false }, 'allowExcessivelyViolentUsage'],
    ['political or religious use is not allowed', { allowPoliticalOrReligiousUsage: false }, 'allowPoliticalOrReligiousUsage'],
    ['antisocial or hateful use is not allowed', { allowAntisocialOrHateUsage: false }, 'allowAntisocialOrHateUsage'],
    ['credit is required', { creditNotation: 'required' }, 'creditNotation'],
    ['the license URL is another license', { licenseUrl: 'https://example.com/license' }, 'licenseUrl'],
    ['extra license terms are linked', { otherLicenseUrl: 'https://example.com/terms' }, 'otherLicenseUrl'],
    ['otherLicenseUrl is null', { otherLicenseUrl: null }, 'otherLicenseUrl'],
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
    // The server fails every VRM 1.0 requirement for such a file; the client names the same ones.
    expect(verdict.failedRequirements).toContain('allowRedistribution');
    expect(verdict.failedRequirements).toContain('commercialUsage');
  });

  it('rejects a plain glTF with no VRM metadata at all', () => {
    const verdict = gateAvatarLicense({ metaVersion: null });
    expect(verdict.allowed).toBe(false);
    expect(verdict.failedRequirements).toEqual([
      'metaVersion', 'avatarPermission', 'allowRedistribution', 'modification', 'commercialUsage',
      'allowExcessivelySexualUsage', 'allowExcessivelyViolentUsage', 'allowPoliticalOrReligiousUsage',
      'allowAntisocialOrHateUsage', 'creditNotation', 'licenseUrl',
    ]);
  });

  it('treats every missing field on an otherwise-VRM-1.0 license as a failure, never as permission', () => {
    const verdict = gateAvatarLicense({ metaVersion: '1' });
    expect(verdict).toEqual({
      allowed: false,
      failedRequirements: [
        'avatarPermission', 'allowRedistribution', 'modification', 'commercialUsage',
        'allowExcessivelySexualUsage', 'allowExcessivelyViolentUsage', 'allowPoliticalOrReligiousUsage',
        'allowAntisocialOrHateUsage', 'creditNotation', 'licenseUrl',
      ],
    });
  });

  const requiredFields: [string, keyof VrmLicense, AvatarLicenseRequirement][] = [
    ['avatarPermission', 'avatarPermission', 'avatarPermission'],
    ['allowRedistribution', 'allowRedistribution', 'allowRedistribution'],
    ['modification', 'modification', 'modification'],
    ['commercialUse', 'commercialUse', 'commercialUsage'],
    ['allowExcessivelySexualUsage', 'allowExcessivelySexualUsage', 'allowExcessivelySexualUsage'],
    ['allowExcessivelyViolentUsage', 'allowExcessivelyViolentUsage', 'allowExcessivelyViolentUsage'],
    ['allowPoliticalOrReligiousUsage', 'allowPoliticalOrReligiousUsage', 'allowPoliticalOrReligiousUsage'],
    ['allowAntisocialOrHateUsage', 'allowAntisocialOrHateUsage', 'allowAntisocialOrHateUsage'],
    ['creditNotation', 'creditNotation', 'creditNotation'],
    ['licenseUrl', 'licenseUrl', 'licenseUrl'],
  ];

  it.each(requiredFields)('fails %s alone when only that field is missing', (_name, field, requirement) => {
    const { [field]: _gone, ...rest } = PASSING;
    expect(gateAvatarLicense(rest as VrmLicense)).toEqual({ allowed: false, failedRequirements: [requirement] });
  });
});
