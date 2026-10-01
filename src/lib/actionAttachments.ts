// The images a player attaches to an action. Like scene images, they live in their own map keyed by turn id,
// never inside a chat message: everything that walks the history parses its messages (see lib/sceneImages).

import type { ChatMessage, ImageAttachment } from '@/types';
import { bytesToDataUrl, dataUrlMime, fitWithin } from './imageBytes';
import { parseTurnContent, pruneTurnMap } from './turnDigest';
import { pageAssistantIndex } from './turnHistory';

/** How many images one action carries. */
export const MAX_ATTACHMENTS = 4;

/** The long side an attached image is shrunk to. */
export const ATTACHMENT_MAX_DIM = 1568;

// LM Studio refuses WebP image parts; JPEG passes every server we target.
const ATTACHMENT_MIME = 'image/jpeg';
const ATTACHMENT_QUALITY = 0.9;

/** A turn's images by turn id, in attach order. */
export type AttachmentMap = Record<string, ImageAttachment[]>;

/** Why a file was not attached. */
export type AttachRefusal = 'notImage' | 'limit' | 'unreadable';

/** The toast for each refusal. */
export const ATTACH_REFUSAL_COPY: Record<AttachRefusal, string> = {
  notImage: 'You can attach only image files.',
  limit: `You can attach up to ${MAX_ATTACHMENTS} images.`,
  unreadable: "Formamorph can't read that image. Try a PNG, JPEG, or WebP file.",
};

/** The shared empty list, so an action with no attachments keeps a stable reference. */
export const NO_ATTACHMENTS: ImageAttachment[] = [];

/** The images on the clipboard of a paste. Empty when the paste carries text, so a copy from a spreadsheet
 *  or a page still inserts its text. */
export function pastedImageFiles(dt: Pick<DataTransfer, 'files' | 'getData'> | null): File[] {
  if (!dt || dt.getData('text/plain')) return [];
  return Array.from(dt.files ?? []).filter((file) => file.type.startsWith('image/'));
}

/** Shrink one image file and re-encode it as JPEG, the format every vision server accepts. Transparency
 *  turns white; an animation keeps its first frame. Null when the browser can't decode or encode it. */
async function encodeAttachment(file: File): Promise<ImageAttachment | null> {
  try {
    const bitmap = await createImageBitmap(file);
    const { w, h } = fitWithin(bitmap.width, bitmap.height, ATTACHMENT_MAX_DIM);
    const canvas = new OffscreenCanvas(w, h);
    const ctx = canvas.getContext('2d');
    if (!ctx) { bitmap.close(); return null; }
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close();
    const blob = await canvas.convertToBlob({ type: ATTACHMENT_MIME, quality: ATTACHMENT_QUALITY });
    if (blob.type !== ATTACHMENT_MIME) return null;
    const dataUrl = bytesToDataUrl(new Uint8Array(await blob.arrayBuffer()), ATTACHMENT_MIME);
    return { id: crypto.randomUUID(), mime: ATTACHMENT_MIME, dataUrl };
  } catch {
    return null;
  }
}

/** Encode image files for the pending set, in order. Files past the cap, non-images and unreadable images
 *  are left out and named once each in `refused`. */
export async function addToPending(
  pending: ImageAttachment[],
  files: File[],
): Promise<{ pending: ImageAttachment[]; refused: AttachRefusal[] }> {
  const added: ImageAttachment[] = [];
  const refused = new Set<AttachRefusal>();
  for (const file of files) {
    if (!file.type.startsWith('image/')) { refused.add('notImage'); continue; }
    if (pending.length + added.length >= MAX_ATTACHMENTS) { refused.add('limit'); continue; }
    const attachment = await encodeAttachment(file);
    if (attachment) added.push(attachment);
    else refused.add('unreadable');
  }
  return { pending: [...pending, ...added], refused: [...refused] };
}

/** Append newly encoded attachments to the pending set as it is now, up to the cap. `overflow` is true when
 *  some did not fit, as when another intake filled the set while these encoded. */
export function joinPending(pending: ImageAttachment[], added: ImageAttachment[]): { pending: ImageAttachment[]; overflow: boolean } {
  const room = Math.max(0, MAX_ATTACHMENTS - pending.length);
  return { pending: [...pending, ...added.slice(0, room)], overflow: added.length > room };
}

/** The list without one attachment. */
export const withoutAttachment = (attachments: ImageAttachment[], id: string): ImageAttachment[] =>
  attachments.filter((attachment) => attachment.id !== id);

/** A turn's images, in attach order. */
export const turnAttachments = (map: AttachmentMap, turnId: string | undefined): ImageAttachment[] =>
  (turnId && map[turnId]) || NO_ATTACHMENTS;

/** Store or replace a turn's images. None leaves no entry. */
export function setTurnAttachments(map: AttachmentMap, turnId: string, attachments: ImageAttachment[]): AttachmentMap {
  if (attachments.length) return { ...map, [turnId]: attachments };
  if (!(turnId in map)) return map;
  const { [turnId]: _dropped, ...rest } = map;
  return rest;
}

/** The images of the newest turn in the history: the ones a regenerate of that turn sends again. */
export const latestTurnAttachments = (map: AttachmentMap, history: ChatMessage[]): ImageAttachment[] =>
  turnAttachments(map, turnIdOf(history.findLast((message) => message.role === 'assistant')));

/** The id of the turn on `page`. Undefined when its narration carries none. */
export const pageTurnId = (history: ChatMessage[], page: number): string | undefined =>
  turnIdOf(history[pageAssistantIndex(page, 2)]);

const turnIdOf = (message: ChatMessage | undefined): string | undefined =>
  message?.role === 'assistant' ? parseTurnContent(message.content)?.turnId : undefined;

/** Forget the images of turns no longer in the history: a failed, rolled-back or re-generated turn. */
export const pruneAttachments = (map: AttachmentMap, history: ChatMessage[]): AttachmentMap => pruneTurnMap(map, history);

/** The map a save holds, read back. A save is a file the player can edit, so entries that are not image
 *  lists are left out. Absent ⇒ none. */
export function restoreAttachments(raw: unknown): AttachmentMap {
  const restored: AttachmentMap = {};
  if (!raw || typeof raw !== 'object') return restored;
  for (const [turnId, list] of Object.entries(raw)) {
    if (!Array.isArray(list)) continue;
    const images = list.filter(isAttachment).slice(0, MAX_ATTACHMENTS);
    if (images.length) restored[turnId] = images;
  }
  return restored;
}

const isAttachment = (value: unknown): value is ImageAttachment => {
  const v = value as Partial<ImageAttachment> | null;
  return !!v && typeof v.id === 'string' && typeof v.mime === 'string' && typeof v.dataUrl === 'string'
    && v.mime.startsWith('image/') && dataUrlMime(v.dataUrl).startsWith('image/');
};
