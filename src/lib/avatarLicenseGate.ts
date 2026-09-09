import type { VrmLicense } from '@/types';

/**
 * Stable identifier for one failed Permissive License requirement. This is the contract between this gate,
 * the server's mirror of it (FormamorphServer, see the `community-avatar-uploads` spec), and this module's
 * own UI copy — never rename an existing value; add a new one instead.
 */
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

/**
 * The Permissive License gate: whether a VRM's normalized license grants every right Community Creations
 * needs to host and redistribute the Avatar. Pure — the caller supplies an already-normalized, current-shape
 * license (see `ModelStorageService`'s stale-record re-read). A missing field fails its requirement; absence
 * is never treated as permission.
 */
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
