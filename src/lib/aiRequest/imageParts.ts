import type { ChatMessage, ImageAttachment, RequestMessage, UserContentPart } from '@/types';

/**
 * A request's messages with images on its last user message: the text part first, then one image part per
 * attachment, in order. Every other message stays as it is. No attachments returns the list unchanged.
 */
export function withImageParts(messages: RequestMessage[], attachments: readonly ImageAttachment[]): RequestMessage[] {
  if (attachments.length === 0) return messages;
  const at = messages.findLastIndex((message) => message.role === 'user');
  const last = messages[at];
  if (!last || typeof last.content !== 'string') return messages;
  const content: UserContentPart[] = [
    { type: 'text', text: last.content },
    ...attachments.map((image): UserContentPart => ({ type: 'image_url', image_url: { url: image.dataUrl } })),
  ];
  return messages.map((message, i) => (i === at ? { role: 'user', content } : message));
}

/** A message's text: the string itself, or the text parts of a message with images. */
export function messageText(message: RequestMessage): string {
  if (typeof message.content === 'string') return message.content;
  return message.content.flatMap((part) => (part.type === 'text' ? [part.text] : [])).join('\n\n');
}

/** A message as history holds it: its text alone. */
export const asTextMessage = (message: RequestMessage): ChatMessage => ({ role: message.role, content: messageText(message) });
