/**
 * Profile images: what stands in when there is none, and what a picker will take.
 */

/** What the crop step produces, and the only sizes the server stores. */
export const AVATAR_SIZE = 256;

/** The largest file the picker will take, before cropping. Room for a phone photo. */
export const MAX_AVATAR_UPLOAD_BYTES = 10 * 1024 * 1024;

/**
 * What a file picker for an uploaded image offers, and what the crop canvas can decode.
 *
 * One list for every picker that feeds the community server — avatars and event posters both — so
 * adding or dropping a supported format is a single edit. An animated source is flattened.
 */
export const IMAGE_UPLOAD_ACCEPT = 'image/png,image/jpeg,image/webp,image/gif';

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
