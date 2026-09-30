import { Fragment, useEffect, useMemo, useState, type ReactNode } from "react";
import { Download, EyeOff, MessageSquare } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { CachedThumbnail } from "@/lib/useCachedThumbnail";
import { LikeButton } from "@/components/community/LikeButton";
import { CATALOG_KINDS, KIND_ICONS, KIND_LABELS, showsMorphArt, type CatalogKind } from "@/lib/catalogKinds";
import { EntityPlaceholderArt } from "@/components/EntityPlaceholderArt";
import UserService from "@/services/UserService";
import { API_BASE_URL } from "@/lib/apiBase";
import type { ProfileCreation } from "@/types";
import { Tip } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { thumbAspectFor, thumbFit } from "@/lib/thumbAspect";
import { parseServerDate } from "@/lib/serverDate";

/** Most recently updated first, so an author's active work leads. */
function byUpdatedDesc(a: ProfileCreation, b: ProfileCreation): number {
  return (parseServerDate(b.updatedAt)?.getTime() ?? 0) - (parseServerDate(a.updatedAt)?.getTime() ?? 0);
}

/** The list's own box: a fixed scroller in a dialog, nothing at all on a page. */
function ListFrame({ layout, children }: { layout: 'dialog' | 'page'; children: ReactNode }) {
  if (layout === 'page') return <>{children}</>;

  return <ScrollArea className="h-[15.5rem]">{children}</ScrollArea>;
}

interface UserCreationsTabProps {
  /** Whose work to list. Null fetches nothing. */
  userId: string | null;
  /** Their name, for the empty line — a profile that says "they" about somebody named is colder. */
  username: string | null;
  /** Opens a listing in Community Creations. Absent leaves the rows as plain text. */
  onOpenListing?: (listing: { id: string; kind: CatalogKind }) => void;
  /** A public destination for a listing. Takes precedence over the in-app opener. */
  listingHref?: (listing: { id: string; kind: CatalogKind }) => string;
  /**
   * How much room the list has.
   *
   * In a dialog it is capped and scrolls, so one prolific author cannot stretch a popup to the height of
   * the window. On a page the list is what the reader came for, so it runs at its natural length.
   */
  layout?: 'dialog' | 'page';
}

/**
 * What somebody has published.
 *
 * Fetched as one list of every kind and split here: three requests would be three round trips to draw the
 * same rows, and the counts on the filter need the whole set regardless.
 */
export function UserCreationsTab({ userId, username, onOpenListing, listingHref, layout = 'dialog' }: UserCreationsTabProps) {
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

        const sorted = [...rows].sort(byUpdatedDesc);
        setCreations(sorted);
        // Opened on something they actually make: defaulting to worlds showed an empty list to anyone
        // whose account is all entities, with the reason two clicks away.
        setKind(sorted[0]?.kind ?? 'world');
      })
      .catch((e: Error) => { if (!cancelled) setError(e.message); })
      .finally(() => { if (!cancelled) setIsLoading(false); });

    return () => { cancelled = true; };
  }, [userId]);

  const counts = useMemo(() => {
    const tally = { world: 0, entity: 0, dictionary: 0, model: 0, prompt: 0 } satisfies Record<CatalogKind, number>;
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
              <Fragment key={k}>
                {/* Prompts sit apart from the content kinds, as in Community Creations. */}
                {k === 'prompt' && (
                  <span role="separator" aria-orientation="vertical" className="mx-1 h-5 w-hairline shrink-0 bg-border" />
                )}
                {/* The count is the visible content, so the aria-label keeps it and the tip only names the kind. */}
                <Tip tip={KIND_LABELS[k].many} labelsChild={false}>
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
              </Fragment>
            );
          })}
        </ToggleGroup>
      </div>

      {/* Capped rather than grown in a dialog: it is a popup, and a prolific author would otherwise
          stretch it to the height of the window every time somebody clicked their name. A page has the
          room, so it lets the list run and scrolls with everything else. */}
      <ListFrame layout={layout}>
        {/* Two columns where the width allows. The dialog's left pad matches the scroll viewport's
            right-hand scrollbar gutter, and belongs only where that gutter is. */}
        <ul className={cn(
          'grid w-full grid-cols-1 gap-2 md:grid-cols-2',
          layout === 'dialog' && 'pl-[11px]'
        )}>
          {shown.map((item) => (
            <li key={item.id} className="flex items-center gap-2 rounded-md border p-2 min-w-0">
              <div className="h-10 w-10 shrink-0 overflow-hidden rounded bg-muted">
                {showsMorphArt(item) ? (
                  <EntityPlaceholderArt id={item.id} name={item.name} />
                ) : item.thumbnailFile && (
                  <CachedThumbnail
                    file={item.thumbnailFile}
                    url={`${API_BASE_URL}/thumbnails/${item.thumbnailFile}`}
                    updatedAt={item.updatedAt}
                    alt={item.name}
                    className={cn('h-full w-full', thumbFit(thumbAspectFor(item.kind)))}
                    aspect={thumbAspectFor(item.kind)}
                  />
                )}
              </div>

              <div className="min-w-0 flex-1 text-left">
                {listingHref ? (
                  <a
                    href={listingHref({ id: item.id, kind: item.kind })}
                    className="block w-full truncate text-left text-label font-medium underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring rounded-sm"
                  >
                    {item.name}
                  </a>
                ) : onOpenListing ? (
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
                  <LikeButton count={item.likes} />
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
      </ListFrame>
    </div>
  );
}
