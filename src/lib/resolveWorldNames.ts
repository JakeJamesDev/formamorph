import type { DictionaryEntry, Entity, GameLocation, StatDescriptor, Trait, TraitGroup } from '@/types';
import { hasPlaceholders } from './placeholders';

/**
 * Name fields resolve at the source rather than at each point of use. Gameplay reads names for three
 * different jobs — matching them against AI prose, keying maps and deltas by them, and showing them to the
 * player — and a name that resolved for only some of those would have the player and the AI talking about
 * different characters. Handing the whole world through here once means every consumer downstream sees one
 * name, and none of them has to know placeholders exist.
 *
 *
 * Every mapper returns the **original array and item references** when nothing contained a chip. That keeps
 * these safe to call unconditionally: a world with no placeholders costs one regex test per field and
 * produces no new object identities, so downstream memos and render paths are untouched.
 */

export type ResolveText = (text: string) => string;

/** Map `items`, keeping the original array reference when every item came back unchanged. */
function mapPreservingIdentity<T>(items: T[], map: (item: T) => T): T[] {
  let changed = false;
  const out = items.map((item) => {
    const next = map(item);
    if (next !== item) changed = true;
    return next;
  });
  return changed ? out : items;
}

/** Resolve one string, returning the exact original when it holds no chips. */
const one = (text: string | undefined, resolve: ResolveText): string | undefined =>
  text && hasPlaceholders(text) ? resolve(text) : text;

/** Resolve a string array, keeping its reference when no element held a chip. */
function list(values: string[] | undefined, resolve: ResolveText): string[] | undefined {
  if (!values?.length) return values;
  return mapPreservingIdentity(values, (v) => (hasPlaceholders(v) ? resolve(v) : v));
}

export function resolveEntityNames(entities: Entity[], resolve: ResolveText): Entity[] {
  return mapPreservingIdentity(entities, (e) => {
    const name = one(e.name, resolve);
    const aliases = list(e.aliases, resolve);
    return name === e.name && aliases === e.aliases ? e : { ...e, name: name ?? '', aliases };
  });
}

export function resolveLocationNames(locations: GameLocation[], resolve: ResolveText): GameLocation[] {
  return mapPreservingIdentity(locations, (l) => {
    const name = one(l.name, resolve);
    return name === l.name ? l : { ...l, name: name ?? '' };
  });
}

/** Generic over the stat shape: the authored `Stat` and the save's `PlayerStat` both carry the same name,
 *  and both have to resolve it — the AI's deltas are matched against one and applied to the other. The
 *  description and each descriptor resolve alongside: the AI reads them as the stat's meaning and status,
 *  and the player reads the active band under the bar. */
export function resolveStatNames<T extends { name: string; description?: string; descriptors?: StatDescriptor[] }>(
  stats: T[],
  resolve: ResolveText,
): T[] {
  return mapPreservingIdentity(stats, (s) => {
    const name = one(s.name, resolve);
    const description = one(s.description, resolve);
    const descriptors = s.descriptors && mapPreservingIdentity(s.descriptors, (d) => {
      const text = one(d.description, resolve);
      return text === d.description ? d : { ...d, description: text ?? '' };
    });
    return name === s.name && description === s.description && descriptors === s.descriptors
      ? s
      : { ...s, name: name ?? '', description, descriptors };
  });
}

/** Per-trait resolver: a pinning trait's own name resolves with its own pins layered over the active ones
 *  (see `traitScopedPins`), so its card reads the same whatever else is ticked. */
export function resolveTraitNames(traits: Trait[], resolveFor: (trait: Trait) => ResolveText): Trait[] {
  return mapPreservingIdentity(traits, (t) => {
    const name = one(t.name, resolveFor(t));
    return name === t.name ? t : { ...t, name: name ?? '' };
  });
}

export function resolveTraitGroupNames(groups: TraitGroup[], resolve: ResolveText): TraitGroup[] {
  return mapPreservingIdentity(groups, (g) => {
    const name = one(g.name, resolve);
    return name === g.name ? g : { ...g, name: name ?? '' };
  });
}

/** An entry's display name and both keyword arrays. Keywords resolve because activation matches them
 *  against context text that has already been resolved — an unresolved key could never hit. */
export function resolveDictionaryEntryNames(entries: DictionaryEntry[], resolve: ResolveText): DictionaryEntry[] {
  return mapPreservingIdentity(entries, (en) => {
    const name = one(en.name, resolve);
    const key = list(en.key, resolve);
    const secondaryKeys = list(en.secondaryKeys, resolve);
    return name === en.name && key === en.key && secondaryKeys === en.secondaryKeys
      ? en
      : { ...en, name: name ?? '', key: key ?? [], secondaryKeys };
  });
}

