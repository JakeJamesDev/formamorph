/** The Media List as Media tab cards: one per entry, with every place that links it. */
import type { ImageCap } from './imageSlots';
import { dataUrlBytes, isRemoteImage } from './imageBytes';
import { ENTRY_ITEM_PREFIX, isPartOnly, largerCap, storedBytes, UNUSED_IMAGE_CAP, type MediaItem, type MediaParent, type MediaSection, type MediaWorld } from './mediaIndex';
import { isFileEntry } from './mediaList';
import { mediaParentSpec } from './mediaParents';
import { mediaUsage, mediaUseLabel, variantUsage, variantUseLabel, type MediaUse } from './mediaUsage';

/** What an entry card names as its holder: the list itself, so the card goes by the entry's name. */
export const MEDIA_LIST_PARENT: MediaParent = { kind: 'world', id: 'mediaList', name: 'Media List' };

/** The largest budget among the uses, by long edge; an entry nothing links takes `UNUSED_IMAGE_CAP`. */
function entryBudget(uses: readonly MediaUse[]): ImageCap {
  return uses.reduce<ImageCap | undefined>((held, use) => largerCap(held, mediaParentSpec(use.owner.kind).cap), undefined) ?? UNUSED_IMAGE_CAP;
}

/** One card per Media List entry, in list order. */
export function mediaEntryItems(w: MediaWorld): MediaItem[] {
  const list = w.worldOverview.mediaList;
  if (!list) return [];
  const usage = mediaUsage(w);
  const variants = variantUsage(list);
  return Object.values(list).flatMap((entry): MediaItem[] => {
    const uses = usage.get(entry.id) ?? [];
    const layerUses = variants.get(entry.id) ?? [];
    const used = uses.length || layerUses.length ? {} : { unused: true as const };
    const variantUses = layerUses.length ? { variantUses: layerUses } : {};
    if (!isFileEntry(entry)) {
      const key = `${ENTRY_ITEM_PREFIX}${entry.id}` as const;
      return [{ id: key, key, kind: 'layered', parent: MEDIA_LIST_PARENT, slot: entry.name, value: '', bytes: 0, linked: false, overBudget: false, mediaId: entry.id, uses, ...used }];
    }
    if (!entry.data) return [];
    const linked = isRemoteImage(entry.data);
    // A Variant takes the budget of the slots that link its Layered Image.
    const budget = entry.kind === 'image' ? entryBudget([...uses, ...layerUses.flatMap((use) => usage.get(use.entryId) ?? [])]) : undefined;
    const rules = uses.flatMap((use) => use.requires ?? []);
    return [{
      id: `${ENTRY_ITEM_PREFIX}${entry.id}`,
      key: `${ENTRY_ITEM_PREFIX}${entry.id}`,
      kind: entry.kind,
      parent: MEDIA_LIST_PARENT,
      slot: entry.name,
      value: entry.data,
      bytes: storedBytes(entry.data),
      linked,
      overBudget: !!budget && !linked && dataUrlBytes(entry.data) > budget.maxBytes,
      mediaId: entry.id,
      uses,
      ...variantUses,
      ...(budget ? { budget } : {}),
      ...(rules.length ? { rules } : {}),
      ...used,
    }];
  });
}

/**
 * The sections' items that match a search. A hit on a part-only image keeps each Layered Image that holds it,
 * as its slot cards or its entry card, never the part's own card.
 */
export function searchSections(sections: MediaSection[], entries: readonly MediaItem[], matches: (text: string) => boolean): MediaSection[] {
  const holders = new Set(entries.filter((e) => isPartOnly(e) && matches(e.slot)).flatMap((e) => e.variantUses!.map((u) => u.entryId)));
  const keep = (i: MediaItem) => matches(mediaSearchText(i)) || (i.kind === 'layered' && !!i.mediaId && holders.has(i.mediaId));
  return sections.map((s) => ({ ...s, items: s.items.filter(keep) })).filter((s) => s.items.length);
}

/** What a search matches on a card: an entry's name and its uses, or a use's holder and slot. */
export function mediaSearchText(item: MediaItem): string {
  if (!item.uses) return `${item.parent.name} ${item.slot}`;
  return [item.slot, ...item.uses.map((use) => mediaUseLabel(use)), ...(item.variantUses ?? []).map(variantUseLabel)].join(' ');
}
