import { useMemo, type ReactNode } from 'react';
import { usePlaceholderStore } from '@/contexts/PlaceholderStoreContext';
import { placeholderOwnerRef, type PlaceholderOwnerRef } from '@/lib/placeholderHomes';
import { ownerIdOfNode } from '@/lib/placeholderScopes';
import { placeholderSelection } from '@/lib/placeholderTree';
import type { Placeholder } from '@/types';
import PlaceholderManager from './PlaceholderManager';
import PlaceholderGroupManager from './PlaceholderGroupManager';
import PlaceholderOwnerPanel from './PlaceholderOwnerPanel';
import { PlaceholderCopyEditor, PlaceholderCopyFooter } from './PlaceholderCopyEditor';

export interface PlaceholderDetailProps {
  /** A row id, or a bare placeholder id that opens its first row. */
  selectedId: string | null;
  /** Opens another row: Edit Blueprint selects the copy's blueprint. */
  onSelect: (id: string) => void;
  /** Opens a selected owner node's entity or book where it is edited. */
  onOpenOwner?: (owner: PlaceholderOwnerRef) => void;
  /** The copy's owner name when the store carries no owner index. */
  ownerName?: string;
  /** An off-world card's carried blueprints: a copy reads its blueprint here, read-only, with no Edit Blueprint. */
  carriedBlueprints?: readonly Placeholder[];
}

/** A copy whose blueprint the card doesn't carry: its values live in the blueprint, so there is nothing to edit. */
const MissingBlueprintNotice = () => (
  <p className="rounded-md border border-dashed px-2 py-1.5 text-helper text-muted-foreground">
    This copy&apos;s blueprint isn&apos;t in this card, so its values can&apos;t be shown. Add the entity to a world
    that has the blueprint to edit the copy.
  </p>
);

export interface PlaceholderDetailParts {
  /** The pane for the selection, or null when it resolves to nothing. */
  detail: ReactNode;
  /** The copy's frozen footer, when the selection is a copy. */
  footer: ReactNode;
  /** The entity or book the selection belongs to, for the palette. */
  ownerId?: string;
}

/**
 * Picks the detail pane for a placeholder selection: a group, an owner node, a copy over its blueprint, or
 * the placeholder manager. Groups and owner nodes resolve only through a store that carries the world's
 * lists, so a store bound to one owner's list reaches the copy and manager panes alone.
 */
export function usePlaceholderDetail({ selectedId, onSelect, onOpenOwner, ownerName, carriedBlueprints }: PlaceholderDetailProps): PlaceholderDetailParts {
  const { placeholders, lists, owners } = usePlaceholderStore();
  const owner = useMemo(() => {
    const ownerId = selectedId && lists ? ownerIdOfNode(selectedId) : null;
    return ownerId && lists ? placeholderOwnerRef(lists, ownerId) ?? null : null;
  }, [selectedId, lists]);
  const group = selectedId ? lists?.placeholderGroups?.find((g) => g.id === selectedId) : undefined;
  // Resolving a row walks the whole tree, and the host re-renders on every keystroke in any panel.
  const selection = useMemo(() => placeholderSelection(placeholders, selectedId), [placeholders, selectedId]);

  if (group) return { detail: <PlaceholderGroupManager key={group.id} group={group} />, footer: null };
  if (owner) {
    return {
      detail: <PlaceholderOwnerPanel owner={owner} placeholders={placeholders} onOpen={() => onOpenOwner?.(owner)} />,
      footer: null,
      ownerId: owner.id,
    };
  }
  if (!selection) return { detail: null, footer: null };
  const { row, share } = selection;
  const placeholder = row.placeholder;
  const holder = owners?.get(placeholder.id);
  const ownerId = holder?.id;
  const { blueprintId } = placeholder;
  const blueprint = blueprintId
    ? (carriedBlueprints ?? placeholders).find((p) => p.id === blueprintId)
    : undefined;
  if (blueprintId && !blueprint && carriedBlueprints) {
    return { detail: <MissingBlueprintNotice key={row.id} />, footer: null, ownerId };
  }
  if (blueprint) {
    return {
      detail: (
        <PlaceholderCopyEditor
          key={row.id}
          copy={placeholder}
          blueprint={blueprint}
          ownerName={holder?.name ?? ownerName ?? ''}
        />
      ),
      footer: <PlaceholderCopyFooter copy={placeholder} onEditBlueprint={carriedBlueprints ? undefined : () => onSelect(blueprint.id)} />,
      ownerId,
    };
  }
  return {
    detail: <PlaceholderManager key={row.id} placeholder={placeholder} rowId={row.id} share={share} />,
    footer: null,
    ownerId,
  };
}
