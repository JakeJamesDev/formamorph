import { useMemo, useState } from 'react';
import { ListEditor } from '@/components/ListEditor';
import { Hint } from '@/components/ui/typography';
import { BlueprintFooter } from '@/components/editor/BlueprintReset';
import PlaceholderText from '@/components/prompt/PlaceholderText';
import { useGameData } from '@/contexts/GameDataContext';
import { newStat } from '@/lib/blankWorld';
import {
  addOwnedStat, addOwnedStatGroup, duplicateOwnedStatNode, removeOwnedStat, updateOwnedStat, updateOwnedStatGroup,
} from '@/lib/ownedStats';
import { labelPlaceholders } from '@/lib/placementLetters';
import {
  addStatLink, copyStatBlueprint, editStatLink, linkedStat, linksStat, placeOf, removeEntityStatGroup, removeStatLink,
  resetStatLinkFieldOn, resetStatLinkOn, resolvedEntityStats, statBlueprint, statLinkState, withEntityStatTree,
} from '@/lib/statLinks';
import { statsInTreeOrder } from '@/lib/statGroupTree';
import { randomUUID } from '@/lib/uuid';
import type { Entity, Stat, StatGroup, StatLink } from '@/types';
import type { StatPanelTab } from '@/views/statPanelTabs';
import StatManager, { type StatEditorStore } from './StatManager';
import { LinkNotice } from './TraitLinkPanel';
import { EntityStatsAddMenu } from './StatsAddMenu';
import { statListAdapter } from './statListAdapter';

const NO_STATS: Stat[] = [];
const NO_GROUPS: StatGroup[] = [];

/** The world groups from the top down to the stat, the stat last. */
function statPath(groups: readonly StatGroup[], stat: Stat): string[] {
  const byId = new Map(groups.map((g) => [g.id, g]));
  const path = [stat.name];
  for (let g = stat.groupId ? byId.get(stat.groupId) : undefined; g; g = g.parentId ? byId.get(g.parentId) : undefined) path.unshift(g.name);
  return path;
}

/** A link's tree row: its original as the link reads it under the link's id, or its stored name when the world's
 *  Blueprints lack the original. */
const linkRow = (link: StatLink, original: Stat | undefined): Stat => (original
  ? { ...linkedStat(original, link), id: link.id }
  : { ...newStat(link.id, link.originalName), descriptors: [], ...placeOf(link) });

/**
 * The entity panel's Stats tab: the Stats tab's tree, toolbar and stat panel over one world entity, stacked so
 * a selected stat's details slide in over the list. Its links sit among its own stats, each opening the stat
 * as the link reads it. Every write lands on the entity through the world's entity edit. The World Editor holds
 * the selection, as it holds the panel's tab, since the panel remounts per entity; the list clears one the
 * entity doesn't hold.
 */
const EntityStatsMirror = ({ entity, selectedId, onSelect }: {
  entity: Entity;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}) => {
  const { stats: worldStats, statGroups: worldGroups, placeholders, placementLetters, placeholderOwners, editEntity } = useGameData();
  const [tab, setTab] = useState<StatPanelTab>('details');
  const world = useMemo(() => ({ stats: worldStats, statGroups: worldGroups }), [worldStats, worldGroups]);
  const own = entity.stats ?? NO_STATS;
  const groups = entity.statGroups ?? NO_GROUPS;
  const links = useMemo(() => entity.statLinks ?? [], [entity.statLinks]);
  const linkById = useMemo(() => new Map(links.map((l) => [l.id, l])), [links]);
  // A link reads its original only while the original sits in Blueprints, as play does.
  const originalOf = (link: StatLink) => statBlueprint(world, link.originalId);
  // The tree's rows: own stats and links together, in tree order.
  const rows = useMemo(
    () => statsInTreeOrder(groups, [...own, ...links.map((l) => linkRow(l, statBlueprint(world, l.originalId)))]),
    [groups, own, links, world],
  );
  const linkIds = useMemo(() => new Set(linkById.keys()), [linkById]);
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

  const linkDetail = (id: string) => {
    const link = linkById.get(id)!;
    const original = originalOf(link);
    const name = <strong><PlaceholderText text={original ? statPath(worldGroups, original).join(' › ') : link.originalName} placeholders={placeholders} /></strong>;
    if (!original) return <LinkNotice>Linked to {name}. This world doesn&apos;t have it.</LinkNotice>;
    const { overridden, stale } = statLinkState(original, link);
    return (
      <StatManager
        key={id}
        stat={linkRow(link, original)}
        tab={tab}
        onTabChange={setTab}
        store={{ stats: resolved, updateStat: (next) => edit((e) => editStatLink(world, e, id, next)), morphOwner }}
        link={{
          overridden,
          stale,
          reset: (field) => edit((e) => resetStatLinkFieldOn(e, id, original.id, field)),
          header: <LinkNotice>Linked from {name}</LinkNotice>,
        }}
      />
    );
  };

  const adapter = statListAdapter({
    stats: rows,
    groups,
    names: { placeholders, letters: placementLetters, owners: placeholderOwners },
    selectedId,
    onSelect,
    onDuplicate: (id) => {
      const { entity: next, newId } = duplicateOwnedStatNode(entity, id);
      if (newId === id) return;
      edit(() => next);
      onSelect(newId);
    },
    onRemoveStat: (id) => edit((e) => (linkById.has(id) ? removeStatLink(e, id) : removeOwnedStat(e, id))),
    onRemoveGroup: (id) => edit((e) => removeEntityStatGroup(e, id)),
    onDrop: (next) => edit((e) => withEntityStatTree(e, next.stats, next.groups, (leaf) => leaf)),
    onWriteGroup: (group) => edit((e) => updateOwnedStatGroup(e, group)),
    add: {
      label: `Add to ${labelPlaceholders(entity.name, placeholders)}`,
      menu: (
        <EntityStatsAddMenu
          world={world}
          linked={(originalId) => linksStat(entity, originalId)}
          onAddGroup={(typed) => add((e, id) => addOwnedStatGroup(e, id, typed || undefined))}
          onAddStat={(typed) => add((e, id) => addOwnedStat(e, id, typed || undefined))}
          onLink={(originalId) => add((e, id) => addStatLink(world, e, originalId, id))}
          onCopy={(originalId) => add((e, id) => copyStatBlueprint(world, e, originalId, id))}
        />
      ),
    },
    placeholder: 'Filter Stats',
    emptyHint: <Hint className="p-2">Add a stat to track something about this entity</Hint>,
    tab,
    onTabChange: setTab,
    store,
    padded: true,
    links: {
      ids: linkIds,
      detail: linkDetail,
      footer: (id) => {
        const link = linkById.get(id)!;
        return originalOf(link)
          ? <BlueprintFooter canReset={!!link.overrides} onReset={() => edit((e) => resetStatLinkOn(e, id))} />
          : null;
      },
    },
  });

  return <ListEditor adapter={adapter} layout="stacked" selectedId={selectedId} onSelect={onSelect} backLabel="Stats" />;
};

export default EntityStatsMirror;
