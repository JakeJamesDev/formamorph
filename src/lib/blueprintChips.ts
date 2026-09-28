// Blueprint chips read per bearer, so only text that always has a bearer takes one (acceptsBlueprintChips).

import { blueprintIds } from './placeholderBlueprints';
import type { PlaceholderHomesWorld } from './placeholderHomes';
import { decodePlaceholderToken, PLACEHOLDER_TOKEN_SOURCE } from './placeholders';
import type { Dictionary, Entity, Placeholder, PlaceholderValue } from '@/types';

const TOKEN_RE = new RegExp(PLACEHOLDER_TOKEN_SOURCE, 'g');

/** A chip-bearing field, as the blueprint-chip rule reads it. */
export type ChipField =
  /** A trait's or trait group's text. `owned`: an entity holds it rather than the world. */
  | { kind: 'trait'; owned: boolean }
  /** One placeholder's own value list. */
  | { kind: 'values'; placeholderId: string }
  /** Any other chip field: entity, location, stat, lore, overview, prompt. */
  | { kind: 'text' };

/** The top of `id`'s owner chain: the placeholder whose values hold it, or itself. */
function rootOf(placeholders: readonly Placeholder[], id: string): Placeholder | undefined {
  const byId = new Map(placeholders.map((p) => [p.id, p]));
  const seen = new Set<string>();
  let at = byId.get(id);
  while (at?.ownerId && !seen.has(at.id)) {
    seen.add(at.id);
    const up = byId.get(at.ownerId);
    if (!up) break;
    at = up;
  }
  return at;
}

/** True where `field` takes a blueprint chip: a world trait's or group's text, and a blueprint's or copy's
 *  values, a placeholder owned by one included. */
export function acceptsBlueprintChips(field: ChipField, world: PlaceholderHomesWorld): boolean {
  if (field.kind === 'trait') return !field.owned;
  if (field.kind === 'text') return false;
  const all = [...(world.placeholders ?? []), ...(world.entities ?? []).flatMap((e) => e.placeholders ?? [])];
  const root = rootOf(all, field.placeholderId);
  return !!root && (!!root.blueprintId || blueprintIds(world).has(root.id));
}

/** True for a chip token naming one of `blueprints`. */
export const isBlueprintChip = (token: string, blueprints: ReadonlySet<string>): boolean => {
  const id = decodePlaceholderToken(token)?.id;
  return !!id && blueprints.has(id);
};

/** `text` with every chip naming one of `blueprints` removed, the text around it kept, and how many went. */
export function dropBlueprintChips(text: string, blueprints: ReadonlySet<string>): { text: string; dropped: number } {
  if (!blueprints.size || !text) return { text, dropped: 0 };
  let dropped = 0;
  const out = text.replace(TOKEN_RE, (token) => {
    if (!isBlueprintChip(token, blueprints)) return token;
    dropped += 1;
    return '';
  });
  return { text: out, dropped };
}

/** The notice a paste or an import that lost blueprint chips shows. */
export const blueprintChipsRemovedNotice = (count: number, lostBy: 'paste' | 'import'): string =>
  `Blueprint chips go only in world trait text and in blueprint and copy values. This ${lostBy} lost ${count === 1 ? 'one' : count}.`;

/** Drops blueprint chips from one record's texts, counting them across every call. */
function dropper(blueprints: ReadonlySet<string>) {
  let dropped = 0;
  const one = <T extends string | undefined>(text: T): T => {
    if (!text) return text;
    const out = dropBlueprintChips(text, blueprints);
    dropped += out.dropped;
    return out.text as T;
  };
  const each = (texts: string[] | undefined) => texts?.map(one);
  const values = (list: PlaceholderValue[]) => list.map((v) => ({ ...v, text: one(v.text) }));
  return { one, each, values, count: () => dropped };
}

/**
 * The entity with every blueprint chip dropped from its own text and its own placeholders' values. A copy's
 * values, and those of a placeholder a copy owns, keep theirs. Its owned traits keep theirs too: the copies
 * reconcile points them at the entity's own copies. The same entity when nothing dropped.
 */
export function dropEntityBlueprintChips(entity: Entity, blueprints: ReadonlySet<string>): { entity: Entity; dropped: number } {
  if (!blueprints.size) return { entity, dropped: 0 };
  const d = dropper(blueprints);
  const owned = entity.placeholders ?? [];
  const next: Entity = {
    ...entity,
    name: d.one(entity.name),
    ...(entity.aliases ? { aliases: d.each(entity.aliases) } : {}),
    playerDescription: d.one(entity.playerDescription),
    aiDescription: d.one(entity.aiDescription),
    aiSummary: d.one(entity.aiSummary),
    imageTags: d.one(entity.imageTags),
    ...(entity.openings ? { openings: entity.openings.map((o) => ({ ...o, text: d.one(o.text) })) } : {}),
    ...(entity.placeholders ? {
      placeholders: owned.map((p) => (acceptsBlueprintChips({ kind: 'values', placeholderId: p.id }, { placeholders: owned })
        ? p : { ...p, values: d.values(p.values) })),
    } : {}),
  };
  return d.count() ? { entity: next, dropped: d.count() } : { entity, dropped: 0 };
}

/** The book with every blueprint chip dropped from its entries and its own placeholders' values. The same
 *  book when nothing dropped. */
export function dropBookBlueprintChips(book: Dictionary, blueprints: ReadonlySet<string>): { book: Dictionary; dropped: number } {
  if (!blueprints.size) return { book, dropped: 0 };
  const d = dropper(blueprints);
  const next: Dictionary = {
    ...book,
    entries: book.entries.map((e) => ({
      ...e, name: d.one(e.name), key: d.each(e.key) ?? e.key,
      ...(e.secondaryKeys ? { secondaryKeys: d.each(e.secondaryKeys) } : {}), value: d.one(e.value),
    })),
    ...(book.placeholders ? { placeholders: book.placeholders.map((p) => ({ ...p, values: d.values(p.values) })) } : {}),
  };
  return d.count() ? { book: next, dropped: d.count() } : { book, dropped: 0 };
}
