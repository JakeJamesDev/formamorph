import { useMemo, useState, type ReactNode } from 'react';
import { DropRefusalNotice } from '@/components/editor/DropRefusalNotice';
import { joinedList } from '@/components/editor/joinedList';
import { TREE_INDENT } from '@/components/EditorRow';
import PlaceholderText from '@/components/prompt/PlaceholderText';
import { useGameData } from '@/contexts/GameDataContext';
import { EntityIcon } from '@/lib/elementIcons';
import { useEditorMode } from '@/lib/editorMode';
import { heldReasonText } from '@/lib/heldReasons';
import { duplicateOwnedStatNode, removeOwnedStat } from '@/lib/ownedStats';
import {
  applyOwnedStatDrop, getOwnedStatDropProjection, ownedStatRowId, ownedStatRows, type FlatStatRow, type OwnedStatTree,
  type StatDropRefusal,
} from '@/lib/ownedStatTree';
import { detachStatLink, removeEntityStatGroup, removeStatLink } from '@/lib/statLinks';
import type { Placeholder } from '@/types';
import { SortableTree, type SortableTreeAdapter } from './SortableTree';
import { statRowSpec, type StatRowActions } from './statRowSpec';
import { chipInput } from './chipInput';

/** The line after a refused drop: why the dragged stat stays with its owner. The dragged item stays put. */
export function StatDropRefusalNotice({ refusal, placeholders, onDismiss }: {
  refusal: StatDropRefusal;
  placeholders: Placeholder[];
  onDismiss: () => void;
}) {
  const text = (t: string) => <PlaceholderText text={t} placeholders={placeholders} />;
  const bold = (t: string) => <strong>{text(t)}</strong>;
  const line = (): ReactNode => {
    if (refusal.reason === 'held') return <>{text(heldReasonText(refusal.held, refusal.owner))}.</>;
    const name = bold(refusal.name);
    switch (refusal.reason) {
      case 'duplicate':
        return refusal.owner === null ? <>The world already has {name}.</> : <>{text(refusal.owner)} already has {name}.</>;
      case 'blueprint-linked':
        return (
          <>
            {name} stays in Blueprints, because {joinedList(refusal.owners.map(bold))}{' '}
            {refusal.owners.length === 1 ? 'links' : 'link'} to it or to something in it. Remove those links first.
          </>
        );
      case 'root':
        return <>{name} stays at the top level, because the Custom Persona can&apos;t go in a group.</>;
      case 'read':
      case 'into-blueprints': {
        const stays = refusal.reason === 'into-blueprints' ? <>{name} stays out of Blueprints</>
          : refusal.owner === null ? <>{name} stays a world stat</> : <>{name} stays {text(refusal.owner)}&apos;s stat</>;
        const { reader } = refusal;
        if (reader.kind === 'readByWorld') return <>{stays}, because a world script reads it.</>;
        const other = bold('trait' in reader ? reader.trait : reader.stat);
        switch (reader.kind) {
          case 'change': return <>{stays}, because {other} changes it. Remove that stat change first.</>;
          case 'toggle': return <>{stays}, because {other} switches it on or off. Remove that stat toggle first.</>;
          case 'readBy': return <>{stays}, because the code of {other} reads it.</>;
          case 'readByTrait': return <>{stays}, because a script of {other} reads it.</>;
          case 'reads': return <>{stays}, because its code reads {other}.</>;
        }
      }
    }
  };
  return <DropRefusalNotice onDismiss={onDismiss}>{line()}</DropRefusalNotice>;
}

/**
 * The Stats tab's folder tree: the world's stats, and a node for each entity that owns a stat, a stat group or a
 * stat Link, holding them. A node drags like a group among the world's items; a stat or group drags across
 * owners with its ids kept, and a Blueprint dropped on an entity links it (Advanced). `world` acts on the world's
 * rows; an entity's rows act on that entity.
 */
const WorldStatTree = ({ tree, selectedId, onSelect, world, emptyHint }: {
  tree: OwnedStatTree;
  selectedId: string | null;
  onSelect: (id: string) => void;
  world: StatRowActions;
  emptyHint: ReactNode;
}) => {
  const {
    stats, statGroups, traits, traitGroups, entities, placeholders, worldScripts, setStats, setStatGroups, editEntity,
  } = useGameData();
  const { advanced } = useEditorMode();
  const [refusal, setRefusal] = useState<StatDropRefusal | null>(null);
  const dropWorld = useMemo(
    () => ({ stats, statGroups, traits, traitGroups, entities, placeholders, scripts: worldScripts }),
    [stats, statGroups, traits, traitGroups, entities, placeholders, worldScripts],
  );

  /** An entity row's buttons, writing to its entity. A link's row passes the link's id. */
  const entityActions = (entityId: string): StatRowActions => {
    const owner = entities.find((e) => e.id === entityId);
    const realId = (id: string) => tree.owned.get(id)?.id ?? id;
    const isLink = (id: string) => !!owner?.statLinks?.some((l) => l.id === id);
    return {
      onRemoveStat: (id) => editEntity(entityId, (e) => (isLink(id) ? removeStatLink(e, id) : removeOwnedStat(e, realId(id)))),
      onRemoveGroup: (id) => editEntity(entityId, (e) => (isLink(id) ? removeStatLink(e, id) : removeEntityStatGroup(e, realId(id)))),
      onDuplicate: (id) => {
        if (!owner) return;
        const res = duplicateOwnedStatNode(owner, realId(id));
        if (res.newId === realId(id)) return;
        editEntity(entityId, () => res.entity);
        onSelect(ownedStatRowId(entityId, res.newId));
      },
      onDetach: (linkId) => {
        const res = owner && detachStatLink({ stats, statGroups }, owner, linkId);
        if (!res) return;
        editEntity(entityId, () => res.entity);
        onSelect(ownedStatRowId(entityId, res.newId));
      },
    };
  };

  const adapter: SortableTreeAdapter<FlatStatRow> = {
    visibleDeps: [tree],
    rowDeps: [],
    rowInputs: (node) => {
      const owned = tree.owned.get(node.id);
      const entity = tree.entityNodes.get(node.id);
      return [owned, entity, node.leaf?.enabled, chipInput(placeholders, node.group?.name, node.leaf?.name, entity?.name, owned?.linked?.link.originalName)];
    },
    placeholders,
    getVisible: (collapsed) => ownedStatRows(tree, collapsed),
    projectDepth: (visible, activeId, overId, offsetLeft) =>
      getOwnedStatDropProjection(tree, visible, activeId, overId, offsetLeft, TREE_INDENT)?.depth ?? null,
    onDrop: (activeId, overId, offsetLeft, collapsed) => {
      // Linking is Advanced only; existing items still drag in Simple.
      const next = applyOwnedStatDrop(
        dropWorld, collapsed, activeId, overId, offsetLeft, TREE_INDENT, { createLinks: advanced, emptySystemNodes: advanced },
      );
      if (!next) return;
      if (next.kind === 'refused') {
        setRefusal(next.refusal);
        return;
      }
      setRefusal(null);
      if (next.world) {
        setStatGroups(next.world.groups);
        setStats(next.world.stats);
      }
      for (const entity of next.entities) editEntity(entity.id, () => entity);
      const after = next.rowIds.get(activeId);
      if (selectedId === activeId && after && after !== activeId) onSelect(after);
    },
    rowSpec: (node, select) => {
      const entity = tree.entityNodes.get(node.id);
      if (entity) {
        return {
          lead: 'chevron',
          collapseLabels: ['Expand entity', 'Collapse entity'],
          icon: <EntityIcon className="h-4 w-4 shrink-0" aria-hidden />,
          label: <PlaceholderText text={entity.name} placeholders={placeholders} />,
          labelClass: 'font-medium',
          meta: entity.customPersona ? 'Custom Persona' : entity.persona ? 'Playable' : 'Entity',
        };
      }
      const owned = tree.owned.get(node.id);
      return statRowSpec(node, select, owned?.linked, placeholders, owned ? entityActions(owned.entityId) : world);
    },
  };

  if (!tree.stats.length && !tree.groups.length) return <>{emptyHint}</>;
  return (
    <>
      {refusal && <StatDropRefusalNotice refusal={refusal} placeholders={placeholders} onDismiss={() => setRefusal(null)} />}
      <SortableTree adapter={adapter} selectedId={selectedId} onSelect={onSelect} revealSelected />
    </>
  );
};

export default WorldStatTree;
