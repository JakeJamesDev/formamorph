import { KIND_LABELS, kindOf, type CatalogKind } from '@/lib/catalogKinds';

/** The author a takedown notice would go to. */
export interface TakedownAuthor {
  id: string;
  username: string;
}

/** Everything the notice needs: who wrote the item, and what it was. */
export interface TakedownTarget {
  author: TakedownAuthor;
  kind: CatalogKind;
  name: string;
}

/** A catalog listing as the browser holds it — every field optional, since the server shapes vary. */
interface ListingLike {
  kind?: string;
  name?: unknown;
  author?: { id?: unknown; username?: unknown } | null;
}

/**
 * Who to offer a takedown notice to for a just-deleted listing, or null when nobody.
 *
 * Only somebody else's work qualifies. Deleting your own needs no explanation, and an item with no author
 * on the record has nobody to address — both would otherwise open a composer with no one in it.
 *
 * @param listing - The deleted listing
 * @param currentUserId - The signed-in user's ID
 * @returns The notice target, or null when the deletion should pass silently
 */
export function takedownTargetFor(
  listing: ListingLike,
  currentUserId: string | null | undefined
): TakedownTarget | null {
  const id = listing.author?.id;
  const username = listing.author?.username;
  if (typeof id !== 'string' || !id || typeof username !== 'string' || !username) return null;
  if (id === currentUserId) return null;

  const kind = kindOf(listing);

  return {
    author: { id, username },
    kind,
    // A listing with no name still has to read as something in the notice.
    name: typeof listing.name === 'string' && listing.name ? listing.name : KIND_LABELS[kind].one,
  };
}

/**
 * Prefill for a takedown notice.
 *
 * The item is already gone by the time this is sent, so its name and kind are written into the text —
 * there is nothing left to link to. The reason is left open for the admin to complete.
 *
 * @param target - The deleted item and its author
 * @returns `{ subject, body }` for the message composer
 */
export function takedownTemplate(target: TakedownTarget): { subject: string; body: string } {
  const noun = KIND_LABELS[target.kind].one.toLowerCase();

  return {
    subject: `Your ${noun} "${target.name}" was removed`,
    body: `Your ${noun} **"${target.name}"** has been removed from Community Creations.\n\n**Reason:** `,
  };
}
