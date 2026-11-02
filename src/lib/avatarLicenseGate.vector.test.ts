import { describe, it, expect } from 'vitest';
import { readVrmMeta } from './vrmMeta';
import { gateAvatarLicense } from './avatarLicenseGate';
import { makeGlb } from '@/test/glbFixture';
import vector from './__fixtures__/avatar-license-vector.json';

type VectorCase = { name: string; kind: 'vrm1' | 'vrm0' | 'plain'; meta?: Record<string, unknown>; failed: string[] };

const fileFor = (c: VectorCase): Blob => {
  if (c.kind === 'vrm1') return makeGlb({ extensions: { VRMC_vrm: { meta: c.meta } } });
  if (c.kind === 'vrm0') return makeGlb({ extensions: { VRM: { meta: c.meta } } });
  return makeGlb({ asset: { version: '2.0' } });
};

// The server repo carries a copy of this vector and runs the same cases through its own gate,
// so both implementations are pinned to one answer per file.
describe('the shared license vector', () => {
  it.each(vector.cases as VectorCase[])('$name', async (c) => {
    const { license } = await readVrmMeta(fileFor(c));
    expect(gateAvatarLicense(license).failedRequirements).toEqual(c.failed);
  });

  it('holds a passing case, one failing alone per requirement, and one missing field per requirement', () => {
    const cases = vector.cases as VectorCase[];
    const single = cases.filter((c) => c.failed.length === 1).map((c) => c.failed[0]);
    for (const id of ['avatarPermission', 'allowRedistribution', 'modification', 'commercialUsage',
      'allowExcessivelySexualUsage', 'allowExcessivelyViolentUsage', 'allowPoliticalOrReligiousUsage',
      'allowAntisocialOrHateUsage', 'creditNotation', 'licenseUrl', 'otherLicenseUrl']) {
      expect(single).toContain(id);
    }
    expect(cases.some((c) => c.failed.length === 0)).toBe(true);
  });
});
