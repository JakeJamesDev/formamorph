import { useMemo, useState, type ReactNode } from 'react';
import { Link2, ArrowUpFromLine, BookOpen, CornerDownRight, Folder, LayoutTemplate, User } from 'lucide-react';
import { removePlaceholderGroup } from '@/lib/placeholderGroups';
import { blueprintMoveRefusal, copyName, type BlueprintRefusal } from '@/lib/placeholderBlueprints';
import { allPlaceholders, placeholderList, withPlaceholderList } from '@/lib/placeholderHomes';
import {
  applyPlaceholderDrop, getPlaceholderDropProjection, placeholderRows, placeholderUsedByMap, promotePlaceholder,
  removeCollapsedPlaceholderRows,
} from '@/lib/placeholderTree';
import {
  applyScopedPlaceholderDrop, ownerPlaceholderNodes, placeholderDropAllowed, placeholderTreeNodes, type PlaceholderTreeNode,
} from '@/lib/placeholderScopes';
import { Tip } from '@/components/ui/tooltip';
import { EmptyListHint } from '@/components/EmptyListHint';
import { TREE_INDENT } from '@/components/EditorRow';
import PlaceholderText from '@/components/prompt/PlaceholderText';
import { usePlaceholderStore } from '@/contexts/PlaceholderStoreContext';
import { useGameDataOptional } from '@/contexts/GameDataContext';
import type { PlaceholderSlices } from '@/lib/placeholderHomes';
import { BlueprintRefusalNotice } from './BlueprintRefusalNotice';
import { usePlaceholderRowActions } from './usePlaceholderRowActions';
import { SortableTree, type SortableTreeAdapter } from './SortableTree';

/**
 * The Placeholders tab's tree. A value that is exactly one chip nests what it names, so the list already
 * knew the structure; what this draws is who each nested row *belongs* to. An owned row is the holder's own
 * and appears nowhere else; a shared row points at an original that stays at the top level, and carries the
 * link icon that opens it.
 *
 * Over a world, the tree also draws the shared list's folders above its loose rows, and an owner node for
 * each entity or book that owns placeholders, with that owner's rows beneath; a drag across those sections
 * moves the record between lists with its id kept. Bound to one owner's section (an entity panel), it
 * draws that owner's rows alone.
 *
 * Dragging a row under another nests it — taking it privately when nothing else reaches it, referencing it
 * when something does. Every one of those decisions is in `lib/placeholderTree` and `lib/placeholderScopes`;
 * this component only wires them to the shared drag-tree scaffold. Adding is the caller's concern (a
 * toolbar button), mirroring how the World Editor and library editor place their own.
 */
const PlaceholderList = ({ selectedId, onSelect, openDuplicate }: {
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  /** Opens a row's fresh duplicate, given the id of the placeholder it copies; absent, the row is selected. */
  openDuplicate?: (rowId: string, sourceId: string) => void;
}) => {
  const { placeholders, setPlaceholders, placedIds, lists, setLists, scope } = usePlaceholderStore();
  const world = useGameDataOptional();
  // The last move across the Blueprints edge that was refused, and whether it was the group's removal.
  const [refusal, setRefusal] = useState<{ refusal: BlueprintRefusal; removing: boolean } | null>(null);
  /** Write every list, unless the change carries a placeholder across the Blueprints edge that something
   *  still holds on its side. */
  const commitLists = (next: PlaceholderSlices, removing = false) => {
    if (!setLists) return;
    const refused = world ? blueprintMoveRefusal(world.getWorldData(), next) : null;
    setRefusal(refused && { refusal: refused, removing });
    if (!refused) setLists(next);
  };
  const { rowRules, dialog } = usePlaceholderRowActions({ selectedId, onSelect, openDuplicate });

  // The tree, the rows that hold at least one other (which drives the chevron), and who holds whom — each
  // derived once per change. `getVisible` runs on every drag frame, so re-walking there is a per-frame cost.
  // Over a world the tree spans every list; bound to one owner's section it draws that list, still looking
  // chip targets and holders up across the world; bound to a lone list (the library) it is that list.
  const nodes = useMemo((): PlaceholderTreeNode[] => {
    if (lists) return scope ? ownerPlaceholderNodes(lists, scope) : placeholderTreeNodes(lists);
    return placeholderRows(placeholders, placeholders).map((row) => ({ ...row, kind: 'placeholder', home: scope ?? { kind: 'world' } }));
  }, [placeholders, lists, scope]);
  const parentRowIds = useMemo(
    () => new Set(nodes.map((r) => r.parentId).filter((id): id is string => id !== null)),
    [nodes],
  );
  const usedByMap = useMemo(() => placeholderUsedByMap(placeholders), [placeholders]);

  const onDrop = (activeId: string, overId: string, offsetLeft: number, collapsed: Set<string>) => {
    const context = { placedIds: placedIds?.() };
    if (lists && setLists && !scope) {
      const next = applyScopedPlaceholderDrop(lists, collapsed, activeId, overId, offsetLeft, TREE_INDENT, context);
      if (next) commitLists(next);
      return;
    }
    if (lists && setLists && scope) {
      const list = placeholderList(lists, scope);
      const next = applyPlaceholderDrop(list, collapsed, activeId, overId, offsetLeft, TREE_INDENT, { ...context, all: allPlaceholders(lists) });
      if (next !== list) setLists(withPlaceholderList(lists, scope, next));
      return;
    }
    const next = applyPlaceholderDrop(placeholders, collapsed, activeId, overId, offsetLeft, TREE_INDENT, context);
    if (next !== placeholders) setPlaceholders(next);
  };

  const adapter: SortableTreeAdapter<PlaceholderTreeNode> = {
    getVisible: (collapsed) => removeCollapsedPlaceholderRows(nodes, collapsed),
    // Over a world the indicator refuses what the drop would (a scoped row into a folder, a folder under
    // a row), so the indent never promises a landing that will not happen.
    projectDepth: (visible, activeId, overId, offsetLeft) => {
      const { depth, parentId } = getPlaceholderDropProjection(visible, activeId, overId, offsetLeft, TREE_INDENT);
      if (lists && !scope && !placeholderDropAllowed(lists, nodes, activeId, parentId)) return null;
      return depth;
    },
    onDrop,
    rowSpec: (node) => {
      if (node.kind === 'group' && node.group.system === 'blueprints') {
        return {
          lead: 'chevron',
          collapseLabels: ['Expand group', 'Collapse group'],
          icon: <LayoutTemplate className="h-4 w-4 shrink-0" aria-hidden />,
          label: node.group.name,
          labelClass: 'font-medium',
          removeTitle: 'Remove Blueprints',
          remove: () => {
            if (!lists) return;
            const next = removePlaceholderGroup(lists.placeholderGroups ?? [], lists.placeholders ?? [], node.id);
            commitLists({ placeholders: next.placeholders, entities: lists.entities ?? [], dictionaries: lists.dictionaries ?? [], placeholderGroups: next.groups }, true);
            if (selectedId === node.id) onSelect(null);
          },
        };
      }
      if (node.kind === 'group') {
        // A folder over shared rows: deleting it lifts what it holds to its parent. Nothing to duplicate,
        // since a copy of the placeholders inside would need re-minting nobody asked for.
        return {
          lead: 'chevron',
          collapseLabels: ['Expand group', 'Collapse group'],
          icon: <Folder className="h-4 w-4 shrink-0" />,
          label: node.group.name,
          labelClass: 'font-medium',
          remove: () => {
            if (!lists || !setLists) return;
            const next = removePlaceholderGroup(lists.placeholderGroups ?? [], lists.placeholders ?? [], node.id);
            setLists({ placeholders: next.placeholders, entities: lists.entities ?? [], dictionaries: lists.dictionaries ?? [], placeholderGroups: next.groups });
            if (selectedId === node.id) onSelect(null);
          },
        };
      }
      if (node.kind === 'owner') {
        // Read off the entity or book, so it is not a row an author can rename, delete or drag; selecting
        // it opens where the owner itself is edited.
        return {
          lead: 'chevron',
          collapseLabels: [`Expand ${node.owner.name}`, `Collapse ${node.owner.name}`],
          icon: node.owner.kind === 'entity'
            ? <User className="h-4 w-4 shrink-0" />
            : <BookOpen className="h-4 w-4 shrink-0" />,
          label: <PlaceholderText text={node.owner.name} placeholders={placeholders} />,
          labelClass: 'font-medium',
          fixed: true,
        };
      }
      const { placeholder, shared, holderId } = node;
      const { copy, duplicate, remove, removeBlocked } = rowRules(node);
      const copyOwner = copy?.owner;
      const blueprint = copy?.blueprint;
      // "Used by" belongs on the original, where the author reads it before dragging: it says whether the
      // drag will take the placeholder or share it.
      const usedBy = holderId === null ? usedByMap.get(placeholder.id) : undefined;
      const blueprintName = blueprint?.name ?? placeholder.name;
      const untouchedCopy = !!copy?.untouched;
      const jump = (to: string, tip: string, glyph: ReactNode) => (
        <Tip tip={tip} labelsChild={false}>
          <button
            type="button"
            aria-label={`Open ${to === placeholder.id ? placeholder.name : blueprintName}`}
            onClick={(e) => { e.stopPropagation(); onSelect(to); }}
            className="shrink-0 px-0.5"
          >
            {glyph}
          </button>
        </Tip>
      );
      const copyGlyph = <Link2 className="h-3.5 w-3.5 opacity-50" />;
      return {
        // Every placeholder can hold another, so a row holding none reserves the slot for alignment.
        lead: parentRowIds.has(node.id) ? 'chevron' : 'spacer',
        collapseLabels: ['Expand nested placeholders', 'Collapse nested placeholders'],
        icon: shared ? jump(placeholder.id, `Shared, opens ${placeholder.name}`, <CornerDownRight className="h-3.5 w-3.5" />)
          // A scoped list holds no blueprint row to open.
          : copyOwner && blueprint && !scope ? jump(blueprint.id, `Copy of ${blueprintName}, opens it${untouchedCopy ? '' : '. Modified for this entity'}`, copyGlyph)
          : copyOwner ? (
            <Tip tip={`Copy of ${blueprintName}${untouchedCopy ? '' : '. Modified for this entity'}`} labelsChild={false}>
              <span className="shrink-0 px-0.5" aria-label="Copy">{copyGlyph}</span>
            </Tip>
          ) : undefined,
        overridden: copyOwner && !untouchedCopy ? 'Modified for this entity' : undefined,
        // A copy reads as its owner's, named after its blueprint live.
        label: copyOwner
          ? <PlaceholderText text={copyName(copyOwner.name, blueprint?.name ?? placeholder.name)} placeholders={placeholders} />
          : placeholder.name,
        meta: usedBy ? `Used by ${usedBy.count}` : undefined,
        metaTitle: usedBy ? `Held as a value of ${usedBy.names.join(', ')}` : undefined,
        actions: shared || holderId === null ? undefined : [{
          icon: <ArrowUpFromLine className="h-4 w-4" />,
          title: 'Promote To Top Level',
          onClick: () => setPlaceholders((prev) => promotePlaceholder(prev, placeholder.id)),
        }],
        // The affordance has to say what it does: a shared row's X unhooks the reference, and only an
        // owned or top-level row's deletes anything.
        removeTitle: shared && holderId !== null ? 'Remove Reference' : 'Delete',
        remove,
        removeBlocked,
        duplicate,
      };
    },
  };

  if (nodes.length === 0) return <EmptyListHint noun="placeholders" />;
  return (
    <>
      {refusal && (
        <BlueprintRefusalNotice
          refusal={refusal.refusal}
          removing={refusal.removing}
          placeholders={placeholders}
          onDismiss={() => setRefusal(null)}
        />
      )}
      <SortableTree adapter={adapter} selectedId={selectedId} onSelect={onSelect} />
      {dialog}
    </>
  );
};

export default PlaceholderList;
