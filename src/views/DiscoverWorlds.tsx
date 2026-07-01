import React, { useState } from 'react';
import { toast } from 'react-toastify';
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Search, RotateCcw, ArrowDownWideNarrow, ArrowUpNarrowWide, ArrowLeft, X,
} from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { TokenAutocomplete } from "@/components/TokenAutocomplete";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { usePersistentState, boolCodec } from "@/lib/usePersistentState";
import { CHIP_BASE } from "@/components/Chip";
import { useCatalogSync } from "@/lib/useCatalogSync";
import { useDownloadCoordinator } from "@/lib/useDownloadCoordinator";
import { useDiscoverFilters } from "@/lib/useDiscoverFilters";
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
import WorldStorageService from '../services/WorldStorageService';
import AuthService from '../services/AuthService';
import { getDownloadState } from '@/lib/downloadState';
import { type WorldRecord } from "@/components/WorldDetails";
import { RemoteWorldDetailsModal } from "@/components/discover/RemoteWorldDetailsModal";
import { RemoteWorldCard } from "@/components/discover/RemoteWorldCard";

// Persisted preference to force the single-column (portrait) layout of the details modal at any width.
const DISCOVER_MODAL_COLLAPSED_KEY = 'FORMAMORPH_discoverModalCollapsed';

interface DiscoverWorldsProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // Local world list (drives download-state) + setter (download/overwrite add or update local copies).
  worlds: WorldRecord[];
  setWorlds: React.Dispatch<React.SetStateAction<WorldRecord[]>>;
  isAuthenticated: boolean;
  currentUser: WorldRecord | null;
  openImageViewer: (src: string | undefined, alt: string | undefined) => void;
}

// The Discover "world browser": browse/search/filter/sort the published catalog, view world details
// and comments, and download/refresh/update copies to the local library.
const DiscoverWorlds = ({ open, onOpenChange, worlds, setWorlds, isAuthenticated, currentUser, openImageViewer }: DiscoverWorldsProps) => {
  // Catalog fetch/cache/sync (loads on open, refreshes in the background).
  const { remoteWorlds, setRemoteWorlds, isLoadingRemoteWorlds, isSyncingCatalog, loadCatalog } = useCatalogSync(open);
  const [remoteWorldToDelete, setRemoteWorldToDelete] = useState<string | null>(null);
  const [selectedRemoteWorld, setSelectedRemoteWorld] = useState<WorldRecord | null>(null);
  const [showRemoteWorldDetailsModal, setShowRemoteWorldDetailsModal] = useState(false);
  // Download flow: per-world progress, the copy-vs-overwrite decision state, and the fetch/store handlers.
  const {
    downloadProgress, contextualAction, setContextualAction,
    overwriteSelectedId, setOverwriteSelectedId, showOverwriteSelect, setShowOverwriteSelect,
    localCopiesBySource, copiesForWorld, downloadStateForWorld,
    handleContextualDownload, handleChooseOverwrite, handleConfirmOverwrite, handleDownloadWorld,
  } = useDownloadCoordinator(worlds, setWorlds);

  const [discoverModalCollapsed, setDiscoverModalCollapsed] = usePersistentState(
    DISCOVER_MODAL_COLLAPSED_KEY, false, boolCodec,
  );
  const toggleDiscoverModalCollapsed = () => setDiscoverModalCollapsed((prev) => !prev);

  // Browse pipeline: search/author/tag/sort filters, hide preferences, and responsive pagination.
  const {
    searchQuery, setSearchQuery, authorFilter, setAuthorFilter, tagFilter, setTagFilter,
    tagMode, setTagMode, sortField, setSortField, sortOrder, setSortOrder,
    sortUpdatesFirst, setSortUpdatesFirst, currentPage, setCurrentPage,
    hiddenWorldIds, hiddenTags, hiddenAuthors,
    hideRemoteWorld, hideRemoteTag, hideRemoteAuthor,
    resetHiddenWorlds, unhideWorld, unhideTag, unhideAuthor, hiddenWorldName,
    allAuthors, allTags, filteredRemoteWorlds, totalPages, pagedRemoteWorlds,
  } = useDiscoverFilters(remoteWorlds, localCopiesBySource, open);

  // Numbered page links with first/last anchors + ellipsis (matches the in-game transcript pager).
  const renderDiscoverPaginationItems = () => {
    const items = [];
    for (let i = 1; i <= totalPages; i++) {
      if (i === 1 || i === totalPages || (i >= currentPage - 1 && i <= currentPage + 1)) {
        items.push(
          <PaginationItem key={i}>
            <PaginationLink
              href="#"
              onClick={(e) => { e.preventDefault(); setCurrentPage(i); }}
              isActive={currentPage === i}
            >
              {i}
            </PaginationLink>
          </PaginationItem>,
        );
      } else if (i === currentPage - 2 || i === currentPage + 2) {
        items.push(
          <PaginationItem key={i}>
            <PaginationEllipsis />
          </PaginationItem>,
        );
      }
    }
    return items;
  };

  const handleRemoteWorldDelete = async (worldId: string) => {
    try {
      // Call API to delete the world
      const response = await fetch(`${WorldStorageService.API_URL}/worlds/${worldId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${AuthService.token}`
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to delete world');
      }

      // Remove the world from the list
      setRemoteWorlds(prev => prev.filter(w => (w._id || w.id) !== worldId));
      setRemoteWorldToDelete(null);
      toast.success('World deleted successfully');
    } catch (error) {
      console.error('Error deleting remote world:', error);
      toast.error((error as Error).message || 'Failed to delete world');
    }
  };

  // Handle viewing remote world details
  const handleViewRemoteWorldDetails = (world: WorldRecord) => {
    setSelectedRemoteWorld(world);
    setShowRemoteWorldDetailsModal(true);
  };

  return (
    <>
      {/* Discover Dialog */}
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          hideClose
          className="max-w-none w-screen h-screen sm:max-w-none left-0 top-0 translate-x-0 translate-y-0 rounded-none sm:rounded-none p-0 gap-0 flex flex-col data-[state=open]:!slide-in-from-top-0 data-[state=open]:!slide-in-from-left-0 data-[state=closed]:!slide-out-to-top-0 data-[state=closed]:!slide-out-to-left-0"
        >
          {/* Frozen header: back button + title + search/filter controls on one row */}
          <div className="shrink-0 border-b px-6 py-4 space-y-4">
            <div className="flex flex-wrap items-center gap-2 sm:gap-4">
              <Button variant="ghost" size="icon" className="shrink-0" onClick={() => onOpenChange(false)} aria-label="Back">
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <DialogTitle className="whitespace-nowrap mr-2">Discover Worlds</DialogTitle>
              <div className="relative flex-grow min-w-[200px]">
                <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search worlds..."
                  className="pl-8"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {/* Sort controls */}
                <div className="flex items-center gap-1">
                  <Select
                    value={sortField}
                    onValueChange={(v) => { setSortField(v); setCurrentPage(1); }}
                  >
                    <SelectTrigger className="w-[160px] h-9">
                      <SelectValue />
                    </SelectTrigger>
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
                </div>
              </div>
            </div>

            {/* Authors / Tags include-filters + Hidden popup */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" className="shrink-0 pointer-events-none" tabIndex={-1}>Authors:</Button>
                <TokenAutocomplete values={authorFilter} onChange={setAuthorFilter} options={allAuthors} placeholder="author…" />
              </div>

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

              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="shrink-0">
                    Hidden{hiddenWorldIds.length + hiddenTags.length + hiddenAuthors.length > 0 ? ` (${hiddenWorldIds.length + hiddenTags.length + hiddenAuthors.length})` : ''}
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="start" side="bottom" className="w-72 space-y-2">
                  {hiddenWorldIds.length === 0 && hiddenTags.length === 0 && hiddenAuthors.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Nothing hidden.</p>
                  ) : (
                    <>
                      <div className="flex flex-wrap gap-1">
                        {hiddenWorldIds.map((id) => (
                          <span key={`w-${id}`} className={cn(CHIP_BASE, "bg-secondary text-secondary-foreground")}>
                            {hiddenWorldName(id)}
                            <button onClick={() => unhideWorld(id)} className="hover:text-destructive" aria-label="Unhide world"><X className="h-3 w-3" /></button>
                          </span>
                        ))}
                        {hiddenAuthors.map((name) => (
                          <span key={`a-${name}`} className={cn(CHIP_BASE, "bg-amber-100 dark:bg-amber-900 text-amber-800 dark:text-amber-300")}>
                            By {name}
                            <button onClick={() => unhideAuthor(name)} className="hover:text-destructive" aria-label="Unhide author"><X className="h-3 w-3" /></button>
                          </span>
                        ))}
                        {hiddenTags.map((tag) => (
                          <span key={`t-${tag}`} className={cn(CHIP_BASE, "bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-300")}>
                            #{tag}
                            <button onClick={() => unhideTag(tag)} className="hover:text-destructive" aria-label="Unhide tag"><X className="h-3 w-3" /></button>
                          </span>
                        ))}
                      </div>
                      <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={resetHiddenWorlds}>
                        <RotateCcw className="h-3 w-3 mr-1" /> Reset all
                      </Button>
                    </>
                  )}
                </PopoverContent>
              </Popover>

              {/* Float worlds with an available update to the front (on by default). */}
              <label className="ml-auto flex items-center gap-2 shrink-0 cursor-pointer text-sm select-none">
                <Checkbox
                  checked={sortUpdatesFirst}
                  onCheckedChange={(c) => { setSortUpdatesFirst(c === true); setCurrentPage(1); }}
                />
                Updates first
              </label>
            </div>
          </div>

          {/* Scrollable results */}
          <div className="flex-1 min-h-0 overflow-y-auto px-6 py-4">
            {/* World grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {isLoadingRemoteWorlds ? (
                Array(4).fill(0).map((_, index) => (
                  <div key={index} className="relative w-full h-48 rounded-lg overflow-hidden">
                    <Skeleton className="w-full h-full" />
                    <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-50 p-2">
                      <Skeleton className="h-6 w-24" />
                    </div>
                  </div>
                ))
              ) : filteredRemoteWorlds.length === 0 ? (
                <div className="col-span-2 text-center py-12 text-gray-500">
                  {searchQuery ?
                    "No worlds found matching your criteria." :
                    "No worlds available. Be the first to publish one!"}
                </div>
              ) : (
                pagedRemoteWorlds.map((world) => {
                  const worldId = world._id || world.id;
                  return (
                    <RemoteWorldCard
                      key={worldId}
                      world={world}
                      downloadState={downloadStateForWorld(world)}
                      downloadProgress={downloadProgress[worldId]}
                      isAuthenticated={isAuthenticated}
                      currentUser={currentUser}
                      onView={handleViewRemoteWorldDetails}
                      onHideWorld={hideRemoteWorld}
                      onHideAuthor={hideRemoteAuthor}
                      onHideTag={hideRemoteTag}
                      onContextualDownload={handleContextualDownload}
                      onDelete={setRemoteWorldToDelete}
                    />
                  );
                })
              )}
            </div>

          </div>

          {/* Frozen footer: pagination */}
          <div className="shrink-0 border-t px-6 py-3">
            {!isLoadingRemoteWorlds && filteredRemoteWorlds.length > 0 && (
              <Pagination>
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious
                      href="#"
                      onClick={(e) => { e.preventDefault(); if (currentPage > 1) setCurrentPage(currentPage - 1); }}
                      className={currentPage === 1 ? "pointer-events-none opacity-50" : ""}
                    />
                  </PaginationItem>
                  {renderDiscoverPaginationItems()}
                  <PaginationItem>
                    <PaginationNext
                      href="#"
                      onClick={(e) => { e.preventDefault(); if (currentPage < totalPages) setCurrentPage(currentPage + 1); }}
                      className={currentPage === totalPages ? "pointer-events-none opacity-50" : ""}
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Remote World Details Modal — details + comments live in the component */}
      <RemoteWorldDetailsModal
        open={showRemoteWorldDetailsModal}
        onOpenChange={setShowRemoteWorldDetailsModal}
        world={selectedRemoteWorld}
        collapsed={discoverModalCollapsed}
        onToggleCollapsed={toggleDiscoverModalCollapsed}
        isAuthenticated={isAuthenticated}
        openImageViewer={openImageViewer}
        downloadStateForWorld={downloadStateForWorld}
        downloadProgress={downloadProgress}
        onContextualDownload={handleContextualDownload}
      />

      {/* Refresh/Update decision: download a separate copy vs overwrite an existing local copy */}
      <Dialog
        open={!!contextualAction && !showOverwriteSelect}
        onOpenChange={(o) => { if (!o) setContextualAction(null); }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{contextualAction?.mode === 'update' ? 'Update available' : 'Re-download world'}</DialogTitle>
            <DialogDescription>
              {contextualAction?.mode === 'update'
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
              {contextualAction?.mode === 'update' ? 'Update an existing copy' : 'Overwrite an existing copy'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Pick which local copy to overwrite/update when several match the same Discover entry */}
      <Dialog
        open={showOverwriteSelect}
        onOpenChange={(o) => { if (!o) { setShowOverwriteSelect(false); setContextualAction(null); setOverwriteSelectedId(null); } }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{contextualAction?.mode === 'update' ? 'Choose a copy to update' : 'Choose a copy to overwrite'}</DialogTitle>
            <DialogDescription>
              You have several local copies of this world. Pick which one to replace with the fresh download — edited copies lose their local changes.
            </DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <RadioGroup value={overwriteSelectedId ?? undefined} onValueChange={setOverwriteSelectedId}>
              {(contextualAction ? copiesForWorld(contextualAction.world) : []).map((copy) => {
                const radioId = `overwrite-${copy.id}`;
                const edited = copy.lastAccessed ? new Date(copy.lastAccessed).toLocaleString() : 'Unknown';
                // In the update flow only, flag copies that already hold the current source version
                // (not out of date vs the server). Irrelevant when re-downloading a current world.
                const upToDate = contextualAction?.mode === 'update'
                  && getDownloadState(contextualAction.world.updated_at, [copy]) === 'refresh';
                return (
                  <div key={copy.id} className="flex items-start space-x-2 p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800">
                    <RadioGroupItem value={copy.id} id={radioId} />
                    <Label htmlFor={radioId} className="flex-1 grid gap-1 cursor-pointer font-normal">
                      <span className="font-medium">
                        {copy.name}
                        {upToDate && <span className="ml-2 font-normal text-green-600 dark:text-green-400">• up to date</span>}
                        {copy.dirty && <span className="ml-2 font-normal text-amber-600 dark:text-amber-400">• edited</span>}
                      </span>
                      <span className="text-xs text-gray-500">Last edited: {edited}</span>
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
              {contextualAction?.mode === 'update' ? 'Update' : 'Overwrite'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm Delete Remote World Dialog */}
      <ConfirmDialog
        open={!!remoteWorldToDelete}
        onOpenChange={(o) => !o && setRemoteWorldToDelete(null)}
        title="Delete Published World"
        description="Are you sure you want to delete this published world? This will remove it from the server and it will no longer be available to other users. This action cannot be undone."
        onConfirm={() => handleRemoteWorldDelete(remoteWorldToDelete!)}
      />
    </>
  );
};

export default DiscoverWorlds;
