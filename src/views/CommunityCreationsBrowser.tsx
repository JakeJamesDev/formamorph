import React, { useState, useCallback, useEffect } from 'react';
import { toast } from 'react-toastify';
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Search, RotateCcw, ArrowDownWideNarrow, ArrowUpNarrowWide, ArrowLeft, X, SlidersHorizontal, ChevronDown,
  Earth, User, BookOpen, Globe, ShieldAlert,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CATALOG_KINDS, KIND_LABELS, kindOf, type CatalogKind } from "@/lib/catalogKinds";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Pager } from "@/components/ui/pagination";
import { ScrollArea } from "@/components/ui/scroll-area";
import { TokenAutocomplete } from "@/components/TokenAutocomplete";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { usePersistentState, boolCodec } from "@/lib/usePersistentState";
import { CHIP_BASE } from "@/components/Chip";
import { useCatalogSync } from "@/lib/useCatalogSync";
import { useDownloadCoordinator } from "@/lib/useDownloadCoordinator";
import { useLibraryDownload } from "@/lib/useLibraryDownload";
import { useDownscalePrompt } from "@/lib/useDownscalePrompt";
import { IMAGE_CAPS } from "@/lib/imageOptim";
import EntityStorageService from "@/services/EntityStorageService";
import DictionaryStorageService from "@/services/DictionaryStorageService";
import type { Entity, Dictionary, EntityMetadata, DictionaryMetadata } from "@/types";
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

// Persisted preference to force the single-column (portrait) layout of the details modal at any width.
// Key string kept as-is so an existing user's saved preference survives the rename.
const COMMUNITY_BROWSER_MODAL_COLLAPSED_KEY = 'FORMAMORPH_discoverModalCollapsed';

interface CommunityCreationsBrowserProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // Local world list (drives download-state) + setter (download/overwrite add or update local copies).
  worlds: WorldRecord[];
  setWorlds: React.Dispatch<React.SetStateAction<WorldRecord[]>>;
  // The character/dictionary libraries drive their tabs' download-state; refreshing re-reads them after a
  // download lands (unlike worlds, these are stored by their own service rather than set here).
  entities: EntityMetadata[];
  dictionaries: DictionaryMetadata[];
  refreshEntities: () => void;
  refreshDictionaries: () => void;
  isAuthenticated: boolean;
  currentUser: WorldRecord | null;
  openImageViewer: (src: string | undefined, alt: string | undefined) => void;
  /** DEV dev-router: the kind tab to open on (`#dev?modal=community&tab=entity`). */
  initialKind?: CatalogKind;
  /** A listing to open the details for, arriving from somewhere else — a notification feed row. */
  openListing?: { id: string; kind: string } | null;
  /** Fired once that listing has been opened, or found to be gone, so the host can clear its request. */
  onListingOpened?: () => void;
}

// The Community Creations browser: browse/search/filter/sort the published catalog, view world details
// and comments, and download/refresh/update copies to the local library.
const CommunityCreationsBrowser = ({
  open, onOpenChange, worlds, setWorlds, entities, dictionaries, refreshEntities, refreshDictionaries,
  isAuthenticated, currentUser, openImageViewer, initialKind, openListing, onListingOpened,
}: CommunityCreationsBrowserProps) => {
  // Catalog fetch/cache/sync (loads on open, refreshes in the background).
  const { remoteWorlds, setRemoteWorlds, isLoadingRemoteWorlds, isSyncingCatalog, loadCatalog } = useCatalogSync(open);
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
  const { promptWorld, promptImage, dialog: downscaleDialog } = useDownscalePrompt();
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

  // Which kind is being browsed. The catalog holds all three; the pipeline below scopes to this one.
  const [browseKind, setBrowseKind] = useState<CatalogKind>(initialKind ?? 'world');

  // Characters and dictionaries download into their own libraries, one copy per listing. Worlds keep the
  // coordinator's multi-copy flow (see useLibraryDownload for why the two differ).
  const entityDownload = useLibraryDownload<Entity>({
    kind: 'entity',
    records: entities,
    store: async (id, entity, link) => {
      await EntityStorageService.storeEntity({ id, name: entity.name, data: entity, ...link });
    },
    refresh: refreshEntities,
    // Offer to shrink an oversized portrait before it lands, as worlds do for their images.
    onFetched: async (entity) => {
      if (!entity.image) return entity;
      const image = await promptImage(entity.image, IMAGE_CAPS.entity);
      return image === entity.image ? entity : { ...entity, image };
    },
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
  const catalogInView = quarantinedOnly ? remoteWorlds.filter(isQuarantined) : remoteWorlds;
  const quarantinedCount = remoteWorlds.filter(isQuarantined).length;

  const {
    searchQuery, setSearchQuery, authorFilter, setAuthorFilter, tagFilter, setTagFilter,
    tagMode, setTagMode, sortField, setSortField, sortOrder, setSortOrder,
    sortUpdatesFirst, setSortUpdatesFirst, currentPage, setCurrentPage,
    hiddenWorldIds, hiddenTags, hiddenAuthors,
    hideRemoteWorld, hideRemoteTag, hideRemoteAuthor,
    setHiddenTagsList, setHiddenAuthorsList,
    resetHiddenWorlds, unhideWorld, hiddenWorldName,
    allAuthors, allTags, filteredRemoteWorlds, totalPages, pagedRemoteWorlds,
  } = useCommunityBrowserFilters(catalogInView, downloadStateForRecord, open, browseKind);

  // Admin-only, and only once something is actually quarantined: a toggle that can only ever show an
  // empty list is a control that teaches nothing.
  const quarantineControl = viewerIsStaff && quarantinedCount > 0 ? (
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
  const activeFilterCount =
    authorFilter.length + tagFilter.length + hiddenWorldIds.length + hiddenTags.length + hiddenAuthors.length;

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
  // there is nothing to fetch: switch to its tab and open it once the catalog is in hand. Waiting for the
  // load rather than looking immediately is what makes this work on a cold open of the browser.
  useEffect(() => {
    if (!open || !openListing || isLoadingRemoteWorlds) return;

    const found = remoteWorlds.find((w) => (w._id || w.id) === openListing.id);
    if (found) {
      setBrowseKind(kindOf(found));
      // Set directly rather than through the click handler, which is rebuilt every render and would
      // make this effect chase its own identity.
      setSelectedRemoteWorld(found);
      setShowRemoteWorldDetailsModal(true);
    } else {
      // Deleted or quarantined between the feed being read and the row being clicked.
      toast.info('That listing is no longer in Community Creations');
    }

    onListingOpened?.();
  }, [open, openListing, isLoadingRemoteWorlds, remoteWorlds, onListingOpened]);

  // Header control fragments — reused across the mobile (collapsible) and desktop (inline) header layouts.
  // Mirrors the local library's tabs (MainMenu's `cardType`) so the same three kinds read the same way
  // in both places — icons below the label breakpoint, matching that header.
  const kindTabs = (
    <TabsList>
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
    </TabsList>
  );

  const searchControl = (
    <div className="relative flex-grow min-w-[200px]">
      <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
      <Input
        placeholder={`Search ${KIND_LABELS[browseKind].many.toLowerCase()}...`}
        className="pl-8"
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
      />
    </div>
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
      <RotateCcw className={`h-4 w-4 ${isSyncingCatalog ? 'animate-spin' : ''}`} />
    </Button>
  );

  const sortControl = (
    <div className="flex items-center gap-1">
      <Select value={sortField} onValueChange={(v) => { setSortField(v); setCurrentPage(1); }}>
        <SelectTrigger className="w-[160px] h-9"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="updated_at">Last Updated</SelectItem>
          <SelectItem value="created_at">Creation Date</SelectItem>
          <SelectItem value="downloads">Downloads</SelectItem>
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

  const authorsControl = (
    <div className="flex items-center gap-2">
      <Button variant="outline" size="sm" className="shrink-0 pointer-events-none" tabIndex={-1}>Authors:</Button>
      <TokenAutocomplete values={authorFilter} onChange={setAuthorFilter} options={allAuthors} placeholder="author…" />
    </div>
  );

  const tagsControl = (
    <div className="flex items-center gap-2">
      <Button
        variant="outline"
        size="sm"
        className="shrink-0 w-[92px]"
        onClick={() => setTagMode((m) => (m === 'any' ? 'all' : 'any'))}
        title="Toggle match: Any vs All"
      >
        {tagMode === 'any' ? 'Any' : 'All'} Tags:
      </Button>
      <TokenAutocomplete values={tagFilter} onChange={setTagFilter} options={allTags} placeholder="tag…" />
    </div>
  );

  const hiddenControl = (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="shrink-0">
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
          <span className="text-xs font-medium text-muted-foreground">Tags</span>
          <TokenAutocomplete values={hiddenTags} onChange={setHiddenTagsList} options={allTags} placeholder="tag…" openOnFocus />
        </div>
        <div className="space-y-1">
          <span className="text-xs font-medium text-muted-foreground">Authors</span>
          <TokenAutocomplete values={hiddenAuthors} onChange={setHiddenAuthorsList} options={allAuthors} placeholder="author…" openOnFocus />
        </div>
        {hiddenWorldIds.length > 0 && (
          <div className="space-y-1">
            <span className="text-xs font-medium text-muted-foreground">Worlds</span>
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
          <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={resetHiddenWorlds}>
            <RotateCcw className="h-3 w-3 mr-1" /> Reset all
          </Button>
        )}
      </PopoverContent>
    </Popover>
  );

  const updatesControl = (
    <label className="ml-auto flex items-center gap-2 shrink-0 cursor-pointer text-sm select-none">
      <Checkbox
        checked={sortUpdatesFirst}
        onCheckedChange={(c) => { setSortUpdatesFirst(c === true); setCurrentPage(1); }}
      />
      Updates first
    </label>
  );

  return (
    <>
      {downscaleDialog}

      {/* Updating a character/dictionary replaces the single local copy, so an edited one asks first —
          there's no second copy for the edits to survive in (unlike worlds). ConfirmDialog holds its text
          while fading out, so the name doesn't vanish mid-animation. */}
      <ConfirmDialog
        open={!!entityDownload.dirtyConfirm}
        onOpenChange={(v) => { if (!v) entityDownload.setDirtyConfirm(null); }}
        title="Replace your edited character?"
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
        <DialogContent
          hideClose
          className="max-w-none w-screen h-dvh sm:max-w-none left-0 top-0 translate-x-0 translate-y-0 rounded-none sm:rounded-none p-0 gap-0 flex flex-col data-[state=open]:!slide-in-from-top-0 data-[state=open]:!slide-in-from-left-0 data-[state=closed]:!slide-out-to-top-0 data-[state=closed]:!slide-out-to-left-0"
        >
          {/* The kind switcher lives in the header and its results below it, so one root spans both.
              `contents` on the root and each panel leaves the dialog's own flex column untouched. */}
          <Tabs value={browseKind} onValueChange={(v) => setBrowseKind(v as CatalogKind)} className="contents">
          {/* Header: back · title · search · refresh always visible. On mobile the sort/filter controls
              collapse behind a "Filters" toggle; on desktop they stay inline. */}
          <Collapsible open={filtersOpen} onOpenChange={setFiltersOpen} className="shrink-0 border-b">
            <div className="px-6 py-4 space-y-4">
              <div className="flex flex-wrap items-center gap-2 sm:gap-4">
                <Button variant="ghost" size="icon" className="shrink-0" onClick={() => onOpenChange(false)} aria-label="Back">
                  <ArrowLeft className="h-5 w-5" />
                </Button>
                <DialogTitle className="flex items-center gap-2 whitespace-nowrap mr-2"><Globe className="h-4 w-4 shrink-0" /> Community Creations</DialogTitle>
                {kindTabs}
                {searchControl}
                {quarantineControl}
                {refreshControl}
                {isMobile ? (
                  <CollapsibleTrigger asChild>
                    <Button variant="outline" size="sm" className="shrink-0 gap-1">
                      <SlidersHorizontal className="h-4 w-4" />
                      Filters{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
                      <ChevronDown className={`h-4 w-4 transition-transform ${filtersOpen ? 'rotate-180' : ''}`} />
                    </Button>
                  </CollapsibleTrigger>
                ) : (
                  sortControl
                )}
              </div>

              {isMobile ? (
                <CollapsibleContent className="space-y-3">
                  {sortControl}
                  {authorsControl}
                  {tagsControl}
                  {hiddenControl}
                  {updatesControl}
                </CollapsibleContent>
              ) : (
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                  {authorsControl}
                  {tagsControl}
                  {hiddenControl}
                  {updatesControl}
                </div>
              )}
            </div>
          </Collapsible>

          {/* A panel per kind so every trigger's `aria-controls` resolves; one grid serves whichever kind is
              showing, so the other two render empty. */}
          {CATALOG_KINDS.filter((k) => k !== browseKind).map((k) => (
            <TabsContent key={k} value={k} className="contents" />
          ))}

          {/* Scrollable results */}
          <TabsContent value={browseKind} className="contents">
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
                  {quarantinedOnly ?
                    `No ${KIND_LABELS[browseKind].many.toLowerCase()} are quarantined.` :
                    searchQuery ?
                      `No ${KIND_LABELS[browseKind].many.toLowerCase()} found matching your criteria.` :
                      `No ${KIND_LABELS[browseKind].many.toLowerCase()} available. Be the first to publish one!`}
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
                      onQuarantine={setQuarantining}
                      onRelease={handleRelease}
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
                      <span className="text-xs text-muted-foreground">Last edited: {edited}</span>
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
        title={`Delete Published ${KIND_LABELS[browseKind].one}`}
        description={`Are you sure you want to delete this published ${KIND_LABELS[browseKind].one.toLowerCase()}? This will remove it from the server and it will no longer be available to other users. This action cannot be undone.`}
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
    </>
  );
};

export default CommunityCreationsBrowser;
