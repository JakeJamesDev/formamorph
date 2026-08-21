/**
 * Where a file the community server stores actually loads from.
 *
 * The server answers with a root-relative path (`/api/avatars/…`, `/api/event-posters/…`) because it does
 * not know what host the client reached it on — the desktop shell and the web build use different ones —
 * so the origin is added here, once, for every kind of asset.
 */

/**
 * The full URL of a stored asset.
 *
 * Only a root-relative path is given an origin. Anything else already says where it comes from — an
 * absolute URL from a CDN, or a `data:` URI for an image being previewed before it has been uploaded —
 * and prefixing those would break them.
 *
 * @param path - The root-relative path from any server DTO
 * @param apiUrl - The API base the client is talking to
 * @returns An absolute URL, or null when there is no asset
 */
export function serverAssetSrc(path: string | null | undefined, apiUrl: string): string | null {
  if (!path) return null;
  if (!path.startsWith('/')) return path;

  // `apiUrl` already ends in `/api`, which the server's path also starts with.
  return `${apiUrl.replace(/\/api\/?$/, '')}${path}`;
}
