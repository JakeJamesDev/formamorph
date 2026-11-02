import type { VrmLicense } from '@/types';

/** A normalized license that clears every Permissive License requirement. */
export const PASSING_LICENSE: VrmLicense = {
  metaVersion: '1',
  licenseUrl: 'https://vrm.dev/licenses/1.0/',
  avatarPermission: 'everyone',
  allowRedistribution: true,
  modification: 'allowModificationRedistribution',
  commercialUse: 'corporation',
  creditNotation: 'unnecessary',
  allowExcessivelySexualUsage: true,
  allowExcessivelyViolentUsage: true,
  allowPoliticalOrReligiousUsage: true,
  allowAntisocialOrHateUsage: true,
};

/** Raw VRM 1.0 meta that clears every requirement, for building a file through `makeVrm1`. */
export const PASSING_META = {
  avatarPermission: 'everyone',
  allowRedistribution: true,
  modification: 'allowModificationRedistribution',
  commercialUsage: 'corporation',
  allowExcessivelySexualUsage: true,
  allowExcessivelyViolentUsage: true,
  allowPoliticalOrReligiousUsage: true,
  allowAntisocialOrHateUsage: true,
  creditNotation: 'unnecessary',
  licenseUrl: 'https://vrm.dev/licenses/1.0/',
};
