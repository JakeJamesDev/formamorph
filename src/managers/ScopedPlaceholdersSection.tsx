import { useMemo } from 'react';
import { ListEditor } from '@/components/ListEditor';
import { PlaceholderStoreProvider, usePlaceholderStore, usePlaceholderStoreOptional, type PlaceholderStore } from '@/contexts/PlaceholderStoreContext';
import { useEditorMode } from '@/lib/editorMode';
import { OWNER_NAME_SEPARATOR, labelPlaceholders } from '@/lib/placementLetters';
import { useGameDataOptional } from '@/contexts/GameDataContext';
import { placeholderList, placeholderOwnerRef, type PlaceholderHome } from '@/lib/placeholderHomes';
import { ownerPlaceholderNodes } from '@/lib/placeholderScopes';
import PlaceholderList from './PlaceholderList';
import { usePlaceholderDetail } from './PlaceholderDetail';
import { usePlaceholderListAdapter } from './usePlaceholderListAdapter';
import { usePlaceholderRowActions } from './usePlaceholderRowActions';

/** The world store narrowed to one owner's list: the same reads and writes, a list that draws only that
 *  owner's rows, and a create that lands there. */
const scopedStore = (store: PlaceholderStore, scope: PlaceholderHome): PlaceholderStore =>
  ({ ...store, scope, addPlaceholder: (p) => store.addPlaceholder(p, scope) });

interface ScopedSelection {
  /** The open row, held by the host so a tab switch keeps it; the editor clears one the owner doesn't hold. */
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  /** Opens a world placeholder where the world's list is edited: a copy's Edit Blueprint. */
  onOpenWorldPlaceholder: (id: string) => void;
}

/** One owner's placeholders on the List Editor, stacked: its tree, a flat search over its rows, and the
 *  detail router's pane over the list. Reads the scoped store. */
const ScopedPlaceholdersEditor = ({ home, selectedId, onSelect, onOpenWorldPlaceholder }: ScopedSelection & { home: PlaceholderHome & { ownerId: string } }) => {
  const { placeholders, lists, owners } = usePlaceholderStore();
  const letters = useGameDataOptional()?.placementLetters;
  const { detail, footer } = usePlaceholderDetail({ selectedId, onSelect: onOpenWorldPlaceholder });
  // A duplicate lands in its source's list, so a shared row's duplicate opens on the top-level tab (Q39).
  const openDuplicate = (rowId: string, sourceId: string) => {
    if (lists && placeholderList(lists, home).some((p) => p.id === sourceId)) onSelect(rowId);
    else onOpenWorldPlaceholder(rowId);
  };
  const { rowRules, dialog } = usePlaceholderRowActions({ selectedId, onSelect, openDuplicate });
  const nodes = useMemo(() => (lists ? ownerPlaceholderNodes(lists, home) : []), [lists, home]);
  const ownerName = lists ? labelPlaceholders(placeholderOwnerRef(lists, home.ownerId)?.name ?? '', placeholders) : '';
  const adapter = usePlaceholderListAdapter({
    nodes,
    lists: lists ?? {},
    rowRules,
    names: { placeholders, letters, owners },
    tree: <PlaceholderList selectedId={selectedId} onSelect={onSelect} openDuplicate={openDuplicate} />,
    detail,
    footer,
    addLabel: `Add Placeholder to ${ownerName}`,
    onSelect,
  });
  if (!lists) return null;
  return (
    <>
      <ListEditor adapter={adapter} layout="stacked" selectedId={selectedId} onSelect={onSelect} backLabel="Placeholders" />
      {dialog}
    </>
  );
};

/**
 * The Placeholders tab of an entity or dictionary panel: the same editor as the top-level tab, bound to this
 * one owner's list. A placeholder made here belongs to the owner and reads `Owner › Name` everywhere else in
 * the world. Advanced mode only, like the tab itself. It binds only to a store that carries the world's
 * lists, so a library modal's own store renders nothing here.
 */
const ScopedPlaceholdersSection = ({ kind, ownerId, ...selection }: ScopedSelection & {
  kind: 'entity' | 'dictionary';
  ownerId: string;
}) => {
  const { advanced } = useEditorMode();
  const store = usePlaceholderStoreOptional();
  const home = useMemo(() => ({ kind, ownerId }), [kind, ownerId]);
  const scoped = useMemo(() => (store?.lists ? scopedStore(store, home) : null), [store, home]);
  if (!advanced || !scoped) return null;
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      <p className="text-helper text-muted-foreground">
        Placeholders of this {kind}&apos;s own. Elsewhere in the world they read as {'{'}Name{OWNER_NAME_SEPARATOR}Placeholder{'}'}.
      </p>
      <PlaceholderStoreProvider value={scoped}>
        <ScopedPlaceholdersEditor home={home} {...selection} />
      </PlaceholderStoreProvider>
    </div>
  );
};

export default ScopedPlaceholdersSection;
