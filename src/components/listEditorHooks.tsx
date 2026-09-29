import { useEffect, type ReactNode } from 'react';
import { EditorRow, EditorRowList, type EditorRowAction } from '@/components/EditorRow';
import { ListSearchToolbar, type ListAddSlot } from '@/components/ListToolbar';
import { useListSearch, type ListSearch } from '@/components/listToolbarHooks';
import PlaceholderText from '@/components/prompt/PlaceholderText';
import { matchesListSearch, type ListSearchNames } from '@/lib/listSearch';
import { labelPlaceholders } from '@/lib/placementLetters';

/** One row of the flat search list. `name` is the label its row shows, and what the search matches. */
export type ListEditorRow = {
  id: string;
  name: string;
  icon?: ReactNode;
  labelClass?: string;
  actions: EditorRowAction[];
};

/** What one list plugs into the List Editor. */
export type ListEditorAdapter = {
  /** The list drawn while no search is typed. */
  tree: ReactNode;
  /** Every row a search can find; read only while a search is typed. */
  rows: () => ListEditorRow[];
  /** The placeholders a row's chips resolve through, for matching and for its label. */
  names: ListSearchNames;
  /** The plural the no-match note names: "No traits match". */
  noun: string;
  /** The detail for the held selection, or for no selection. */
  detail: (id: string | null) => ReactNode;
  /** Frozen below the detail's scroll, for a held selection. */
  footer?: (id: string) => ReactNode;
  add: ListAddSlot;
  /** The search box's placeholder text. */
  placeholder: string;
  /** Whether the list holds `id`. A selection it doesn't hold is cleared. */
  holds: (id: string) => boolean;
  /** Shown in place of the tree while the list has nothing in it. */
  isEmpty: boolean;
  emptyHint: ReactNode;
  /** Runs after a selection the list doesn't hold is cleared. */
  onDropStale?: () => void;
};

/** The List Editor's pieces, for a host that lays them out itself. */
export type ListEditorParts = {
  search: ListSearch;
  /** The search box and + control, with the host's classes on its row. */
  toolbar: (className?: string) => ReactNode;
  list: ReactNode;
  detail: ReactNode;
  footer: ReactNode;
  showDetail: boolean;
  onBack: () => void;
};

/**
 * The List Editor's state and parts: the search, the switch between the tree and the flat search list, the
 * detail and its footer, and the empty hint. The caller holds the selection; this clears one the list doesn't
 * hold, on mount included, since a host that keys the editor remounts it with the old selection in hand.
 */
export function useListEditor(
  adapter: ListEditorAdapter,
  { selectedId, onSelect }: { selectedId: string | null; onSelect: (id: string | null) => void },
): ListEditorParts {
  const search = useListSearch();
  const { names, onDropStale } = adapter;
  const heldId = selectedId && adapter.holds(selectedId) ? selectedId : null;

  const stale = !!selectedId && heldId === null;
  useEffect(() => {
    if (!stale) return;
    onSelect(null);
    onDropStale?.();
  }, [stale, onSelect, onDropStale]);

  const matches = search.typed ? adapter.rows().filter((row) => matchesListSearch(row.name, search.term, names)) : null;

  const searchList = (rows: ListEditorRow[]) => {
    if (!rows.length) return <p className="text-helper text-muted-foreground p-2">No {adapter.noun} match &ldquo;{search.typed}&rdquo;.</p>;
    return (
      <EditorRowList>
        {rows.map((row) => (
          <EditorRow
            key={row.id}
            grip={false}
            selected={selectedId === row.id}
            onSelect={() => onSelect(row.id)}
            selectionLabel={`Select ${labelPlaceholders(row.name, names.placeholders)}`}
            icon={row.icon}
            label={<PlaceholderText text={row.name} placeholders={names.placeholders} />}
            labelClass={row.labelClass}
            actions={row.actions}
          />
        ))}
      </EditorRowList>
    );
  };

  return {
    search,
    toolbar: (className) => <ListSearchToolbar className={className} search={search} placeholder={adapter.placeholder} add={adapter.add} />,
    list: matches ? searchList(matches) : adapter.isEmpty ? adapter.emptyHint : adapter.tree,
    detail: adapter.detail(heldId),
    footer: heldId !== null ? adapter.footer?.(heldId) : undefined,
    showDetail: heldId !== null,
    onBack: () => onSelect(null),
  };
}
