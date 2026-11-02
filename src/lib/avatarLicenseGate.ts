import type { VrmLicense } from '@/types';

/** One failed Permissive License requirement — the contract between this gate, the server's mirror of it, and this module's UI copy. Never rename an existing value; add a new one instead. */
export type AvatarLicenseRequirement =
  | 'metaVersion'
  | 'avatarPermission'
  | 'allowRedistribution'
  | 'modification'
  | 'commercialUsage'
  | 'allowExcessivelySexualUsage'
  | 'allowExcessivelyViolentUsage'
  | 'allowPoliticalOrReligiousUsage'
  | 'allowAntisocialOrHateUsage'
  | 'creditNotation'
  | 'licenseUrl'
  | 'otherLicenseUrl';

export interface AvatarLicenseVerdict {
  allowed: boolean;
  failedRequirements: AvatarLicenseRequirement[];
}

const VRM_PUBLIC_LICENSE_URL = 'https://vrm.dev/licenses/1.0/';

/** Whether a VRM's normalized license grants every right Community Creations needs. Pure; a missing field fails its requirement, never treated as permission. */
export function gateAvatarLicense(license: VrmLicense): AvatarLicenseVerdict {
  const failedRequirements: AvatarLicenseRequirement[] = [];
  // A file without VRM 1.0 metadata grants nothing: its other fields come from a different schema, so they never count.
  const v1 = license.metaVersion === '1';
  if (!v1) failedRequirements.push('metaVersion');
  if (!v1 || license.avatarPermission !== 'everyone') failedRequirements.push('avatarPermission');
  if (!v1 || license.allowRedistribution !== true) failedRequirements.push('allowRedistribution');
  if (!v1 || license.modification !== 'allowModificationRedistribution') failedRequirements.push('modification');
  if (!v1 || license.commercialUse !== 'corporation') failedRequirements.push('commercialUsage');
  if (!v1 || license.allowExcessivelySexualUsage !== true) failedRequirements.push('allowExcessivelySexualUsage');
  if (!v1 || license.allowExcessivelyViolentUsage !== true) failedRequirements.push('allowExcessivelyViolentUsage');
  if (!v1 || license.allowPoliticalOrReligiousUsage !== true) failedRequirements.push('allowPoliticalOrReligiousUsage');
  if (!v1 || license.allowAntisocialOrHateUsage !== true) failedRequirements.push('allowAntisocialOrHateUsage');
  if (!v1 || license.creditNotation !== 'unnecessary') failedRequirements.push('creditNotation');
  if (!v1 || license.licenseUrl !== VRM_PUBLIC_LICENSE_URL) failedRequirements.push('licenseUrl');
  // The one field where absence passes: exporters omit it when there are no extra terms.
  if (license.otherLicenseUrl !== undefined && license.otherLicenseUrl !== '') failedRequirements.push('otherLicenseUrl');
  return { allowed: failedRequirements.length === 0, failedRequirements };
}
