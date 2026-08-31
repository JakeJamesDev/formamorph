import { EyeOff, Download, MessageSquare, Trash2, ShieldAlert, ShieldCheck, TicketX } from "lucide-react";
import { ActionIcon } from "@/lib/actionIcons";
import { Progress } from "@/components/ui/progress";
import { Tip } from "@/components/ui/tooltip";
import IndeterminateProgress from "@/components/ui/indeterminate-progress";
import { cn } from "@/lib/utils";
import { CachedThumbnail } from "@/lib/useCachedThumbnail";
import { CardTags, type WorldRecord } from "@/components/WorldDetails";
import { LikeButton } from "@/components/community/LikeButton";
import { WorldCardShell } from "@/components/WorldCardShell";
import { type DownloadState } from "@/lib/downloadState";
import { KIND_LABELS, kindOf } from "@/lib/catalogKinds";
import { thumbFit } from "@/lib/thumbAspect";
import { isQuarantined, quarantineDaysLeft, quarantineDeadline } from "@/lib/quarantine";
import WorldStorageService from "@/services/WorldStorageService";
import { UserAvatar } from "@/components/UserAvatar";
import { RoleBadge } from "@/components/RoleBadge";
import { canModerate, isStaff } from "@/lib/roles";
import { TutorialPopover } from "@/components/TutorialPopover";
import { PlaceBadges } from "@/components/PlaceBadges";
import type { TutorialEntry, TutorialNav } from "@/lib/tutorials";
import type { ContestPlacement } from "@/lib/contests";

/** "3 downloads" — the tip counts too, matching the like button's. */
const counted = (n: number, noun: string) => `${n} ${noun}${n === 1 ? '' : 's'}`;

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
  /** Records a like. Absent leaves the heart a plain count. */
  onLike?: (world: WorldRecord, liked: boolean) => Promise<void>;
  /** Opens the quarantine dialog. Admin surfaces only. */
  onQuarantine?: (world: WorldRecord) => void;
  /** Lifts a quarantine. Admin surfaces only. */
  onRelease?: (world: WorldRecord) => void;
  /** Where this listing placed — the badge travels with the world, not with the tab it was won in. */
  placements?: ContestPlacement[];
  /** Take this listing out of the contest it was entered in. Offered on the contest tab, to its author. */
  onWithdraw?: (world: WorldRecord) => void;
  /** The like tutorial, when this is the card chosen to anchor it. */
  likeTutorial?: TutorialEntry | null;
  likeTutorialNav?: TutorialNav;
}

/** A single card in the community browser grid: thumbnail with a contextual download/hide overlay, plus title,
 *  description, author, counts, tags, and (for owners/admins) a delete control. */
export function RemoteWorldCard({
  world, downloadState: dlState, downloadProgress, isAuthenticated, currentUser,
  onView, onHideWorld, onHideAuthor, onHideTag, onContextualDownload, onDelete, onLike, onQuarantine, onRelease,
  placements = [], onWithdraw, likeTutorial, likeTutorialNav,
}: RemoteWorldCardProps) {
  // Get the world ID (server uses _id)
  const worldId = world._id || world.id;
  // Player-facing noun for this listing's kind (World / Entity / Dictionary), for the download tooltips.
  const noun = KIND_LABELS[kindOf(world)].one.toLowerCase();
  const thumbClass = cn("w-full h-full", thumbFit(kindOf(world) === 'entity' ? 'portrait' : 'landscape'));

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

  const likeControl = (
    <LikeButton
      likes={world.likes || 0}
      liked={world.liked}
      // Static on your own listing, which the server refuses: liking it would make the count say how much
      // somebody has published rather than how many people liked it.
      onToggle={onLike && isAuthenticated && !isOwnedByUser ? (next) => onLike(world, next) : undefined}
    />
  );

  return (
    <WorldCardShell
      // Highlight worlds with an available update with the semantic info tint + ring.
      // The shell's frame is a `group`, which the download and hide overlays fade in on.
      frameClassName={cn(
        dlState === 'update'
          ? "border-info bg-info/10 ring-1 ring-info"
          : "bg-card",
      )}
      onClick={() => onView(world)}
      name={world.name}
      description={world.description}
      cornerAction={(
        /* Both actions fade in with the card hover, so an idle card is all art. Download sits beside
           hide rather than centered on the thumbnail, where it covered the name once names started
           expanding on the same hover. Icon reflects whether the world is new, current (refresh), or
           has an update. */
        <div className="absolute top-1 right-1 z-10 flex gap-1">
          {downloadProgress === undefined && (
            <Tip tip={dlState === 'update' ? "Update available — download the newer version" : dlState === 'refresh' ? `Re-download this ${noun}` : `Download this ${noun}`}>
              <button
                onClick={(e) => { e.stopPropagation(); onContextualDownload(world, dlState); }}
                className="p-1 rounded bg-overlay/50 text-white hover:bg-overlay/70 opacity-0 pointer-events-none transition-opacity group-hover:opacity-100 group-hover:pointer-events-auto"
                aria-label={dlState === 'update' ? "Update available" : dlState === 'refresh' ? `Re-download this ${noun}` : `Download this ${noun}`}
              >
                {dlState === 'update' ? (
                  <ActionIcon.cloudUpdate className="h-5 w-5" />
                ) : dlState === 'refresh' ? (
                  <ActionIcon.cloudRefresh className="h-5 w-5" />
                ) : (
                  <ActionIcon.cloudDownload className="h-5 w-5" />
                )}
              </button>
            </Tip>
          )}
          <Tip tip="Hide this world">
            <button
              onClick={(e) => { e.stopPropagation(); onHideWorld(worldId); }}
              className="p-1 rounded bg-overlay/50 text-white hover:bg-overlay/70 opacity-0 pointer-events-none transition-opacity group-hover:opacity-100 group-hover:pointer-events-auto"
            >
              <EyeOff className="h-5 w-5" />
            </button>
          </Tip>
        </div>
      )}
      thumbnailOverlay={downloadProgress !== undefined ? (
        // Downloading: a centered status bar. -1 ⇒ size unknown.
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
      ) : undefined}
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
          <Tip
            tip={world.author?.username ? `Hide all worlds by ${world.author.username}` : undefined}
            labelsChild={false}
          >
            <span
              onClick={(e) => { e.stopPropagation(); if (world.author?.username) onHideAuthor(world.author.username); }}
              className={world.author?.username ? "cursor-pointer hover:line-through truncate" : "truncate"}
            >
              By {world.author?.username || "Unknown"}
            </span>
          </Tip>
          <RoleBadge role={world.author?.role} />
        </span>
      )}
    >
      {/* Three counts across the row: likes take the left where downloads used to sit, and downloads move
          to the middle rather than shrinking — three evenly spread numbers read as one set. */}
      <div className="grid grid-cols-3 items-center text-meta text-muted-foreground mb-2">
        {likeTutorial && likeTutorialNav ? (
          // A span carries the anchor ref: LikeButton renders a bare element and forwards none.
          <TutorialPopover entry={likeTutorial} nav={likeTutorialNav} side="bottom" align="start">
            <span className="justify-self-start">{likeControl}</span>
          </TutorialPopover>
        ) : (
          <span className="justify-self-start">{likeControl}</span>
        )}
        {/* The number stays the content, not the accessible name — that would hide the count from
            a reader. */}
        <Tip tip={counted(world.downloads || 0, 'download')} labelsChild={false}>
          <span className="flex items-center gap-1 justify-self-center">
            <Download className="h-3 w-3" /> {world.downloads || 0}
          </span>
        </Tip>
        <Tip tip={counted(world.comment_count || 0, 'comment')} labelsChild={false}>
          <span className="flex items-center gap-1 justify-self-end">
            <MessageSquare className="h-3 w-3" /> {world.comment_count || 0}
          </span>
        </Tip>
      </div>

      {/* Won a contest: said on the card itself, so the honor is visible wherever the world is found
          rather than only in the tab the contest was run in. */}
      <PlaceBadges placements={placements} className="mb-2" />

      {/* Tags */}
      <div className="mb-2">
        <CardTags tags={world.tags || []} onHide={onHideTag} />
      </div>

      {/* Only its author and the admins ever see this card, so the deadline is said plainly rather than
          hinted at — the author has something to do about it and a date by which to do it. */}
      {quarantined && (
        <div className="mb-2 rounded-md border border-warning/40 bg-warning/10 px-2 py-1 text-meta">
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
          {/* Leaving a contest is not deleting anything, so it reads as the trophy coming off rather than
              as a destructive control — and it is only ever on the author's own entry. */}
          {isOwnedByUser && onWithdraw && (
            <Tip tip="Take it out of the contest — the listing stays published">
              <button
                className="p-1 text-muted-foreground hover:text-foreground"
                onClick={(e) => { e.stopPropagation(); onWithdraw(world); }}
                aria-label={`Withdraw ${world.name || noun} from the contest`}
              >
                <TicketX className="h-5 w-5" />
              </button>
            </Tip>
          )}
          {/* Quarantine is the gentler half of the same job as Delete, so it sits beside it. */}
          {mayModerate && !quarantined && onQuarantine && (
            <Tip tip="Hide it while the author fixes it">
              <button
                className="p-1 text-warning hover:text-warning/80"
                onClick={(e) => { e.stopPropagation(); onQuarantine(world); }}
                aria-label={`Quarantine ${world.name || noun}`}
              >
                <ShieldAlert className="h-5 w-5" />
              </button>
            </Tip>
          )}
          {mayModerate && quarantined && onRelease && (
            <Tip tip="Put it back in Community Creations">
              <button
                className="p-1 text-success hover:text-success/80"
                onClick={(e) => { e.stopPropagation(); onRelease(world); }}
                aria-label={`Release ${world.name || noun}`}
              >
                <ShieldCheck className="h-5 w-5" />
              </button>
            </Tip>
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
