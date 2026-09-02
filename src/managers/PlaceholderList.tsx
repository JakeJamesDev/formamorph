import { useMemo, useState } from 'react';
import { Link2, ArrowUpFromLine, BookOpen, Folder, User } from 'lucide-react';
import { randomUUID } from '@/lib/uuid';
import { remintPlaceholderDef } from '@/lib/placeholders';
import { removePlaceholderGroup } from '@/lib/placeholderGroups';
import { allPlaceholders, placeholderList, withPlaceholderList } from '@/lib/placeholderHomes';
import {
  applyPlaceholderDrop, chipValueFor, getPlaceholderDropProjection, ownedDescendants, placeholderRows,
  placeholderUsedByMap, promotePlaceholder, releasePlaceholderOwners, removeChipValueFrom,
  removeCollapsedPlaceholderRows, removePlaceholderCascade, type PlaceholderTreeRow,
} from '@/lib/placeholderTree';
import {
  applyScopedPlaceholderDrop, placeholderDropAllowed, placeholderTreeNodes, type PlaceholderTreeNode,
} from '@/lib/placeholderScopes';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { Tip } from '@/components/ui/tooltip';
import { EmptyListHint } from '@/components/EmptyListHint';
import { TREE_INDENT } from '@/components/EditorRow';
import PlaceholderText from '@/components/prompt/PlaceholderText';
import { usePlaceholderStore } from '@/contexts/PlaceholderStoreContext';
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
const PlaceholderList = ({ selectedId, onSelect }: { selectedId: string | null; onSelect: (id: string | null) => void }) => {
  const { placeholders, setPlaceholders, removePlaceholder, placedIds, lists, setLists, scope } = usePlaceholderStore();
  // The placeholder a delete is waiting on, held so the confirmation can name what goes with it.
  const [pendingDelete, setPendingDelete] = useState<PlaceholderTreeRow | null>(null);
  const doomed = useMemo(
    () => (pendingDelete ? ownedDescendants(placeholders, pendingDelete.placeholder.id) : []),
    [placeholders, pendingDelete],
  );

  /** Delete a placeholder, plus the value its holder held it through — a value pointing at something just
   *  deleted on purpose is a red `?` nobody asked for. A top-level row has no holder and only goes itself. */
  const remove = (id: string, holderId: string | null) => {
    if (holderId === null) removePlaceholder(id);
    else setPlaceholders((prev) =>
      releasePlaceholderOwners(removeChipValueFrom(removePlaceholderCascade(prev, id), holderId, id)));
    // Selection speaks in row ids, and every row this placeholder reached goes with it.
    if (selectedId?.split('/').includes(id)) onSelect(null);
  };

  const askRemove = (node: PlaceholderTreeRow) => {
    const { placeholder, shared, holderId } = node;
    // A shared row is a reference, never a possession: removing it removes the reference and the original
    // stays for everyone else holding it.
    if (shared && holderId !== null) {
      setPlaceholders((prev) => releasePlaceholderOwners(removeChipValueFrom(prev, holderId, placeholder.id)));
      return;
    }
    // Nothing else goes with it, so there is nothing to warn about.
    if (!ownedDescendants(placeholders, placeholder.id).length) remove(placeholder.id, holderId);
    else setPendingDelete(node);
  };

  const duplicate = (row: PlaceholderTreeRow) => {
    setPlaceholders((prev) => {
      const i = prev.findIndex((p) => p.id === row.placeholder.id);
      if (i === -1) return prev;
      // Re-mint value-chip placements so the copy never shares a nested Unique roll with the original.
      const source = prev[i];
      const copy = { ...remintPlaceholderDef(source), id: randomUUID(), name: `${source.name} (Copy)` };
      // Selection speaks in row ids. Only a copy that stays owned lands under the row it came from; a copy
      // of a shared row belongs to nobody, so its row is a top-level one named by its id alone.
      onSelect(copy.ownerId && row.parentId ? `${row.parentId}/${copy.id}` : copy.id);
      // Inserted right after its source, which is what keeps it in the source's list (see `scatterPlaceholders`).
      const next = [...prev.slice(0, i + 1), copy, ...prev.slice(i + 1)];
      // A copy of an owned row belongs where the original does, which only holds once its owner holds it.
      const ownerId = copy.ownerId;
      return ownerId
        ? next.map((p) => (p.id === ownerId ? { ...p, values: [...p.values, chipValueFor(copy.id)] } : p))
        : next;
    });
  };

  // The tree, the rows that hold at least one other (which drives the chevron), and who holds whom — each
  // derived once per change. `getVisible` runs on every drag frame, so re-walking there is a per-frame cost.
  // Over a world the tree spans every list; bound to one owner's section it draws that list, still looking
  // chip targets and holders up across the world; bound to a lone list (the library) it is that list.
  const nodes = useMemo((): PlaceholderTreeNode[] => {
    if (lists && !scope) return placeholderTreeNodes(lists);
    const list = lists && scope ? placeholderList(lists, scope) : placeholders;
    const all = lists ? allPlaceholders(lists) : placeholders;
    return placeholderRows(list, all).map((row) => ({ ...row, kind: 'placeholder', home: scope ?? { kind: 'world' } }));
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
      if (next) setLists(next);
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
      // "Used by" belongs on the original, where the author reads it before dragging: it says whether the
      // drag will take the placeholder or share it.
      const usedBy = holderId === null ? usedByMap.get(placeholder.id) : undefined;
      return {
        // Every placeholder can hold another, so a row holding none reserves the slot for alignment.
        lead: parentRowIds.has(node.id) ? 'chevron' : 'spacer',
        collapseLabels: ['Expand nested placeholders', 'Collapse nested placeholders'],
        icon: shared ? (
          <Tip tip={`Shared — open ${placeholder.name}`} labelsChild={false}>
            <button
              type="button"
              aria-label={`Open ${placeholder.name}`}
              onClick={(e) => { e.stopPropagation(); onSelect(placeholder.id); }}
              className="shrink-0 px-0.5"
            >
              <Link2 className="h-3.5 w-3.5" />
            </button>
          </Tip>
        ) : undefined,
        label: placeholder.name,
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
        remove: () => askRemove(node),
        duplicate: () => duplicate(node),
      };
    },
  };

  if (nodes.length === 0) return <EmptyListHint noun="placeholders" />;
  return (
    <>
      <SortableTree adapter={adapter} selectedId={selectedId} onSelect={onSelect} />
      <ConfirmDialog
        open={!!pendingDelete}
        onOpenChange={(open) => { if (!open) setPendingDelete(null); }}
        title={`Delete ${pendingDelete?.placeholder.name ?? ''}?`}
        description={`This also deletes what it owns: ${doomed.map((p) => p.name).join(', ')}.`}
        onConfirm={() => {
          if (pendingDelete) remove(pendingDelete.placeholder.id, pendingDelete.holderId);
          setPendingDelete(null);
        }}
        onCancel={() => setPendingDelete(null)}
      />
    </>
  );
};

export default PlaceholderList;
