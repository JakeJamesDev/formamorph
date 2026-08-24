import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { toast } from 'react-toastify';
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Search, RotateCcw, ArrowDownWideNarrow, ArrowUpNarrowWide, ArrowLeft, X, SlidersHorizontal, ChevronDown,
  Earth, User, BookOpen, Globe, ShieldAlert, Trophy,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { KIND_LABELS, kindOf, type CatalogKind } from "@/lib/catalogKinds";
import { BROWSE_TABS, BROWSE_TAB_LABELS, type BrowseTab } from "@/lib/browseTabs";
import { contestPhase, placementsBy, entriesOf, orderContestEntries } from "@/lib/contests";
import { isContestEvent } from "@/lib/serverEvents";
import { useContests } from "@/lib/useContests";
import { ContestBar, ContestPodium } from "@/components/community/ContestBar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Pager } from "@/components/ui/pagination";
import { ScrollArea } from "@/components/ui/scroll-area";
import { TokenAutocomplete } from "@/components/TokenAutocomplete";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { usePersistentState, boolCodec } from "@/lib/usePersistentState";
import { CHIP_BASE } from "@/components/Chip";
import { useCatalogSync } from "@/lib/useCatalogSync";
import { replaceCatalog, type CatalogWorld } from "@/lib/worldCatalog";
import { useContestWithdrawal } from "@/lib/useContestWithdrawal";
import { useDownloadCoordinator } from "@/lib/useDownloadCoordinator";
import { useLibraryDownload } from "@/lib/useLibraryDownload";
import { useDownscalePrompt } from "@/lib/useDownscalePrompt";
import EntityStorageService from "@/services/EntityStorageService";
import DictionaryStorageService from "@/services/DictionaryStorageService";
import type { Entity, Dictionary, EntityMetadata, DictionaryMetadata, ServerEvent } from "@/types";
import { EventBanner, EventBannerChips } from "@/components/events/EventBanner";
import { useEventBanners } from "@/components/events/useEventBanners";
import { useClosingSnapshot } from "@/lib/useClosingSnapshot";
import { useCommunityBrowserFilters } from "@/lib/useCommunityBrowserFilters";
import { MessageComposerDialog } from "@/components/menu/MessageComposerDialog";
import { takedownTargetFor, takedownTemplate, type TakedownTarget } from "@/lib/takedownNotice";
import {
  isQuarantined, quarantineTargetFor, quarantineTemplate, type QuarantineTarget,
} from "@/lib/quarantine";
import { isStaff } from "@/lib/roles";
import { QuarantineDialog } from "@/components/community/QuarantineDialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useIsMobile } from "@/lib/useIsMobile";
import WorldStorageService from '../services/WorldStorageService';
import AuthService from '../services/AuthService';
import { getDownloadState, type DownloadState } from '@/lib/downloadState';
import { type WorldRecord } from "@/components/WorldDetails";
import { RemoteWorldDetailsModal } from "@/components/community/RemoteWorldDetailsModal";
import { RemoteWorldCard } from "@/components/community/RemoteWorldCard";
import { CommunityFilterBar } from "@/components/community/CommunityFilterBar";
import { TutorialPopover } from "@/components/TutorialPopover";
import { useTutorial } from "@/lib/tutorials";

// Persisted preference to force the single-column (portrait) layout of the details modal at any width.
// Key string kept as-is so an existing user's saved preference survives the rename.
const COMMUNITY_BROWSER_MODAL_COLLAPSED_KEY = 'FORMAMORPH_discoverModalCollapsed';

interface CommunityCreationsBrowserProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // Local world list (drives download-state) + setter (download/overwrite add or update local copies).
  worlds: WorldRecord[];
  setWorlds: React.Dispatch<React.SetStateAction<WorldRecord[]>>;
  // The entity/dictionary libraries drive their tabs' download-state; refreshing re-reads them after a
  // download lands (unlike worlds, these are stored by their own service rather than set here).
  entities: EntityMetadata[];
  dictionaries: DictionaryMetadata[];
  refreshEntities: () => void;
  refreshDictionaries: () => void;
  isAuthenticated: boolean;
  currentUser: WorldRecord | null;
  openImageViewer: (src: string | undefined, alt: string | undefined) => void;
  /** The tab to open on — the dev-router's (`#dev?modal=community&tab=entity`), or Contest when an
   *  event banner sent the player here. */
  initialTab?: BrowseTab;
  /** A listing to open the details for, arriving from somewhere else — a notification feed row. */
  openListing?: { id: string; kind: string } | null;
  /** Fired once that listing has been opened, or found to be gone, so the host can clear its request. */
  onListingOpened?: () => void;
  /** Running community events, announced in the header the same way the main menu announces them. */
  events?: ServerEvent[];
  /** Open the place an event's content lives — the contest tab, for a contest. */
  onOpenEvent?: (event: ServerEvent) => void;
}

// The Community Creations browser: browse/search/filter/sort the published catalog, view world details
// and comments, and download/refresh/update copies to the local library.
const CommunityCreationsBrowser = ({
  open, onOpenChange, worlds, setWorlds, entities, dictionaries, refreshEntities, refreshDictionaries,
  isAuthenticated, currentUser, openImageViewer, initialTab, openListing, onListingOpened,
  events = [], onOpenEvent,
}: CommunityCreationsBrowserProps) => {
  // Catalog fetch/cache/sync (loads on open, refreshes in the background).
  const { remoteWorlds, setRemoteWorlds, isLoadingRemoteWorlds, isSyncingCatalog, catalogSettled, loadCatalog } = useCatalogSync(open);
  const [remoteWorldToDelete, setRemoteWorldToDelete] = useState<string | null>(null);
  // Set once someone else's item has been deleted, offering to tell its author why. The takedown itself
  // has already landed — declining leaves it removed and simply unexplained, as suspending does.
  const [takedown, setTakedown] = useState<TakedownTarget | null>(null);
  const [notifyAuthor, setNotifyAuthor] = useState<TakedownTarget | null>(null);
  // The listing an admin is about to quarantine, and the one whose author is about to be written to.
  const [quarantining, setQuarantining] = useState<WorldRecord | null>(null);
  const [isQuarantiningNow, setIsQuarantiningNow] = useState(false);
  const [quarantineNotice, setQuarantineNotice] = useState<QuarantineTarget | null>(null);
  // Admin-only view of just what is hidden — the whole catalog is already in memory, so this is a filter
  // over it rather than another request.
  const [quarantinedOnly, setQuarantinedOnly] = useState(false);
  const [selectedRemoteWorld, setSelectedRemoteWorld] = useState<WorldRecord | null>(null);
  const [showRemoteWorldDetailsModal, setShowRemoteWorldDetailsModal] = useState(false);
  // Offer to downscale oversized images right after a world is downloaded/overwritten.
  const { promptWorld, promptEntity, dialog: downscaleDialog } = useDownscalePrompt();
  // Download flow: per-world progress, the copy-vs-overwrite decision state, and the fetch/store handlers.
  const {
    downloadProgress, contextualAction, setContextualAction,
    overwriteSelectedId, setOverwriteSelectedId, showOverwriteSelect, setShowOverwriteSelect,
    localCopiesBySource, copiesForWorld, downloadStateForWorld,
    handleContextualDownload, handleChooseOverwrite, handleConfirmOverwrite, handleDownloadWorld,
  } = useDownloadCoordinator(worlds, setWorlds, (_id, data) => promptWorld(data));

  // Hold the copy-vs-overwrite decision's content while its dialogs fade out (contextualAction nulls on close,
  // which would otherwise flip the title/description to the other mode's text for a frame or two).
  const shownAction = useClosingSnapshot(!!contextualAction, contextualAction);

  const [communityBrowserModalCollapsed, setCommunityBrowserModalCollapsed] = usePersistentState(
    COMMUNITY_BROWSER_MODAL_COLLAPSED_KEY, false, boolCodec,
  );
  const toggleCommunityBrowserModalCollapsed = () => setCommunityBrowserModalCollapsed((prev) => !prev);

  // Which tab is being browsed. The catalog holds every kind; the pipeline below scopes to this one.
  // Contest is a fourth tab rather than a fourth kind — a narrowing of the worlds already in hand.
  const [browseTab, setBrowseTab] = useState<BrowseTab>(initialTab ?? 'world');

  // Entities and dictionaries download into their own libraries, one copy per listing. Worlds keep the
  // coordinator's multi-copy flow (see useLibraryDownload for why the two differ).
  const entityDownload = useLibraryDownload<Entity>({
    kind: 'entity',
    records: entities,
    store: async (id, entity, link) => {
      await EntityStorageService.storeEntity({ id, name: entity.name, data: entity, ...link });
    },
    refresh: refreshEntities,
    // Offer to shrink oversized portraits before they land, as worlds do for their images.
    onFetched: (entity) => promptEntity(entity),
  });

  const dictionaryDownload = useLibraryDownload<Dictionary>({
    kind: 'dictionary',
    records: dictionaries,
    store: async (id, book, link) => {
      await DictionaryStorageService.storeDictionary({ id, name: book.name, data: book, ...link });
    },
    refresh: refreshDictionaries,
  });

  const downloadFor = (kind: CatalogKind) => (kind === 'entity' ? entityDownload : dictionaryDownload);

  /**
   * The none/refresh/update state for any listing, from whichever library holds that kind.
   *
   * Memoized on the three copy maps: the browse pipeline sorts by it, so an identity that changed every
   * render would re-sort the whole catalog every time.
   */
  const downloadStateForRecord = useCallback((record: WorldRecord): DownloadState => {
    const kind = kindOf(record);
    return kind === 'world' ? downloadStateForWorld(record) : downloadFor(kind).downloadStateFor(record);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localCopiesBySource, entityDownload.copyBySource, dictionaryDownload.copyBySource]);

  // Every in-flight bar, keyed by listing id — unique across kinds, so the three sources merge cleanly.
  const allDownloadProgress = {
    ...downloadProgress,
    ...entityDownload.downloadProgress,
    ...dictionaryDownload.downloadProgress,
  };

  const handleCardDownload = (record: WorldRecord, state: DownloadState) => {
    const kind = kindOf(record);
    if (kind === 'world') {
      handleContextualDownload(record, state);
      return;
    }
    downloadFor(kind).startDownload(record);
  };

  // Browse pipeline: search/author/tag/sort filters, hide preferences, and responsive pagination.
  // Moderation controls are offered to any staff account; the server narrows it per listing.
  const viewerIsStaff = isStaff(currentUser);

  // Narrowed before paging, not after: filtering the page in hand would leave the pager counting pages
  // that are mostly empty. The catalog is one request that already carries every quarantined listing this
  // account may see, so this is a filter over it rather than another fetch — the same as search and tags.
  const catalogForKinds = quarantinedOnly ? remoteWorlds.filter(isQuarantined) : remoteWorlds;
  const quarantinedCount = remoteWorlds.filter(isQuarantined).length;

  // Contests: the one running now and the archives behind it. The tab appears while there is either.
  const { contests, loaded: contestsLoaded } = useContests(open);
  const [selectedContestId, setSelectedContestId] = useState<string | null>(null);
  // The newest contest is the default — the running one when there is one, since that is how they sort.
  const shownContest = contests.find((c) => c.id === selectedContestId) ?? contests[0] ?? null;

  // On the contest's own tab its banner card is the one card with nowhere to send anyone: its action goes
  // where the reader already is. Announcements are untouched — they are unrelated news, and hiding the
  // contest must not take them down with it.
  const bannerEvents = useMemo(
    () => (browseTab === 'contest' ? events.filter((event) => !isContestEvent(event)) : events),
    [browseTab, events],
  );

  const banners = useEventBanners(bannerEvents);

  // The banner here drives this browser's own tab rather than asking the host to re-open it: the host's
  // request is already set to the contest by the time the second click lands, so re-sending it is a
  // no-op React bails on and the button dies. Anything that isn't a contest still goes back to the host.
  const openEventFromBanner = useCallback((event: ServerEvent) => {
    if (isContestEvent(event)) setBrowseTab('contest');
    else onOpenEvent?.(event);
  }, [onOpenEvent]);

  // A fresh shuffle seed each time the browser opens, so a live contest is re-ordered per visit but holds
  // still while the reader is looking at it. The archive picked last time is dropped at the same moment:
  // the running contest is what a visit opens on, not whichever old one was last read.
  const [shuffleSeed, setShuffleSeed] = useState(() => Math.random());
  useEffect(() => {
    if (!open) return;
    setShuffleSeed(Math.random());
    setSelectedContestId(null);
  }, [open]);

  // The browser is mounted for the app's lifetime, so the tab it was asked to open on is applied each
  // time it opens rather than only at mount — otherwise the second click on an event banner lands on
  // whichever tab the last visit was left on.
  useEffect(() => {
    if (open && initialTab) setBrowseTab(initialTab);
  }, [open, initialTab]);

  // A contest that ends up not being browsable — the read failed, or the router aimed here on a server
  // with no contests — leaves the reader on a tab with no trigger. Send them back to the catalog.
  useEffect(() => {
    if (browseTab === 'contest' && open && contestsLoaded && contests.length === 0) setBrowseTab('world');
  }, [browseTab, open, contestsLoaded, contests.length]);

  const contestOrder = useCallback(
    (list: WorldRecord[]) => orderContestEntries(list, shownContest, shuffleSeed),
    [shownContest, shuffleSeed],
  );

  // Withdrawing clears the flag on the server; the catalog in hand and its cache are corrected to match,
  // so the entry leaves the grid at once and stays gone across a reopen. Re-fetching instead would seed
  // the grid from the stale cache first, flashing the entry back in before the reply landed.
  // Read through a ref rather than captured: a like or a download can land while the withdrawal is in
  // flight, and a snapshot taken when the button was pressed would undo it.
  const remoteWorldsRef = useRef(remoteWorlds);
  remoteWorldsRef.current = remoteWorlds;

  const withdrawal = useContestWithdrawal(useCallback((listingId: string) => {
    const released = remoteWorldsRef.current.map((record) => (
      String(record._id || record.id) === listingId
        ? { ...record, contest_event_id: null, contestEventId: null }
        : record
    ));
    setRemoteWorlds(released);
    void replaceCatalog(released as CatalogWorld[]);
  }, [setRemoteWorlds]));

  const catalogInView = browseTab === 'contest'
    ? entriesOf(remoteWorlds, shownContest?.id)
    : catalogForKinds;

  const {
    searchQuery, applySearchInput, authorFilter, setAuthorFilter, tagFilter, setTagFilter,
    tagMode, setTagMode, statusFilter, toggleStatus, clearFilters, activeFilterCount,
    sortField, setSortField, sortOrder, setSortOrder,
    sortUpdatesFirst, setSortUpdatesFirst, currentPage, setCurrentPage,
    hiddenWorldIds, hiddenTags, hiddenAuthors,
    hideRemoteWorld, hideRemoteTag, hideRemoteAuthor,
    setHiddenTagsList, setHiddenAuthorsList,
    resetHiddenWorlds, unhideWorld, hiddenWorldName,
    allAuthors, allTags, filteredRemoteWorlds, totalPages, pagedRemoteWorlds,
  } = useCommunityBrowserFilters(
    catalogInView, downloadStateForRecord, open, browseTab,
    currentUser?.id ? String(currentUser.id) : undefined,
    browseTab === 'contest' ? contestOrder : undefined,
  );

  /** Whether anything is narrowing the grid — what tells an empty result from an empty catalog. */
  const anyFilterApplied = Boolean(searchQuery) || activeFilterCount > 0;

  // Admin-only, and only once something is actually quarantined: a toggle that can only ever show an
  // empty list is a control that teaches nothing.
  const quarantineControl = viewerIsStaff && quarantinedCount > 0 && browseTab !== 'contest' ? (
    <Button
      variant={quarantinedOnly ? 'default' : 'outline'}
      size="sm"
      className="shrink-0 gap-1"
      aria-pressed={quarantinedOnly}
      onClick={() => setQuarantinedOnly((prev) => !prev)}
      title="Show only what is hidden pending changes"
    >
      <ShieldAlert className="h-4 w-4" />
      Quarantined ({quarantinedCount})
    </Button>
  ) : null;

  // On mobile the sort/filter controls collapse behind a "Filters" toggle; on desktop they stay inline.
  const isMobile = useIsMobile();
  const [filtersOpen, setFiltersOpen] = useState(false);

  // The card that anchors the like tutorial: the first one on the page whose heart is a control rather
  // than a count. Your own listings can't be liked, and a signed-out reader can't like anything.
  const likeAnchor = isAuthenticated
    ? pagedRemoteWorlds.find((w) => !(
      w.author && currentUser && (w.author.id === currentUser.id || w.author.username === currentUser.username)
    ))
    : undefined;
  const likeAnchorId = likeAnchor ? likeAnchor._id || likeAnchor.id : undefined;

  // Explanations wait for the thing they explain: the like heart until a likeable card is on screen.
  const { active: tutorial, nav: tutorialNav, dismiss } = useTutorial('community', {
    active: open,
    held: likeAnchorId ? undefined : ['community-like'],
  });
  /** Using a control counts as reading its explanation, exactly as the button does. */
  const dismissIfShowing = (id: string) => { if (tutorial?.id === id) dismiss(id); };

  // On mobile the filter bar and the Hidden panel both live behind the Filters toggle, so that button
  // anchors both of their explanations.
  const filtersToggleTutorial = isMobile
    && (tutorial?.id === 'community-filters' || tutorial?.id === 'community-hidden') ? tutorial : null;
  const filterBarTutorial = !isMobile && tutorial?.id === 'community-filters' ? tutorial : null;
  const hiddenTutorial = !isMobile && tutorial?.id === 'community-hidden' ? tutorial : null;

  // Numbered page links with first/last anchors + ellipsis (matches the in-game transcript pager).

  const handleRemoteWorldDelete = async (worldId: string) => {
    // Every kind is served by the /worlds route; only the wording differs, so name it from the record.
    const record = remoteWorlds.find((w) => (w._id || w.id) === worldId) ?? {};
    const noun = KIND_LABELS[kindOf(record)].one;
    try {
      const response = await fetch(`${WorldStorageService.API_URL}/worlds/${worldId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${AuthService.token}`
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `Failed to delete ${noun.toLowerCase()}`);
      }

      setRemoteWorlds(prev => prev.filter(w => (w._id || w.id) !== worldId));
      setRemoteWorldToDelete(null);
      toast.success(`${noun} deleted successfully`);

      // Someone else's work: offer to tell them why it went. Their own needs no explanation.
      setTakedown(takedownTargetFor(record, currentUser?.id));
    } catch (error) {
      console.error('Error deleting remote item:', error);
      toast.error((error as Error).message || `Failed to delete ${noun.toLowerCase()}`);
    }
  };

  const handleQuarantine = async (days: number) => {
    if (!quarantining) return;
    const worldId = String(quarantining._id || quarantining.id);
    const noun = KIND_LABELS[kindOf(quarantining)].one;

    setIsQuarantiningNow(true);
    try {
      const state = await WorldStorageService.quarantineRemoteWorld(worldId, days);
      // Patched in place rather than re-synced: the catalog is one big request, and re-fetching it to
      // learn one field would blank the grid the admin is working in.
      const updated = {
        ...quarantining,
        quarantined_at: state.quarantinedAt,
        quarantine_expires_at: state.quarantineExpiresAt,
        quarantine_extended: state.quarantineExtended ? 1 : 0,
      };
      setRemoteWorlds((prev) => prev.map((w) => ((w._id || w.id) === worldId ? updated : w)));
      setQuarantining(null);
      toast.success(`${noun} quarantined`);

      // Someone else's work: they are owed an explanation of what to fix, and by when.
      setQuarantineNotice(quarantineTargetFor(updated, currentUser?.id));
    } catch (error) {
      toast.error((error as Error).message || `Failed to quarantine the ${noun.toLowerCase()}`);
    } finally {
      setIsQuarantiningNow(false);
    }
  };

  /**
   * Record a like, taking the count from the server's own answer.
   *
   * Patched in place rather than re-synced, like a quarantine: the catalog arrives as one big request, and
   * refetching it to learn one number would blank the grid — and re-sort it under the pointer when the
   * reader is sorting by likes.
   */
  const handleLike = async (world: WorldRecord, liked: boolean) => {
    dismissIfShowing('community-like');
    const worldId = String(world._id || world.id);
    const state = await WorldStorageService.setRemoteWorldLiked(worldId, liked);

    setRemoteWorlds((prev) => prev.map((w) => ((w._id || w.id) === worldId
      ? { ...w, liked: state.liked, likes: state.likes }
      : w)));
    // The open details modal holds its own copy of the record, so it needs the same patch to agree.
    setSelectedRemoteWorld((prev) => (prev && (prev._id || prev.id) === worldId
      ? { ...prev, liked: state.liked, likes: state.likes }
      : prev));
  };

  const handleRelease = async (world: WorldRecord) => {
    const worldId = String(world._id || world.id);
    const noun = KIND_LABELS[kindOf(world)].one;

    try {
      await WorldStorageService.releaseRemoteWorld(worldId);
      setRemoteWorlds((prev) => prev.map((w) => ((w._id || w.id) === worldId
        ? { ...w, quarantined_at: null, quarantine_expires_at: null, quarantine_extended: 0 }
        : w)));
      toast.success(`${noun} released`);
    } catch (error) {
      toast.error((error as Error).message || `Failed to release the ${noun.toLowerCase()}`);
    }
  };

  // Handle viewing remote world details
  const handleViewRemoteWorldDetails = (world: WorldRecord) => {
    setSelectedRemoteWorld(world);
    setShowRemoteWorldDetailsModal(true);
  };

  // A listing named from outside — a notification feed row. The catalog is one request for every kind, so
  // there is nothing to fetch: switch to its tab and open it once the catalog is in hand. The list at
  // arrival may be last visit's snapshot (or still empty), so a lookup miss only counts once a refresh
  // has settled during this open; until then the request is held rather than misreported as deleted.
  useEffect(() => {
    if (!open) {
      // Closed while still waiting: drop the request rather than popping its modal on a later visit.
      if (openListing) onListingOpened?.();
      return;
    }
    if (!openListing) return;

    const found = remoteWorlds.find((w) => (w._id || w.id) === openListing.id);
    if (found) {
      setBrowseTab(kindOf(found));
      // Set directly rather than through the click handler, which is rebuilt every render and would
      // make this effect chase its own identity.
      setSelectedRemoteWorld(found);
      setShowRemoteWorldDetailsModal(true);
    } else if (!catalogSettled) {
      return;
    } else {
      // Deleted or quarantined between the feed being read and the row being clicked.
      toast.info('That listing is no longer in Community Creations');
    }

    onListingOpened?.();
  }, [open, openListing, catalogSettled, remoteWorlds, onListingOpened]);

  // Header control fragments — reused across the mobile (collapsible) and desktop (inline) header layouts.
  // Mirrors the local library's tabs (MainMenu's `cardType`) so the same three kinds read the same way
  // in both places — icons below the label breakpoint, matching that header.
  const kindTabs = (
    <TutorialPopover
      entry={tutorial?.id === 'community-kind-tabs' ? tutorial : null}
      nav={tutorialNav}
      align="start"
    >
    <TabsList onPointerDownCapture={() => dismissIfShowing('community-kind-tabs')}>
      <TabsTrigger value="world" aria-label="Worlds" title="Worlds">
        <Earth className="h-5 w-5 min-[1040px]:hidden" />
        <span className="hidden min-[1040px]:inline">Worlds</span>
      </TabsTrigger>
      <TabsTrigger value="entity" aria-label="Entities" title="Entities">
        <User className="h-5 w-5 min-[1040px]:hidden" />
        <span className="hidden min-[1040px]:inline">Entities</span>
      </TabsTrigger>
      <TabsTrigger value="dictionary" aria-label="Dictionaries" title="Dictionaries">
        <BookOpen className="h-5 w-5 min-[1040px]:hidden" />
        <span className="hidden min-[1040px]:inline">Dictionaries</span>
      </TabsTrigger>
      {/* A fourth tab only while there is a contest to browse — running, or finished and archived. */}
      {contests.length > 0 && (
        <TabsTrigger value="contest" aria-label="Contest" title="Contest">
          <Trophy className="h-5 w-5 min-[1040px]:hidden" />
          <span className="hidden min-[1040px]:inline">Contest</span>
        </TabsTrigger>
      )}
    </TabsList>
    </TutorialPopover>
  );

  const searchControl = (
    <TutorialPopover
      entry={tutorial?.id === 'community-search-prefixes' ? tutorial : null}
      nav={tutorialNav}
      align="start"
    >
    <div className="relative flex-grow min-w-[200px]">
      <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
      {/* `author:`/`tag:`/`status:` typed here become filter chips — see the hook's applySearchInput.
          Enter finishes the token under the cursor, a space finishes it as you keep typing. */}
      <Input
        // The prefix hint is desktop-only: on mobile it outruns the field and hides the word "Search".
        placeholder={isMobile
          ? `Search ${BROWSE_TAB_LABELS[browseTab].many.toLowerCase()}…`
          : `Search ${BROWSE_TAB_LABELS[browseTab].many.toLowerCase()}… or type author:, tag:, status:`}
        className="pl-8"
        value={searchQuery}
        onChange={(e) => { dismissIfShowing('community-search-prefixes'); applySearchInput(e.target.value); }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
            e.preventDefault();
            applySearchInput(e.currentTarget.value, true);
          }
        }}
      />
    </div>
    </TutorialPopover>
  );

  const refreshControl = (
    <Button
      variant="outline"
      size="icon"
      className="h-9 w-9 shrink-0"
      title="Refresh catalog"
      disabled={isSyncingCatalog}
      onClick={() => loadCatalog(true)}
    >
      {/* Reversed spin: animate-spin turns clockwise, but this glyph's arrow points counterclockwise. */}
      <RotateCcw className={`h-4 w-4 ${isSyncingCatalog ? 'animate-spin [animation-direction:reverse]' : ''}`} />
    </Button>
  );

  // Dismissed banners ride the header's own toolbar rather than a row of their own — a full-width row
  // reserved for a chip is most of a row of nothing. True centering is out in a row that wraps, so they
  // trail the controls and wrap with them.
  const eventChips = <EventBannerChips banners={banners} onOpenEvent={openEventFromBanner} />;

  // A contest's entries are ordered by the contest, not by the reader: shuffled while it runs, by likes
  // once it is judged. Offering a sort that the grid then overrides would be a control that lies.
  const sortControl = browseTab === 'contest' ? null : (
    <div className="flex items-center gap-1">
      <Select value={sortField} onValueChange={(v) => { setSortField(v); setCurrentPage(1); }}>
        <SelectTrigger className="w-[160px] h-9"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="updated_at">Last Updated</SelectItem>
          <SelectItem value="created_at">Creation Date</SelectItem>
          <SelectItem value="downloads">Downloads</SelectItem>
          <SelectItem value="likes">Likes</SelectItem>
        </SelectContent>
      </Select>
      <Button
        variant="outline"
        size="icon"
        className="h-9 w-9 shrink-0"
        title={sortOrder === 'desc' ? 'Descending' : 'Ascending'}
        onClick={() => { setSortOrder((o) => (o === 'desc' ? 'asc' : 'desc')); setCurrentPage(1); }}
      >
        {sortOrder === 'desc' ? <ArrowDownWideNarrow className="h-4 w-4" /> : <ArrowUpNarrowWide className="h-4 w-4" />}
      </Button>
    </div>
  );

  const hiddenControl = (
    // The tutorial wraps the Hidden popover rather than sitting inside it: its own Popover would otherwise
    // become the context the trigger below binds to.
    <TutorialPopover entry={hiddenTutorial} nav={tutorialNav} align="start">
    <span className="inline-flex shrink-0">
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="shrink-0"
          onPointerDownCapture={() => dismissIfShowing('community-hidden')}
        >
          Hidden{hiddenWorldIds.length + hiddenTags.length + hiddenAuthors.length > 0 ? ` (${hiddenWorldIds.length + hiddenTags.length + hiddenAuthors.length})` : ''}
        </Button>
      </PopoverTrigger>
      {/* Radix focuses the first thing it finds on open, which here is a field that opens its suggestion
          list on focus — so the panel arrived with its own contents covered. Opening it is a request to
          see what is hidden, not to start typing; focus stays on the trigger and Tab reaches the fields. */}
      <PopoverContent
        portal={false}
        align="start"
        side="bottom"
        className="w-80 space-y-3"
        onOpenAutoFocus={(event) => event.preventDefault()}
      >
        {/* Type to hide tags/authors (autocompletes over the catalog); chips are the hidden items. */}
        <div className="space-y-1">
          <span className="text-meta font-medium text-muted-foreground">Tags</span>
          <TokenAutocomplete values={hiddenTags} onChange={setHiddenTagsList} options={allTags} placeholder="tag…" openOnFocus />
        </div>
        <div className="space-y-1">
          <span className="text-meta font-medium text-muted-foreground">Authors</span>
          <TokenAutocomplete values={hiddenAuthors} onChange={setHiddenAuthorsList} options={allAuthors} placeholder="author…" openOnFocus />
        </div>
        {hiddenWorldIds.length > 0 && (
          <div className="space-y-1">
            <span className="text-meta font-medium text-muted-foreground">Worlds</span>
            <div className="flex flex-wrap gap-1">
              {hiddenWorldIds.map((id) => (
                <span key={`w-${id}`} className={cn(CHIP_BASE, "bg-secondary text-secondary-foreground")}>
                  {hiddenWorldName(id)}
                  <button onClick={() => unhideWorld(id)} className="hover:text-destructive" aria-label="Unhide world"><X className="h-3 w-3" /></button>
                </span>
              ))}
            </div>
          </div>
        )}
        {hiddenWorldIds.length + hiddenTags.length + hiddenAuthors.length > 0 && (
          <Button variant="ghost" size="sm" className="h-7 px-2 text-meta" onClick={resetHiddenWorlds}>
            <RotateCcw className="h-3 w-3 mr-1" /> Reset all
          </Button>
        )}
      </PopoverContent>
    </Popover>
    </span>
    </TutorialPopover>
  );

  const updatesControl = browseTab === 'contest' ? null : (
    <label className="ml-auto flex items-center gap-2 shrink-0 cursor-pointer text-label select-none">
      <Checkbox
        checked={sortUpdatesFirst}
        onCheckedChange={(c) => { setSortUpdatesFirst(c === true); setCurrentPage(1); }}
      />
      Updates first
    </label>
  );

  // Hidden and updates-first ride along inside the bar: they narrow or reorder the same grid, and a second
  // row for two controls reads as a second, unrelated set of filters.
  const filterBar = (
    <TutorialPopover entry={filterBarTutorial} nav={tutorialNav} align="start">
    <div onPointerDownCapture={() => dismissIfShowing('community-filters')}>
    <CommunityFilterBar
      authorFilter={authorFilter}
      setAuthorFilter={setAuthorFilter}
      tagFilter={tagFilter}
      setTagFilter={setTagFilter}
      tagMode={tagMode}
      setTagMode={setTagMode}
      statusFilter={statusFilter}
      toggleStatus={toggleStatus}
      clearFilters={clearFilters}
      allAuthors={allAuthors}
      allTags={allTags}
      signedIn={isAuthenticated}
    >
      {hiddenControl}
      {updatesControl}
    </CommunityFilterBar>
    </div>
    </TutorialPopover>
  );

  return (
    <>
      {downscaleDialog}

      {/* Updating an entity/dictionary replaces the single local copy, so an edited one asks first —
          there's no second copy for the edits to survive in (unlike worlds). ConfirmDialog holds its text
          while fading out, so the name doesn't vanish mid-animation. */}
      <ConfirmDialog
        open={!!entityDownload.dirtyConfirm}
        onOpenChange={(v) => { if (!v) entityDownload.setDirtyConfirm(null); }}
        title="Replace your edited entity?"
        description={`You've edited your copy of "${entityDownload.dirtyConfirm?.name ?? ''}". Downloading again replaces it with the published version, and your changes are lost.`}
        onConfirm={entityDownload.confirmDirtyDownload}
      />

      <ConfirmDialog
        open={!!dictionaryDownload.dirtyConfirm}
        onOpenChange={(v) => { if (!v) dictionaryDownload.setDirtyConfirm(null); }}
        title="Replace your edited dictionary?"
        description={`You've edited your copy of "${dictionaryDownload.dirtyConfirm?.name ?? ''}". Downloading again replaces it with the published version, and your changes are lost.`}
        onConfirm={dictionaryDownload.confirmDirtyDownload}
      />
      {/* Community Creations browser dialog */}
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent aria-describedby={undefined}
          hideClose
          className="max-w-none w-screen h-dvh sm:max-w-none left-0 top-0 translate-x-0 translate-y-0 rounded-none sm:rounded-none p-0 gap-0 flex flex-col data-[state=open]:!slide-in-from-top-0 data-[state=open]:!slide-in-from-left-0 data-[state=closed]:!slide-out-to-top-0 data-[state=closed]:!slide-out-to-left-0"
        >
          {/* The kind switcher lives in the header and its results below it, so one root spans both.
              `contents` on the root and each panel leaves the dialog's own flex column untouched. */}
          <Tabs value={browseTab} onValueChange={(v) => setBrowseTab(v as BrowseTab)} className="contents">
          {/* Header: back · title · search · refresh always visible. On mobile the sort/filter controls
              collapse behind a "Filters" toggle; on desktop they stay inline. */}
          <Collapsible open={filtersOpen} onOpenChange={setFiltersOpen} className="shrink-0 border-b">
            <div className="px-6 py-4 space-y-4">
              {isMobile ? (
                // Two rows on mobile, not four. The title goes screen-reader-only the way the World
                // Editor's does — the header it names is the only thing on screen — which frees its row
                // for the search box, and the kind tabs drop to share a row with the Filters toggle.
                <>
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="icon" className="shrink-0" onClick={() => onOpenChange(false)} aria-label="Back">
                      <ArrowLeft className="h-5 w-5" />
                    </Button>
                    <DialogTitle className="sr-only">Community Creations</DialogTitle>
                    {searchControl}
                    {refreshControl}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {kindTabs}
                    {quarantineControl}
                    <TutorialPopover entry={filtersToggleTutorial} nav={tutorialNav} align="end">
                    <CollapsibleTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className="ml-auto shrink-0 gap-1"
                        onPointerDownCapture={() => {
                          dismissIfShowing('community-filters');
                          dismissIfShowing('community-hidden');
                        }}
                      >
                        <SlidersHorizontal className="h-4 w-4" />
                        Filters{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
                        <ChevronDown className={`h-4 w-4 transition-transform ${filtersOpen ? 'rotate-180' : ''}`} />
                      </Button>
                    </CollapsibleTrigger>
                    </TutorialPopover>
                    {eventChips}
                  </div>
                </>
              ) : (
                <div className="flex flex-wrap items-center gap-2 sm:gap-4">
                  <Button variant="ghost" size="icon" className="shrink-0" onClick={() => onOpenChange(false)} aria-label="Back">
                    <ArrowLeft className="h-5 w-5" />
                  </Button>
                  <DialogTitle className="flex items-center gap-2 whitespace-nowrap mr-2"><Globe className="h-4 w-4 shrink-0" /> Community Creations</DialogTitle>
                  {kindTabs}
                  {searchControl}
                  {quarantineControl}
                  {refreshControl}
                  {sortControl}
                  {eventChips}
                </div>
              )}

              {isMobile ? (
                <CollapsibleContent className="space-y-3">
                  {sortControl}
                  {filterBar}
                </CollapsibleContent>
              ) : (
                filterBar
              )}

              {/* The same event banner the main menu carries — the two surfaces share no shell, so this
                  is a second instance rather than a moved one. Margins come from the header's own
                  padding, so the card's are dropped. */}
              <EventBanner banners={banners} onOpenEvent={openEventFromBanner} className="mx-0 mb-0" />
            </div>
          </Collapsible>

          {/* The contest's own header: which contest, where it stands, its rules, and — once several have
              been run — which archive is being read. Above the grid rather than inside it, so it stays put
              while the entries scroll. */}
          {browseTab === 'contest' && shownContest && (
            <>
              <ContestBar
                contest={shownContest}
                contests={contests}
                onSelect={setSelectedContestId}
                entryCount={catalogInView.length}
              />
              {contestPhase(shownContest) === 'decided' && <ContestPodium contest={shownContest} />}
            </>
          )}

          {/* A panel per tab so every trigger's `aria-controls` resolves; one grid serves whichever tab is
              showing, so the others render empty. */}
          {BROWSE_TABS.filter((k) => k !== browseTab).map((k) => (
            <TabsContent key={k} value={k} className="contents" />
          ))}

          {/* Scrollable results */}
          <TabsContent value={browseTab} className="contents">
          <ScrollArea className="flex-1 min-h-0">
            {/* World grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 px-6 py-4">
              {isLoadingRemoteWorlds ? (
                Array(4).fill(0).map((_, index) => (
                  <div key={index} className="relative w-full h-48 rounded-lg overflow-hidden">
                    <Skeleton className="w-full h-full" />
                    <div className="absolute bottom-0 left-0 right-0 bg-overlay/50 p-2">
                      <Skeleton className="h-6 w-24" />
                    </div>
                  </div>
                ))
              ) : filteredRemoteWorlds.length === 0 ? (
                <div className="col-span-full text-center py-12 text-muted-foreground">
                  {/* Filters now outlive the session, so an empty grid names them rather than reading as an
                      empty catalog. */}
                  {browseTab === 'contest' && !anyFilterApplied ?
                    (shownContest && contestPhase(shownContest) === 'live'
                      ? 'No entries yet. Publish a world with the contest switch on to be the first.'
                      : 'This contest ended with no entries.') :
                    quarantinedOnly ?
                    `No ${BROWSE_TAB_LABELS[browseTab].many.toLowerCase()} are quarantined.` :
                    anyFilterApplied ?
                      `No ${BROWSE_TAB_LABELS[browseTab].many.toLowerCase()} match your filters. Clear them to see everything.` :
                      `No ${BROWSE_TAB_LABELS[browseTab].many.toLowerCase()} available. Be the first to publish one!`}
                </div>
              ) : (
                pagedRemoteWorlds.map((world) => {
                  const worldId = world._id || world.id;
                  return (
                    <RemoteWorldCard
                      key={worldId}
                      world={world}
                      downloadState={downloadStateForRecord(world)}
                      downloadProgress={allDownloadProgress[worldId]}
                      isAuthenticated={isAuthenticated}
                      currentUser={currentUser}
                      onView={handleViewRemoteWorldDetails}
                      onHideWorld={hideRemoteWorld}
                      onHideAuthor={hideRemoteAuthor}
                      onHideTag={hideRemoteTag}
                      onContextualDownload={handleCardDownload}
                      onDelete={setRemoteWorldToDelete}
                      onLike={handleLike}
                      onQuarantine={setQuarantining}
                      onRelease={handleRelease}
                      placements={placementsBy(world, contests)}
                      // Only where the entry is the subject, and only while it is still an entry: a
                      // decided contest keeps its podium, and the server refuses to release a placed world.
                      onWithdraw={browseTab === 'contest' && shownContest && contestPhase(shownContest) !== 'decided'
                        ? (entry) => withdrawal.ask({
                            id: String(entry._id || entry.id),
                            name: String(entry.name ?? 'That world'),
                          })
                        : undefined}
                      likeTutorial={
                        tutorial?.id === 'community-like' && worldId === likeAnchorId ? tutorial : null
                      }
                      likeTutorialNav={tutorialNav}
                    />
                  );
                })
              )}
            </div>
          </ScrollArea>
          </TabsContent>

          {/* Frozen footer: pagination */}
          <div className="shrink-0 border-t px-6 py-3">
            {!isLoadingRemoteWorlds && filteredRemoteWorlds.length > 0 && (
              <Pager page={currentPage} pageCount={totalPages} onPageChange={setCurrentPage} />
            )}
          </div>
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* Remote World Details Modal — details + comments live in the component */}
      <RemoteWorldDetailsModal
        open={showRemoteWorldDetailsModal}
        onOpenChange={setShowRemoteWorldDetailsModal}
        world={selectedRemoteWorld}
        collapsed={communityBrowserModalCollapsed}
        onToggleCollapsed={toggleCommunityBrowserModalCollapsed}
        isAuthenticated={isAuthenticated}
        openImageViewer={openImageViewer}
        downloadStateForWorld={downloadStateForRecord}
        downloadProgress={allDownloadProgress}
        onContextualDownload={handleCardDownload}
        currentUser={currentUser}
        onLike={handleLike}
        contests={contests}
      />

      {/* Refresh/Update decision: download a separate copy vs overwrite an existing local copy */}
      <Dialog
        open={!!contextualAction && !showOverwriteSelect}
        onOpenChange={(o) => { if (!o) setContextualAction(null); }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{shownAction?.mode === 'update' ? 'Update available' : 'Re-download world'}</DialogTitle>
            <DialogDescription>
              {shownAction?.mode === 'update'
                ? 'A newer version of this world is available. Update an existing copy in place, or download the new version as a separate copy.'
                : 'You already have this world. Download another copy, or overwrite an existing copy with a fresh download.'}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setContextualAction(null)}>Cancel</Button>
            <Button
              variant="secondary"
              onClick={() => { if (contextualAction) handleDownloadWorld(contextualAction.world); setContextualAction(null); }}
            >
              Download a copy
            </Button>
            <Button onClick={handleChooseOverwrite}>
              {shownAction?.mode === 'update' ? 'Update an existing copy' : 'Overwrite an existing copy'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Pick which local copy to overwrite/update when several match the same community catalog entry */}
      <Dialog
        open={showOverwriteSelect}
        onOpenChange={(o) => { if (!o) { setShowOverwriteSelect(false); setContextualAction(null); setOverwriteSelectedId(null); } }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{shownAction?.mode === 'update' ? 'Choose a copy to update' : 'Choose a copy to overwrite'}</DialogTitle>
            <DialogDescription>
              You have several local copies of this world. Pick which one to replace with the fresh download — edited copies lose their local changes.
            </DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <RadioGroup value={overwriteSelectedId ?? undefined} onValueChange={setOverwriteSelectedId}>
              {(shownAction ? copiesForWorld(shownAction.world) : []).map((copy) => {
                const radioId = `overwrite-${copy.id}`;
                const edited = copy.lastAccessed ? new Date(copy.lastAccessed).toLocaleString() : 'Unknown';
                // In the update flow only, flag copies that already hold the current source version
                // (not out of date vs the server). Irrelevant when re-downloading a current world.
                const upToDate = shownAction?.mode === 'update'
                  && getDownloadState(shownAction.world.updated_at, [copy]) === 'refresh';
                return (
                  <div key={copy.id} className="flex items-start space-x-2 p-2 rounded-md hover:bg-accent">
                    <RadioGroupItem value={copy.id} id={radioId} />
                    <Label htmlFor={radioId} className="flex-1 grid gap-1 cursor-pointer font-normal">
                      <span className="font-medium">
                        {copy.name}
                        {upToDate && <span className="ml-2 font-normal text-success">• up to date</span>}
                        {copy.dirty && <span className="ml-2 font-normal text-warning">• edited</span>}
                      </span>
                      <span className="text-meta text-muted-foreground">Last edited: {edited}</span>
                    </Label>
                  </div>
                );
              })}
            </RadioGroup>
          </div>
          <DialogFooter className="flex flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              onClick={() => { setShowOverwriteSelect(false); setContextualAction(null); setOverwriteSelectedId(null); }}
            >
              Cancel
            </Button>
            <Button onClick={handleConfirmOverwrite} disabled={!overwriteSelectedId}>
              {shownAction?.mode === 'update' ? 'Update' : 'Overwrite'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm Delete Remote World Dialog */}
      <ConfirmDialog
        open={!!remoteWorldToDelete}
        onOpenChange={(o) => !o && setRemoteWorldToDelete(null)}
        title={`Delete Published ${BROWSE_TAB_LABELS[browseTab].one}`}
        description={`Are you sure you want to delete this published ${BROWSE_TAB_LABELS[browseTab].one.toLowerCase()}? This will remove it from the server and it will no longer be available to other users. This action cannot be undone.`}
        onConfirm={() => handleRemoteWorldDelete(remoteWorldToDelete!)}
      />

      {/* The takedown has already landed; the notice is an optional follow-up so the author learns why.
          Declining leaves the item removed and simply unexplained, exactly as suspending does. */}
      <ConfirmDialog
        open={takedown !== null}
        onOpenChange={(o) => { if (!o) setTakedown(null); }}
        title="Send a takedown notice?"
        description={takedown
          ? `${takedown.author.username}'s ${KIND_LABELS[takedown.kind].one.toLowerCase()} "${takedown.name}" has been removed. Send them a message explaining why?`
          : ''}
        onConfirm={() => { setNotifyAuthor(takedown); setTakedown(null); }}
        onCancel={() => setTakedown(null)}
      />

      <QuarantineDialog
        open={quarantining !== null}
        onOpenChange={(o) => { if (!o) setQuarantining(null); }}
        what={quarantining
          ? `The ${KIND_LABELS[kindOf(quarantining)].one.toLowerCase()} “${quarantining.name}”`
          : ''}
        willNotifyAuthor={Boolean(quarantining && quarantining.author?.id !== currentUser?.id)}
        busy={isQuarantiningNow}
        onConfirm={handleQuarantine}
      />

      {/* Unlike a takedown there is something the author can still do, so the notice leads with the
          deadline. Opened straight away rather than behind a "send one?" prompt: a quarantine nobody
          explained is a listing that quietly dies. */}
      {quarantineNotice && (
        <MessageComposerDialog
          open
          onOpenChange={(o) => { if (!o) setQuarantineNotice(null); }}
          target={{ broadcast: false, recipients: [quarantineNotice.author] }}
          adminUsername={String(currentUser?.username || 'Admin')}
          initialSubject={quarantineTemplate(quarantineNotice).subject}
          initialBody={quarantineTemplate(quarantineNotice).body}
          initialSeverity="warning"
          initialScope="existing"
        />
      )}

      {notifyAuthor && (
        <MessageComposerDialog
          open
          onOpenChange={(o) => { if (!o) setNotifyAuthor(null); }}
          target={{ broadcast: false, recipients: [notifyAuthor.author] }}
          adminUsername={String(currentUser?.username || 'Admin')}
          initialSubject={takedownTemplate(notifyAuthor).subject}
          initialBody={takedownTemplate(notifyAuthor).body}
          // A one-off moderation event, not a standing rule: they read it and clear it.
          initialSeverity="warning"
          initialScope="existing"
        />
      )}

      {withdrawal.dialog}
    </>
  );
};

export default CommunityCreationsBrowser;
