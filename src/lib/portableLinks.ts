// The link half of carrying owned traits and owned stats off-world: links named on the way out, bound to a
// receiving world's originals on the way in. Each item kind supplies its world through a LinkLists.

import { rekeyed, uniqueNamed, type Named } from './carriedBinding';

/** The fields a trait link and a stat link share. */
export interface PortableLink {
  id: string;
  originalId: string;
  kind: string;
  originalName: string;
  groupId: string | null;
  order?: number;
  overrides?: Record<string, unknown>;
  keyNames?: Record<string, string>;
}

/** One item kind's lists in one world, as its links read them. */
export interface LinkLists<L extends PortableLink> {
  /** The world item a link's original id names, when it is of the link's kind. */
  originalNamed: (link: L) => Named | null | undefined;
  /** The items a link of `kind` may bind to. */
  originals: (kind: L['kind']) => readonly Named[];
  /** The world's leaves, the items an override keys. */
  leaves: readonly Named[];
  /** The ids a link to `original` brings, and the leaves among them. */
  brought: (original: Named, kind: L['kind']) => { ids: string[]; leaves: readonly Named[] };
  /** The bound link as the kind stores it. */
  finish?: (link: L) => L;
}

/** Each link naming its original, and each other leaf its overrides key, by the world's names. */
export function portableLinks<L extends PortableLink>(links: readonly L[], lists?: LinkLists<L>): L[] {
  return links.map((link) => {
    const original = lists?.originalNamed(link);
    const keyNames = Object.fromEntries(Object.keys(link.overrides ?? {}).filter((id) => id !== link.originalId).flatMap((id) => {
      const name = lists?.leaves.find((leaf) => leaf.id === id)?.name ?? link.keyNames?.[id];
      return name ? [[id, name] as const] : [];
    }));
    const { keyNames: _stored, ...rest } = link;
    return { ...rest, originalName: original ? original.name : link.originalName, ...(Object.keys(keyNames).length ? { keyNames } : {}) } as L;
  });
}

/** One link bound to the world, with the ids it brings: by its original's id, else by the one original of its
 *  kind carrying its stored name. Each override key follows the same rule inside what the original brings.
 *  Null when no original matches. */
export function bindLink<L extends PortableLink>(link: L, lists: LinkLists<L>): { link: L; ids: string[] } | null {
  const candidates = lists.originals(link.kind);
  const original = candidates.find((item) => item.id === link.originalId) ?? uniqueNamed(candidates, link.originalName);
  if (!original) return null;
  const { ids, leaves } = lists.brought(original, link.kind);
  const key = (id: string): string | null => {
    if (id === link.originalId) return original.id;
    if (leaves.some((leaf) => leaf.id === id)) return id;
    return uniqueNamed(leaves, link.keyNames?.[id])?.id ?? null;
  };
  const overrides = rekeyed(link.overrides, key);
  const { keyNames: _k, overrides: _o, ...rest } = link;
  const bound = { ...rest, originalId: original.id, ...(overrides ? { overrides } : {}) } as L;
  return { ids, link: lists.finish ? lists.finish(bound) : bound };
}

/**
 * The links bound to the world as {@link bindLink} binds one, in their stored order. A link that brings
 * anything a link before it in `treeOrder` already brings is dropped, as play keeps the first in tree order.
 */
export function bindLinks<L extends PortableLink>(links: readonly L[], treeOrder: readonly L[], lists: LinkLists<L>): L[] {
  const held = new Set<string>();
  const kept = new Map<string, L>();
  for (const link of treeOrder) {
    const bound = bindLink(link, lists);
    if (!bound || bound.ids.some((id) => held.has(id))) continue;
    bound.ids.forEach((id) => held.add(id));
    kept.set(link.id, bound.link);
  }
  return links.flatMap((l) => kept.get(l.id) ?? []);
}

/** The links as a world reads a library entity's: each that binds takes the world's ids, and one that does not
 *  stays as stored. */
export const linksBound = <L extends PortableLink>(links: readonly L[], lists: LinkLists<L>): L[] =>
  links.map((link) => bindLink(link, lists)?.link ?? link);

/** A link as two copies compare it: its original and override keys by name, since the ids are each world's own. */
export type ComparableLink<L extends PortableLink> = Pick<L, 'id' | 'kind' | 'originalName' | 'groupId' | 'order' | 'overrides'>;

export function comparableLink<L extends PortableLink>(link: L): ComparableLink<L> {
  const key = (id: string) => (id === link.originalId ? '' : link.keyNames?.[id] ?? id);
  return {
    id: link.id, kind: link.kind, originalName: link.originalName, groupId: link.groupId ?? null, order: link.order,
    overrides: rekeyed(link.overrides, key),
  } as ComparableLink<L>;
}
