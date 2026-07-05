import { EyeOff, Download, MessageSquare, RefreshCw, CircleArrowUp, Trash2 } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import IndeterminateProgress from "@/components/ui/indeterminate-progress";
import { cn } from "@/lib/utils";
import { CachedThumbnail } from "@/lib/useCachedThumbnail";
import { CardTags, type WorldRecord } from "@/components/WorldDetails";
import { WorldCardShell } from "@/components/WorldCardShell";
import { type DownloadState } from "@/lib/downloadState";
import WorldStorageService from "@/services/WorldStorageService";

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
}

/** A single card in the community browser grid: thumbnail with a contextual download/hide overlay, plus title,
 *  description, author, counts, tags, and (for owners/admins) a delete control. */
export function RemoteWorldCard({
  world, downloadState: dlState, downloadProgress, isAuthenticated, currentUser,
  onView, onHideWorld, onHideAuthor, onHideTag, onContextualDownload, onDelete,
}: RemoteWorldCardProps) {
  // Get the world ID (server uses _id)
  const worldId = world._id || world.id;

  // Check if the world is owned by the current user
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
          : "bg-background",
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
          title={dlState === 'update' ? "Update available — download the newer version" : dlState === 'refresh' ? "Re-download this world" : "Download this world"}
          aria-label={dlState === 'update' ? "Update available" : dlState === 'refresh' ? "Re-download this world" : "Download this world"}
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
          className="w-full h-full object-cover"
        />
      ) : world.thumbnail ? (
        <img
          src={world.thumbnail}
          alt={world.name}
          className="w-full h-full object-cover"
        />
      ) : undefined}
      author={(
        <span
          onClick={(e) => { e.stopPropagation(); if (world.author?.username) onHideAuthor(world.author.username); }}
          title={world.author?.username ? `Hide all worlds by ${world.author.username}` : undefined}
          className={world.author?.username ? "cursor-pointer hover:line-through" : ""}
        >
          By {world.author?.username || "Unknown"}
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

      {(isOwnedByUser || currentUser?.accountType === "admin") && (
        <div className="mt-auto pt-1 flex justify-end">
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
