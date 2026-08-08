import { useGameData } from '@/contexts/GameDataContext';
import { Folder } from 'lucide-react';
import {
  buildTraitTree, flattenTraitTree, removeChildrenOf, getTraitDropProjection, applyTraitDrop,
  duplicateTraitNode, type FlatTraitNode,
} from '@/lib/traitTree';
import { SortableTree, TREE_INDENT, type SortableTreeAdapter } from './SortableTree';
import { useEditorMode } from '@/lib/editorMode';
import { EmptyListHint } from '@/components/EmptyListHint';
import PlaceholderText from '@/components/prompt/PlaceholderText';

/** The Traits tab's folder tree: a flat sortable list where horizontal drag sets nesting depth. */
const TraitTree = ({ selectedId, onSelect }: { selectedId: string | null; onSelect: (id: string) => void }) => {
  const { traits, traitGroups, setTraits, setTraitGroups, removeTrait, removeTraitGroup, placeholders } = useGameData();
  const { advanced } = useEditorMode();

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
      return {
        // Only groups collapse; traits get no leading slot (matching the original layout).
        lead: isGroup ? 'chevron' : 'none',
        collapseLabels: ['Expand group', 'Collapse group'],
        icon: isGroup ? <Folder className="h-4 w-4 shrink-0" /> : undefined,
        label: <PlaceholderText text={isGroup ? node.group?.name ?? '' : node.leaf?.name ?? ''} placeholders={placeholders} />,
        labelClass: isGroup ? 'font-medium' : undefined,
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
