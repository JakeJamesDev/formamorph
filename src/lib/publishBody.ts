import type { PublishPayload } from '@/lib/publishPayload';

/** A publish request's body and the size the publish limit is checked against. */
export interface PublishBody {
  /** The UTF-8 byte length of the content's compact JSON: the server's own measure. */
  bytes: number;
  body: Blob;
}

/**
 * Build the request body for `payload` and size its content in one pass.
 *
 * The content is stringified once, on its own, and spliced between the other fields' JSON as a Blob part,
 * so the world never becomes a second string. Field order and omissions match `JSON.stringify` over the
 * whole request, including a content that serializes to nothing (it is dropped and sized at zero).
 *
 * @param payload - A ready publish payload
 * @param contestEventId - The contest to enter the new listing into, or null
 */
export function buildPublishBody(payload: PublishPayload, contestEventId: string | null): PublishBody {
  const json = JSON.stringify(payload.contentData);
  const content = json === undefined ? null : new Blob([json]);
  const head = JSON.stringify({ name: payload.name, description: payload.description, thumbnail: payload.thumbnail });
  const tail = JSON.stringify({
    kind: payload.kind,
    // Top level because only a world keeps a copy in its content, where the server looks first.
    tags: payload.tags ?? [],
    ...(contestEventId ? { contestEventId } : {}),
    // Omitted unless declared, so a publish that says nothing leaves the listing's relationships as they are.
    ...(payload.visibility ? { visibility: payload.visibility } : {}),
    ...(payload.requiredDependencies ? { requiredDependencies: payload.requiredDependencies } : {}),
    ...(payload.compatibleWorlds ? { compatibleWorlds: payload.compatibleWorlds } : {}),
    ...(payload.models ? { models: payload.models } : {}),
  });
  // `head` ends with `}` and `tail` starts with `{`; both always hold a field.
  const parts = content ? [head.slice(0, -1), ',"contentData":', content, ',', tail.slice(1)] : [head.slice(0, -1), ',', tail.slice(1)];
  return { bytes: content?.size ?? 0, body: new Blob(parts, { type: 'application/json' }) };
}
