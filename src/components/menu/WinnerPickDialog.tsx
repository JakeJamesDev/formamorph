import { useEffect, useState } from "react";
import { toast } from "react-toastify";
import { Heart, Loader2, Trophy } from "lucide-react";
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
import { winnerBlockReason } from "@/lib/adminEvents";
import { isQuarantined } from "@/lib/quarantine";
import AuthService from "@/services/AuthService";
import EventService from "@/services/EventService";
import WorldStorageService from "@/services/WorldStorageService";
import type { WorldRecord } from "@/components/WorldDetails";
import type { ServerEvent } from "@/types";

/** A page wide enough to hold a community-sized contest, since entries are filtered from the catalog. */
const ENTRY_PAGE = 100;

interface WinnerPickDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contest: ServerEvent;
  /** Called after the winner is announced, so the list behind can pick the change up. */
  onPicked?: () => void;
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
  /** Why this one cannot be picked, or null. */
  blocked: string | null;
}

/**
 * Pick a contest's winner by looking at the entries.
 *
 * Judging is a browsing task, not an id-typing one, so the entries arrive as a grid of what they
 * actually are. The two entries nobody may crown — the picker's own, and anything quarantined — stay in
 * the grid wearing the reason: a judge who cannot find an entry they remember will go looking for it,
 * and the answer to "where did it go" is cheaper shown than explained.
 *
 * Nothing is sent until the announcement has been read. The broadcast the server will post is written
 * from the pick, and previewing it is the last moment before every player has it.
 */
export function WinnerPickDialog({ open, onOpenChange, contest, onPicked }: WinnerPickDialogProps) {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);
  const [announcing, setAnnouncing] = useState(false);

  useEffect(() => {
    if (!open) return;

    let current = true;
    setLoading(true);
    setSelected(null);

    const pickerId = String(AuthService.getCurrentUser()?.id ?? '') || null;

    WorldStorageService.fetchRemoteWorlds(1, ENTRY_PAGE)
      .then((result) => {
        if (!current) return;
        const catalog = (result.data ?? []) as WorldRecord[];
        setEntries(entriesOf(catalog, contest.id).map((record) => {
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
            blocked: winnerBlockReason({ authorId, quarantined: isQuarantined(record) }, pickerId),
          };
        }));
      })
      .catch((error) => {
        console.error('Failed to load contest entries:', error);
        if (current) setEntries([]);
      })
      .finally(() => { if (current) setLoading(false); });

    return () => { current = false; };
  }, [open, contest.id]);

  const chosen = entries.find((entry) => entry.id === selected) ?? null;

  const handleAnnounce = async () => {
    if (!chosen) return;

    setAnnouncing(true);
    try {
      await EventService.pickWinner(contest.id, chosen.id);
      toast.success(`${chosen.name} announced as the winner`);
      onPicked?.();
      onOpenChange(false);
    } catch (error) {
      toast.error((error as Error).message || 'Failed to announce the winner');
    } finally {
      setAnnouncing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[880px] max-h-[90dvh] flex flex-col overflow-hidden">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Trophy className="h-4 w-4 text-warning" aria-hidden /> Pick Winner — {contest.title}
          </DialogTitle>
          <DialogDescription>
            {entries.length} {entries.length === 1 ? 'entry' : 'entries'}. Your own entry and quarantined
            worlds can&apos;t be picked.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-y-auto space-y-4 py-2">
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
              role="radiogroup"
              aria-label="Entries"
              className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3"
            >
              {entries.map((entry) => (
                <button
                  key={entry.id}
                  type="button"
                  role="radio"
                  aria-checked={selected === entry.id}
                  disabled={Boolean(entry.blocked)}
                  onClick={() => setSelected(entry.id)}
                  className={cn(
                    'group text-left rounded-lg border overflow-hidden transition-colors',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ring-inset',
                    entry.blocked
                      ? 'opacity-60 cursor-not-allowed'
                      : 'hover:border-primary/60',
                    selected === entry.id && 'border-primary bg-primary/5',
                  )}
                >
                  <div className="relative aspect-video bg-muted">
                    {entry.thumbnailFile ? (
                      <CachedThumbnail
                        file={entry.thumbnailFile}
                        url={`${WorldStorageService.API_URL}/thumbnails/${entry.thumbnailFile}`}
                        updatedAt={entry.updatedAt}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : entry.thumbnail ? (
                      <img src={entry.thumbnail} alt="" className="h-full w-full object-cover" />
                    ) : null}
                    {entry.blocked && (
                      <span className="absolute left-1 top-1 rounded bg-background/90 px-1.5 py-0.5 text-meta font-semibold">
                        {entry.blocked}
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
              ))}
            </div>
          )}

          {/* The announcement, before it is one. Wording is the server's template; an admin polishes it
              afterward under Broadcasts, the same as any other auto-posted notice. */}
          {chosen && (
            <div className="rounded-lg border bg-muted/40 p-3 space-y-1">
              <div className="text-meta text-muted-foreground">
                Goes to everyone, from the Formamorph Team.
              </div>
              <div className="text-label font-semibold">Winner — {contest.title}</div>
              <div className="text-meta">
                The winning world is “{chosen.name}” by {chosen.authorName}. It now wears its badge in
                Community Creations.
              </div>
              <div className="text-meta text-muted-foreground">
                You can edit the wording afterward under Broadcasts.
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="flex-shrink-0">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={announcing}>Cancel</Button>
          <Button onClick={handleAnnounce} disabled={!chosen || announcing}>
            <Trophy className="mr-2 h-4 w-4" aria-hidden /> Announce Winner
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
