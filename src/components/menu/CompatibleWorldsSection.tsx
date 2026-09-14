import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { OptionSwitcher } from '@/components/SettingsRows';
import type { CompatibleWorldRow, ReviewState } from '@/lib/compatibleWorlds';
import { LISTING_OPTIONS, type ListingVisibility } from '@/lib/publishLinks';
import { Globe } from 'lucide-react';

/** The world author's answer, in the words the add-on review uses. */
const REVIEW_LABELS: Record<ReviewState, string> = {
  unreviewed: 'Unreviewed',
  approved: 'Approved',
  declined: 'Declined',
};

/**
 * The component's Listing choice and its Compatible Worlds review.
 *
 * The worlds come from the author's own linked copies, so there is no world to search for: a world is
 * offered only where they already use the component in it and that world has a listing. An unlisted
 * component offers nothing, because players reach it only inside a world that requires it.
 */
export function CompatibleWorldsSection({ visibility, onVisibilityChange, rows, onRowsChange, disabled, noun }: {
  visibility: ListingVisibility;
  onVisibilityChange: (visibility: ListingVisibility) => void;
  rows: CompatibleWorldRow[];
  onRowsChange: (rows: CompatibleWorldRow[]) => void;
  disabled?: boolean;
  /** The kind's own noun, lowercase, so each sentence names what is being published. */
  noun: string;
}) {
  const unlisted = visibility === 'unlisted';

  const toggle = (listingId: string, offered: boolean) => {
    onRowsChange(rows.map((row) => (row.listingId === listingId ? { ...row, offered } : row)));
  };

  return (
    <div className="mt-4 rounded-md border p-3 space-y-3">
      <div className="flex items-start gap-2">
        <Globe className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
        <div className="min-w-0 w-full space-y-2">
          <p className="text-label font-medium">Listing</p>
          <OptionSwitcher
            value={visibility}
            onChange={onVisibilityChange}
            options={LISTING_OPTIONS}
            ariaLabel="Listing"
          />
          <p className="text-meta text-muted-foreground">
            {unlisted
              ? `Unlisted hides this ${noun} from Community Creations. Players receive it only inside a world that requires it.`
              : `Public lists this ${noun} in Community Creations.`}
          </p>
        </div>
      </div>

      <div className="space-y-2 border-t pt-3">
        <p className="text-label font-medium">Compatible Worlds</p>
        {/* One line, not two: the empty state already says what the list would have held. */}
        <p className="text-meta text-muted-foreground">
          {unlisted
            ? `An unlisted ${noun} cannot be an add-on.`
            : rows.length === 0
              ? `No world has a linked copy of this ${noun} and a listing of its own.`
              : `Each world here has a linked copy of this ${noun} and its own listing. The world's author reviews each offer.`}
        </p>

        {/* The checkbox caption, said once for the list rather than on every row. Hidden with the list
            itself, and while an unlisted listing offers nothing. */}
        {!unlisted && rows.length > 0 && (
          <p className="text-meta font-medium text-foreground">Offer as add-on</p>
        )}

        {rows.length > 0 && (
          <ul className="space-y-2">
            {rows.map((row) => {
              const boxId = `addon-${row.listingId}`;
              return (
                <li key={row.listingId} className="flex items-start gap-2">
                  <span className="flex h-[1lh] shrink-0 items-center">
                    <Checkbox
                      id={boxId}
                      checked={row.offered}
                      disabled={disabled || unlisted || !row.linked}
                      onCheckedChange={(checked) => toggle(row.listingId, checked === true)}
                      aria-label={`Offer as add-on for ${row.name}`}
                    />
                  </span>
                  <div className="min-w-0">
                    <Label htmlFor={boxId} className="block truncate">{row.name}</Label>
                    <p className="text-meta text-muted-foreground">
                      {row.linked
                        ? (row.reviewState ? REVIEW_LABELS[row.reviewState] : 'Not offered yet.')
                        : 'Pending removal. This world no longer has a linked copy.'}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
