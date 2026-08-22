import { useState, useEffect, useRef } from "react";
import { toast } from "react-toastify";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import IndeterminateProgress from "@/components/ui/indeterminate-progress";
import { Globe, Columns2, RectangleVertical } from "lucide-react";
import { ActionIcon } from "@/lib/actionIcons";
import { cn } from "@/lib/utils";
import { useCachedThumbnail } from "@/lib/useCachedThumbnail";
import { WorldDetailsColumn, DateTimeText, splitColumnClasses, type WorldRecord } from "@/components/WorldDetails";
import { formatServerDateTime } from "@/lib/serverDate";
import { type DownloadState } from "@/lib/downloadState";
import { KIND_LABELS, kindOf } from "@/lib/catalogKinds";
import WorldStorageService from "@/services/WorldStorageService";
import { UserAvatar } from "@/components/UserAvatar";
import { UserName } from "@/components/UserName";
import { LikeButton } from "@/components/community/LikeButton";
import { WorldActionButton } from "@/components/WorldActionButton";
import { WinnerBadges } from "@/components/WinnerBadges";
import { contestsWonBy } from "@/lib/contests";
import type { ServerEvent } from "@/types";

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
  /** Who is reading, so the heart is a control only for somebody who could press it. */
  currentUser?: WorldRecord | null;
  /** Records a like. Absent leaves the heart a plain count. */
  onLike?: (world: WorldRecord, liked: boolean) => Promise<void>;
  /** The contest archive the browser already fetched, so a winner is badged here as it is on its card. */
  contests?: ServerEvent[];
}

/** The remote-world details modal: metadata + download action (left) and comments (right). Owns its own
 *  comment state/paging; download state is supplied by the parent's download coordinator via props. */
export function RemoteWorldDetailsModal({
  open, onOpenChange, world, collapsed, onToggleCollapsed,
  isAuthenticated, openImageViewer, downloadStateForWorld, downloadProgress, onContextualDownload,
  currentUser, onLike, contests = [],
}: RemoteWorldDetailsModalProps) {
  const [comments, setComments] = useState<WorldRecord[]>([]);
  const [commentsTotal, setCommentsTotal] = useState(0);
  const [commentsPage, setCommentsPage] = useState(1);
  const [commentsHasMore, setCommentsHasMore] = useState(false);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [postingComment, setPostingComment] = useState(false);

  // Token each comments fetch so a slow response for a since-closed world can't land in a different world's
  // modal: opening world B fires a newer request, and world A's late result is discarded.
  const commentsReqRef = useRef(0);

  // Load comments for the world detail modal (page 1 resets, higher pages append).
  const loadComments = async (worldId: string, page = 1) => {
    const reqId = ++commentsReqRef.current;
    setCommentsLoading(true);
    try {
      const res = await WorldStorageService.fetchComments(worldId, page, 20);
      if (reqId !== commentsReqRef.current) return; // superseded by a newer world's fetch
      setCommentsTotal(res.total);
      setCommentsHasMore(!!res.pagination?.next);
      setCommentsPage(page);
      setComments((prev) => (page === 1 ? res.data : [...prev, ...res.data]));
    } finally {
      if (reqId === commentsReqRef.current) setCommentsLoading(false);
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

  const thumbFile = world?.thumbnail_file;
  const thumbUrl = thumbFile
    ? `${WorldStorageService.API_URL}/thumbnails/${thumbFile}`
    : (world?.thumbnail || '');
  // Resolve through the same blob cache the card thumbnails use, so the zoom gets a same-origin object URL
  // rather than the raw cross-origin server URL (which CORP blocks from an <img> load, breaking the viewer).
  const { src: thumbSrc } = useCachedThumbnail(thumbFile, thumbUrl, world?.updated_at);

  // Matched on either id or name, the same pair the card uses — a catalog row and the signed-in user come
  // from different endpoints and have disagreed on which one is populated before.
  const isOwnListing = Boolean(
    world?.author && currentUser &&
    (world.author.id === currentUser.id || world.author.username === currentUser.username)
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent aria-describedby={undefined} className={cn("h-[85dvh] flex flex-col", collapsed ? "sm:max-w-[600px]" : "sm:max-w-[1200px]")}>
        <DialogHeader className="shrink-0">
          <DialogTitle className="flex items-center gap-2">
            {/* `leading-normal` overrides DialogTitle's `leading-none`, whose one-em line box crops
                descenders under `truncate`'s overflow clip. Fits the row's existing height. */}
            <span className="truncate leading-normal">{world?.name || 'World Details'}</span>
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
          {/* Under the title, as on the card: opening a winning card must not lose what the card said. */}
          {world && <WinnerBadges contests={contestsWonBy(world, contests)} className="mr-8" />}
        </DialogHeader>

        {world && (
          <div className={cn("mt-4", splitColumnClasses(collapsed).wrapper)}>
            {/* Left column: metadata */}
            <div className={splitColumnClasses(collapsed).left}>
              <WorldDetailsColumn
                description={world.description || ""}
                tags={world.tags}
                thumbnail={
                  /* World Thumbnail — click to open the pan/zoom viewer (uses the cached blob src, so the
                     zoom isn't CORP-blocked like the raw cross-origin URL would be). */
                  <div
                    className={cn(
                      "relative w-full pt-[56.25%] rounded-lg overflow-hidden",
                      thumbSrc && "cursor-zoom-in",
                    )}
                    onClick={() => thumbSrc && openImageViewer(thumbSrc, world.name)}
                    title={thumbSrc ? "Click to enlarge" : undefined}
                  >
                    {thumbSrc ? (
                      <img
                        src={thumbSrc}
                        alt={world.name}
                        className={cn(
                          "absolute top-0 left-0 w-full h-full object-cover",
                          // Entity art is almost always a portrait; anchor it to the top so faces aren't cropped.
                          kindOf(world) === 'entity' && "object-top",
                        )}
                      />
                    ) : (
                      <div className="absolute top-0 left-0 w-full h-full flex items-center justify-center bg-muted text-muted-foreground">
                        <Globe className="h-16 w-16" />
                      </div>
                    )}
                  </div>
                }
                actions={(() => {
                  // Mirror the contextual card button (none/refresh/update), icon and all.
                  const dlState = downloadStateForWorld(world);
                  const progress = downloadProgress[world._id || world.id];
                  // While downloading, swap the button for a status bar (-1 ⇒ size unknown).
                  if (progress !== undefined) {
                    return progress < 0
                      ? <IndeterminateProgress />
                      : <Progress value={progress * 100} className="h-2" />;
                  }
                  const noun = KIND_LABELS[kindOf(world)].one;
                  const [Icon, label] = dlState === 'update'
                    ? [ActionIcon.cloudUpdate, 'Update Available'] as const
                    : dlState === 'refresh'
                      ? [ActionIcon.cloudRefresh, `Re-download ${noun}`] as const
                      : [ActionIcon.cloudDownload, `Download ${noun}`] as const;
                  return (
                    <WorldActionButton
                      tone="sky"
                      onClick={() => onContextualDownload(world, dlState)}
                    >
                      <Icon className="mr-2 h-4 w-4" /> {label}
                    </WorldActionButton>
                  );
                })()}
                meta={
                  <div className="grid grid-cols-2 gap-4">
                    {/* Full width so the two counts below pair off on a row of their own — they are the
                        comparison the pair exists to make. */}
                    <div className="col-span-2">
                      <h3 className="text-helper font-semibold text-muted-foreground">Author</h3>
                      <p className="flex items-center gap-2 min-w-0">
                        <UserAvatar username={world.author?.username} avatarUrl={world.author?.avatarUrl} size="sm" />
                        <UserName userId={world.author?.id} username={world.author?.username} role={world.author?.role} />
                      </p>
                    </div>

                    <div>
                      <h3 className="text-helper font-semibold text-muted-foreground">Downloads</h3>
                      <p>{world.downloads || 0}</p>
                    </div>

                    <div>
                      <h3 className="text-helper font-semibold text-muted-foreground">Likes</h3>
                      <LikeButton
                        likes={world.likes || 0}
                        liked={world.liked}
                        size="md"
                        // Static on your own listing, which the server refuses.
                        onToggle={onLike && isAuthenticated && !isOwnListing ? (next) => onLike(world, next) : undefined}
                      />
                    </div>

                    <div>
                      <h3 className="text-helper font-semibold text-muted-foreground">Created</h3>
                      <p>{world.created_at ? <DateTimeText value={world.created_at} /> : "Unknown"}</p>
                    </div>

                    <div>
                      <h3 className="text-helper font-semibold text-muted-foreground">Updated</h3>
                      <p>{world.updated_at ? <DateTimeText value={world.updated_at} /> : "Unknown"}</p>
                    </div>
                  </div>
                }
              />
            </div>

            {/* Right column: comments */}
            <div className={cn(splitColumnClasses(collapsed).right, "space-y-3")}>
              <h3 className="text-helper font-semibold text-muted-foreground">Comments ({commentsTotal})</h3>

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
                <p className="text-helper text-muted-foreground">Log in to leave a comment.</p>
              )}

              <div className="space-y-3">
                {comments.map((c) => (
                  <div key={c.id} className="text-label border-b border-border/50 pb-2 last:border-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="flex items-center gap-1.5 min-w-0 font-medium">
                        <UserAvatar username={c.author?.username} avatarUrl={c.author?.avatarUrl} size="xs" />
                        <UserName userId={c.author?.id} username={c.author?.username} role={c.author?.role} />
                      </span>
                      <span className="text-meta text-muted-foreground">
                        {c.created_at ? formatServerDateTime(c.created_at) : ''}
                      </span>
                    </div>
                    <p className="text-muted-foreground whitespace-pre-wrap mt-1">{c.content}</p>
                  </div>
                ))}
                {comments.length === 0 && !commentsLoading && (
                  <p className="text-helper text-muted-foreground">No comments yet.</p>
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
