import { useMemo, useState, type ReactNode } from 'react';
import { ListEditor, type ListEditorLayout } from '@/components/ListEditor';
import type { PlaceholderOwners } from '@/lib/placeholderHomes';
import {
  addOwnedStat, addOwnedStatGroup, duplicateOwnedStatNode, removeOwnedStat, updateOwnedStatGroup,
} from '@/lib/ownedStats';
import { labelPlaceholders, type PlacementLetters } from '@/lib/placementLetters';
import {
  addStatLink, applyEntityStatRows, entityStatRows, NO_STAT_WORLD, removeEntityStatGroup, removeStatLink,
  resolvedEntityStats, statHeldReason, type StatLinkWorld,
} from '@/lib/statLinks';
import { heldReasonText } from '@/lib/heldReasons';
import { randomUUID } from '@/lib/uuid';
import type { Entity, Placeholder } from '@/types';
import type { StatPanelTab } from '@/views/statPanelTabs';
import { entityStatPanels } from './entityStatPanels';
import { EntityStatsAddMenu } from './StatsAddMenu';
import { statListAdapter } from './statListAdapter';

/**
 * One entity's stats on the List Editor: the Stats tab's tree, toolbar and stat panel over the entity's own
 * stats. Its links sit among its own stats: a stat link opens the stat as the link reads it, and a group link
 * brings the Blueprint group's live subtree, each stat in it opening the same way. Every write lands through
 * `edit`. The caller holds the selection and the layout; the list clears a selection the entity doesn't hold.
 */
const EntityStatsEditor = ({
  entity, world, edit, names, layout, selectedId, onSelect, canLink, standalone = false, placeholder, emptyHint, detailHeader,
}: {
  entity: Entity;
  /** The stats and groups the entity's links read their Blueprints from. */
  world: StatLinkWorld;
  edit: (change: (e: Entity) => Entity) => void;
  /** How the host's chips read as text. */
  names: { placeholders: Placeholder[]; letters: PlacementLetters; owners?: PlaceholderOwners };
  layout: ListEditorLayout;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  /** Whether the + menu offers **Link Stat**. */
  canLink: boolean;
  /** No world holds the entity, so an unbound link has nowhere to look its Blueprint up. */
  standalone?: boolean;
  placeholder: string;
  emptyHint: ReactNode;
  /** Tops the detail pane: a host's placeholder palette. */
  detailHeader?: ReactNode;
}) => {
  const { placeholders, letters, owners } = names;
  const [tab, setTab] = useState<StatPanelTab>('details');
  const rows = useMemo(() => entityStatRows(world, entity), [world, entity]);
  const resolved = useMemo(() => resolvedEntityStats(world, entity), [world, entity]);
  const { store, linkDetail, linkFooter, detach } = entityStatPanels({
    entity, world, edit, rows, resolved, placeholders, standalone, tab, onTabChange: setTab,
  });

  /** Add an item under a fresh id and select it. An add the entity refuses selects nothing. */
  const add = (change: (e: Entity, id: string) => Entity | null) => {
    const id = randomUUID();
    if (!change(entity, id)) return;
    edit((e) => change(e, id) ?? e);
    onSelect(id);
  };

  const adapter = statListAdapter({
    stats: rows.stats,
    groups: rows.groups,
    names: { placeholders, letters, owners },
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
    tree: { onDrop: (next) => edit((e) => applyEntityStatRows(e, rows, next) ?? e) },
    onWriteGroup: (group) => edit((e) => updateOwnedStatGroup(e, group)),
    add: {
      label: `Add to ${labelPlaceholders(entity.name, placeholders)}`,
      menu: (
        <EntityStatsAddMenu
          world={canLink ? world : NO_STAT_WORLD}
          refusal={(originalId) => {
            const held = statHeldReason(world, entity, originalId);
            return held && heldReasonText(held, entity.name);
          }}
          onAddGroup={(typed) => add((e, id) => addOwnedStatGroup(e, id, typed || undefined))}
          onAddStat={(typed) => add((e, id) => addOwnedStat(e, id, typed || undefined))}
          onLink={(originalId) => add((e, id) => addStatLink(world, e, originalId, id))}
        />
      ),
    },
    placeholder,
    emptyHint,
    tab,
    onTabChange: setTab,
    store,
    padded: true,
    links: {
      rows: rows.linked,
      detail: linkDetail,
      footer: linkFooter,
      onDetach: (linkId) => {
        const newId = detach(linkId);
        if (newId) onSelect(newId);
      },
    },
  });

  return <ListEditor adapter={adapter} layout={layout} selectedId={selectedId} onSelect={onSelect} backLabel="Stats" detailHeader={detailHeader} />;
};

export default EntityStatsEditor;
