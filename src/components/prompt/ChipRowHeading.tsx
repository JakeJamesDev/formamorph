import { usePlaceholderStoreOptional } from '@/contexts/PlaceholderStoreContext';
import type { ChipRow } from '@/lib/chipVocabulary';
import type { Placeholder } from '@/types';
import OwnerHeading from './OwnerHeading';

const NO_PLACEHOLDERS: readonly Placeholder[] = [];

/**
 * The heading a sectioned chip list draws where a section opens — an owner's name carrying its kind's icon,
 * or a folder's path as quiet text. One component so the palette bar, the `{` typeahead and the drill
 * picker all head their sections the same way, off the same vocabulary rows.
 *
 * Renders nothing for a loose row, so a caller can hand it every row it draws.
 */
const ChipRowHeading = ({ row, placeholders }: {
  row: Pick<ChipRow, 'heading' | 'headingKind' | 'ownerKind' | 'ownerName'>;
  /** Everything a chip in an owner's name could point at. Defaults to the bound store's list: a store that
   *  knows who owns what carries the world's whole combined list, so an owner heading always resolves. */
  placeholders?: readonly Placeholder[];
}) => {
  const store = usePlaceholderStoreOptional();
  if (!row.heading) return null;
  if (row.headingKind === 'owner' && row.ownerKind) {
    return (
      <OwnerHeading
        kind={row.ownerKind}
        name={row.ownerName ?? row.heading}
        placeholders={placeholders ?? store?.placeholders ?? NO_PLACEHOLDERS}
      />
    );
  }
  return <span className="text-meta text-muted-foreground">{row.heading}</span>;
};

export default ChipRowHeading;
