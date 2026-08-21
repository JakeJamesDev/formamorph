/**
 * Profile images: where they load from, and what stands in when there is none.
 */
import { serverAssetSrc } from './serverAssets';

/** What the crop step produces, and the only sizes the server stores. */
export const AVATAR_SIZE = 256;

/** The largest file the picker will take, before cropping. Room for a phone photo. */
export const MAX_AVATAR_UPLOAD_BYTES = 10 * 1024 * 1024;

/** What the file picker offers, and what the crop canvas can decode. An animated source is flattened. */
export const AVATAR_ACCEPT = 'image/png,image/jpeg,image/webp,image/gif';

/**
 * The full URL of a stored avatar.
 *
 * @param path - The `avatarUrl` from any server DTO
 * @param apiUrl - The API base the client is talking to
 * @returns An absolute URL, or null when there is no avatar
 */
export function avatarSrc(path: string | null | undefined, apiUrl: string): string | null {
  return serverAssetSrc(path, apiUrl);
}

/** The letter shown when somebody has no image. Falls back to a shape rather than an empty circle. */
export function avatarInitial(username: string | null | undefined): string {
  const trimmed = (username || '').trim();

  return trimmed ? trimmed[0].toUpperCase() : '?';
}

/**
 * A stable hue for a username, so the same person is the same color everywhere.
 *
 * Derived from the name rather than stored: two readers looking at the same thread see the same colors
 * without the server having to have an opinion, and a fallback circle never has to wait on a fetch.
 *
 * @param username - The name to color
 * @returns An HSL hue in [0, 360)
 */
export function avatarHue(username: string | null | undefined): number {
  const name = (username || '').trim().toLowerCase();
  let hash = 0;

  for (let i = 0; i < name.length; i++) {
    // The usual string hash: shift-and-add, kept in 32 bits.
    hash = (hash << 5) - hash + name.charCodeAt(i);
    hash |= 0;
  }

  return Math.abs(hash) % 360;
}
