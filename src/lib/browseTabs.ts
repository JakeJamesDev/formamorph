/**
 * The tabs the Community Creations browser switches between: one per catalog kind, plus Contest.
 *
 * Contest is deliberately not a `CatalogKind`. A kind is what a listing *is*, and the server's kinds are
 * the whole of that list; a contest is a narrowing of the worlds already in the catalog. Widening the
 * kind enum instead would put a value the server has never heard of into every request, every stored
 * filter record and every kind label.
 */
import { CATALOG_KINDS, KIND_LABELS, type CatalogKind } from './catalogKinds';

export const BROWSE_TABS = [...CATALOG_KINDS, 'contest'] as const;

export type BrowseTab = (typeof BROWSE_TABS)[number];

/** Which kind of listing a tab shows. Contest entries are worlds; the rest name themselves. */
export function catalogKindOfTab(tab: BrowseTab): CatalogKind {
  return tab === 'contest' ? 'world' : tab;
}

/**
 * Player-facing name for what a tab holds, singular and plural.
 *
 * Contest entries are worlds, and are called that when one of them is the subject — it is the browsing
 * of them that is a contest, not the thing itself.
 */
export const BROWSE_TAB_LABELS: Record<BrowseTab, { one: string; many: string }> = {
  ...KIND_LABELS,
  contest: { one: 'World', many: 'Entries' },
};

/** Narrows an arbitrary string — a dev-router tab, a stored value — to a tab this browser has. */
export function asBrowseTab(value: string | undefined): BrowseTab | undefined {
  return (BROWSE_TABS as readonly string[]).includes(value ?? '') ? (value as BrowseTab) : undefined;
}
