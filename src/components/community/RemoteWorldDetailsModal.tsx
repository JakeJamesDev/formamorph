import { useState, useEffect, useLayoutEffect, useMemo, useRef, type ReactNode } from "react";
import { toastError } from "@/lib/linkToast";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import IndeterminateProgress from "@/components/ui/indeterminate-progress";
import { Globe, Columns2, RectangleVertical, Pencil, Trash2, X, Flag, EyeOff, Check, Play } from "lucide-react";
import { ActionIcon } from "@/lib/actionIcons";
import { THUMB_FRAME, thumbAspectFor, thumbFit } from "@/lib/thumbAspect";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { MarkdownRenderer } from "@/components/game/MarkdownRenderer";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import PromptField from "@/components/prompt/PromptField";
import { plainVocabulary } from "@/lib/chipVocabulary";
import { canModerate, isStaff } from "@/lib/roles";
import { cn } from "@/lib/utils";
import { useCachedThumbnail } from "@/lib/useCachedThumbnail";
import { WorldDetailsColumn, DetailTags, DateTimeText, splitColumnClasses, type WorldRecord } from "@/components/WorldDetails";
import { formatServerDateTime } from "@/lib/serverDate";
import { type DownloadState } from "@/lib/downloadState";
import { KIND_LABELS, kindOf, kindHasMorphArt, kindHasThumbnail, listingAppVersion, listingModels, showsMorphArt, type CatalogKind } from "@/lib/catalogKinds";
import { KindArt } from "@/components/community/KindArt";
import { EntityPlaceholderArt } from "@/components/EntityPlaceholderArt";
import { CHIP_BASE } from "@/components/Chip";
import { componentKind } from "@/lib/worldDependencies";
import { associationGroups } from "@/lib/listingAssociations";
import { ListingCompatibleWorlds } from "@/components/community/ListingCompatibleWorlds";
import WorldStorageService, { type ListingDetails } from "@/services/WorldStorageService";
import { COMMENTS_PAGE, loadListingDetails, takePrefetchedComments, type CommentsPage } from "@/lib/listingDetailsLoader";
import { UserAvatar } from "@/components/UserAvatar";
import { UserName } from "@/components/UserName";
import { LikeButton } from "@/components/community/LikeButton";
import { likeCountOf } from "@/lib/likeCount";
import { LikersDialog } from "@/components/community/LikersDialog";
import { ReportDialog, type ReportTarget } from "@/components/community/ReportDialog";
import { useReportsEnabled } from "@/lib/useReportsEnabled";
import { ChangelogPanel } from "@/components/community/ChangelogPanel";
import { defaultChangelogTab, defaultTabForCount, type ChangelogEntry, type ChangelogTab } from "@/lib/listingChangelog";
import { Skeleton } from "@/components/ui/skeleton";
import { WorldActionButton } from "@/components/WorldActionButton";
import { DownloadLinkedContent } from "@/components/community/DownloadLinkedContent";
import { useWorldDownloadPlan } from "@/lib/useWorldDownloadPlan";
import { useMountedRef } from "@/lib/useMountedRef";
import type { DownloadPlan } from "@/lib/useDownloadCoordinator";
import { PlaceBadges } from "@/components/PlaceBadges";
import { placementsBy } from "@/lib/contests";
import { Tip } from "@/components/ui/tooltip";
import { VrmFileDetails } from "@/components/VrmFileDetails";
import type { ListingVisibility } from "@/lib/publishLinks";
import type { WorldAssociation } from "@/lib/compatibleWorlds";
import type { ServerEvent, VrmLicense } from "@/types";
import type { CommunityBrowserCapabilities } from '@/lib/communityBrowserCapabilities';
import { mayPressHeart } from '@/lib/anonymousLikes';

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
  onContextualDownload?: (world: WorldRecord, state: DownloadState, plan?: DownloadPlan) => void;
  onDeviceDownload?: (world: WorldRecord) => void;
  /** Which mutable app actions this shell exposes. */
  capabilities?: Pick<CommunityBrowserCapabilities, 'localLibrary' | 'deviceDownloads' | 'likes' | 'comments' | 'moderation' | 'reports'>;
  /** Who is reading, so the heart is a control only for somebody who could press it. */
  currentUser?: WorldRecord | null;
  /** Records a like. Absent leaves the heart a plain count. */
  onLike?: (world: WorldRecord, liked: boolean) => Promise<void>;
  /** Starts authentication for a guest Like without mutating the listing. */
  onGuestLike?: (world: WorldRecord) => void;
  /** Whether this shell takes a signed-out reader's like at all. Off sends them to `onGuestLike`. */
  guestLikes?: boolean;
  /** Whether the server takes one right now. Off still lets a filled heart clear. */
  serverTakesLikes?: boolean;
  /** Reports what this listing's response said about guest likes, which is the fresher answer. */
  onAnonymousLikes?: (on: boolean) => void;
  /** The contest archive the browser already fetched, so a placement is badged here as on its card. */
  contests?: ServerEvent[];
  /** Opens a contest this listing placed in, from its place chip. */
  onOpenContest?: (contestId: string) => void;
  /** Records a new like count after a staff removal, so the card behind this modal agrees. */
  onLikesChanged?: (world: WorldRecord, likes: number) => void;
  /** DEV only: raise the likers dialog as soon as the modal opens, for the dev route. */
  openLikersOnMount?: boolean;
  /** A read-only action supplied by the surface that opened this listing. */
  detailsAction?: ReactNode;
  /** Opens another listing in place of this one, for the worlds a component names. Absent leaves those
   *  worlds plain names, which is what a surface with only one listing to show wants. */
  onOpenListing?: (listing: { id: string; kind: CatalogKind }) => void;
  /** Selects this prompt listing's downloaded preset. Absent until the preset is downloaded. */
  presetUse?: { active: boolean; onUse: () => void } | null;
}

/** The same cap a feedback comment carries, so the two comment boxes hold the same amount. */
const COMMENT_MAX = 4000;

/** A count the catalog row carries, or undefined against a server that predates the field. */
const rowCount = (value: unknown): number | undefined =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : undefined;

/** Whether the Changelog panel has something to open: a known entry count above zero, or the author's own. */
const hasChangelog = (count: number | undefined, own: boolean): boolean =>
  count !== undefined && (count > 0 || own);

/** The most placeholder rows the Changelog panel holds while its entries load. */
const CHANGELOG_PLACEHOLDERS = 3;

const APP_DETAILS_CAPABILITIES: Pick<CommunityBrowserCapabilities, 'localLibrary' | 'deviceDownloads' | 'likes' | 'comments' | 'moderation' | 'reports'> = {
  localLibrary: true, deviceDownloads: false, likes: true, comments: true, moderation: true, reports: true,
};

/** The remote-world details modal: metadata + download action (left) and comments (right). Owns its own
 *  comment state/paging; download state is supplied by the parent's download coordinator via props. */
export function RemoteWorldDetailsModal({
  open, onOpenChange, world, collapsed, onToggleCollapsed,
  isAuthenticated, openImageViewer, downloadStateForWorld, downloadProgress, onContextualDownload, onDeviceDownload,
  currentUser, onLike, onGuestLike, guestLikes = false, serverTakesLikes = false, onAnonymousLikes,
  contests = [], onOpenContest, onLikesChanged, openLikersOnMount = false,
  capabilities = APP_DETAILS_CAPABILITIES,
  detailsAction, onOpenListing, presetUse,
}: RemoteWorldDetailsModalProps) {
  const [comments, setComments] = useState<WorldRecord[]>([]);
  const [commentsTotal, setCommentsTotal] = useState(0);
  const [commentsShown, setCommentsShown] = useState(COMMENTS_PAGE);
  const [commentsHasMore, setCommentsHasMore] = useState(false);
  const [commentsLoading, setCommentsLoading] = useState(false);
  // Which listing the comments fetch last settled for, keyed so a previous listing's answer never reads
  // as this one's.
  const [commentsSettledFor, setCommentsSettledFor] = useState<string | null>(null);
  // Which listing's last comments read failed, so its placeholders stop without claiming none exist.
  const [commentsFailedFor, setCommentsFailedFor] = useState<string | null>(null);
  // Whether the listing details request has settled, answered or failed. Either way the row's entry
  // count stops speaking: the answer, or its absence, is the authority.
  const [detailsSettled, setDetailsSettled] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [postingComment, setPostingComment] = useState(false);
  // The comment being rewritten, and its draft text. Only one is open at a time.
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  // Null until the listing has been read, and null forever against a server that has never heard of
  // changelogs — which is what keeps the whole feature invisible rather than broken on an old deploy.
  const [changelog, setChangelog] = useState<ChangelogEntry[] | null>(null);
  // An Avatar's own license terms, read from the file at publish. Undefined for every other kind, and
  // against a server that predates the field.
  const [modelLicense, setModelLicense] = useState<VrmLicense | undefined>(undefined);
  // What worlds this component is offered for, and whether it is in the catalog at all. Both are absent
  // against a server that predates them, which leaves their surfaces off rather than wrong.
  const [associations, setAssociations] = useState<WorldAssociation[] | undefined>(undefined);
  const [listingVisibility, setListingVisibility] = useState<ListingVisibility | undefined>(undefined);
  const [tab, setTab] = useState<ChangelogTab>('comments');
  // What the report dialog is aimed at, or null when it is closed. One dialog for both the listing and
  // any comment on it — they differ only in what they point at.
  const [reportTarget, setReportTarget] = useState<ReportTarget | null>(null);
  // Whether the likers list is up. Staff only; nothing else can raise it.
  const [showLikers, setShowLikers] = useState(false);

  // What this world requires and what it is offered as an add-on, read only while the listing is open.
  const downloadPlan = useWorldDownloadPlan(world, open && capabilities.localLibrary);

  // Only a component is offered for worlds, so a world's own listing never draws the section — whatever
  // an older payload happens to carry under the field.
  const listingComponentKind = world ? componentKind(world) : null;

  // The catalog row answers at once and the listing read corrects it, so the marker does not appear a
  // beat after the rest of the window.
  const unlisted = (listingVisibility ?? world?.visibility) === 'unlisted';

  const listingKey = world ? String(world._id || world.id) : null;

  // What the catalog row already says, so the tab state and the comments header are right on the first
  // frame. The answers below correct them. Undefined changelog count: an older server, state unknown.
  const seededChangelog = rowCount(world?.changelog_count);
  const seededComments = rowCount(world?.comment_count) ?? 0;
  const commentsAnswered = commentsSettledFor !== null && commentsSettledFor === listingKey;
  const commentsCount = commentsAnswered ? commentsTotal : seededComments;
  const commentsFailed = commentsFailedFor !== null && commentsFailedFor === listingKey;

  // Off entirely for a signed-out reader and against a server without the feature, so no surface here
  // ever offers an action that would be refused.
  const reportFeatureEnabled = useReportsEnabled(isAuthenticated && open);
  const reportsEnabled = capabilities.reports && reportFeatureEnabled;

  const plainVocab = useMemo(() => plainVocabulary(), []);

  // Token each comments fetch so a slow response for a since-closed world can't land in a different world's
  // modal: opening world B fires a newer request, and world A's late result is discarded.
  const commentsReqRef = useRef(0);

  /** The same guard for the changelog fetch, which races the same way. */
  const changelogReqRef = useRef(0);

  /** Whether the reader picked a tab in this open; a late default never overrides a pick. */
  const tabPickedRef = useRef(false);

  // Neither request id survives an unmount: a modal closed with the app still holds the newest id, so
  // the late answer passes its own guard and sets state on a tree that is gone.
  const mountedRef = useMountedRef();

  /**
   * Read the first `wanted` comments — the whole window on screen, not the next page of it.
   *
   * Asking for one page at a time by number would skip a comment as soon as one had been deleted: the
   * rows below it shift up by one, and the next page starts past the row that moved into it.
   * `prefetched` is a first page already on its way, read in place of a request of its own.
   */
  const loadComments = async (worldId: string, wanted = COMMENTS_PAGE, prefetched: Promise<CommentsPage> | null = null) => {
    const reqId = ++commentsReqRef.current;
    const current = () => mountedRef.current && reqId === commentsReqRef.current;
    setCommentsLoading(true);
    let res: CommentsPage;
    try {
      res = await (prefetched ?? WorldStorageService.fetchComments(worldId, 1, wanted));
      if (res.success === false) throw new Error('error' in res ? res.error : undefined);
    } catch (error) {
      if (!current()) return;
      // A failed read leaves the count and rows in hand; it never reads as a listing with no comments.
      setCommentsLoading(false);
      setCommentsFailedFor(worldId);
      toastError(error, 'Failed to load the comments');
      return;
    }
    if (!current()) return; // superseded by a newer world's fetch
    setCommentsLoading(false);
    setCommentsTotal(res.total);
    setCommentsHasMore(!!res.pagination?.next);
    setCommentsShown(wanted);
    setComments(res.data);
    setCommentsSettledFor(worldId);
    setCommentsFailedFor(null);
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
      toastError(error, 'Failed to post comment');
    } finally {
      setPostingComment(false);
    }
  };

  const handleSaveEdit = async () => {
    const next = editDraft.trim();
    if (!editingId || !next) return;

    setSavingEdit(true);
    try {
      const updated = await WorldStorageService.updateComment(editingId, next);
      // Written in from the server's answer rather than from the draft, so the edited marker and the
      // stored text are the same ones the next reader will get.
      setComments((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
      setEditingId(null);
    } catch (error) {
      toastError(error, 'Failed to save the comment');
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    try {
      await WorldStorageService.deleteComment(commentId);
      setComments((prev) => prev.filter((c) => c.id !== commentId));
      setCommentsTotal((n) => Math.max(0, n - 1));
      // The edit box would otherwise stay open over a comment that no longer exists.
      if (editingId === commentId) setEditingId(null);
    } catch (error) {
      toastError(error, 'Failed to delete the comment');
    }
  };

  /**
   * Read what only an open listing shows — its changelog and, for an Avatar, its license terms — and
   * decide which panel this reader arrives on. Details cached from a past open show first; the fresh
   * answer replaces them, and a request that gets no answer leaves them standing.
   *
   * Tokened like the comments fetch, and for the same reason: a slow answer for a since-closed world must
   * not land in a different world's modal.
   */
  const showListingDetails = async (worldId: string, forWorld: WorldRecord) => {
    const reqId = ++changelogReqRef.current;
    const current = () => mountedRef.current && reqId === changelogReqRef.current;

    const applyAside = (details: ListingDetails | null) => {
      setModelLicense(details?.modelLicense);
      setAssociations(details?.compatibleWorlds);
      setListingVisibility(details?.visibility);
    };
    const apply = (details: ListingDetails | null) => {
      const entries = details?.changelog ?? null;
      applyAside(details);
      setChangelog(entries);
      setDetailsSettled(true);
      if (!tabPickedRef.current) setTab(defaultChangelogTab(entries, downloadStateForWorld(forWorld)));
    };

    const load = loadListingDetails(worldId);
    const cached = await load.cached;
    if (!current()) return;
    // The catalog row is revalidated each open, and a disk entry can be visits old: a cached changelog
    // that disagrees with the row's count waits for the fresh answer instead of moving the tab.
    const rowEntries = rowCount(forWorld.changelog_count);
    const cachedAgrees = rowEntries === undefined || cached?.changelog?.length === rowEntries;
    if (cached) (cachedAgrees ? apply : applyAside)(cached);

    const fresh = await load.fresh;
    if (!current()) return;
    if (fresh.status === 'ok') {
      // The fresher answer about the setting: this response was read now, and the catalog may be a visit
      // old. Cached details and a failed request say nothing about it, so nothing is reported.
      onAnonymousLikes?.(fresh.details.anonymousLikes);
      apply(fresh.details);
    } else if (fresh.status === 'gone' || !cached) {
      apply(null);
    } else if (!cachedAgrees) {
      // No answer is coming, so the cached details are the best there is.
      apply(cached);
    }
  };

  // Reset before the first paint, so the window opens on the catalog row's tab and count rather than a
  // frame of the previous listing's.
  useLayoutEffect(() => {
    if (open && world) {
      setComments([]);
      setCommentsTotal(0);
      setCommentsSettledFor(null);
      setCommentsFailedFor(null);
      setDetailsSettled(false);
      setCommentText('');
      setEditingId(null);
      setPendingDelete(null);
      // Cleared rather than left standing: the previous world's history must not show under this one's
      // name for the frames before the fetch answers.
      setChangelog(null);
      setModelLicense(undefined);
      setAssociations(undefined);
      setListingVisibility(undefined);
      tabPickedRef.current = false;
      setTab(seededChangelog === undefined ? 'comments' : defaultTabForCount(seededChangelog, downloadStateForWorld(world)));
      setReportTarget(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, world?._id, world?.id]);

  // Fetch comments and the changelog whenever the detail modal opens for a world.
  useEffect(() => {
    if (open && world) {
      const worldId = world._id || world.id;
      loadComments(worldId, COMMENTS_PAGE, takePrefetchedComments(worldId));
      void showListingDetails(worldId, world);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, world?._id, world?.id]);

  // A kind with no cover art, and an entity or Avatar drawn as Morph art, never ask for the server's stand-in file.
  const hasArt = world ? kindHasThumbnail(kindOf(world)) : false;
  const flagged = world ? showsMorphArt(world) : false;
  const thumbFile = hasArt && !flagged ? world?.thumbnail_file : undefined;
  const thumbUrl = thumbFile
    ? `${WorldStorageService.API_URL}/thumbnails/${thumbFile}`
    : (hasArt && !flagged && world?.thumbnail) || '';
  // An entity or Avatar with no picture at all draws it too, as its card does.
  const showMorphArt = flagged || (world ? kindHasMorphArt(kindOf(world)) && !thumbUrl : false);
  // Tall art sits beside the author and counts, as on the split card.
  const aspect = world ? thumbAspectFor(kindOf(world)) : 'landscape';
  const portrait = aspect === 'portrait';
  const models = world ? listingModels(world) : [];
  const madeFor = world ? listingAppVersion(world) : null;
  // Resolve through the same blob cache the card thumbnails use, so the zoom gets a same-origin object URL
  // rather than the raw cross-origin server URL (which CORP blocks from an <img> load, breaking the viewer).
  const { src: thumbSrc } = useCachedThumbnail(thumbFile, thumbUrl, world?.updated_at);

  // Matched on either id or name, the same pair the card uses — a catalog row and the signed-in user come
  // from different endpoints and have disagreed on which one is populated before.
  const isOwnListing = Boolean(
    world?.author && currentUser &&
    (world.author.id === currentUser.id || world.author.username === currentUser.username)
  );

  // Who liked something is a moderation surface, not a social one: an author does not get it on their
  // own listing, and nothing on screen tells anybody else it exists.
  const canSeeLikers = capabilities.moderation && isStaff(currentUser);

  // The row's count says so at open; the details answer, once it lands, is the authority.
  const changelogUsable = hasChangelog(changelog ? changelog.length : detailsSettled ? undefined : seededChangelog, isOwnListing);
  // A pick of a panel that is not there shows Comments, rather than a window waiting on entries.
  const shownTab: ChangelogTab = tab === 'changelog' && !changelogUsable ? 'comments' : tab;

  // An offer the world's author turned away is the component author's business and the staff's. The
  // server already withholds it from everybody else; this decides it again rather than trusting a row
  // that arrived.
  const worldGroups = useMemo(
    () => associationGroups(associations, isOwnListing || isStaff(currentUser)),
    [associations, isOwnListing, currentUser],
  );

  // The modal outlives the listing it is showing — it stays mounted while the catalog is browsed — so a
  // likers list left open would reopen itself over whichever listing came next, unasked.
  useEffect(() => {
    setShowLikers(false);
  }, [open, listingKey]);

  // DEV: `#dev?modal=likers` lands on the likers list without clicking through the catalog first. Runs
  // after the reset above, which is what keeps the route working rather than being undone by it.
  useEffect(() => {
    if (import.meta.env.DEV && open && openLikersOnMount && canSeeLikers) setShowLikers(true);
  }, [open, listingKey, openLikersOnMount, canSeeLikers]);

  /** Whether the reader wrote this comment. Only they may rewrite it, with no deadline on it. */
  const isOwnComment = (comment: WorldRecord) =>
    Boolean(currentUser && comment.author?.id && comment.author.id === currentUser.id);

  /**
   * Whether to offer the bin: the commenter, the author of the listing it sits on, or staff who may
   * reach the commenter. The server decides the same thing again; this only keeps off screen a control
   * that would be refused. A comment's author carries `role` (null for an ordinary account), which is
   * what the shared helper reads as an account type.
   */
  const mayDelete = (comment: WorldRecord) =>
    isOwnComment(comment) || isOwnListing ||
    canModerate(currentUser, { id: comment.author?.id, accountType: comment.author?.role ?? 'normal' });

  // Click opens the pan/zoom viewer on the cached blob src, which CORP does not block. No tip without a
  // picture: the tip is the whole hint that it opens.
  const art = world && (
    <Tip tip={thumbSrc ? "Click to enlarge" : undefined} labelsChild={false}>
      <div
        className={cn(
          "relative w-full rounded-lg overflow-hidden",
          THUMB_FRAME[aspect],
          thumbSrc && "cursor-zoom-in",
        )}
        onClick={() => thumbSrc && openImageViewer(thumbSrc, world.name)}
      >
        {thumbSrc ? (
          <img
            src={thumbSrc}
            alt={world.name}
            className={cn("absolute top-0 left-0 w-full h-full", thumbFit(aspect))}
          />
        ) : !hasArt ? (
          <KindArt kind={kindOf(world)} className="absolute top-0 left-0" iconClassName="h-16 w-16" />
        ) : showMorphArt ? (
          <EntityPlaceholderArt id={String(world._id || world.id)} name={world.name ?? ''} className="absolute inset-0" />
        ) : (
          <div className="absolute top-0 left-0 w-full h-full flex items-center justify-center bg-muted text-muted-foreground">
            <Globe className="h-16 w-16" />
          </div>
        )}
      </div>
    </Tip>
  );

  const actions = world && (() => {
    // Mirror the contextual card button (none/refresh/update), icon and all.
    const dlState = downloadStateForWorld(world);
    const progress = downloadProgress[world._id || world.id];
    // While downloading, swap the button for a status bar (-1 ⇒ size unknown).
    if ((capabilities.localLibrary || capabilities.deviceDownloads) && progress !== undefined) {
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
    // What this press installs beyond the world itself, so the count answers the review
    // above it rather than making the player add it up.
    const extras = downloadPlan.count
      ? ` + ${downloadPlan.count} ${downloadPlan.count === 1 ? 'Item' : 'Items'}`
      : '';
    const download = (
      <WorldActionButton
        tone="sky"
        onClick={() => onContextualDownload?.(world, dlState, downloadPlan.plan)}
      >
        <Icon className="mr-2 h-4 w-4" /> {label}{extras}
      </WorldActionButton>
    );
    return capabilities.localLibrary && onContextualDownload ? (
      presetUse ? (
        <div className="space-y-2">
          {download}
          <WorldActionButton tone="amberSoft" disabled={presetUse.active} onClick={presetUse.onUse}>
            {presetUse.active
              ? <><Check className="mr-2 h-4 w-4" /> Preset In Use</>
              : <><Play className="mr-2 h-4 w-4" /> Use This Preset</>}
          </WorldActionButton>
        </div>
      ) : download
    ) : capabilities.deviceDownloads && onDeviceDownload ? (
      <WorldActionButton tone="sky" onClick={() => onDeviceDownload(world)}>
        <ActionIcon.cloudDownload className="mr-2 h-4 w-4" /> Download {noun}
      </WorldActionButton>
    ) : null;
  })();

  const authorCell = world && (
    <>
      <h3 className="text-helper font-semibold text-muted-foreground">Author</h3>
      <p className="flex items-center gap-2 min-w-0">
        <UserAvatar username={world.author?.username} avatarUrl={world.author?.avatarUrl} supporter={world.author?.supporter} size="sm" />
        <UserName userId={world.author?.id} username={world.author?.username} role={world.author?.role} supporter={world.author?.supporter} />
      </p>
    </>
  );

  const countCells = world && (
    <>
      <div>
        <h3 className="text-helper font-semibold text-muted-foreground">Downloads</h3>
        <p>{world.downloads || 0}</p>
      </div>

      <div>
        <h3 className="text-helper font-semibold text-muted-foreground">Likes</h3>
        <LikeButton
          count={likeCountOf(world)}
          liked={world.liked}
          size="md"
          // Static on your own listing, which the server refuses.
          onToggle={capabilities.likes && onLike && mayPressHeart({
            signedIn: isAuthenticated, ownListing: isOwnListing,
            guestLikes, serverTakesLikes, liked: world.liked,
          })
            ? (next) => onLike(world, next)
            : capabilities.likes && !isAuthenticated && onGuestLike ? async () => { onGuestLike(world); } : undefined}
          // Staff read the count as a way into who is behind it; everybody else keeps the
          // heart, and nothing on screen says a list exists.
          onOpenLikers={canSeeLikers ? () => setShowLikers(true) : undefined}
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
    </>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent aria-describedby={undefined} className={cn("h-[85dvh] flex flex-col", collapsed ? "sm:max-w-[600px]" : "sm:max-w-[1200px]")}>
        <DialogHeader className="shrink-0">
          <div className="flex items-center gap-2">
            <DialogTitle className="min-w-0 flex-1">
              {/* `leading-normal` overrides DialogTitle's `leading-none`, whose one-em line box crops
                  descenders under `truncate`'s overflow clip. Fits the row's existing height. */}
              <span className="truncate leading-normal">{world?.name || `${KIND_LABELS[world ? kindOf(world) : 'world'].one} Details`}</span>
            </DialogTitle>
            {detailsAction && <div className="shrink-0">{detailsAction}</div>}
            <Tip tip={collapsed ? "Expand to two columns" : "Collapse to single column"}>
              <Button
                variant="ghost"
                size="icon"
                className="mr-8 shrink-0 hidden md:inline-flex"
                onClick={onToggleCollapsed}
              >
                {collapsed ? <Columns2 className="h-4 w-4" /> : <RectangleVertical className="h-4 w-4" />}
              </Button>
            </Tip>
          </div>
          {/* Under the title, as on the card: opening a winning card must not lose what the card said. */}
          {world && <PlaceBadges placements={placementsBy(world, contests)} className="mr-8" shine onSelect={onOpenContest} />}
        </DialogHeader>

        {world && (
          <div className={cn("mt-4", splitColumnClasses(collapsed).wrapper)}>
            {/* Left column: metadata */}
            <div className={splitColumnClasses(collapsed).left}>
              <WorldDetailsColumn
                description={world.description || ""}
                omitEmptyDescription={kindOf(world) === 'model'}
                tags={portrait ? undefined : world.tags}
                thumbnail={portrait ? (
                  <div className="flex gap-4" data-layout="split">
                    <div className="w-2/5 shrink-0">{art}</div>
                    <div className="min-w-0 flex-1 flex flex-col gap-4 [container-type:inline-size]">
                      <div>{authorCell}</div>
                      <div className="grid grid-cols-1 gap-4 [@container(min-width:18rem)]:grid-cols-2">{countCells}</div>
                      {world.tags && <DetailTags tags={world.tags} />}
                      {/* Pinned to the art's bottom edge, where the card keeps its download. */}
                      {actions && <div className="mt-auto">{actions}</div>}
                    </div>
                  </div>
                ) : art}
                actions={portrait ? null : actions}
                meta={
                  <div className="grid grid-cols-2 gap-4" data-testid="details-meta">
                    {/* Only its author and the staff ever open an unlisted listing, so it says plainly
                        what unlisted costs rather than badging a state nobody can act on. */}
                    {unlisted && (
                      <div className="col-span-2 rounded-md border border-warning/40 bg-warning/10 px-2 py-1 text-meta">
                        <p className="flex items-center gap-1 font-medium text-warning">
                          <EyeOff className="h-3 w-3 shrink-0" /> Unlisted
                        </p>
                        <p className="text-muted-foreground">
                          This {KIND_LABELS[kindOf(world)].one.toLowerCase()} is unlisted.
                          Other players receive it only inside a world that requires it.
                        </p>
                      </div>
                    )}

                    {/* Full width so the two counts below pair off on a row of their own — they are the
                        comparison the pair exists to make. */}
                    {!portrait && <div className="col-span-2">{authorCell}</div>}

                    {/* The models a prompt fits and the app version it was made for. */}
                    {(models.length > 0 || madeFor) && (
                      <div className="col-span-2">
                        {models.length > 0 && (
                          <>
                            <h3 className="text-helper font-semibold text-muted-foreground">Models</h3>
                            <div className="flex flex-wrap gap-2 mt-1">
                              {models.map((model) => (
                                <span key={model} className={cn(CHIP_BASE, "bg-secondary text-secondary-foreground")}>{model}</span>
                              ))}
                            </div>
                          </>
                        )}
                        {madeFor && (
                          <p className="mt-2 text-meta text-muted-foreground">Made for Formamorph {madeFor}</p>
                        )}
                      </div>
                    )}

                    {!portrait && countCells}

                    {/* What the file itself permits, read from it at publish. A downloader decides here
                        what they may do with an Avatar, before they take it. */}
                    {modelLicense && (
                      <div className="col-span-2">
                        <h3 className="text-helper font-semibold text-muted-foreground">Avatar File</h3>
                        {modelLicense.title && <p className="text-meta">{modelLicense.title}</p>}
                        <VrmFileDetails license={modelLicense} />
                      </div>
                    )}

                    {/* Quiet, under everything the page is actually for. Never on your
                        own listing — reporting yourself is a way into the queue, not moderation. */}
                    {reportsEnabled && !isOwnListing && (
                      <div className="col-span-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="gap-1.5 text-muted-foreground hover:text-destructive"
                          onClick={() => setReportTarget({
                            kind: 'listing',
                            id: world._id || world.id,
                            name: world.name,
                            // The same word the button uses, so the dialog is visibly about this thing.
                            noun: KIND_LABELS[kindOf(world)].one,
                          })}
                        >
                          <Flag className="h-3.5 w-3.5" /> Report This {KIND_LABELS[kindOf(world)].one}
                        </Button>
                      </div>
                    )}
                  </div>
                }
                // Below the tags, so a section that arrives with the details answer pushes nothing above it.
                after={
                  <>
                    {/* What the download installs beside the world, and what the player may add to it.
                        Absent for a world that follows nothing, and against a server without the routes. */}
                    {capabilities.localLibrary && <DownloadLinkedContent review={downloadPlan} />}

                    {/* Where a component fits, for a player deciding whether to take it. Each world is a
                        download of its own; this one installs the component and nothing else. */}
                    {listingComponentKind && (
                      <ListingCompatibleWorlds
                        groups={worldGroups}
                        kind={listingComponentKind}
                        {...(onOpenListing
                          ? { onOpenWorld: (worldId: string) => onOpenListing({ id: worldId, kind: 'world' }) }
                          : {})}
                      />
                    )}
                  </>
                }
              />
            </div>

            {/* Right column: the changelog and the comments, one at a time. */}
            <div className={cn(splitColumnClasses(collapsed).right, "space-y-3")}>
              {/* Always drawn, so the column never jumps. Changelog waits for entries; the author's own
                  listing opens it regardless, so the way to start a changelog is where it will appear. */}
              <ToggleGroup
                type="single"
                value={shownTab}
                // A single ToggleGroup clears its value when the active item is clicked again; one panel
                // is always shown, so an empty result is ignored rather than stored.
                onValueChange={(next) => {
                  // Pressing the active tab still counts as a pick, so a late default can't move it.
                  tabPickedRef.current = true;
                  if (next) setTab(next as ChangelogTab);
                }}
                className="w-full"
              >
                <ToggleGroupItem
                  value="changelog"
                  className="flex-1"
                  disabled={!changelogUsable}
                >
                  Changelog
                </ToggleGroupItem>
                <ToggleGroupItem value="comments" className="flex-1">Comments</ToggleGroupItem>
              </ToggleGroup>

              {shownTab === 'changelog' && !changelog ? (
                // Opened on the row's word that entries exist; the details answer has them.
                <div className="space-y-3" data-testid="changelog-placeholder">
                  {Array.from({ length: Math.max(1, Math.min(seededChangelog ?? 1, CHANGELOG_PLACEHOLDERS)) }, (_, i) => (
                    <Skeleton key={i} className="h-16 w-full" />
                  ))}
                </div>
              ) : changelog && shownTab === 'changelog' ? (
                <ChangelogPanel
                  worldId={world._id || world.id}
                  entries={changelog}
                  onEntriesChange={setChangelog}
                  canEdit={isOwnListing}
                />
              ) : (
                <>
              <h3 className="text-helper font-semibold text-muted-foreground">Comments ({commentsCount})</h3>

              {capabilities.comments && isAuthenticated ? (
                <div className="space-y-2 min-w-0">
                  <PromptField
                    value={commentText}
                    onChange={(next) => setCommentText(next.slice(0, COMMENT_MAX))}
                    vocabulary={plainVocab}
                    markdown
                    ariaLabel="Comment"
                    placeholder="Leave a comment..."
                  />
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      disabled={postingComment || !commentText.trim()}
                      onClick={handlePostComment}
                    >
                      {postingComment ? 'Posting...' : 'Post Comment'}
                    </Button>
                    <span className="ml-auto text-meta text-muted-foreground">
                      {commentText.length} / {COMMENT_MAX}
                    </span>
                  </div>
                </div>
              ) : (
                <p className="text-helper text-muted-foreground">
                  {capabilities.comments ? 'Log in to leave a comment.' : 'Comments are read-only on the website.'}
                </p>
              )}

              <div className="space-y-3">
                {comments.map((c) => (
                  <div key={c.id} className="text-label border-b border-border/50 pb-2 last:border-0 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="flex items-center gap-1.5 min-w-0 font-medium">
                        <UserAvatar username={c.author?.username} avatarUrl={c.author?.avatarUrl} supporter={c.author?.supporter} size="xs" />
                        <UserName userId={c.author?.id} username={c.author?.username} role={c.author?.role} supporter={c.author?.supporter} />
                      </span>
                      <span className="flex shrink-0 items-center gap-1 text-meta text-muted-foreground">
                        {c.created_at ? formatServerDateTime(c.created_at) : ''}
                        {/* Said plainly, so a reader can tell a comment changed after the replies to it. */}
                        {c.edited_at && <span className="italic">· edited</span>}
                        {capabilities.comments && editingId !== c.id && (isOwnComment(c) || mayDelete(c) || (reportsEnabled && !isOwnComment(c))) && (
                          <span className="flex items-center">
                            {/* Per comment rather than per thread: an abusive reply under a listing that
                                is otherwise fine is the case this exists for. */}
                            {reportsEnabled && !isOwnComment(c) && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-muted-foreground hover:text-destructive"
                                aria-label="Report comment"
                                onClick={() => setReportTarget({
                                  kind: 'comment',
                                  id: c.id,
                                  name: world.name,
                                  author: c.author?.username,
                                })}
                              >
                                <Flag className="h-3.5 w-3.5" />
                              </Button>
                            )}
                            {/* The pencil is the commenter's alone: moderation reaches as far as taking
                                a comment down, never as far as rewriting somebody's words. */}
                            {isOwnComment(c) && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                aria-label="Edit comment"
                                onClick={() => { setEditingId(c.id); setEditDraft(c.content || ''); }}
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                            )}
                            {mayDelete(c) && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-destructive hover:text-destructive/80"
                                aria-label="Delete comment"
                                onClick={() => setPendingDelete(c.id)}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            )}
                          </span>
                        )}
                      </span>
                    </div>

                    {capabilities.comments && editingId === c.id ? (
                      <div className="mt-2 space-y-2 min-w-0">
                        <PromptField
                          value={editDraft}
                          onChange={(next) => setEditDraft(next.slice(0, COMMENT_MAX))}
                          vocabulary={plainVocab}
                          markdown
                          ariaLabel="Comment text"
                        />
                        <div className="flex items-center gap-2">
                          <Button size="sm" onClick={handleSaveEdit} disabled={savingEdit || !editDraft.trim()}>
                            {savingEdit ? 'Saving…' : 'Save'}
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => setEditingId(null)}>
                            <X className="mr-2 h-4 w-4" /> Cancel
                          </Button>
                          <span className="ml-auto text-meta text-muted-foreground">
                            {editDraft.length} / {COMMENT_MAX}
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div className="mt-1 min-w-0"><MarkdownRenderer text={c.content || ''} /></div>
                    )}
                  </div>
                ))}
                {/* One row per expected comment, up to a page; a listing with none skips straight to the
                    empty state. */}
                {!commentsAnswered && !commentsFailed && comments.length === 0 && Array.from({ length: Math.min(seededComments, COMMENTS_PAGE) }, (_, i) => (
                  <Skeleton key={i} className="h-14 w-full" data-testid="comment-placeholder" />
                ))}
                {comments.length === 0 && (commentsAnswered ? !commentsLoading : seededComments === 0) && (
                  <p className="text-helper text-muted-foreground">No comments yet.</p>
                )}
                {commentsHasMore && (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={commentsLoading}
                    onClick={() => loadComments(world._id || world.id, commentsShown + COMMENTS_PAGE)}
                  >
                    {commentsLoading ? 'Loading...' : 'Load more'}
                  </Button>
                )}
              </div>
                </>
              )}
            </div>
          </div>
        )}

        {capabilities.reports && <ReportDialog
          open={reportTarget !== null}
          onOpenChange={(isOpen) => { if (!isOpen) setReportTarget(null); }}
          target={reportTarget}
        />}

        {canSeeLikers && (
          <LikersDialog
            open={showLikers}
            onOpenChange={setShowLikers}
            listingId={world ? String(world._id || world.id) : null}
            listingName={world?.name}
            currentUser={currentUser}
            onLikesChanged={(likes) => { if (world) onLikesChanged?.(world, likes); }}
          />
        )}

        {capabilities.comments && <ConfirmDialog
          open={!!pendingDelete}
          onOpenChange={(isOpen) => { if (!isOpen) setPendingDelete(null); }}
          title="Delete this comment?"
          description="It goes for good, and the rest of the thread stays as it is."
          onConfirm={() => {
            const commentId = pendingDelete;
            setPendingDelete(null);
            if (commentId) void handleDeleteComment(commentId);
          }}
          onCancel={() => setPendingDelete(null)}
        />}
      </DialogContent>
    </Dialog>
  );
}
