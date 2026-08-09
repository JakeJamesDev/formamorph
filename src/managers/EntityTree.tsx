import { useGameData } from '@/contexts/GameDataContext';
import { Folder } from 'lucide-react';
import {
  buildEntityTree, flattenEntityTree, removeChildrenOf, getEntityDropProjection, applyEntityDrop,
  duplicateEntityNode, type FlatEntityNode,
} from '@/lib/entityGroupTree';
import { SortableTree, type SortableTreeAdapter } from './SortableTree';
import { TREE_INDENT } from '@/components/EditorRow';
import { useEditorMode } from '@/lib/editorMode';
import { EmptyListHint } from '@/components/EmptyListHint';
import PlaceholderText from '@/components/prompt/PlaceholderText';

/** The Entities tab's folder tree: a flat sortable list where horizontal drag sets nesting depth. Groups are
 *  editor-only folders (never sent to the AI); entities are leaves. Mirrors the Traits tab. */
const EntityTree = ({ selectedId, onSelect }: { selectedId: string | null; onSelect: (id: string) => void }) => {
  const { entities, entityGroups, setEntities, setEntityGroups, removeEntity, removeEntityGroup, placeholders } = useGameData();
  const { advanced } = useEditorMode();

  const adapter: SortableTreeAdapter<FlatEntityNode> = {
    getVisible: (collapsed) => removeChildrenOf(flattenEntityTree(buildEntityTree(entityGroups, entities)), collapsed),
    projectDepth: (visible, activeId, overId, offsetLeft) =>
      getEntityDropProjection(visible, activeId, overId, offsetLeft, TREE_INDENT)?.depth ?? null,
    onDrop: (activeId, overId, offsetLeft, collapsed) => {
      const next = applyEntityDrop(entityGroups, entities, collapsed, activeId, overId, offsetLeft, TREE_INDENT);
      if (next.groups !== entityGroups) setEntityGroups(next.groups);
      if (next.entities !== entities) setEntities(next.entities);
    },
    rowSpec: (node) => {
      const isGroup = node.kind === 'group';
      return {
        // Only groups collapse; entities get no leading slot (matching the flat list layout).
        lead: isGroup ? 'chevron' : 'none',
        collapseLabels: ['Expand group', 'Collapse group'],
        icon: isGroup ? <Folder className="h-4 w-4 shrink-0" /> : undefined,
        label: <PlaceholderText text={isGroup ? node.group?.name ?? '' : node.leaf?.name ?? ''} placeholders={placeholders} />,
        labelClass: isGroup ? 'font-medium' : undefined,
        remove: () => { if (isGroup) removeEntityGroup(node.id); else removeEntity(node.id); },
        duplicate: () => {
          const res = duplicateEntityNode(entityGroups, entities, node.id);
          setEntityGroups(res.groups);
          setEntities(res.entities);
          onSelect(res.newId);
        },
      };
    },
  };

  if (!entities.length && !entityGroups.length) {
    // Simple mode has no groups, so its + adds the item directly.
    return <EmptyListHint noun="entities" action={advanced ? "add a group or entity" : "add one"} />;
  }

  return <SortableTree adapter={adapter} selectedId={selectedId} onSelect={onSelect} />;
};

export default EntityTree;
