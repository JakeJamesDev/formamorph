import AddFromLibraryModal, { type LibraryPick } from './AddFromLibraryModal';
import type { LibraryKind } from '@/lib/librarySources';

const COPY = {
  entity: {
    title: 'Link to Library Item',
    description: 'Choose the library entity this one follows. Nothing in this world is overwritten.',
    empty: 'No saved entities yet. Save one to your library first.',
  },
  dictionary: {
    title: 'Link to Library Item',
    description: 'Choose the library dictionary this one follows. Nothing in this world is overwritten.',
    empty: 'No saved dictionaries yet. Save one to your library first.',
  },
} as const;

/**
 * Reconnect an independent copy to a library item it already matches, or to one it has drifted from.
 *
 * The picker chooses a source; it never brings content across. A copy whose content still matches becomes
 * Linked, and one that differs becomes a Local replacement, so the author keeps what this world holds.
 */
const LinkToLibraryModal = ({ open, onOpenChange, kind, onLink }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  kind: LibraryKind;
  onLink: (pick: LibraryPick) => void;
}) => (
  <AddFromLibraryModal
    open={open}
    onOpenChange={onOpenChange}
    kind={kind}
    title={COPY[kind].title}
    description={COPY[kind].description}
    emptyMessage={COPY[kind].empty}
    confirmLabel="Link"
    single
    alwaysLink
    onConfirm={(picks) => { if (picks[0]) onLink(picks[0]); }}
  />
);

export default LinkToLibraryModal;
