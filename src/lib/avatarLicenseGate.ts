import type { VrmLicense } from '@/types';

/** One failed Permissive License requirement — the contract between this gate, the server's mirror of it, and this module's UI copy. Never rename an existing value; add a new one instead. */
export type AvatarLicenseRequirement =
  | 'metaVersion'
  | 'avatarPermission'
  | 'allowRedistribution'
  | 'modification'
  | 'commercialUsage';

export interface AvatarLicenseVerdict {
  allowed: boolean;
  failedRequirements: AvatarLicenseRequirement[];
}

/** Whether a VRM's normalized license grants every right Community Creations needs. Pure; a missing field fails its requirement, never treated as permission. */
export function gateAvatarLicense(license: VrmLicense): AvatarLicenseVerdict {
  const failedRequirements: AvatarLicenseRequirement[] = [];
  if (license.metaVersion !== '1') failedRequirements.push('metaVersion');
  if (license.avatarPermission !== 'everyone') failedRequirements.push('avatarPermission');
  if (license.allowRedistribution !== true) failedRequirements.push('allowRedistribution');
  if (license.modification !== 'allowModificationRedistribution') failedRequirements.push('modification');
  if (license.commercialUse !== 'personalProfit' && license.commercialUse !== 'corporation') {
    failedRequirements.push('commercialUsage');
  }
  return { allowed: failedRequirements.length === 0, failedRequirements };
}
