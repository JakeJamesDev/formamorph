import type { ReactNode } from 'react';
import { BlueprintFooter } from '@/components/editor/BlueprintReset';
import PlaceholderText from '@/components/prompt/PlaceholderText';
import { updateOwnedStat } from '@/lib/ownedStats';
import { labelPlaceholders } from '@/lib/placementLetters';
import {
  detachStatLink, editStatLink, resetStatLinkFieldOn, resetStatLinkOn, resetStatLinkStatOn, statLinkState,
  type EntityStatRows, type StatLinkWorld,
} from '@/lib/statLinks';
import { ancestors, parentLookup } from '@/lib/ancestors';
import { offWorldOf } from '@/lib/scriptBoxHome';
import type { Entity, Placeholder, Stat, StatGroup } from '@/types';
import type { StatPanelTab } from '@/views/statPanelTabs';
import StatManager, { type StatEditorStore } from './StatManager';
import { LinkNotice } from './TraitLinkPanel';

/** The world groups from the top down to the stat or group, the item last. */
function originalPath(groups: readonly StatGroup[], item: { name: string; parentId?: string | null; groupId?: string | null }): string[] {
  const byId = new Map(groups.map((g) => [g.id, g]));
  const start = item.groupId ?? item.parentId;
  const above = start ? [start, ...ancestors(start, parentLookup(groups, (g) => g.parentId))] : [];
  return [...above.reverse().flatMap((id) => byId.get(id)?.name ?? []), item.name];
}

/** What one entity's stat panels read and write. */
export interface EntityStatPanelsInput {
  entity: Entity;
  /** The stats and groups the entity's links read their Blueprints from. */
  world: StatLinkWorld;
  edit: (change: (e: Entity) => Entity) => void;
  /** The entity's Stats tab rows, ids as `entityStatRows` gives them. */
  rows: EntityStatRows;
  /** The stats the entity holds in play, which a stat's code and sliders read beside it. */
  resolved: Stat[];
  placeholders: Placeholder[];
  /** No world holds the entity, so an unbound link has nowhere to look its Blueprint up. */
  standalone?: boolean;
  tab: StatPanelTab;
  onTabChange: (tab: StatPanelTab) => void;
}

/** One entity's stat panels: the store its own stats edit through, a link row's panel and footer, and Detach.
 *  Ids are the entity's own row ids. */
export function entityStatPanels({ entity, world, edit, rows, resolved, placeholders, standalone = false, tab, onTabChange }: EntityStatPanelsInput): {
  store: StatEditorStore;
  linkDetail: (id: string, key?: string) => ReactNode;
  linkFooter: (id: string) => ReactNode;
  /** The id the detached item takes, or null when the link or its original is gone. */
  detach: (linkId: string) => string | null;
} {
  const morphOwner = { name: labelPlaceholders(entity.name, placeholders), model: entity.model };
  const offWorld = offWorldOf(entity, world);
  const store: StatEditorStore = {
    stats: resolved, updateStat: (stat) => edit((e) => updateOwnedStat(e, stat)), ownerId: entity.id, morphOwner, offWorld,
  };
  const pathOf = (originalId: string) => {
    const item = world.stats.find((s) => s.id === originalId) ?? world.statGroups.find((g) => g.id === originalId);
    return item ? originalPath(world.statGroups, item).join(' › ') : '';
  };

  const linkDetail = (id: string, key = id) => {
    const row = rows.linked.get(id)!;
    const { link, originalId } = row;
    const linkName = <strong><PlaceholderText text={row.unbound ? link.originalName : pathOf(link.originalId)} placeholders={placeholders} /></strong>;
    if (row.unbound) {
      return (
        <LinkNotice>
          Linked to {linkName}. {standalone ? 'Open this entity from a world to edit the link.' : "This world doesn't have it."}
        </LinkNotice>
      );
    }
    const header = row.root
      ? <LinkNotice>Linked from {linkName}</LinkNotice>
      : <LinkNotice>Part of the linked {linkName}</LinkNotice>;
    const original = row.kind === 'stat' ? world.stats.find((s) => s.id === originalId) : undefined;
    if (!original) return header;
    const { overridden, stale } = statLinkState(original, link);
    return (
      <StatManager
        key={key}
        stat={rows.stats.find((s) => s.id === id)!}
        tab={tab}
        onTabChange={onTabChange}
        store={{ ...store, updateStat: (next) => edit((e) => editStatLink(world, e, link.id, originalId, next)) }}
        link={{
          linkId: link.id,
          originalId,
          overridden,
          stale,
          reset: (field) => edit((e) => resetStatLinkFieldOn(e, link.id, originalId, field)),
          header,
        }}
      />
    );
  };
  // Reset to Blueprint clears one linked stat, or on a group link's row, the whole link.
  const linkFooter = (id: string) => {
    const { link, originalId, kind, root, unbound } = rows.linked.get(id)!;
    if (unbound) return null;
    if (kind === 'stat') {
      return <BlueprintFooter canReset={!!link.overrides?.[originalId]} onReset={() => edit((e) => resetStatLinkStatOn(e, link.id, originalId))} />;
    }
    return root ? <BlueprintFooter canReset={!!link.overrides} onReset={() => edit((e) => resetStatLinkOn(e, link.id))} /> : null;
  };
  const detach = (linkId: string) => {
    const res = detachStatLink(world, entity, linkId);
    if (!res) return null;
    edit(() => res.entity);
    return res.newId;
  };
  return { store, linkDetail, linkFooter, detach };
}
