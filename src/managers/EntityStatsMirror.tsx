import { useMemo, useState } from 'react';
import { ListEditor } from '@/components/ListEditor';
import { Hint } from '@/components/ui/typography';
import { BlueprintFooter } from '@/components/editor/BlueprintReset';
import PlaceholderText from '@/components/prompt/PlaceholderText';
import { useGameData } from '@/contexts/GameDataContext';
import {
  addOwnedStat, addOwnedStatGroup, duplicateOwnedStatNode, removeOwnedStat, updateOwnedStat, updateOwnedStatGroup,
} from '@/lib/ownedStats';
import { labelPlaceholders } from '@/lib/placementLetters';
import {
  addStatLink, applyEntityStatRows, detachStatLink, editStatLink, entityStatRows, holdsStatOriginal, removeEntityStatGroup,
  removeStatLink, resetStatLinkFieldOn, resetStatLinkOn, resetStatLinkStatOn, resolvedEntityStats, statLinkState,
} from '@/lib/statLinks';
import { randomUUID } from '@/lib/uuid';
import type { Entity, StatGroup } from '@/types';
import type { StatPanelTab } from '@/views/statPanelTabs';
import StatManager, { type StatEditorStore } from './StatManager';
import { LinkNotice } from './TraitLinkPanel';
import { EntityStatsAddMenu } from './StatsAddMenu';
import { statListAdapter } from './statListAdapter';

/** The world groups from the top down to the stat or group, the item last. */
function originalPath(groups: readonly StatGroup[], item: { name: string; parentId?: string | null; groupId?: string | null }): string[] {
  const byId = new Map(groups.map((g) => [g.id, g]));
  const path = [item.name];
  const start = item.groupId ?? item.parentId;
  for (let g = start ? byId.get(start) : undefined; g; g = g.parentId ? byId.get(g.parentId) : undefined) path.unshift(g.name);
  return path;
}

/**
 * The entity panel's Stats tab: the Stats tab's tree, toolbar and stat panel over one world entity, stacked so
 * a selected stat's details slide in over the list. Its links sit among its own stats: a stat link opens the stat
 * as the link reads it, and a group link brings the Blueprint group's live subtree, each stat in it opening the
 * same way. Every write lands on the entity through the world's entity edit. The World Editor holds the
 * selection, as it holds the panel's tab, since the panel remounts per entity; the list clears one the entity
 * doesn't hold.
 */
const EntityStatsMirror = ({ entity, selectedId, onSelect }: {
  entity: Entity;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}) => {
  const { stats: worldStats, statGroups: worldGroups, placeholders, placementLetters, placeholderOwners, editEntity } = useGameData();
  const [tab, setTab] = useState<StatPanelTab>('details');
  const world = useMemo(() => ({ stats: worldStats, statGroups: worldGroups }), [worldStats, worldGroups]);
  const rows = useMemo(() => entityStatRows(world, entity), [world, entity]);
  // The stats this entity holds in play, which a stat's code and sliders read beside it.
  const resolved = useMemo(() => resolvedEntityStats(world, entity), [world, entity]);

  const edit = (change: (e: Entity) => Entity) => editEntity(entity.id, change);
  const morphOwner = { name: labelPlaceholders(entity.name, placeholders), model: entity.model };
  const store: StatEditorStore = { stats: resolved, updateStat: (stat) => edit((e) => updateOwnedStat(e, stat)), morphOwner };
  /** Add an item under a fresh id and select it. An add the entity refuses selects nothing. */
  const add = (change: (e: Entity, id: string) => Entity | null) => {
    const id = randomUUID();
    if (!change(entity, id)) return;
    edit((e) => change(e, id) ?? e);
    onSelect(id);
  };
  const detach = (linkId: string) => {
    const res = detachStatLink(world, entity, linkId);
    if (!res) return;
    edit(() => res.entity);
    onSelect(res.newId);
  };

  const pathOf = (originalId: string) => {
    const item = worldStats.find((s) => s.id === originalId) ?? worldGroups.find((g) => g.id === originalId);
    return item ? originalPath(worldGroups, item).join(' › ') : '';
  };
  const linkDetail = (id: string) => {
    const row = rows.linked.get(id)!;
    const { link, originalId } = row;
    const linkName = <strong><PlaceholderText text={row.unbound ? link.originalName : pathOf(link.originalId)} placeholders={placeholders} /></strong>;
    if (row.unbound) return <LinkNotice>Linked to {linkName}. This world doesn&apos;t have it.</LinkNotice>;
    const header = row.root
      ? <LinkNotice>Linked from {linkName}</LinkNotice>
      : <LinkNotice>Part of the linked {linkName}</LinkNotice>;
    const original = row.kind === 'stat' ? worldStats.find((s) => s.id === originalId) : undefined;
    if (!original) return header;
    const { overridden, stale } = statLinkState(original, link);
    return (
      <StatManager
        key={id}
        stat={rows.stats.find((s) => s.id === id)!}
        tab={tab}
        onTabChange={setTab}
        store={{ stats: resolved, updateStat: (next) => edit((e) => editStatLink(world, e, link.id, originalId, next)), morphOwner }}
        link={{
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

  const adapter = statListAdapter({
    stats: rows.stats,
    groups: rows.groups,
    names: { placeholders, letters: placementLetters, owners: placeholderOwners },
    selectedId,
    onSelect,
    onDuplicate: (id) => {
      const { entity: next, newId } = duplicateOwnedStatNode(entity, id);
      if (newId === id) return;
      edit(() => next);
      onSelect(newId);
    },
    onRemoveStat: (id) => edit((e) => (rows.linked.get(id)?.root ? removeStatLink(e, id) : removeOwnedStat(e, id))),
    onRemoveGroup: (id) => edit((e) => (rows.linked.get(id)?.root ? removeStatLink(e, id) : removeEntityStatGroup(e, id))),
    onDrop: (next) => edit((e) => applyEntityStatRows(e, rows, next) ?? e),
    onWriteGroup: (group) => edit((e) => updateOwnedStatGroup(e, group)),
    add: {
      label: `Add to ${labelPlaceholders(entity.name, placeholders)}`,
      menu: (
        <EntityStatsAddMenu
          world={world}
          held={(originalId) => holdsStatOriginal(world, entity, originalId)}
          onAddGroup={(typed) => add((e, id) => addOwnedStatGroup(e, id, typed || undefined))}
          onAddStat={(typed) => add((e, id) => addOwnedStat(e, id, typed || undefined))}
          onLink={(originalId) => add((e, id) => addStatLink(world, e, originalId, id))}
        />
      ),
    },
    placeholder: 'Filter Stats',
    emptyHint: <Hint className="p-2">Add a stat to track something about this entity</Hint>,
    tab,
    onTabChange: setTab,
    store,
    padded: true,
    links: { rows: rows.linked, detail: linkDetail, footer: linkFooter, onDetach: detach },
  });

  return <ListEditor adapter={adapter} layout="stacked" selectedId={selectedId} onSelect={onSelect} backLabel="Stats" />;
};

export default EntityStatsMirror;
