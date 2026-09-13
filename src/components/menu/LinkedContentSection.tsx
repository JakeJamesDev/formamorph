import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { OptionSwitcher } from '@/components/SettingsRows';
import { KIND_LABELS } from '@/lib/catalogKinds';
import { LISTING_OPTIONS, type LinkedContentRow } from '@/lib/publishLinks';
import { Link2 } from 'lucide-react';

/** What each row says about its source, beyond the kind. */
const STATE_LINES: Record<LinkedContentRow['state'], string> = {
  published: 'Already published.',
  unpublished: 'Will publish with this world.',
  unavailable: 'This source is not in your library. It cannot be required.',
};

/**
 * The world's Linked Content review: one row per source its content follows, with the author's choice of
 * what this publish declares as required.
 *
 * A source with no listing yet gets its own Public/Unlisted choice, because publishing the world is what
 * creates that listing. A source already published only ever gets declared, whoever owns it.
 */
export function LinkedContentSection({ rows, onChange, disabled }: {
  rows: LinkedContentRow[];
  onChange: (rows: LinkedContentRow[]) => void;
  disabled?: boolean;
}) {
  if (rows.length === 0) return null;

  const update = (libraryId: string, patch: Partial<LinkedContentRow>) => {
    onChange(rows.map((row) => (row.libraryId === libraryId ? { ...row, ...patch } : row)));
  };

  return (
    <div className="mt-4 rounded-md border p-3 space-y-3">
      <div className="flex items-start gap-2">
        <Link2 className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
        <div className="min-w-0">
          <p className="text-label font-medium">Linked Content</p>
          <p className="text-meta text-muted-foreground">
            A player who downloads this world also downloads and links each required source. Content you
            do not require is included in the world with no source to follow.
          </p>
        </div>
      </div>

      {/* The checkbox caption, said once for the list rather than on every row: each box carries the
          row's name, so repeating the caption per row would bury it. */}
      <p className="text-meta font-medium">Include as required</p>

      <ul className="space-y-3">
        {rows.map((row) => {
          const boxId = `linked-${row.libraryId}`;
          return (
            <li key={row.libraryId} className="space-y-2">
              <div className="flex items-start gap-2">
                {/* The `1lh` sleeve centers the box on the first line of the label beside it. */}
                <span className="flex h-[1lh] shrink-0 items-center">
                  <Checkbox
                    id={boxId}
                    checked={row.required}
                    disabled={disabled || row.state === 'unavailable'}
                    onCheckedChange={(checked) => update(row.libraryId, { required: checked === true })}
                    aria-label={`Include ${row.name} as required`}
                  />
                </span>
                <div className="min-w-0">
                  <Label htmlFor={boxId} className="block truncate">{row.name}</Label>
                  <p className="text-meta text-muted-foreground">
                    {KIND_LABELS[row.kind].one} · {STATE_LINES[row.state]}
                  </p>
                </div>
              </div>

              {/* Only where this publish creates the listing. An existing listing keeps the visibility it
                  already has, and this publish never touches it. */}
              {row.required && row.state === 'unpublished' && (
                <div className="pl-6 space-y-1">
                  <OptionSwitcher
                    value={row.visibility}
                    onChange={(visibility) => update(row.libraryId, { visibility })}
                    options={LISTING_OPTIONS}
                    ariaLabel={`Listing for ${row.name}`}
                  />
                  <p className="text-meta text-muted-foreground">
                    {row.visibility === 'unlisted'
                      ? 'Unlisted keeps this out of Community Creations. It still downloads with this world.'
                      : 'Public lists this in Community Creations on its own.'}
                  </p>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
