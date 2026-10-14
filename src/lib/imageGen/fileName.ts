/**
 * Where an image is saved on the image server, for the servers that take a path (ComfyUI's save node takes
 * a file-name prefix with folders). The player's pattern names the parts: `{world}`, `{subject}` (an entity's
 * or location's name, or `turn-12-scene`), `{turn}` and `{preset}` (the image endpoint preset). Only the
 * pattern's own `/` makes folders. The server adds its own counter and extension.
 */

export const DEFAULT_IMAGE_FILE_NAME = 'formamorph/{world}/{subject}';
/** What a prefix falls back to when the pattern leaves nothing. */
const FALLBACK = 'Formamorph';
/** Windows device names, which no folder or file can take even with an extension. */
const RESERVED = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i;

export interface ImageFileParts {
  world?: string;
  subject?: string;
  turn?: number;
  preset?: string;
}

/** One filled value: a slash stays inside the part, and dots alone go. */
const safeValue = (text: string) => text.replace(/[/\\]/g, '-').replace(/^\s*\.+\s*$/, '');

/** One path part made safe for a file system: the characters no OS allows become `-`, dots alone go. */
const safePart = (text: string) => {
  const part = [...text].map((ch) => (ch.charCodeAt(0) < 32 || '<>:"\\|?*'.includes(ch) ? '-' : ch)).join('')
    .replace(/\s+/g, ' ').trim().replace(/^\.+$/, '');
  return RESERVED.test(part.split('.')[0].trim()) ? `_${part}` : part;
};

/** The prefix for one image: the pattern with its parts filled in, empty folders dropped. */
export function imageFilePrefix(pattern: string, parts: ImageFileParts): string {
  const values: Record<string, string> = {
    world: safeValue(parts.world ?? ''),
    subject: safeValue(parts.subject ?? ''),
    turn: parts.turn !== undefined ? String(parts.turn) : '',
    preset: safeValue(parts.preset ?? ''),
  };
  const fill = (segment: string) => safePart(segment.replace(/\{(world|subject|turn|preset)\}/g, (_, key: string) => values[key]));
  const segments = (pattern || DEFAULT_IMAGE_FILE_NAME).split('/').map(fill).filter(Boolean);
  return segments.length ? segments.join('/') : FALLBACK;
}
