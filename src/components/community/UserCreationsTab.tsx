import { useEffect, useMemo, useState } from "react";
import { BookOpen, Download, Earth, EyeOff, MessageSquare, User } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { CachedThumbnail } from "@/lib/useCachedThumbnail";
import { LikeButton } from "@/components/community/LikeButton";
import { CATALOG_KINDS, KIND_LABELS, type CatalogKind } from "@/lib/catalogKinds";
import UserService from "@/services/UserService";
import WorldStorageService from "@/services/WorldStorageService";
import type { ProfileCreation } from "@/types";
import { Tip } from "@/components/ui/tooltip";

/** The icon each kind wears, matching the Community Creations header so the three read the same way. */
const KIND_ICONS: Record<CatalogKind, typeof Earth> = {
  world: Earth,
  entity: User,
  dictionary: BookOpen,
};

interface UserCreationsTabProps {
  /** Whose work to list. Null fetches nothing. */
  userId: string | null;
  /** Their name, for the empty line — a profile that says "they" about somebody named is colder. */
  username: string | null;
  /** Opens a listing in Community Creations. Absent leaves the rows as plain text. */
  onOpenListing?: (listing: { id: string; kind: string }) => void;
}

/**
 * What somebody has published.
 *
 * Fetched as one list of every kind and split here: three requests would be three round trips to draw the
 * same rows, and the counts on the filter need the whole set regardless.
 */
export function UserCreationsTab({ userId, username, onOpenListing }: UserCreationsTabProps) {
  const [creations, setCreations] = useState<ProfileCreation[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [kind, setKind] = useState<CatalogKind>('world');

  useEffect(() => {
    if (!userId) return;

    let cancelled = false;
    setCreations([]);
    setError(null);
    setIsLoading(true);

    UserService.fetchCreations(userId)
      .then((rows) => {
        if (cancelled) return;

        setCreations(rows);
        // Opened on something they actually make: defaulting to worlds showed an empty list to anyone
        // whose account is all entities, with the reason two clicks away.
        setKind(rows[0]?.kind ?? 'world');
      })
      .catch((e: Error) => { if (!cancelled) setError(e.message); })
      .finally(() => { if (!cancelled) setIsLoading(false); });

    return () => { cancelled = true; };
  }, [userId]);

  const counts = useMemo(() => {
    const tally = { world: 0, entity: 0, dictionary: 0 } satisfies Record<CatalogKind, number>;
    for (const row of creations) tally[row.kind] += 1;

    return tally;
  }, [creations]);

  const shown = useMemo(() => creations.filter((row) => row.kind === kind), [creations, kind]);

  if (isLoading) {
    return (
      <div className="space-y-2 py-2">
        <Skeleton className="h-14 w-full" />
        <Skeleton className="h-14 w-full" />
      </div>
    );
  }

  if (error) {
    return <p className="py-6 text-center text-label text-destructive">{error}</p>;
  }

  // Said once for the whole account rather than per kind, so somebody who has published nothing isn't
  // asked to click through three empty filters to find that out.
  if (creations.length === 0) {
    return (
      <p className="py-6 text-center text-helper text-muted-foreground">
        {username || 'They'} hasn&apos;t published anything yet.
      </p>
    );
  }

  return (
    <div className="space-y-2 py-2 min-w-0">
      {/* Centered from out here: the group itself is an inline-flex, so it sits at its own width and has
          no free space of its own to center anything in. */}
      <div className="flex justify-center">
        <ToggleGroup
          type="single"
          value={kind}
          // A single ToggleGroup clears its value when the active item is clicked again; one kind is always
          // shown, so an empty result is ignored rather than stored.
          onValueChange={(v) => { if (v) setKind(v as CatalogKind); }}
        >
          {CATALOG_KINDS.map((k) => {
            const Icon = KIND_ICONS[k];

            return (
              // The count is the visible content, so the aria-label keeps it and the tip only names the kind.
              <Tip key={k} tip={KIND_LABELS[k].many} labelsChild={false}>
                <ToggleGroupItem
                  value={k}
                  // Kept in place rather than dropped when empty: a filter row that changes shape per person
                  // moves the kind you wanted under the cursor of the one you didn't.
                  disabled={counts[k] === 0}
                  className="gap-1.5"
                  aria-label={`${KIND_LABELS[k].many} (${counts[k]})`}
                >
                  <Icon className="h-4 w-4" />
                  <span className="text-meta tabular-nums">{counts[k]}</span>
                </ToggleGroupItem>
              </Tip>
            );
          })}
        </ToggleGroup>
      </div>

      {/* Capped rather than grown: the dialog is a popup, and a prolific author would otherwise stretch it
          to the height of the window every time somebody clicked their name. */}
      <ScrollArea className="h-[15.5rem]">
        {/* A column under the filter above it rather than edge-to-edge: the rows are short, and letting
            them run the full width of the dialog left the counts stranded away from the names. */}
        {/* The matching half of the scroll viewport's own right-hand scrollbar gutter, which would
            otherwise leave this column sitting left of the filter above it. */}
        <ul className="mx-auto w-full max-w-[22rem] space-y-2 pl-[11px]">
          {shown.map((item) => (
            <li key={item.id} className="flex items-center gap-2 rounded-md border p-2 min-w-0">
              <div className="h-10 w-10 shrink-0 overflow-hidden rounded bg-muted">
                {item.thumbnailFile && (
                  <CachedThumbnail
                    file={item.thumbnailFile}
                    url={`${WorldStorageService.API_URL}/thumbnails/${item.thumbnailFile}`}
                    updatedAt={item.updatedAt}
                    alt={item.name}
                    className="h-full w-full object-cover"
                  />
                )}
              </div>

              <div className="min-w-0 flex-1 text-left">
                {onOpenListing ? (
                  <button
                    type="button"
                    onClick={() => onOpenListing({ id: item.id, kind: item.kind })}
                    className="block w-full truncate text-left text-label font-medium underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring rounded-sm"
                    aria-label={`Open ${item.name} in Community Creations`}
                  >
                    {item.name}
                  </button>
                ) : (
                  <span className="block truncate text-label font-medium">{item.name}</span>
                )}

                <p className="flex items-center gap-3 text-meta text-muted-foreground">
                  <LikeButton likes={item.likes} />
                  <span className="inline-flex items-center gap-1">
                    <Download className="h-3 w-3" aria-hidden />
                    <span className="tabular-nums">{item.downloads}</span>
                    <span className="sr-only">downloads</span>
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <MessageSquare className="h-3 w-3" aria-hidden />
                    <span className="tabular-nums">{item.commentCount}</span>
                    <span className="sr-only">comments</span>
                  </span>
                  {/* Only ever reaches its own author or the staff — everybody else isn't shown the row. */}
                  {item.quarantined && (
                    <span className="inline-flex items-center gap-1 text-destructive">
                      <EyeOff className="h-3 w-3" aria-hidden />
                      Hidden
                    </span>
                  )}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </ScrollArea>
    </div>
  );
}
