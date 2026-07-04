import { useState, useEffect } from "react";
import { toast } from "react-toastify";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import IndeterminateProgress from "@/components/ui/indeterminate-progress";
import { Globe, Columns2, RectangleVertical } from "lucide-react";
import { cn } from "@/lib/utils";
import { CachedThumbnail } from "@/lib/useCachedThumbnail";
import { WorldDetailsColumn, DateTimeText, splitColumnClasses, type WorldRecord } from "@/components/WorldDetails";
import { type DownloadState } from "@/lib/downloadState";
import WorldStorageService from "@/services/WorldStorageService";

interface RemoteWorldDetailsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The selected remote world, or null when nothing is chosen. */
  world: WorldRecord | null;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  isAuthenticated: boolean;
  openImageViewer: (src: string | undefined, alt: string | undefined) => void;
  downloadStateForWorld: (world: WorldRecord) => DownloadState;
  downloadProgress: Record<string, number>;
  onContextualDownload: (world: WorldRecord, state: DownloadState) => void;
}

/** The remote-world details modal: metadata + download action (left) and comments (right). Owns its own
 *  comment state/paging; download state is supplied by the parent's download coordinator via props. */
export function RemoteWorldDetailsModal({
  open, onOpenChange, world, collapsed, onToggleCollapsed,
  isAuthenticated, openImageViewer, downloadStateForWorld, downloadProgress, onContextualDownload,
}: RemoteWorldDetailsModalProps) {
  const [comments, setComments] = useState<WorldRecord[]>([]);
  const [commentsTotal, setCommentsTotal] = useState(0);
  const [commentsPage, setCommentsPage] = useState(1);
  const [commentsHasMore, setCommentsHasMore] = useState(false);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [postingComment, setPostingComment] = useState(false);

  // Load comments for the world detail modal (page 1 resets, higher pages append).
  const loadComments = async (worldId: string, page = 1) => {
    setCommentsLoading(true);
    try {
      const res = await WorldStorageService.fetchComments(worldId, page, 20);
      setCommentsTotal(res.total);
      setCommentsHasMore(!!res.pagination?.next);
      setCommentsPage(page);
      setComments((prev) => (page === 1 ? res.data : [...prev, ...res.data]));
    } finally {
      setCommentsLoading(false);
    }
  };

  const handlePostComment = async () => {
    if (!world || !commentText.trim()) return;
    setPostingComment(true);
    try {
      const created = await WorldStorageService.postComment(
        world._id || world.id,
        commentText.trim(),
      );
      setComments((prev) => [created, ...prev]);
      setCommentsTotal((n) => n + 1);
      setCommentText('');
    } catch (error) {
      toast.error((error as Error).message || 'Failed to post comment');
    } finally {
      setPostingComment(false);
    }
  };

  // Fetch comments whenever the detail modal opens for a world.
  useEffect(() => {
    if (open && world) {
      setComments([]);
      setCommentText('');
      loadComments(world._id || world.id, 1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, world?._id, world?.id]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn("h-[85vh] flex flex-col", collapsed ? "sm:max-w-[600px]" : "sm:max-w-[1200px]")}>
        <DialogHeader className="shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <span className="truncate">{world?.name || 'World Details'}</span>
            <Button
              variant="ghost"
              size="icon"
              className="ml-auto mr-8 shrink-0 hidden md:inline-flex"
              onClick={onToggleCollapsed}
              title={collapsed ? "Expand to two columns" : "Collapse to single column"}
              aria-label={collapsed ? "Expand to two columns" : "Collapse to single column"}
            >
              {collapsed ? <Columns2 className="h-4 w-4" /> : <RectangleVertical className="h-4 w-4" />}
            </Button>
          </DialogTitle>
        </DialogHeader>

        {world && (
          <div className={cn("mt-4", splitColumnClasses(collapsed).wrapper)}>
            {/* Left column: metadata */}
            <div className={splitColumnClasses(collapsed).left}>
              <WorldDetailsColumn
                description={world.description || ""}
                tags={world.tags}
                thumbnail={
                  /* World Thumbnail — click to open the pan/zoom viewer */
                  <div
                    className="relative w-full pt-[56.25%] rounded-lg overflow-hidden cursor-zoom-in"
                    onClick={() => openImageViewer(
                      world.thumbnail_file
                        ? `${WorldStorageService.API_URL}/thumbnails/${world.thumbnail_file}`
                        : world.thumbnail,
                      world.name,
                    )}
                    title="Click to enlarge"
                  >
                    {world.thumbnail_file ? (
                      <CachedThumbnail
                        file={world.thumbnail_file}
                        url={`${WorldStorageService.API_URL}/thumbnails/${world.thumbnail_file}`}
                        updatedAt={world.updated_at}
                        alt={world.name}
                        className="absolute top-0 left-0 w-full h-full object-cover"
                      />
                    ) : world.thumbnail ? (
                      <img
                        src={world.thumbnail}
                        alt={world.name}
                        className="absolute top-0 left-0 w-full h-full object-cover"
                      />
                    ) : (
                      <div className="absolute top-0 left-0 w-full h-full flex items-center justify-center bg-gray-100 dark:bg-gray-800 text-gray-400">
                        <Globe className="h-16 w-16" />
                      </div>
                    )}
                  </div>
                }
                actions={(() => {
                  // Mirror the contextual card button (none/refresh/update) as a text label.
                  const dlState = downloadStateForWorld(world);
                  const progress = downloadProgress[world._id || world.id];
                  // While downloading, swap the button for a status bar (-1 ⇒ size unknown).
                  if (progress !== undefined) {
                    return progress < 0
                      ? <IndeterminateProgress />
                      : <Progress value={progress * 100} className="h-2" />;
                  }
                  const label = dlState === 'update' ? 'Update Available'
                    : dlState === 'refresh' ? 'Re-download World'
                    : 'Download World';
                  return (
                    <Button
                      className="w-full bg-gradient-to-r from-sky-200 to-cyan-200 hover:from-sky-300 hover:to-cyan-300 text-black font-bold"
                      onClick={() => onContextualDownload(world, dlState)}
                    >
                      {label}
                    </Button>
                  );
                })()}
                meta={
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <h3 className="text-sm font-semibold text-gray-500">Author</h3>
                      <p>{world.author?.username || "Unknown"}</p>
                    </div>

                    <div>
                      <h3 className="text-sm font-semibold text-gray-500">Downloads</h3>
                      <p>{world.downloads || 0}</p>
                    </div>

                    <div>
                      <h3 className="text-sm font-semibold text-gray-500">Created</h3>
                      <p>{world.created_at ? <DateTimeText value={world.created_at} /> : "Unknown"}</p>
                    </div>

                    <div>
                      <h3 className="text-sm font-semibold text-gray-500">Updated</h3>
                      <p>{world.updated_at ? <DateTimeText value={world.updated_at} /> : "Unknown"}</p>
                    </div>
                  </div>
                }
              />
            </div>

            {/* Right column: comments */}
            <div className={cn(splitColumnClasses(collapsed).right, "space-y-3")}>
              <h3 className="text-sm font-semibold text-gray-500">Comments ({commentsTotal})</h3>

              {isAuthenticated ? (
                <div className="space-y-2">
                  <Textarea
                    placeholder="Leave a comment..."
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    className="min-h-[60px]"
                  />
                  <Button
                    size="sm"
                    disabled={postingComment || !commentText.trim()}
                    onClick={handlePostComment}
                  >
                    {postingComment ? 'Posting...' : 'Post Comment'}
                  </Button>
                </div>
              ) : (
                <p className="text-sm text-gray-500">Log in to leave a comment.</p>
              )}

              <div className="space-y-3">
                {comments.map((c) => (
                  <div key={c.id} className="text-sm border-b border-border/50 pb-2 last:border-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium">{c.author?.username || 'Unknown'}</span>
                      <span className="text-xs text-gray-500">
                        {c.created_at ? new Date(c.created_at).toLocaleString() : ''}
                      </span>
                    </div>
                    <p className="text-gray-600 dark:text-gray-400 whitespace-pre-wrap mt-1">{c.content}</p>
                  </div>
                ))}
                {comments.length === 0 && !commentsLoading && (
                  <p className="text-sm text-gray-500">No comments yet.</p>
                )}
                {commentsHasMore && (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={commentsLoading}
                    onClick={() => loadComments(world._id || world.id, commentsPage + 1)}
                  >
                    {commentsLoading ? 'Loading...' : 'Load more'}
                  </Button>
                )}
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
