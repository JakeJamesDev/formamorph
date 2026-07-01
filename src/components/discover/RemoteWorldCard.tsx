import { Globe, EyeOff, Download, MessageSquare, RefreshCw, CircleArrowUp, Trash2 } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import IndeterminateProgress from "@/components/ui/indeterminate-progress";
import { cn } from "@/lib/utils";
import { CachedThumbnail } from "@/lib/useCachedThumbnail";
import { MarkdownRenderer } from "@/components/game/MarkdownRenderer";
import { CardTags, type WorldRecord } from "@/components/WorldDetails";
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

/** A single card in the Discover grid: thumbnail with a contextual download/hide overlay, plus title,
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
    <div
      className={cn(
        "group relative flex flex-col rounded-lg border cursor-pointer",
        // Highlight worlds with an available update with a brighter sky tint + ring.
        dlState === 'update'
          ? "border-sky-300 dark:border-sky-700 bg-sky-50 dark:bg-sky-950/40 ring-1 ring-sky-300 dark:ring-sky-700"
          : "border-gray-200 dark:border-gray-700 bg-background",
      )}
      onClick={() => onView(world)}
    >
      <button
        onClick={(e) => { e.stopPropagation(); onHideWorld(worldId); }}
        className="absolute top-1 right-1 z-10 p-1 rounded bg-black/50 text-white hover:bg-black/70"
        title="Hide this world"
      >
        <EyeOff className="h-4 w-4" />
      </button>

      <div className="relative h-32 bg-gray-100 dark:bg-gray-800 rounded-t-lg overflow-hidden">
        {downloadProgress !== undefined ? (
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
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10 p-2 rounded bg-black/50 text-white hover:bg-black/70 opacity-0 pointer-events-none transition-opacity group-hover:opacity-100 group-hover:pointer-events-auto"
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
        {world.thumbnail_file ? (
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
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-400">
            <Globe className="h-12 w-12" />
          </div>
        )}
      </div>

      <div className="p-4 flex flex-col flex-grow">
        <h3 className="font-semibold text-lg mb-1">{world.name}</h3>
        <div className="text-sm text-gray-600 dark:text-gray-400 mb-2 max-h-20 overflow-hidden">
          <MarkdownRenderer text={world.description || "No description available."} />
        </div>

        <div className="text-xs text-gray-500 mb-1">
          <span
            onClick={(e) => { e.stopPropagation(); if (world.author?.username) onHideAuthor(world.author.username); }}
            title={world.author?.username ? `Hide all worlds by ${world.author.username}` : undefined}
            className={world.author?.username ? "cursor-pointer hover:line-through" : ""}
          >
            By {world.author?.username || "Unknown"}
          </span>
        </div>

        <div className="flex items-center justify-between text-xs text-gray-500 mb-2">
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
              className="p-1 text-red-500 hover:text-red-700"
              onClick={(e) => { e.stopPropagation(); onDelete(worldId); }}
              aria-label="Delete world"
            >
              <Trash2 className="h-5 w-5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
