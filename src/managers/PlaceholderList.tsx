import { useMemo, useState } from 'react';
import { Link2, ArrowUpFromLine } from 'lucide-react';
import { randomUUID } from '@/lib/uuid';
import { remintPlaceholderDef } from '@/lib/placeholders';
import {
  applyPlaceholderDrop, chipValueFor, getPlaceholderDropProjection, ownedDescendants, placeholderRows,
  placeholderUsedByMap, promotePlaceholder, releasePlaceholderOwners, removeChipValueFrom,
  removeCollapsedPlaceholderRows, removePlaceholderCascade, type PlaceholderTreeRow,
} from '@/lib/placeholderTree';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { Tip } from '@/components/ui/tooltip';
import { EmptyListHint } from '@/components/EmptyListHint';
import { TREE_INDENT } from '@/components/EditorRow';
import { usePlaceholderStore } from '@/contexts/PlaceholderStoreContext';
import { SortableTree, type SortableTreeAdapter } from './SortableTree';

/**
 * The Placeholders tab's tree. A value that is exactly one chip nests what it names, so the list already
 * knew the structure; what this draws is who each nested row *belongs* to. An owned row is the holder's own
 * and appears nowhere else; a shared row points at an original that stays at the top level, and carries the
 * link icon that opens it.
 *
 * Dragging a row under another nests it — taking it privately when nothing else reaches it, referencing it
 * when something does. Every one of those decisions is in `lib/placeholderTree`; this component only wires
 * it to the shared drag-tree scaffold. Adding is the caller's concern (a toolbar button), mirroring how the
 * World Editor and library editor place their own.
 */
const PlaceholderList = ({ selectedId, onSelect }: { selectedId: string | null; onSelect: (id: string | null) => void }) => {
  const { placeholders, setPlaceholders, removePlaceholder, placedIds } = usePlaceholderStore();
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
    if (selectedId === id) onSelect(null);
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
      onSelect(copy.id);
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
  const rows = useMemo(() => placeholderRows(placeholders), [placeholders]);
  const parentRowIds = useMemo(
    () => new Set(rows.map((r) => r.parentId).filter((id): id is string => id !== null)),
    [rows],
  );
  const usedByMap = useMemo(() => placeholderUsedByMap(placeholders), [placeholders]);

  const adapter: SortableTreeAdapter<PlaceholderTreeRow> = {
    getVisible: (collapsed) => removeCollapsedPlaceholderRows(rows, collapsed),
    projectDepth: (visible, activeId, overId, offsetLeft) =>
      getPlaceholderDropProjection(visible, activeId, overId, offsetLeft, TREE_INDENT).depth,
    onDrop: (activeId, overId, offsetLeft, collapsed) => {
      const next = applyPlaceholderDrop(
        placeholders, collapsed, activeId, overId, offsetLeft, TREE_INDENT, { placedIds: placedIds?.() },
      );
      if (next !== placeholders) setPlaceholders(next);
    },
    // A shared placeholder draws a row under every holder that references it, and all of them are the one
    // placeholder the editor panel opens.
    selectionId: (node) => node.placeholder.id,
    rowSpec: (node) => {
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

  if (placeholders.length === 0) return <EmptyListHint noun="placeholders" />;
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
