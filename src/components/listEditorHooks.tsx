import { useEffect, type ReactNode } from 'react';
import { type DragEndEvent } from '@dnd-kit/core';
import { verticalListSortingStrategy } from '@dnd-kit/sortable';
import { EditorDndContext, StableSortableContext } from '@/components/dnd/EditorDndContext';
import { EditorRow, EditorRowList, type EditorRowAction } from '@/components/EditorRow';
import { SortableEditorRow } from '@/components/SortableList';
import { ListSearchToolbar, type ListAddSlot } from '@/components/ListToolbar';
import { useListSearch, type ListSearch } from '@/components/listToolbarHooks';
import PlaceholderText from '@/components/prompt/PlaceholderText';
import { matchesListSearch, type ListSearchNames } from '@/lib/listSearch';
import type { TargetAttribute } from '@/lib/surface/surfaceTargets';
import { labelPlaceholders } from '@/lib/placementLetters';

/** One row of the flat search list. `name` is the label its row shows, and what the search matches. */
export type ListEditorRow = {
  id: string;
  name: string;
  icon?: ReactNode;
  labelClass?: string;
  actions: EditorRowAction[];
  /** Draws a grip that drags the row, when the adapter takes `onReorder`. */
  sortable?: boolean;
};

/** What one list plugs into the List Editor. */
export type ListEditorAdapter = {
  /** The list drawn while no search is typed. A flat list omits it, and the shell draws every row. */
  tree?: ReactNode;
  /** Every row a search can find, read while a search is typed; a flat list draws them all without one. */
  rows: () => ListEditorRow[];
  /** The placeholders a row's chips resolve through, for matching and for its label. */
  names: ListSearchNames;
  /** The plural the no-match note names: "No traits match". */
  noun: string;
  /** The detail for the held selection, or for no selection. */
  detail: (id: string | null) => ReactNode;
  /** Frozen below the detail's scroll, for a held selection. */
  footer?: (id: string) => ReactNode;
  /** Whether the detail for a held selection fills the pane and scrolls inside itself. */
  fills?: (id: string) => boolean;
  /** Drops a sortable search row on another: the ids of the row dragged and the row under it. */
  onReorder?: (activeId: string, overId: string) => void;
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
  /** `tree` fills the slot and owns its clicks: no scroll, no click-to-deselect, and no search list in its place. */
  ownsSlot?: boolean;
};

/** The List Editor's pieces, for a host that lays them out itself. */
export type ListEditorParts = {
  search: ListSearch;
  /** The search box and + control, with the host's classes on its row, its extras after the +, and `after` last. */
  toolbar: (className?: string, extras?: { children?: ReactNode; after?: ReactNode; target?: TargetAttribute }) => ReactNode;
  list: ReactNode;
  detail: ReactNode;
  footer: ReactNode;
  /** The held selection's detail fills the pane; the host gives it a flex column instead of a scroll. */
  fills: boolean;
  ownsSlot: boolean;
  showDetail: boolean;
  onBack: () => void;
};

/**
 * The List Editor's state and parts: the search, the switch between the tree and the flat search list, the
 * detail and its footer, and the empty hint. The caller holds the selection; this clears one the list doesn't
 * hold, on mount included, since a host that keys the editor remounts it with the old selection in hand.
 * A host that shares one search box across lists passes its own `search`.
 */
export function useListEditor(
  adapter: ListEditorAdapter,
  { selectedId, onSelect, search: hostSearch }: {
    selectedId: string | null;
    onSelect: (id: string | null) => void;
    search?: ListSearch;
  },
): ListEditorParts {
  const ownSearch = useListSearch();
  const search = hostSearch ?? ownSearch;
  const { names, onDropStale } = adapter;
  const heldId = selectedId && adapter.holds(selectedId) ? selectedId : null;

  const stale = !!selectedId && heldId === null;
  useEffect(() => {
    if (!stale) return;
    onSelect(null);
    onDropStale?.();
  }, [stale, onSelect, onDropStale]);

  const ownsSlot = !!adapter.ownsSlot;
  const matches = search.typed && !ownsSlot ? adapter.rows().filter((row) => matchesListSearch(row.name, search.term, names)) : null;

  const { onReorder } = adapter;
  const searchList = (rows: ListEditorRow[]) => {
    if (!rows.length) return <p className="text-helper text-muted-foreground p-2">No {adapter.noun} match &ldquo;{search.typed}&rdquo;.</p>;
    const drawn = rows.map((row) => {
      const props = {
        selected: selectedId === row.id,
        onSelect: () => onSelect(row.id),
        selectionLabel: `Select ${labelPlaceholders(row.name, names.placeholders)}`,
        icon: row.icon,
        label: <PlaceholderText text={row.name} placeholders={names.placeholders} />,
        labelClass: row.labelClass,
        actions: row.actions,
      };
      return onReorder && row.sortable
        ? <SortableEditorRow key={row.id} id={row.id} {...props} />
        : <EditorRow key={row.id} grip={false} {...props} />;
    });
    if (!onReorder) return <EditorRowList>{drawn}</EditorRowList>;
    const onDragEnd = ({ active, over }: DragEndEvent) => {
      if (over && active.id !== over.id) onReorder(String(active.id), String(over.id));
    };
    return (
      <EditorDndContext onDragEnd={onDragEnd}>
        <StableSortableContext items={rows.filter((row) => row.sortable)} strategy={verticalListSortingStrategy}>
          <EditorRowList>{drawn}</EditorRowList>
        </StableSortableContext>
      </EditorDndContext>
    );
  };

  return {
    search,
    toolbar: (className, extras) => (
      <ListSearchToolbar className={className} search={search} placeholder={adapter.placeholder} add={adapter.add} after={extras?.after} target={extras?.target}>
        {extras?.children}
      </ListSearchToolbar>
    ),
    list: ownsSlot ? adapter.tree : matches ? searchList(matches) : adapter.isEmpty ? adapter.emptyHint : adapter.tree ?? searchList(adapter.rows()),
    detail: adapter.detail(heldId),
    footer: heldId !== null ? adapter.footer?.(heldId) : undefined,
    fills: heldId !== null && !!adapter.fills?.(heldId),
    ownsSlot,
    showDetail: heldId !== null,
    onBack: () => onSelect(null),
  };
}
