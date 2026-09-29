import { Copy, Link2, X } from 'lucide-react';
import type { EditorRowAction } from '@/components/EditorRow';
import type { ListEditorRow } from '@/components/listEditorHooks';
import { copyName } from '@/lib/placeholderBlueprints';
import { allPlaceholders, placeholderOwnerRef, type PlaceholderHomesWorld } from '@/lib/placeholderHomes';
import { PLACEHOLDER_PATH_SEPARATOR, SHARED_PATH_SEP } from '@/lib/placeholders';
import { OWNER_NAME_SEPARATOR } from '@/lib/placementLetters';
import type { PlaceholderRowNode, PlaceholderTreeNode } from '@/lib/placeholderScopes';
import type { Placeholder } from '@/types';
import type { PlaceholderRowRules } from './usePlaceholderRowActions';

/**
 * A placeholder tree's flat search rows: each placeholder once, at its own row, with its tree row's Duplicate
 * and Delete. A shared reference and the rows it repeats beneath it stay out. `withOwner` names an owned row's
 * owner before its chain, for a list that draws every owner.
 */
export function placeholderSearchRows(
  nodes: readonly PlaceholderTreeNode[],
  lists: PlaceholderHomesWorld,
  rowRules: (node: PlaceholderRowNode) => PlaceholderRowRules,
  { withOwner }: { withOwner: boolean },
): ListEditorRow[] {
  const byId = new Map(allPlaceholders(lists).map((p) => [p.id, p]));
  const repeated = new Set<string>();
  const out: ListEditorRow[] = [];
  for (const node of nodes) {
    if (node.kind !== 'placeholder') continue;
    if (node.shared || (node.parentId && repeated.has(node.parentId))) {
      repeated.add(node.id);
      continue;
    }
    const { copy, duplicate, remove, removeBlocked } = rowRules(node);
    const actions: EditorRowAction[] = [];
    if (duplicate) actions.push({ icon: <Copy className="h-4 w-4" />, title: 'Duplicate', onClick: duplicate });
    if (remove || removeBlocked) {
      actions.push({ icon: <X className="h-4 w-4" />, title: 'Delete', onClick: remove ?? (() => {}), disabledReason: removeBlocked });
    }
    out.push({
      id: node.id,
      name: rowLabel(node, byId, lists, withOwner),
      icon: copy ? <Link2 className="h-4 w-4 shrink-0" aria-label="Copy" /> : undefined,
      actions,
    });
  }
  return out;
}

/** A search row's label: its chain of names, under its owner when `withOwner`, and a copy as its tree row reads. */
function rowLabel(node: PlaceholderRowNode, byId: ReadonlyMap<string, Placeholder>, lists: PlaceholderHomesWorld, withOwner: boolean): string {
  const chain = node.id.split(SHARED_PATH_SEP).map((id) => byId.get(id));
  const names = chain.map((p) => p?.name ?? '');
  const owner = node.home.kind === 'world' ? undefined : placeholderOwnerRef(lists, node.home.ownerId);
  if (!owner) return names.join(PLACEHOLDER_PATH_SEPARATOR);
  // A copy reads as its owner's, named after its blueprint live, as its tree row does.
  const root = chain[0];
  if (root?.blueprintId) {
    names[0] = copyName(owner.name, byId.get(root.blueprintId)?.name ?? root.name);
    return names.join(PLACEHOLDER_PATH_SEPARATOR);
  }
  const path = names.join(PLACEHOLDER_PATH_SEPARATOR);
  return withOwner ? `${owner.name}${OWNER_NAME_SEPARATOR}${path}` : path;
}
