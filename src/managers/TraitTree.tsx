import { useMemo } from 'react';
import { useGameData } from '@/contexts/GameDataContext';
import { Folder, Lock, User } from 'lucide-react';
import {
  buildTraitTree, flattenTraitTree, removeChildrenOf, getTraitDropProjection, applyOwnedTraitDrop,
  duplicateTraitNode, ownedTraitTree, type FlatTraitNode,
} from '@/lib/traitTree';
import { editorGateInput, removeOwnedItem, withOwnedTraits } from '@/lib/ownedTraits';
import { SortableTree, type SortableTreeAdapter } from './SortableTree';
import { TREE_INDENT } from '@/components/EditorRow';
import { useEditorMode } from '@/lib/editorMode';
import { EmptyListHint } from '@/components/EmptyListHint';
import PlaceholderText from '@/components/prompt/PlaceholderText';
import { labelPlaceholders } from '@/lib/placementLetters';
import { gateStates, type GateState } from '@/lib/traitGates';
import { gateLine } from '@/lib/traitGateLine';
import { cn } from '@/lib/utils';

// Red on the primary fill is unreadable, so a selected row drops the tint for the row's own color.
const UNRESOLVED = 'text-destructive [[data-editor-row-selected]_&]:text-current';

/** A gated row's lock and count, with the full rule as its tip. Red when a requirement points at nothing. */
const gateMeta = (gate: GateState | undefined, placeholders: Parameters<typeof labelPlaceholders>[1]) => {
  if (!gate?.requirements.length) return {};
  const unresolved = gate.requirements.some((r) => r.unresolved);
  return {
    unresolved,
    meta: (
      <span className={cn('inline-flex items-center gap-1', unresolved && UNRESOLVED)}>
        <Lock className="h-3.5 w-3.5" aria-hidden />{gate.requirements.length}
      </span>
    ),
    // The editor's gate input holds nothing active, so every gated row reads locked: "Requires A or B".
    metaTitle: labelPlaceholders(gateLine(gate) ?? '', placeholders),
  };
};

/**
 * The Traits tab's folder tree: a flat sortable list where horizontal drag sets nesting depth. Each entity
 * that owns a trait or a group has a node at the end of the top level, holding them.
 */
const TraitTree = ({ selectedId, onSelect }: { selectedId: string | null; onSelect: (id: string) => void }) => {
  const {
    traits, traitGroups, entities, setTraits, setTraitGroups, removeTrait, removeTraitGroup, editEntity, placeholders,
  } = useGameData();
  const { advanced } = useEditorMode();
  const gates = useMemo(() => gateStates(editorGateInput({ traits, traitGroups, entities })), [traits, traitGroups, entities]);
  const tree = useMemo(() => ownedTraitTree({ traits, traitGroups }, entities), [traits, traitGroups, entities]);

  const adapter: SortableTreeAdapter<FlatTraitNode> = {
    getVisible: (collapsed) => removeChildrenOf(flattenTraitTree(buildTraitTree(tree.groups, tree.traits)), collapsed),
    projectDepth: (visible, activeId, overId, offsetLeft) =>
      getTraitDropProjection(visible, activeId, overId, offsetLeft, TREE_INDENT)?.depth ?? null,
    onDrop: (activeId, overId, offsetLeft, collapsed) => {
      const next = applyOwnedTraitDrop({ traits, traitGroups }, entities, collapsed, activeId, overId, offsetLeft, TREE_INDENT);
      if (next?.kind === 'world') {
        setTraitGroups(next.groups);
        setTraits(next.traits);
      } else if (next?.kind === 'entity') {
        editEntity(next.entity.id, () => next.entity);
      }
    },
    rowSpec: (node) => {
      const entity = tree.entityNodes.get(node.id);
      if (entity) {
        return {
          lead: 'chevron',
          collapseLabels: ['Expand entity', 'Collapse entity'],
          icon: <User className="h-4 w-4 shrink-0" aria-hidden />,
          label: <PlaceholderText text={entity.name} placeholders={placeholders} />,
          labelClass: 'font-medium',
          meta: entity.persona ? 'Playable' : 'Entity',
          fixed: true,
        };
      }
      const isGroup = node.kind === 'group';
      const ownerId = tree.ownerOf.get(node.id);
      const { unresolved, meta, metaTitle } = isGroup ? {} : gateMeta(gates.get(node.id), placeholders);
      return {
        // Only groups collapse; traits get no leading slot (matching the original layout).
        lead: isGroup ? 'chevron' : 'none',
        collapseLabels: ['Expand group', 'Collapse group'],
        icon: isGroup ? <Folder className="h-4 w-4 shrink-0" /> : undefined,
        label: <PlaceholderText text={isGroup ? node.group?.name ?? '' : node.leaf?.name ?? ''} placeholders={placeholders} />,
        labelClass: isGroup ? 'font-medium' : unresolved ? UNRESOLVED : undefined,
        meta,
        metaTitle,
        remove: () => {
          if (ownerId) editEntity(ownerId, (e) => removeOwnedItem(e, node.id));
          else if (isGroup) removeTraitGroup(node.id);
          else removeTrait(node.id);
        },
        duplicate: () => {
          const owner = ownerId && tree.entityNodes.get(ownerId);
          if (owner) {
            const res = duplicateTraitNode(owner.traitGroups ?? [], owner.traits ?? [], node.id);
            editEntity(owner.id, (e) => withOwnedTraits(e, res.traits, res.groups));
            onSelect(res.newId);
            return;
          }
          const res = duplicateTraitNode(traitGroups, traits, node.id);
          setTraitGroups(res.groups);
          setTraits(res.traits);
          onSelect(res.newId);
        },
      };
    },
  };

  if (!tree.traits.length && !tree.groups.length) {
    // Simple mode has no groups, so its + adds the item directly.
    return <EmptyListHint noun="traits" action={advanced ? "add a group or trait" : "add one"} />;
  }

  return <SortableTree adapter={adapter} selectedId={selectedId} onSelect={onSelect} />;
};

export default TraitTree;
