// The images a player attaches to an action. Like scene images, they live in their own map keyed by turn id,
// never inside a chat message: everything that walks the history parses its messages (see lib/sceneImages).

import type { ChatMessage, ImageAttachment } from '@/types';
import { fileToDataUrl } from './imageDrop';
import { dataUrlMime, optimizeToWebpDataUrl } from './imageOptim';
import { pruneTurnMap } from './turnDigest';

/** How many images one action carries. */
export const MAX_ATTACHMENTS = 4;

/** The long side an attached image is shrunk to. */
export const ATTACHMENT_MAX_DIM = 1568;

/** A turn's images by turn id, in attach order. */
export type AttachmentMap = Record<string, ImageAttachment[]>;

/** Why a file was not attached. */
export type AttachRefusal = 'notImage' | 'limit' | 'unreadable';

/** The toast for each refusal. */
export const ATTACH_REFUSAL_COPY: Record<AttachRefusal, string> = {
  notImage: 'You can attach only image files.',
  limit: `You can attach up to ${MAX_ATTACHMENTS} images to an action.`,
  unreadable: "That image couldn't be read. Try a PNG, JPEG, or WebP file.",
};

const EMPTY: ImageAttachment[] = [];

/** The images on the clipboard of a paste. Empty when the paste carries text, so a copy from a spreadsheet
 *  or a page still inserts its text. */
export function pastedImageFiles(dt: Pick<DataTransfer, 'files' | 'getData'> | null): File[] {
  if (!dt || dt.getData('text/plain')) return [];
  return Array.from(dt.files ?? []).filter((file) => file.type.startsWith('image/'));
}

/** Shrink and re-encode one image file. Null when the browser can't decode it. */
async function encodeAttachment(file: File): Promise<ImageAttachment | null> {
  const source = await fileToDataUrl(file);
  const dataUrl = await optimizeToWebpDataUrl(source, { maxDim: ATTACHMENT_MAX_DIM, maxBytes: Infinity });
  // A failed decode hands the source back unchanged.
  return dataUrl === source ? null : { id: crypto.randomUUID(), mime: dataUrlMime(dataUrl), dataUrl };
}

/** Add image files to the pending set, in order. Files past the cap, non-images and unreadable images are
 *  left out and named once each in `refused`. */
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

/** The pending set without one image. */
export const removePending = (pending: ImageAttachment[], id: string): ImageAttachment[] =>
  pending.filter((attachment) => attachment.id !== id);

/** Store a turn's images. A turn with none leaves no entry. */
export function attachToTurn(map: AttachmentMap, turnId: string, attachments: ImageAttachment[]): AttachmentMap {
  return attachments.length ? { ...map, [turnId]: attachments } : map;
}

/** A turn's images, in attach order. */
export const turnAttachments = (map: AttachmentMap, turnId: string | undefined): ImageAttachment[] =>
  (turnId && map[turnId]) || EMPTY;

/** Forget the images of turns no longer in the history: a failed, rolled-back or re-generated turn. */
export const pruneAttachments = (map: AttachmentMap, history: ChatMessage[]): AttachmentMap => pruneTurnMap(map, history);
