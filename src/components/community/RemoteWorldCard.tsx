import { EyeOff, Download, MessageSquare, RefreshCw, CircleArrowUp, Trash2, ShieldAlert, ShieldCheck } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import IndeterminateProgress from "@/components/ui/indeterminate-progress";
import { cn } from "@/lib/utils";
import { CachedThumbnail } from "@/lib/useCachedThumbnail";
import { CardTags, type WorldRecord } from "@/components/WorldDetails";
import { WorldCardShell } from "@/components/WorldCardShell";
import { type DownloadState } from "@/lib/downloadState";
import { KIND_LABELS, kindOf } from "@/lib/catalogKinds";
import { isQuarantined, quarantineDaysLeft, quarantineDeadline } from "@/lib/quarantine";
import WorldStorageService from "@/services/WorldStorageService";
import { UserAvatar } from "@/components/UserAvatar";
import { canModerate, isStaff } from "@/lib/roles";

interface RemoteWorldCardProps {
  world: WorldRecord;
  /** Contextual download state for this world (none / refresh / update). */
  downloadState: DownloadState;
  /** In-progress download fraction for this world (undefined when not downloading; -1 ⇒ size unknown). */
  downloadProgress: number | undefined;
  isAuthenticated: boolean;
  currentUser: WorldRecord | null;
  onView: (world: WorldRecord) => void;
  onHideWorld: (worldId: string) => void;
  onHideAuthor: (username: string) => void;
  onHideTag: (tag: string) => void;
  onContextualDownload: (world: WorldRecord, state: DownloadState) => void;
  onDelete: (worldId: string) => void;
  /** Opens the quarantine dialog. Admin surfaces only. */
  onQuarantine?: (world: WorldRecord) => void;
  /** Lifts a quarantine. Admin surfaces only. */
  onRelease?: (world: WorldRecord) => void;
}

/** A single card in the community browser grid: thumbnail with a contextual download/hide overlay, plus title,
 *  description, author, counts, tags, and (for owners/admins) a delete control. */
export function RemoteWorldCard({
  world, downloadState: dlState, downloadProgress, isAuthenticated, currentUser,
  onView, onHideWorld, onHideAuthor, onHideTag, onContextualDownload, onDelete, onQuarantine, onRelease,
}: RemoteWorldCardProps) {
  // Get the world ID (server uses _id)
  const worldId = world._id || world.id;
  // Player-facing noun for this listing's kind (World / Entity / Dictionary), for the download tooltips.
  const noun = KIND_LABELS[kindOf(world)].one.toLowerCase();
  // Entity art is almost always a portrait; anchor it to the top so faces aren't cropped out by centering.
  const thumbClass = cn("w-full h-full object-cover", kindOf(world) === 'entity' && "object-top");

  // Whether to offer the moderation controls at all. What the server will actually allow is narrower —
  // staff moderate the room, not each other — and is checked per listing below.
  const viewerIsStaff = isStaff(currentUser);
  // Quarantined listings only reach a card at all for their author or a moderator — the server hides them
  // from everyone else — so the badge is always addressed to somebody who can act on it.
  const quarantined = isQuarantined(world);
  const deadline = quarantineDeadline(world);
  const daysLeft = quarantineDaysLeft(world);

  // Check if the world is owned by the current user
  // Staff moderate the room, not each other: whether these controls do anything depends on who published
  // it, so the decision is per listing rather than per viewer.
  const mayModerate = viewerIsStaff && canModerate(currentUser, world.author);

  const isOwnedByUser = isAuthenticated &&
    world.author &&
    currentUser &&
    (world.author.id === currentUser.id ||
     world.author.username === currentUser.username);

  return (
    <WorldCardShell
      // Highlight worlds with an available update with the semantic info tint + ring.
      frameClassName={cn(
        "group",
        dlState === 'update'
          ? "border-info bg-info/10 ring-1 ring-info"
          : "bg-card",
      )}
      onClick={() => onView(world)}
      name={world.name}
      description={world.description}
      cornerAction={(
        <button
          onClick={(e) => { e.stopPropagation(); onHideWorld(worldId); }}
          className="absolute top-1 right-1 z-10 p-1 rounded bg-overlay/50 text-white hover:bg-overlay/70"
          title="Hide this world"
        >
          <EyeOff className="h-4 w-4" />
        </button>
      )}
      thumbnailOverlay={downloadProgress !== undefined ? (
        // Downloading: swap the button for a centered status bar. -1 ⇒ size unknown.
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10 w-3/4"
          onClick={(e) => e.stopPropagation()}
        >
          {downloadProgress < 0 ? (
            <IndeterminateProgress />
          ) : (
            <Progress value={downloadProgress * 100} className="h-2" />
          )}
        </div>
      ) : (
        /* Contextual download — centered on the thumbnail, fades in on hover; same color as the hide
           button, 2x size. Icon reflects whether the world is new, current (refresh), or has an update. */
        <button
          onClick={(e) => { e.stopPropagation(); onContextualDownload(world, dlState); }}
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10 p-2 rounded bg-overlay/50 text-white hover:bg-overlay/70 opacity-0 pointer-events-none transition-opacity group-hover:opacity-100 group-hover:pointer-events-auto"
          title={dlState === 'update' ? "Update available — download the newer version" : dlState === 'refresh' ? `Re-download this ${noun}` : `Download this ${noun}`}
          aria-label={dlState === 'update' ? "Update available" : dlState === 'refresh' ? `Re-download this ${noun}` : `Download this ${noun}`}
        >
          {dlState === 'update' ? (
            <CircleArrowUp className="h-8 w-8" />
          ) : dlState === 'refresh' ? (
            <RefreshCw className="h-8 w-8" />
          ) : (
            <Download className="h-8 w-8" />
          )}
        </button>
      )}
      thumbnail={world.thumbnail_file ? (
        <CachedThumbnail
          file={world.thumbnail_file}
          url={`${WorldStorageService.API_URL}/thumbnails/${world.thumbnail_file}`}
          updatedAt={world.updated_at}
          alt={world.name}
          className={thumbClass}
        />
      ) : world.thumbnail ? (
        <img
          src={world.thumbnail}
          alt={world.name}
          className={thumbClass}
        />
      ) : undefined}
      author={(
        <span className="inline-flex items-center gap-1.5 min-w-0">
          <UserAvatar username={world.author?.username} avatarUrl={world.author?.avatarUrl} size="xs" />
          <span
            onClick={(e) => { e.stopPropagation(); if (world.author?.username) onHideAuthor(world.author.username); }}
            title={world.author?.username ? `Hide all worlds by ${world.author.username}` : undefined}
            className={world.author?.username ? "cursor-pointer hover:line-through truncate" : "truncate"}
          >
            By {world.author?.username || "Unknown"}
          </span>
        </span>
      )}
    >
      <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
        <span className="flex items-center gap-1" title="Downloads">
          <Download className="h-3 w-3" /> {world.downloads || 0}
        </span>
        <span className="flex items-center gap-1" title="Comments">
          <MessageSquare className="h-3 w-3" /> {world.comment_count || 0}
        </span>
      </div>

      {/* Tags */}
      <div className="mb-2">
        <CardTags tags={world.tags || []} onHide={onHideTag} />
      </div>

      {/* Only its author and the admins ever see this card, so the deadline is said plainly rather than
          hinted at — the author has something to do about it and a date by which to do it. */}
      {quarantined && (
        <div className="mb-2 rounded-md border border-warning/40 bg-warning/10 px-2 py-1 text-xs">
          <p className="flex items-center gap-1 font-medium text-warning">
            <ShieldAlert className="h-3 w-3 shrink-0" /> Quarantined
          </p>
          {deadline && (
            <p className="text-muted-foreground">
              Deleted on {deadline}{daysLeft !== null && ` — ${daysLeft} day${daysLeft === 1 ? '' : 's'} left`}
            </p>
          )}
        </div>
      )}

      {(isOwnedByUser || mayModerate) && (
        <div className="mt-auto pt-1 flex justify-end gap-1">
          {/* Quarantine is the gentler half of the same job as Delete, so it sits beside it. */}
          {mayModerate && !quarantined && onQuarantine && (
            <button
              className="p-1 text-warning hover:text-warning/80"
              onClick={(e) => { e.stopPropagation(); onQuarantine(world); }}
              aria-label={`Quarantine ${world.name || noun}`}
              title="Hide it while the author fixes it"
            >
              <ShieldAlert className="h-5 w-5" />
            </button>
          )}
          {mayModerate && quarantined && onRelease && (
            <button
              className="p-1 text-success hover:text-success/80"
              onClick={(e) => { e.stopPropagation(); onRelease(world); }}
              aria-label={`Release ${world.name || noun}`}
              title="Put it back in Community Creations"
            >
              <ShieldCheck className="h-5 w-5" />
            </button>
          )}
          <button
            className="p-1 text-destructive hover:text-destructive/80"
            onClick={(e) => { e.stopPropagation(); onDelete(worldId); }}
            aria-label="Delete world"
          >
            <Trash2 className="h-5 w-5" />
          </button>
        </div>
      )}
    </WorldCardShell>
  );
}
