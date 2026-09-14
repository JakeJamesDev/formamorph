import { Globe } from 'lucide-react';
import { cn } from '@/lib/utils';
import { KIND_LABELS, type CatalogKind } from '@/lib/catalogKinds';
import {
  ASSOCIATION_NOTES, NOT_RECOMMENDED,
  hasAssociations, type AssociationGroups, type AssociationRow,
} from '@/lib/listingAssociations';
import { Meta } from '@/components/ui/typography';

interface ListingCompatibleWorldsProps {
  groups: AssociationGroups;
  /** What this listing is, so the note names it in the reader's own word for it. */
  kind: CatalogKind;
  /** Opens the world a row names. Absent leaves every row a plain name. */
  onOpenWorld?: (worldId: string) => void;
}

function WorldRow({ row, onOpenWorld }: { row: AssociationRow; onOpenWorld?: (worldId: string) => void }) {
  return (
    <li className="min-w-0">
      {onOpenWorld ? (
        <button
          type="button"
          className="block w-full truncate text-left text-label text-sky-600 hover:underline dark:text-sky-400"
          aria-label={`Open ${row.name}`}
          onClick={() => onOpenWorld(row.id)}
        >
          {row.name}
        </button>
      ) : (
        <p className="truncate text-label">{row.name}</p>
      )}
    </li>
  );
}

function WorldGroup({ heading, note, rows, onOpenWorld, className }: {
  heading: string;
  note: string;
  rows: AssociationRow[];
  onOpenWorld?: (worldId: string) => void;
  className?: string;
}) {
  if (!rows.length) return null;
  return (
    <div className={cn('mt-3', className)}>
      <h4 className="text-helper font-semibold text-muted-foreground">{heading}</h4>
      <Meta as="p">{note}</Meta>
      <ul className="mt-1 space-y-1">
        {rows.map((row) => (
          <WorldRow key={row.id} row={row} {...(onOpenWorld ? { onOpenWorld } : {})} />
        ))}
      </ul>
    </div>
  );
}

/**
 * Where a published component fits, as a player reading its listing sees it.
 *
 * The three groups are separate so an endorsement is never read as a claim anybody can make. A declined
 * group is drawn only for the readers the server sends one to — the component's author and staff — and
 * carries the world author's answer in words rather than as a state name.
 */
export function ListingCompatibleWorlds({ groups, kind, onOpenWorld }: ListingCompatibleWorldsProps) {
  if (!hasAssociations(groups)) return null;

  // Lowercased: the labels are Title Case as controls, and these two sit inside a sentence.
  const noun = KIND_LABELS[kind].one.toLowerCase();

  return (
    <div className="col-span-2 rounded-md border p-3">
      <div className="flex items-start gap-2">
        <Globe className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
        <div className="min-w-0">
          <h3 className="text-label font-medium">Compatible Worlds</h3>
          <Meta as="p">
            Download installs this {noun} only. Each world below is a separate download.
          </Meta>
        </div>
      </div>

      <WorldGroup
        heading={`Approved (${groups.approved.length})`}
        note={ASSOCIATION_NOTES.approved}
        rows={groups.approved}
        {...(onOpenWorld ? { onOpenWorld } : {})}
      />
      <WorldGroup
        heading={`Unreviewed (${groups.community.length})`}
        note={ASSOCIATION_NOTES.community}
        rows={groups.community}
        {...(onOpenWorld ? { onOpenWorld } : {})}
      />
      <WorldGroup
        heading={NOT_RECOMMENDED}
        note={ASSOCIATION_NOTES.declined}
        rows={groups.declined}
        {...(onOpenWorld ? { onOpenWorld } : {})}
      />
    </div>
  );
}
