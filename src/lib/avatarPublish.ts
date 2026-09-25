import ModelStorageService from '@/services/ModelStorageService';
import { blobToDataUrl } from '@/lib/imageSource';
import { gateAvatarLicense, type AvatarLicenseRequirement } from '@/lib/avatarLicenseGate';
import { modelPublishPayload } from '@/lib/publishPayload';
import { DEFAULT_AVATAR_URL } from '@/lib/defaultAvatar';
import type { PublishPayload } from '@/lib/publishPayload';

/**
 * What one failed Permissive License requirement denies, phrased to complete "its file doesn't allow …".
 *
 * The identifiers are the contract with the server, which reports the same names from its own copy of the
 * gate; this is the only place the client turns one into words a player reads.
 */
const DENIALS: Record<AvatarLicenseRequirement, string> = {
  metaVersion: 'VRM 1.0 license information',
  avatarPermission: 'everyone to use it',
  allowRedistribution: 'redistribution',
  modification: 'modification',
  commercialUsage: 'commercial use',
};

/** "a, b, or c" — the reading of a list of things none of which is permitted. */
const orList = (items: string[]): string => (
  items.length <= 1 ? items.join('')
    : items.length === 2 ? `${items[0]} or ${items[1]}`
    : `${items.slice(0, -1).join(', ')}, or ${items[items.length - 1]}`
);

/**
 * Why a model cannot be published, in one sentence naming the requirements its file fails.
 *
 * A file with no VRM 1.0 metadata fails all five at once, and reciting them would suggest five separate
 * problems rather than the one the player can act on: the export is the wrong format.
 *
 * @param failed - The requirements the gate reported, in its own order
 * @returns The sentence to show
 */
export function avatarPublishRefusal(failed: AvatarLicenseRequirement[]): string {
  if (failed.includes('metaVersion')) {
    return `This Avatar can’t be published: its file carries no ${DENIALS.metaVersion}.`;
  }
  return `This Avatar can’t be published: its file doesn’t allow ${orList(failed.map((id) => DENIALS[id]))}.`;
}

/** Why the default Avatar can't be published, whatever its license says. */
const DEFAULT_AVATAR_REFUSAL = 'This is the default avatar. Upload your own VRM.';

/** A model that may be published, with the payload ready, or one that may not, with the reason to show. */
export type AvatarPublishAttempt =
  | { allowed: true; payload: PublishPayload }
  | { allowed: false; reason: 'defaultAvatar'; message: string }
  | { allowed: false; reason: 'license'; message: string; failedRequirements: AvatarLicenseRequirement[] };

/** Everything the gate needs that only the caller knows. */
export interface AvatarPublishTarget {
  id: string;
  /** The library's name for it, used when the file names itself nothing. */
  name: string;
}

/** Absence is failure, exactly as it is everywhere else the license is read. */
const NOTHING_KNOWN = { metaVersion: null } as const;

const licenseRefusal = (failedRequirements: AvatarLicenseRequirement[]): AvatarPublishAttempt => ({
  allowed: false,
  reason: 'license',
  message: avatarPublishRefusal(failedRequirements),
  failedRequirements,
});

/**
 * Judge one library model's file and, when it passes, build the payload that publishes it.
 *
 * The default Avatar is refused by its bytes before the license is read: its file grants every right, and a
 * copy under a new name is still the default.
 *
 * The stored license is refreshed first: a record written before the Permissive License gate's fields
 * existed carries a license missing them, which would fail every requirement for being old rather than
 * for what the file says. The refresh is best effort — a model that cannot be rendered is still judged on
 * the license the refresh did resolve.
 *
 * @param target - Which library model to publish
 * @returns The verdict, with a ready payload when it passed
 */
export async function buildAvatarPublish(target: AvatarPublishTarget): Promise<AvatarPublishAttempt> {
  await ModelStorageService.ensureThumbnail(target.id).catch(() => undefined);

  let data;
  try {
    data = await ModelStorageService.getModelData(target.id);
  } catch {
    // Unreadable bytes are not a license, so they are not permission either.
    return licenseRefusal(gateAvatarLicense(NOTHING_KNOWN).failedRequirements);
  }

  // The server makes the same check, so a failed lookup here only moves the refusal there.
  const defaultHashes = await ModelStorageService.defaultAvatarHashes(DEFAULT_AVATAR_URL).catch((): string[] => []);
  if (data.hash && defaultHashes.includes(data.hash)) {
    return { allowed: false, reason: 'defaultAvatar', message: DEFAULT_AVATAR_REFUSAL };
  }

  const verdict = gateAvatarLicense(data.license ?? NOTHING_KNOWN);
  if (!verdict.allowed) return licenseRefusal(verdict.failedRequirements);

  return {
    allowed: true,
    payload: modelPublishPayload({
      name: target.name,
      vrm: await blobToDataUrl(data.blob),
      license: data.license,
      hash: data.hash,
      thumbnail: data.thumbnail,
    }),
  };
}
