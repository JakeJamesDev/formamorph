import type { World, Entity, Dictionary } from '@/types';
import type { CatalogKind } from '@/lib/catalogKinds';
import { describePlaceholders } from '@/lib/placeholders';

/**
 * What a publish request carries, whatever kind it is. The server takes the same body for all three; only
 * where the fields come from differs, and that mapping lives here rather than in the dialog so it can be
 * read (and tested) in one place.
 */
export interface PublishPayload {
  kind: CatalogKind;
  name: string;
  /** The listing blurb. Empty is allowed for the kinds that have nothing to put here. */
  description: string;
  /** Cover art. Absent for a dictionary, and optional for a character — the server fills a placeholder. */
  thumbnail?: string;
  /** The item itself, stored verbatim and handed back on download. */
  contentData: unknown;
}

/**
 * A world publishes its overview: name, description, and thumbnail are all authored fields.
 *
 * The blurb goes through {@link describePlaceholders} because a listing carries no placeholder defs — this is
 * the last point where a chip can be rendered as something a browsing human can read.
 *
 * `tags` is defaulted into the content because the server reads a listing's tags from
 * `contentData.worldOverview.tags` — a world with none would otherwise publish untagged. Copied rather
 * than assigned in place: the caller's world is the live library copy, not ours to edit.
 */
export function worldPublishPayload(world: World): PublishPayload {
  const overview = world.worldOverview ?? {};
  return {
    kind: 'world',
    name: overview.name || 'Untitled World',
    description: describePlaceholders(overview.description || '', world.placeholders),
    thumbnail: overview.thumbnail || undefined,
    contentData: { ...world, worldOverview: { ...overview, tags: overview.tags ?? [] } },
  };
}

/**
 * A character has no `description` field — it has one description written for the player and two written
 * for the AI. The player's is what a human browsing listings wants to read; `aiSummary` is the short
 * fallback. `aiDescription` is deliberately never used: it's long and full of prompt scaffolding.
 *
 * The blurb goes through {@link describePlaceholders} against the character's carried defs — a listing stores
 * only this string, so a chip left raw here would show as its id forever.
 */
export function entityPublishPayload(entity: Entity): PublishPayload {
  return {
    kind: 'entity',
    name: entity.name || 'Unnamed Character',
    description: describePlaceholders(entity.playerDescription || entity.aiSummary || '', entity.placeholders),
    thumbnail: entity.image || undefined, // optional; the server supplies stand-in art
    contentData: entity,
  };
}

/** A dictionary has an optional note and no art at all; the server supplies the cover. The note goes through
 *  {@link describePlaceholders} for the same reason a character's does. */
export function dictionaryPublishPayload(book: Dictionary): PublishPayload {
  return {
    kind: 'dictionary',
    name: book.name || 'Untitled Dictionary',
    description: describePlaceholders(book.description || '', book.placeholders),
    contentData: book,
  };
}
