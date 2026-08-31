import { useEffect, useMemo, useState } from "react";
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
import { cn } from "@/lib/utils";
import { CachedThumbnail } from "@/lib/useCachedThumbnail";
import { entriesOf } from "@/lib/contests";
import { entryBlockReason } from "@/lib/adminEvents";
import { placementsOf } from "@/lib/serverEvents";
import { PLACES, PLACE_COLORS, PLACE_LABELS, PLACE_PLATES } from "@/lib/placeLabels";
import { isQuarantined } from "@/lib/quarantine";
import AuthService from "@/services/AuthService";
import EventService from "@/services/EventService";
import WorldStorageService from "@/services/WorldStorageService";
import type { WorldRecord } from "@/components/WorldDetails";
import type { ContestPlace, ServerEvent } from "@/types";
import { THUMB_FRAME, thumbFit } from "@/lib/thumbAspect";

/**
 * The whole catalog in one request, which is how the community browser reads it too.
 *
 * Entries are filtered out of the catalog rather than asked for by contest, so a short page would hide
 * whichever entries fell past it — and an entry the judge cannot see is one that cannot place.
 */
const ENTRY_PAGE = 1000;

interface PodiumDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contest: ServerEvent;
  /** Called after the podium reaches the server, so the list behind can pick the change up. */
  onSaved?: () => void;
}

/** One entry, reduced to what a judgement is made on. */
interface Entry {
  id: string;
  name: string;
  authorName: string;
  authorId: string | null;
  likes: number;
  /** Either the stored file the catalog caches by name, or an inline data URL. */
  thumbnailFile: string | null;
  thumbnail: string | null;
  updatedAt: string | undefined;
  /** Why this one cannot be given a place, or null. */
  blocked: string | null;
}

/**
 * The podium being staged: world ids in podium order, first is gold.
 *
 * A list rather than a place-to-world map, which is what makes contiguity structural. There is no way to
 * express a silver with no gold, so no click, clear or reorder can stage a podium the server would then
 * refuse — the rule is held by the shape instead of by a check somebody has to remember to run.
 */
type Draft = string[];

/**
 * The podium after this world's card is clicked.
 *
 * Clicking cycles. An unplaced world joins at the first free place; a placed one trades places with the
 * step below it; and one already on the bottom step leaves. That keeps the whole assembly on the same
 * click the old single pick used, and means a mistake is undone by clicking again rather than by hunting
 * for a control — while the two worlds swapping is what stops a click from opening a hole in the middle.
 */
const cycle = (draft: Draft, worldId: string): Draft => {
  const at = draft.indexOf(worldId);
  if (at === -1) return draft.length < PLACES.length ? [...draft, worldId] : draft;
  if (at === draft.length - 1) return draft.filter((id) => id !== worldId);

  const next = [...draft];
  [next[at], next[at + 1]] = [next[at + 1], next[at]];
  return next;
};

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

  // The published podium as a plain string rather than the event itself, so the staging effect below
  // re-seeds when the podium actually changes and not merely when the list behind the dialog re-renders
  // and hands down a fresh object — which would throw away a podium half assembled.
  const publishedIds = useMemo(
    () => placementsOf(contest).map((placement) => placement.worldId ?? '').filter(Boolean).join(','),
    [contest],
  );

  useEffect(() => {
    if (!open) return;

    let current = true;
    setLoading(true);
    // Reopened over an announced podium, the staging starts from what is already published, so an edit
    // that means to move one place does not silently drop the other two.
    setDraft(publishedIds ? publishedIds.split(',') : []);

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
  }, [open, contestId, publishedIds]);

  const byId = useMemo(() => new Map(entries.map((entry) => [entry.id, entry])), [entries]);
  const podium = draft.map((worldId, index) => ({
    place: PLACES[index], entry: byId.get(worldId) ?? null,
  }));

  const assign = (worldId: string) => setDraft((held) => cycle(held, worldId));

  // Everything below closes up behind it, so clearing gold promotes silver rather than leaving a hole.
  const clear = (place: ContestPlace) => setDraft((held) => held.filter((_, index) => index !== place - 1));

  const handleSave = async () => {
    if (draft.length === 0 || lost.length > 0) return;

    const placements = draft.map((worldId, index) => ({ place: PLACES[index], worldId }));

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
            {entries.length} {entries.length === 1 ? 'entry' : 'entries'}. Click an entry to place it, and
            again to step it down. Your own entry and quarantined worlds can&apos;t be placed.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-y-auto space-y-4 py-2">
          {/* The podium as it stands, above the grid it is assembled from. */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2" aria-label="Podium">
            {PLACES.map((place) => {
              const entry = byId.get(draft[place - 1]) ?? null;

              return (
                <div
                  key={place}
                  className={cn(
                    'flex items-center gap-2 rounded-lg border px-3 py-2 min-w-0',
                    entry ? PLACE_PLATES[place] : 'border-dashed bg-muted/30',
                  )}
                >
                  <Trophy className={cn('h-4 w-4 shrink-0', entry ? PLACE_COLORS[place] : 'text-muted-foreground')} aria-hidden />
                  <div className="min-w-0 flex-1">
                    <div className={cn('text-meta font-semibold', entry ? PLACE_COLORS[place] : 'text-muted-foreground')}>
                      {PLACE_LABELS[place]}
                    </div>
                    <div className="text-label truncate">
                      {entry ? entry.name : <span className="text-muted-foreground">Empty</span>}
                    </div>
                  </div>
                  {entry && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 shrink-0"
                      aria-label={`Clear ${PLACE_LABELS[place]}`}
                      onClick={() => clear(place)}
                    >
                      <X className="h-3.5 w-3.5" aria-hidden />
                    </Button>
                  )}
                </div>
              );
            })}
          </div>

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
              {entries.map((entry) => {
                const staged = draft.indexOf(entry.id);
                const place = staged === -1 ? null : PLACES[staged];

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
                        <span className="ml-auto inline-flex items-center gap-1 shrink-0">
                          <Heart className="h-3 w-3" aria-hidden /> {entry.likes}
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
              {podium.map(({ place, entry }) => (
                <div key={place} className="text-meta">
                  {PLACE_LABELS[place]}: {entry?.name} by {entry?.authorName}
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
