/**
 * Where a picture is saved on the image server, for the servers that take a path (ComfyUI's save node takes
 * a file-name prefix with folders). The player's pattern names the parts: `{world}`, `{subject}` (an entity's
 * name, or `turn-12-scene`), `{turn}` and `{preset}` (the image endpoint preset). The server adds its own
 * counter and extension.
 */

export const DEFAULT_IMAGE_FILE_NAME = 'formamorph/{world}/{subject}';
/** What a prefix falls back to when the pattern leaves nothing. */
const FALLBACK = 'Formamorph';

export interface ImageFileParts {
  world?: string;
  subject?: string;
  turn?: number;
  preset?: string;
}

/** One path part made safe for a file system: the characters no OS allows become `-`, dots alone go. */
const safePart = (text: string) =>
  [...text].map((ch) => (ch.charCodeAt(0) < 32 || '<>:"\\|?*'.includes(ch) ? '-' : ch)).join('')
    .replace(/\s+/g, ' ').trim().replace(/^\.+$/, '');

/** The prefix for one picture: the pattern with its parts filled in, empty folders dropped. */
export function imageFilePrefix(pattern: string, parts: ImageFileParts): string {
  const fill = (segment: string) => safePart(segment
    .replace(/\{world\}/g, parts.world ?? '')
    .replace(/\{subject\}/g, parts.subject ?? '')
    .replace(/\{turn\}/g, parts.turn !== undefined ? String(parts.turn) : '')
    .replace(/\{preset\}/g, parts.preset ?? ''));
  const segments = (pattern || DEFAULT_IMAGE_FILE_NAME).split('/').map(fill).filter(Boolean);
  return segments.length ? segments.join('/') : FALLBACK;
}
