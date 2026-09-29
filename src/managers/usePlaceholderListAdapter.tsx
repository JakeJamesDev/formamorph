import { useMemo, type ReactNode } from 'react';
import type { ListEditorAdapter } from '@/components/listEditorHooks';
import { usePlaceholderStore } from '@/contexts/PlaceholderStoreContext';
import type { ListSearchNames } from '@/lib/listSearch';
import type { PlaceholderHomesWorld } from '@/lib/placeholderHomes';
import { newPlaceholder } from '@/lib/placeholders';
import type { PlaceholderRowNode } from '@/lib/placeholderScopes';
import { placeholderSearchRows } from './placeholderSearchRows';
import type { PlaceholderRowRules } from './usePlaceholderRowActions';

/**
 * The List Editor adapter for one owner's placeholder list: its tree, flat search rows without an owner
 * prefix, the router's detail and footer, and an add named from the search text. It holds every drawn row
 * and the bare id of each placeholder in it, so a shared row's link still opens its original.
 */
export function usePlaceholderListAdapter({ nodes, lists, rowRules, names, tree, detail, footer, addLabel, onSelect }: {
  nodes: readonly PlaceholderRowNode[];
  lists: PlaceholderHomesWorld;
  rowRules: (node: PlaceholderRowNode) => PlaceholderRowRules;
  names: ListSearchNames;
  tree: ReactNode;
  detail: ReactNode;
  footer: ReactNode;
  addLabel: string;
  onSelect: (id: string) => void;
}): ListEditorAdapter {
  const { addPlaceholder } = usePlaceholderStore();
  const heldIds = useMemo(() => new Set(nodes.flatMap((n) => [n.id, n.placeholder.id])), [nodes]);
  return {
    tree,
    rows: () => placeholderSearchRows(nodes, lists, rowRules, { withOwner: false }),
    names,
    noun: 'placeholders',
    detail: (id) => (
      <div className="p-4">
        {id ? detail : <p className="text-helper text-muted-foreground">Select a placeholder to edit it, or add one</p>}
      </div>
    ),
    footer: () => footer,
    add: {
      label: addLabel,
      onAdd: (typed) => {
        const p = newPlaceholder(typed || 'New Placeholder');
        addPlaceholder(p);
        onSelect(p.id);
      },
    },
    placeholder: 'Search or add new placeholders',
    holds: (id) => heldIds.has(id),
    // The tree draws its own empty hint.
    isEmpty: false,
    emptyHint: null,
  };
}
