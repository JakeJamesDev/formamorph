import { useMemo, useState, type ReactNode } from 'react';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { usePlaceholderStore } from '@/contexts/PlaceholderStoreContext';
import { isUntouchedCopy } from '@/lib/blueprintCopies';
import { remintPlaceholderDef } from '@/lib/placeholders';
import { placeholderOwnerRef, type PlaceholderHome, type PlaceholderOwnerRef } from '@/lib/placeholderHomes';
import {
  chipValueFor, ownedDescendants, releasePlaceholderOwners, removeChipValueFrom, removePlaceholderCascade,
  type PlaceholderTreeRow,
} from '@/lib/placeholderTree';
import { randomUUID } from '@/lib/uuid';
import type { Placeholder } from '@/types';

export type PlaceholderRowRef = PlaceholderTreeRow & { home: PlaceholderHome };

/** What a copy's row knows about the copy. */
export interface PlaceholderCopyFacts {
  owner: PlaceholderOwnerRef;
  blueprint?: Placeholder;
  untouched: boolean;
  /** Something uses the copy, so a delete would bring it straight back. */
  inUse: boolean;
}

export interface PlaceholderRowRules {
  copy?: PlaceholderCopyFacts;
  duplicate?: () => void;
  /** Deletes the row, or removes a shared row's reference. */
  remove?: () => void;
  /** Why the row can't be deleted. */
  removeBlocked?: string;
}

/**
 * The actions a placeholder row offers wherever it is drawn: delete (with the confirmation that names what
 * goes with it), remove a reference, and duplicate. `dialog` is the confirmation; the caller renders it.
 */
export function usePlaceholderRowActions({ selectedId, onSelect, openDuplicate }: {
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  /** Opens a fresh duplicate's row, given the id of the placeholder it copies; absent, the row is selected. */
  openDuplicate?: (rowId: string, sourceId: string) => void;
}) {
  const { placeholders, setPlaceholders, removePlaceholder, lists, copiesInUse } = usePlaceholderStore();
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
      const rowId = copy.ownerId && row.parentId ? `${row.parentId}/${copy.id}` : copy.id;
      if (openDuplicate) openDuplicate(rowId, source.id);
      else onSelect(rowId);
      // Inserted right after its source, which is what keeps it in the source's list (see `scatterPlaceholders`).
      const next = [...prev.slice(0, i + 1), copy, ...prev.slice(i + 1)];
      // A copy of an owned row belongs where the original does, which only holds once its owner holds it.
      const ownerId = copy.ownerId;
      return ownerId
        ? next.map((p) => (p.id === ownerId ? { ...p, values: [...p.values, chipValueFor(copy.id)] } : p))
        : next;
    });
  };

  /** The owner's copy a row draws, if it draws one. */
  const copyOf = (node: PlaceholderRowRef): PlaceholderCopyFacts | undefined => {
    const { placeholder, home } = node;
    if (!placeholder.blueprintId || home.kind === 'world' || !lists) return undefined;
    const owner = placeholderOwnerRef(lists, home.ownerId);
    if (!owner) return undefined;
    const untouched = isUntouchedCopy(placeholder);
    return {
      owner,
      blueprint: placeholders.find((p) => p.id === placeholder.blueprintId),
      untouched,
      // With no use data, only an untouched copy is known to be in use: nothing else keeps one.
      inUse: copiesInUse ? !!copiesInUse.get(owner.id)?.has(placeholder.blueprintId) : untouched,
    };
  };

  /** A row's copy facts and its duplicate and delete, with the delete blocked while something uses the copy. */
  const rowRules = (node: PlaceholderRowRef): PlaceholderRowRules => {
    const copy = copyOf(node);
    return {
      copy,
      // One copy per blueprint per owner.
      duplicate: node.placeholder.blueprintId ? undefined : () => duplicate(node),
      remove: copy?.inUse ? undefined : () => askRemove(node),
      removeBlocked: !copy?.inUse ? undefined
        : copy.untouched ? 'A trait uses this copy. It goes away when nothing uses it.'
        : 'A trait uses this copy. Use Reset to Blueprint to undo your edits.',
    };
  };

  const dialog: ReactNode = (
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
  );

  return { rowRules, dialog };
}
