import { useMemo, useState, type ReactNode } from 'react';
import { ListEditor } from '@/components/ListEditor';
import { usePlaceholderStore } from '@/contexts/PlaceholderStoreContext';
import { usePlacementLetters } from '@/contexts/PlacementLettersContext';
import type { PlaceholderRowNode } from '@/lib/placeholderScopes';
import { placeholderRows } from '@/lib/placeholderTree';
import type { Placeholder } from '@/types';
import PlaceholderList from './PlaceholderList';
import { usePlaceholderDetail } from './PlaceholderDetail';
import { usePlaceholderListAdapter } from './usePlaceholderListAdapter';
import { usePlaceholderRowActions } from './usePlaceholderRowActions';

/**
 * A library item's placeholders on the List Editor, side by side: its tree, a flat search over its rows, and
 * the detail router's pane. Reads the modal's own store. `carriedBlueprints` are an entity card's blueprints,
 * which its copies open over read-only; a book passes none.
 */
const LibraryPlaceholdersEditor = ({ ownerName, carriedBlueprints, detailHeader }: {
  /** The item's name, which a copy reads as its owner's. */
  ownerName: string;
  carriedBlueprints?: readonly Placeholder[];
  detailHeader?: ReactNode;
}) => {
  const { placeholders } = usePlaceholderStore();
  const letters = usePlacementLetters();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { detail, footer } = usePlaceholderDetail({ selectedId, onSelect: setSelectedId, ownerName, carriedBlueprints });
  const { rowRules, dialog } = usePlaceholderRowActions({ selectedId, onSelect: setSelectedId });
  const nodes = useMemo(
    (): PlaceholderRowNode[] => placeholderRows(placeholders, placeholders).map((row) => ({ ...row, kind: 'placeholder', home: { kind: 'world' } })),
    [placeholders],
  );
  const adapter = usePlaceholderListAdapter({
    nodes,
    lists: { placeholders },
    rowRules,
    names: { placeholders, letters },
    tree: <PlaceholderList selectedId={selectedId} onSelect={setSelectedId} />,
    detail,
    footer,
    addLabel: 'Add Placeholder',
    onSelect: setSelectedId,
  });
  return (
    <>
      <ListEditor adapter={adapter} layout="sideBySide" selectedId={selectedId} onSelect={setSelectedId} backLabel="Placeholders" detailHeader={detailHeader} />
      {dialog}
    </>
  );
};

export default LibraryPlaceholdersEditor;
