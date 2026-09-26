import { useMemo } from 'react';
import { useGameData } from '@/contexts/GameDataContext';
import { Folder, Lock } from 'lucide-react';
import {
  buildTraitTree, flattenTraitTree, removeChildrenOf, getTraitDropProjection, applyTraitDrop,
  duplicateTraitNode, type FlatTraitNode,
} from '@/lib/traitTree';
import { SortableTree, type SortableTreeAdapter } from './SortableTree';
import { TREE_INDENT } from '@/components/EditorRow';
import { useEditorMode } from '@/lib/editorMode';
import { EmptyListHint } from '@/components/EmptyListHint';
import PlaceholderText from '@/components/prompt/PlaceholderText';
import { labelPlaceholders } from '@/lib/placementLetters';
import { gateStates, worldGateInput, type GateState } from '@/lib/traitGates';
import { cn } from '@/lib/utils';

const OR = new Intl.ListFormat('en', { type: 'disjunction' });
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
    metaTitle: labelPlaceholders(`Requires ${OR.format(gate.requirements.map((r) => r.text))}`, placeholders),
  };
};

/** The Traits tab's folder tree: a flat sortable list where horizontal drag sets nesting depth. */
const TraitTree = ({ selectedId, onSelect }: { selectedId: string | null; onSelect: (id: string) => void }) => {
  const { traits, traitGroups, entities, setTraits, setTraitGroups, removeTrait, removeTraitGroup, placeholders } = useGameData();
  const { advanced } = useEditorMode();
  const gates = useMemo(
    () => gateStates(worldGateInput({ traits, groups: traitGroups, entities }, { source: 'none' })),
    [traits, traitGroups, entities],
  );

  const adapter: SortableTreeAdapter<FlatTraitNode> = {
    getVisible: (collapsed) => removeChildrenOf(flattenTraitTree(buildTraitTree(traitGroups, traits)), collapsed),
    projectDepth: (visible, activeId, overId, offsetLeft) =>
      getTraitDropProjection(visible, activeId, overId, offsetLeft, TREE_INDENT)?.depth ?? null,
    onDrop: (activeId, overId, offsetLeft, collapsed) => {
      const next = applyTraitDrop(traitGroups, traits, collapsed, activeId, overId, offsetLeft, TREE_INDENT);
      if (next.groups !== traitGroups) setTraitGroups(next.groups);
      if (next.traits !== traits) setTraits(next.traits);
    },
    rowSpec: (node) => {
      const isGroup = node.kind === 'group';
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
        remove: () => { if (isGroup) removeTraitGroup(node.id); else removeTrait(node.id); },
        duplicate: () => {
          const res = duplicateTraitNode(traitGroups, traits, node.id);
          setTraitGroups(res.groups);
          setTraits(res.traits);
          onSelect(res.newId);
        },
      };
    },
  };

  if (!traits.length && !traitGroups.length) {
    // Simple mode has no groups, so its + adds the item directly.
    return <EmptyListHint noun="traits" action={advanced ? "add a group or trait" : "add one"} />;
  }

  return <SortableTree adapter={adapter} selectedId={selectedId} onSelect={onSelect} />;
};

export default TraitTree;
