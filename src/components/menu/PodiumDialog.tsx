import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "react-toastify";
import { Heart, Loader2, Trophy, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Meta } from "@/components/ui/typography";
import { cn, listNames } from "@/lib/utils";
import { CachedThumbnail } from "@/lib/useCachedThumbnail";
import {
  UNKNOWN_PUBLISH_TIME, entriesOf, publishedAtOf, standingsOrder, tiedLikeCounts,
} from "@/lib/contests";
import { entryBlockReason } from "@/lib/adminEvents";
import { placementsOf } from "@/lib/serverEvents";
import {
  canToggleTie, clearRow, cyclePodium, orderTiedRows, placementsFrom, podiumLines, podiumPlacesOf,
  rowsFromPlacements, toggleTie,
} from "@/lib/podiumRanking";
import type { PodiumRow } from "@/lib/podiumRanking";
import { BROADCAST_PLACE_LABELS, PLACE_COLORS, PLACE_LABELS, PLACE_PLATES } from "@/lib/placeLabels";
import { isQuarantined } from "@/lib/quarantine";
import AuthService from "@/services/AuthService";
import EventService from "@/services/EventService";
import WorldStorageService from "@/services/WorldStorageService";
import type { WorldRecord } from "@/components/WorldDetails";
import type { ServerEvent } from "@/types";
import { THUMB_FRAME, thumbFit } from "@/lib/thumbAspect";

/**
 * The whole catalog in one request, which is how the community browser reads it too.
 *
 * Entries are filtered out of the catalog rather than asked for by contest, so a short page would hide
 * whichever entries fell past it — and an entry the judge cannot see is one that cannot place.
 */
const ENTRY_PAGE = 1000;

/**
 * What a drafted world reads as when the grid has no entry for it.
 *
 * A published placement whose listing was deleted seeds a row that no catalog entry answers. Saving over
 * one is refused, so this is what a judge reads while they look at why.
 */
const UNKNOWN_WORLD = 'Unknown world';

interface PodiumDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contest: ServerEvent;
  /** Called after the podium reaches the server, so the list behind can pick the change up. */
  onSaved?: () => void;
}

/** One entry, reduced to what a judgment is made on. */
interface Entry {
  id: string;
  name: string;
  authorName: string;
  authorId: string | null;
  likes: number;
  /** When the listing was published, in milliseconds. The tiebreaker on both orders in this dialog. */
  publishedAt: number;
  /** Either the stored file the catalog caches by name, or an inline data URL. */
  thumbnailFile: string | null;
  thumbnail: string | null;
  updatedAt: string | undefined;
  /** Why this one cannot be given a place, or null. */
  blocked: string | null;
}

/**
 * The podium being staged: an ordered list of rows, each either taking its own step or sharing the one
 * above it.
 *
 * A list rather than a place-to-world map, which is what makes the ranking rule structural. There is no
 * way to express a silver with no gold, or a 1, 1, 2, so no click, clear or toggle can stage a podium the
 * server would then refuse — the rule is held by the shape instead of by a check somebody has to
 * remember to run. `podiumRanking` derives the places from it.
 */
type Draft = PodiumRow[];

/**
 * Assemble a contest's podium and publish it.
 *
 * Judging is a browsing task, not an id-typing one, so the entries arrive as a grid of what they actually
 * are, and the three places are assigned by clicking through them. The two entries nobody may place — the
 * judge's own, and anything quarantined — stay in the grid wearing the reason: a judge who cannot find an
 * entry they remember will go looking for it, and the answer to "where did it go" is cheaper shown than
 * explained.
 *
 * Everything is staged here until Announce. There are no server-side drafts, so a half-assembled podium
 * lives only in this dialog and nothing partial can reach a player. Reopened over an announced podium the
 * dialog becomes an editor instead: the same staging, the same rules, and a save that corrects the record
 * without announcing anything.
 */
export function PodiumDialog({ open, onOpenChange, contest, onSaved }: PodiumDialogProps) {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState<Draft>([]);
  const [saving, setSaving] = useState(false);

  const contestId = contest.id;
  const announced = placementsOf(contest);
  const editing = Boolean(contest.resultsAnnouncedAt);

  // Places whose listing has since been deleted. The snapshot survives the deletion, but the id does
  // not — so there is nothing left to send back, and saving would replace the podium with only the
  // places that still have listings: the lost one's record gone, and everything under it promoted a
  // step. Refused rather than silently written, because the archive is the one thing a correction
  // must not cost.
  const lost = editing ? announced.filter((placement) => !placement.worldId) : [];

  // The staging effect below re-seeds when the published podium actually changes, not merely when the
  // list behind the dialog re-renders and hands down a fresh event object, which would throw away a
  // podium half assembled. So it watches a signature and reads the rows off a ref. The tie flags are in
  // the signature, and they are the places, so a correction that only shares a place re-seeds too.
  const publishedRows = useMemo(() => rowsFromPlacements(placementsOf(contest)), [contest]);
  const publishedSignature = publishedRows
    .map((row) => `${row.tiedWithAbove ? '=' : ''}${row.worldId}`).join(',');
  const seed = useRef(publishedRows);
  seed.current = publishedRows;

  useEffect(() => {
    if (!open) return;

    let current = true;
    setLoading(true);
    // Reopened over an announced podium, the staging starts from what is already published, ties and
    // all, so an edit that means to move one place does not silently drop the other two.
    setDraft(seed.current);

    const judgeId = String(AuthService.getCurrentUser()?.id ?? '') || null;

    WorldStorageService.fetchRemoteWorlds(1, ENTRY_PAGE)
      .then((result) => {
        if (!current) return;
        const catalog = (result.data ?? []) as WorldRecord[];
        setEntries(entriesOf(catalog, contestId).map((record) => {
          const authorId = record.author?.id === undefined || record.author?.id === null
            ? null
            : String(record.author.id);

          return {
            id: String(record._id || record.id),
            name: String(record.name || 'Untitled'),
            authorName: String(record.author?.username || 'Unknown'),
            authorId,
            likes: Number(record.likes ?? 0) || 0,
            publishedAt: publishedAtOf(record),
            thumbnailFile: typeof record.thumbnail_file === 'string' ? record.thumbnail_file : null,
            thumbnail: typeof record.thumbnail === 'string' && record.thumbnail ? record.thumbnail : null,
            updatedAt: typeof record.updated_at === 'string' ? record.updated_at : undefined,
            blocked: entryBlockReason({ authorId, quarantined: isQuarantined(record) }, judgeId),
          };
        }));
      })
      .catch((error) => {
        console.error('Failed to load contest entries:', error);
        if (current) setEntries([]);
      })
      .finally(() => { if (current) setLoading(false); });

    return () => { current = false; };
  }, [open, contestId, publishedSignature]);

  const byId = useMemo(() => new Map(entries.map((entry) => [entry.id, entry])), [entries]);

  // The standings, which is what a judgment is read off. Sorted neighbors say which entry leads but
  // not whether two are tied, so the entries that share a count are marked as well as ordered.
  const standings = useMemo(() => standingsOrder(entries), [entries]);
  const tiedCounts = useMemo(() => tiedLikeCounts(entries), [entries]);

  // A drafted world the grid has no entry for — a published placement whose listing was deleted — has
  // no stamp to sort on, so it goes last.
  const publishedAt = (worldId: string): number =>
    byId.get(worldId)?.publishedAt ?? UNKNOWN_PUBLISH_TIME;

  const places = podiumPlacesOf(draft);
  const podium = draft.map((row, index) => ({
    row, place: places[index], entry: byId.get(row.worldId) ?? null,
  }));

  /** How the broadcast will credit one world. A drafted world is normally in the grid it came from. */
  const credit = (worldId: string): string => {
    const entry = byId.get(worldId);
    return entry ? `${entry.name} by ${entry.authorName}` : UNKNOWN_WORLD;
  };

  // Every action re-sorts the worlds inside each shared place by publish time, which is the order the
  // server stores them in — so what a judge reads here is what the save writes.
  const stage = (next: (held: Draft) => Draft) =>
    setDraft((held) => orderTiedRows(next(held), publishedAt));

  const assign = (worldId: string) => stage((held) => cyclePodium(held, worldId));

  // Everything below closes up behind it, so clearing gold promotes silver rather than leaving a hole.
  const clear = (index: number) => stage((held) => clearRow(held, index));

  const tie = (index: number) => stage((held) => toggleTie(held, index));

  const handleSave = async () => {
    if (draft.length === 0 || lost.length > 0) return;

    const placements = placementsFrom(draft);

    setSaving(true);
    try {
      if (editing) {
        await EventService.editPlacements(contest.id, placements);
        toast.success('Podium updated');
      } else {
        await EventService.announceResults(contest.id, placements);
        toast.success(`Results announced for ${contest.title}`);
      }
      onSaved?.();
      onOpenChange(false);
    } catch (error) {
      toast.error((error as Error).message
        || (editing ? 'Failed to update the podium' : 'Failed to announce the results'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[880px] max-h-[90dvh] flex flex-col overflow-hidden">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Trophy className="h-4 w-4 text-gold" aria-hidden />
            {editing ? 'Edit Podium' : 'Announce Results'} — {contest.title}
          </DialogTitle>
          <DialogDescription>
            {entries.length} {entries.length === 1 ? 'entry' : 'entries'}, most likes first. A{' '}
            <strong>Tied</strong> badge marks entries that share a like count. Click an entry to place it,
            and again to step it down. Select a row&apos;s <strong>Tie With Above</strong> checkbox to share
            the place above it, and the places below follow. Your own entry and quarantined worlds
            can&apos;t be placed.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-y-auto space-y-4 py-2">
          {/* The podium as it stands, above the grid it is assembled from. One row per placed world
              rather than three fixed slots: a place is derived from the row's position and its tie
              flag, so any number of worlds can share one. */}
          <ol className="space-y-2" aria-label="Podium">
            {podium.length === 0 ? (
              <li className="rounded-lg border border-dashed bg-muted/30 px-3 py-4 text-center text-label text-muted-foreground">
                Click an entry to start the podium
              </li>
            ) : podium.map(({ row, place, entry }, index) => {
              const name = entry?.name ?? `row ${index + 1}`;
              // Breaking a tie can push the row past the last step, and there is no podium to stage it
              // on, so the checkbox is unavailable there and says why.
              const tieRefused = index > 0 && !canToggleTie(draft, index);

              return (
                <li
                  key={row.worldId}
                  className={cn('rounded-lg border px-3 py-2 min-w-0', PLACE_PLATES[place])}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Trophy className={cn('h-4 w-4 shrink-0', PLACE_COLORS[place])} aria-hidden />
                    <div className="min-w-0 flex-1">
                      <div className={cn('text-meta font-semibold', PLACE_COLORS[place])}>
                        {PLACE_LABELS[place]}
                      </div>
                      <div className="text-label truncate">
                        {entry ? entry.name : <span className="text-muted-foreground">{UNKNOWN_WORLD}</span>}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 shrink-0"
                      aria-label={`Clear ${name}`}
                      onClick={() => clear(index)}
                    >
                      <X className="h-3.5 w-3.5" aria-hidden />
                    </Button>
                  </div>

                  {index > 0 && (
                    <div className="mt-1.5 flex items-center gap-2 pl-6">
                      <Checkbox
                        id={`tie-${row.worldId}`}
                        checked={row.tiedWithAbove}
                        disabled={tieRefused}
                        aria-label={`Tie With Above: ${name}`}
                        onCheckedChange={() => tie(index)}
                      />
                      <label
                        htmlFor={`tie-${row.worldId}`}
                        className={cn('text-meta', tieRefused ? 'text-muted-foreground' : 'cursor-pointer')}
                      >
                        Tie With Above
                      </label>
                      {tieRefused && <Meta>The podium ends at 3rd place</Meta>}
                    </div>
                  )}
                </li>
              );
            })}
          </ol>

          {loading ? (
            <div className="flex items-center justify-center gap-2 py-12 text-label text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Loading entries…
            </div>
          ) : entries.length === 0 ? (
            <p className="py-12 text-center text-label text-muted-foreground">
              Nothing was entered into this contest.
            </p>
          ) : (
            <div
              role="group"
              aria-label="Entries"
              className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3"
            >
              {standings.map((entry) => {
                const staged = draft.findIndex((row) => row.worldId === entry.id);
                const place = staged === -1 ? null : places[staged];
                const tied = tiedCounts.has(entry.likes);

                return (
                  <button
                    key={entry.id}
                    type="button"
                    aria-pressed={place !== null}
                    disabled={Boolean(entry.blocked)}
                    onClick={() => assign(entry.id)}
                    className={cn(
                      'group text-left rounded-lg border overflow-hidden transition-colors',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ring-inset',
                      entry.blocked
                        ? 'opacity-60 cursor-not-allowed'
                        : 'hover:border-primary/60',
                      place !== null && PLACE_PLATES[place],
                    )}
                  >
                    <div className={cn('relative bg-muted', THUMB_FRAME.landscape)}>
                      {entry.thumbnailFile ? (
                        <CachedThumbnail
                          file={entry.thumbnailFile}
                          url={`${WorldStorageService.API_URL}/thumbnails/${entry.thumbnailFile}`}
                          updatedAt={entry.updatedAt}
                          alt=""
                          className={cn('h-full w-full', thumbFit('landscape'))}
                          aspect="landscape"
                        />
                      ) : entry.thumbnail ? (
                        <img src={entry.thumbnail} alt="" className={cn('h-full w-full', thumbFit('landscape'))} />
                      ) : null}
                      {entry.blocked && (
                        <span className="absolute left-1 top-1 rounded bg-background/90 px-1.5 py-0.5 text-meta font-semibold">
                          {entry.blocked}
                        </span>
                      )}
                      {place !== null && (
                        <span className={cn(
                          'absolute right-1 top-1 rounded bg-background/90 px-1.5 py-0.5 text-meta font-semibold',
                          PLACE_COLORS[place],
                        )}>
                          {PLACE_LABELS[place]}
                        </span>
                      )}
                    </div>

                    <div className="p-2 min-w-0">
                      <div className="text-label font-semibold truncate">{entry.name}</div>
                      <div className="flex items-center gap-2 text-meta text-muted-foreground">
                        <span className="truncate">by {entry.authorName}</span>
                        <span className="ml-auto inline-flex items-center gap-1.5 shrink-0">
                          <span className="inline-flex items-center gap-1">
                            <Heart className="h-3 w-3" aria-hidden /> {entry.likes}
                          </span>
                          {/* A word rather than a tint: the mark is what a judge counts on to see a
                              tie, so it has to read the same to everyone. */}
                          {tied && (
                            <span className="rounded border px-1 font-semibold text-foreground">
                              Tied<span className="sr-only"> on {entry.likes} likes</span>
                            </span>
                          )}
                        </span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {/* The announcement, before it is one. Wording is the server's template; an admin polishes it
              afterward under Broadcasts, the same as any other auto-posted notice. An edit posts nothing,
              so there is no preview to show for one. */}
          {!editing && podium.length > 0 && (
            <div className="rounded-lg border bg-muted/40 p-3 space-y-1">
              <div className="text-meta text-muted-foreground">
                Goes to everyone, from the Formamorph Team.
              </div>
              <div className="text-label font-semibold">{contest.title} — the results</div>
              <div className="text-meta">{contest.title} has been judged.</div>
              {podiumLines(draft).map(({ place, worldIds }) => (
                <div key={place} className="text-meta">
                  {BROADCAST_PLACE_LABELS[place]}: {listNames(worldIds.map(credit))}
                </div>
              ))}
              <div className="text-meta">
                Congratulations, and thank you to everyone who entered.
              </div>
              <div className="text-meta text-muted-foreground">
                You can edit the wording afterward under Broadcasts.
              </div>
            </div>
          )}

          {editing && lost.length > 0 && (
            <p className="text-meta text-destructive" role="status">
              {lost.map((placement) => `${PLACE_LABELS[placement.place]} (${placement.worldName})`).join(', ')}
              {lost.length === 1 ? ' is' : ' are'} no longer a listing on this server, so this podium
              can&apos;t be re-saved without losing that record.
            </p>
          )}

          {editing && (
            <p className="text-meta text-muted-foreground">
              Saving a correction posts nothing. The change is recorded in the audit log.
            </p>
          )}
        </div>

        <DialogFooter className="flex-shrink-0">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
          <Button onClick={handleSave} disabled={draft.length === 0 || lost.length > 0 || saving}>
            <Trophy className="mr-2 h-4 w-4" aria-hidden />
            {editing ? 'Save Podium' : 'Announce Results'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
