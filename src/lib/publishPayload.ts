import type { World, Entity, Dictionary, VrmLicense } from '@/types';
import type { CatalogKind } from '@/lib/catalogKinds';
import { describePlaceholders } from '@/lib/placeholders';
import { allPlaceholders } from '@/lib/placeholderHomes';
import { entityPlacementLetters, labelPlaceholders } from '@/lib/placementLetters';
import { primaryImage } from '@/lib/entityImages';

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
  /**
   * Listing tags. Sent alongside the content rather than dug out of it, because only a world keeps them
   * somewhere the server already knows to look.
   */
  tags?: string[];
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
export function worldPublishPayload(world: Omit<World, 'id'>): PublishPayload {
  const overview = world.worldOverview ?? {};
  return {
    kind: 'world',
    name: overview.name || 'Untitled World',
    description: describePlaceholders(overview.description || '', allPlaceholders(world)),
    thumbnail: overview.thumbnail || undefined,
    contentData: { ...world, worldOverview: { ...overview, tags: overview.tags ?? [] } },
    tags: overview.tags ?? [],
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
    name: labelPlaceholders(entity.name, entity.placeholders, { letters: entityPlacementLetters(entity) }) || 'Unnamed Character',
    description: describePlaceholders(entity.playerDescription || entity.aiSummary || '', entity.placeholders),
    thumbnail: primaryImage(entity), // optional; the server supplies stand-in art
    contentData: entity,
    tags: entity.tags ?? [],
  };
}

/** A dictionary has an optional note and no art at all; the server supplies the cover. The note goes through
 *  {@link describePlaceholders} for the same reason a character's does. */
export function dictionaryPublishPayload(book: Dictionary): PublishPayload {
  return {
    kind: 'dictionary',
    name: book.name || 'Untitled Dictionary',
    description: describePlaceholders(book.description || '', book.placeholders),
    thumbnail: book.thumbnail || undefined, // optional; the server supplies stand-in art
    contentData: book,
    tags: book.tags ?? [],
  };
}

/** A model's bytes and everything its file said about itself, resolved by the caller. */
export interface ModelPublishSource {
  /** The library's name for it, which is the fallback when the file names itself nothing. */
  name: string;
  /** The `.vrm` file's own bytes as a data URL. This is what the server re-reads the license from. */
  vrm: string;
  license?: VrmLicense;
  hash?: string;
  /** The model's picture, absent when there is none — the server then fills its stand-in. */
  thumbnail?: string;
}

/** "By Alice.", "By Alice and Bob.", "By Alice, Bob, and Carol." — or nothing, for a file crediting nobody. */
function creditLine(authors: string[] | undefined): string {
  const names = authors?.filter((name) => name.trim()) ?? [];
  if (names.length === 0) return '';
  if (names.length === 1) return `By ${names[0]}.`;
  if (names.length === 2) return `By ${names[0]} and ${names[1]}.`;
  return `By ${names.slice(0, -1).join(', ')}, and ${names[names.length - 1]}.`;
}

/**
 * An Avatar publishes what its own file says: the author's title, the authors it credits, and its embedded
 * picture. There is no authored blurb and no tag field for this kind, so the description is generated and
 * the tags are empty — a listing form nobody has to fill in.
 *
 * The license rides in the content for readers of it. The server never trusts it: it re-reads the same
 * verdict out of `vrm` before storing the row.
 */
export function modelPublishPayload(model: ModelPublishSource): PublishPayload {
  return {
    kind: 'model',
    name: model.license?.title?.trim() || model.name.trim() || 'Untitled Avatar',
    description: creditLine(model.license?.authors),
    thumbnail: model.thumbnail || undefined, // optional; the server supplies stand-in art
    contentData: { vrm: model.vrm, license: model.license, hash: model.hash },
    tags: [],
  };
}

/**
 * The tags a listing will publish with.
 *
 * Read off the payload's own `tags` rather than out of its content: every kind carries them now, and only
 * a world keeps a copy inside `worldOverview` where the server already looks. The content is still the
 * fallback so a payload built by older code is not silently untagged.
 *
 * @param payload - A ready publish payload
 * @returns Its tags, or an empty array for one that has none
 */
export function publishTags(payload: PublishPayload): string[] {
  const overview = (payload.contentData as { worldOverview?: { tags?: unknown } })?.worldOverview;
  const tags = payload.tags ?? overview?.tags;

  return Array.isArray(tags) ? tags.filter((tag): tag is string => typeof tag === 'string') : [];
}
