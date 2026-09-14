import AddFromLibraryModal, { type LibraryPick } from './AddFromLibraryModal';
import type { LibraryKind } from '@/lib/librarySources';

const COPY = {
  entity: {
    description: 'Select the library entity this copy follows. The copy is overwritten with that entity’s content.',
    empty: 'Your library has no entities. Download or import the new version, then select Replace from Library again.',
  },
  dictionary: {
    description: 'Select the library dictionary this copy follows. The copy is overwritten with that dictionary’s content.',
    empty: 'Your library has no dictionaries. Download or import the new version, then select Replace from Library again.',
  },
} as const;

/**
 * Point a copy whose source is gone at a library item instead.
 *
 * This is the way back from a source the author republished: a republished source is a new listing with a
 * new identity, so nothing reconnects on its own. The copy takes the picked item's content and follows it.
 */
const ReplaceSourceModal = ({ open, onOpenChange, kind, name, onReplace }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  kind: LibraryKind;
  /** The copy being repaired, named in the title so the picker says what it is for. */
  name: string;
  onReplace: (pick: LibraryPick) => void;
}) => (
  <AddFromLibraryModal
    open={open}
    onOpenChange={onOpenChange}
    kind={kind}
    title={`Replace ${name}`}
    description={COPY[kind].description}
    emptyMessage={COPY[kind].empty}
    confirmLabel="Replace"
    single
    alwaysLink
    onConfirm={(picks) => { if (picks[0]) onReplace(picks[0]); }}
  />
);

export default ReplaceSourceModal;
