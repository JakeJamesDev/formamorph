import React, { useState, useEffect, useMemo } from 'react';
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
import { toEpoch } from "@/lib/thumbnailCache";
import { sanitizeTag, collectSanitizedTags } from "@/lib/tagUtils";
import { cn } from "@/lib/utils";
import { usePersistentState, boolCodec } from "@/lib/usePersistentState";
import { CHIP_BASE } from "@/components/Chip";
import { getCatalog, replaceCatalog } from "@/lib/worldCatalog";
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
import type { World } from '@/types';
import { migrateWorld } from '@/lib/version';
import { getDownloadState, type DownloadState } from '@/lib/downloadState';
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
  const [remoteWorlds, setRemoteWorlds] = useState<WorldRecord[]>([]);
  const [isLoadingRemoteWorlds, setIsLoadingRemoteWorlds] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const [authorFilter, setAuthorFilter] = useState<string[]>([]);
  const [tagFilter, setTagFilter] = useState<string[]>([]);
  const [tagMode, setTagMode] = useState<'any' | 'all'>('any');
  const [sortField, setSortField] = useState('updated_at'); // updated_at | created_at | downloads
  const [sortOrder, setSortOrder] = useState('desc'); // asc | desc
  const [sortUpdatesFirst, setSortUpdatesFirst] = useState(true); // float worlds with an update to the front
  const [currentPage, setCurrentPage] = useState(1);
  // Discover page size: 3 full rows of whatever the responsive grid currently fits, or 10 in portrait.
  const [pageSize, setPageSize] = useState(12);
  const [isSyncingCatalog, setIsSyncingCatalog] = useState(false);
  const [remoteWorldToDelete, setRemoteWorldToDelete] = useState<string | null>(null);
  const [selectedRemoteWorld, setSelectedRemoteWorld] = useState<WorldRecord | null>(null);
  const [showRemoteWorldDetailsModal, setShowRemoteWorldDetailsModal] = useState(false);
  // In-flight downloads keyed by remote world id → fraction 0..1, or -1 when total size is unknown.
  const [downloadProgress, setDownloadProgress] = useState<Record<string, number>>({});
  // Contextual refresh/update flow for an already-downloaded world. The decision dialog (copy vs
  // overwrite) opens first; if several local copies match, the selection dialog picks which to overwrite.
  const [contextualAction, setContextualAction] = useState<{ world: WorldRecord; mode: DownloadState } | null>(null);
  const [overwriteSelectedId, setOverwriteSelectedId] = useState<string | null>(null);
  const [showOverwriteSelect, setShowOverwriteSelect] = useState(false);

  const [discoverModalCollapsed, setDiscoverModalCollapsed] = usePersistentState(
    DISCOVER_MODAL_COLLAPSED_KEY, false, boolCodec,
  );
  const toggleDiscoverModalCollapsed = () => setDiscoverModalCollapsed((prev) => !prev);

  // Discover hide preferences (client-side, persisted in localStorage)
  const [hiddenWorldIds, setHiddenWorldIds] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem('FORMAMORPH_hiddenWorldIds') || '[]'); }
    catch { return []; }
  });
  const [hiddenTags, setHiddenTags] = useState<string[]>(() => {
    try {
      const raw = JSON.parse(localStorage.getItem('FORMAMORPH_hiddenTags') || '[]');
      // Sanitize + dedupe on load so legacy entries match current tags.
      return Array.from(new Set((Array.isArray(raw) ? raw : []).map(sanitizeTag).filter(Boolean)));
    } catch { return []; }
  });
  const [hiddenAuthors, setHiddenAuthors] = useState<string[]>(() => {
    try {
      const raw = JSON.parse(localStorage.getItem('FORMAMORPH_hiddenAuthors') || '[]');
      return Array.from(new Set((Array.isArray(raw) ? raw : []).filter(Boolean)));
    } catch { return []; }
  });

  // Load the world catalog when Discover opens: render the cached copy instantly, then refresh
  // the whole catalog from the server in the background (one request) and re-cache it.
  useEffect(() => {
    if (open) {
      loadCatalog();
    }
  }, [open]);

  const loadCatalog = async (force = false) => {
    try {
      const cached = await getCatalog();
      if (cached.length && !force) {
        setRemoteWorlds(cached);
      } else {
        setIsLoadingRemoteWorlds(true);
      }
      setIsSyncingCatalog(true);
      // One request returns the entire catalog; replace the cache wholesale (also drops removed worlds).
      const result = await WorldStorageService.fetchRemoteWorlds(1, 1000, '', false, false);
      if (result.success && Array.isArray(result.data)) {
        setRemoteWorlds(result.data);
        await replaceCatalog(result.data);
      } else if (!cached.length) {
        toast.error(result.error || 'Failed to fetch worlds');
      }
    } catch (error) {
      console.error('Error loading world catalog:', error);
    } finally {
      setIsLoadingRemoteWorlds(false);
      setIsSyncingCatalog(false);
    }
  };

  // Persist discover hide preferences
  useEffect(() => {
    localStorage.setItem('FORMAMORPH_hiddenWorldIds', JSON.stringify(hiddenWorldIds));
  }, [hiddenWorldIds]);
  useEffect(() => {
    localStorage.setItem('FORMAMORPH_hiddenTags', JSON.stringify(hiddenTags));
  }, [hiddenTags]);
  useEffect(() => {
    localStorage.setItem('FORMAMORPH_hiddenAuthors', JSON.stringify(hiddenAuthors));
  }, [hiddenAuthors]);

  const hideRemoteWorld = (worldId: string) => {
    setHiddenWorldIds((prev) => (prev.includes(worldId) ? prev : [...prev, worldId]));
  };
  const hideRemoteTag = (tag: string) => {
    const t = sanitizeTag(tag);
    if (!t) return;
    setHiddenTags((prev) => (prev.includes(t) ? prev : [...prev, t]));
  };
  const hideRemoteAuthor = (name: string) => {
    const n = String(name || '').trim();
    if (!n) return;
    setHiddenAuthors((prev) => (prev.some((a) => a.toLowerCase() === n.toLowerCase()) ? prev : [...prev, n]));
  };
  const resetHiddenWorlds = () => {
    setHiddenWorldIds([]);
    setHiddenTags([]);
    setHiddenAuthors([]);
  };
  const unhideWorld = (id: string) => setHiddenWorldIds((prev) => prev.filter((w) => w !== id));
  const unhideTag = (tag: string) => setHiddenTags((prev) => prev.filter((t) => t !== tag));
  const unhideAuthor = (name: string) => setHiddenAuthors((prev) => prev.filter((a) => a !== name));
  // Resolve a hidden world id to its name from the catalog (falls back to a short id).
  const hiddenWorldName = (id: string) =>
    remoteWorlds.find((w) => (w._id || w.id) === id)?.name || `${id.slice(0, 8)}…`;

  // Unique authors/tags from the cached catalog (excluding hidden ones), for the filter autocomplete.
  const allAuthors = useMemo(() => {
    const hidden = new Set(hiddenAuthors.map((a) => a.toLowerCase()));
    const set = new Set<string>();
    remoteWorlds.forEach((w) => {
      const name = w.author?.username;
      if (name && !hidden.has(name.toLowerCase())) set.add(name);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [remoteWorlds, hiddenAuthors]);
  // hiddenTags are already sanitized; collectSanitizedTags normalizes the rest.
  const allTags = useMemo(
    () => collectSanitizedTags(remoteWorlds.map((w) => w.tags), new Set(hiddenTags)),
    [remoteWorlds, hiddenTags],
  );

  // Local copies grouped by the Discover entry they were downloaded from (sourceId). Drives the
  // contextual download button: none/refresh/update per server world, plus the overwrite picker.
  const localCopiesBySource = useMemo(() => {
    const map = new Map<string, WorldRecord[]>();
    for (const w of worlds) {
      if (!w.sourceId) continue;
      const list = map.get(w.sourceId) ?? [];
      list.push(w);
      map.set(w.sourceId, list);
    }
    return map;
  }, [worlds]);

  const copiesForWorld = (world: WorldRecord): WorldRecord[] =>
    localCopiesBySource.get(world._id || world.id) ?? [];

  const downloadStateForWorld = (world: WorldRecord): DownloadState =>
    getDownloadState(world.updated_at, copiesForWorld(world));

  // Client-side browse pipeline: hide filters → text search → author/tag include filters → sort.
  // With "updates first" on, worlds with an available update are floated to the front, each group
  // then ordered by the chosen sort field/direction.
  const filteredRemoteWorlds = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const authors = authorFilter.map((a) => a.toLowerCase());
    const tags = tagFilter.map((t) => sanitizeTag(t)).filter(Boolean);
    const list = remoteWorlds.filter((world) => {
      const id = world._id || world.id;
      if (hiddenWorldIds.includes(id)) return false;
      if ((world.tags || []).some((t: string) => hiddenTags.includes(sanitizeTag(t)))) return false;
      if (hiddenAuthors.some((a) => a.toLowerCase() === (world.author?.username || '').toLowerCase())) return false;
      if (q && !`${world.name || ''} ${world.description || ''}`.toLowerCase().includes(q)) return false;
      if (authors.length && !authors.includes((world.author?.username || '').toLowerCase())) return false;
      if (tags.length) {
        const worldTags = new Set((world.tags || []).map((t: string) => sanitizeTag(t)).filter(Boolean));
        const ok = tagMode === 'all' ? tags.every((t) => worldTags.has(t)) : tags.some((t) => worldTags.has(t));
        if (!ok) return false;
      }
      return true;
    });
    const dir = sortOrder === 'asc' ? 1 : -1;
    return [...list].sort((a, b) => {
      if (sortUpdatesFirst) {
        const au = getDownloadState(a.updated_at, localCopiesBySource.get(a._id || a.id) ?? []) === 'update' ? 1 : 0;
        const bu = getDownloadState(b.updated_at, localCopiesBySource.get(b._id || b.id) ?? []) === 'update' ? 1 : 0;
        if (au !== bu) return bu - au; // updates first, regardless of sort direction
      }
      const av = sortField === 'downloads' ? (a.downloads || 0) : toEpoch(a[sortField]);
      const bv = sortField === 'downloads' ? (b.downloads || 0) : toEpoch(b[sortField]);
      return (av - bv) * dir;
    });
  }, [remoteWorlds, searchQuery, authorFilter, tagFilter, tagMode, hiddenWorldIds, hiddenTags, hiddenAuthors, sortField, sortOrder, sortUpdatesFirst, localCopiesBySource]);

  const totalPages = Math.max(1, Math.ceil(filteredRemoteWorlds.length / pageSize));
  const pagedRemoteWorlds = filteredRemoteWorlds.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  // Contextual button click: new worlds download immediately; already-downloaded ones open the
  // refresh/update decision dialog (copy vs overwrite).
  const handleContextualDownload = (world: WorldRecord, state: DownloadState) => {
    if (state === 'none') { handleDownloadWorld(world); return; }
    setContextualAction({ world, mode: state });
  };

  // "Overwrite an existing copy": overwrite directly when there's a single match, else pick which one.
  const handleChooseOverwrite = () => {
    if (!contextualAction) return;
    const copies = copiesForWorld(contextualAction.world);
    if (copies.length <= 1) {
      if (copies[0]) overwriteWorld(contextualAction.world, copies[0].id);
      setContextualAction(null);
      return;
    }
    setOverwriteSelectedId(copies[0]?.id ?? null);
    setShowOverwriteSelect(true);
  };

  // Confirm the chosen copy in the selection dialog.
  const handleConfirmOverwrite = () => {
    if (contextualAction && overwriteSelectedId) {
      overwriteWorld(contextualAction.world, overwriteSelectedId);
    }
    setShowOverwriteSelect(false);
    setContextualAction(null);
    setOverwriteSelectedId(null);
  };

  // Page size = 3 rows of however many columns the grid renders at the current viewport (matching the
  // Tailwind sm/md/lg/xl breakpoints on the grid class), except a flat 10 in portrait orientation.
  useEffect(() => {
    if (!open) return;
    const portraitMq = window.matchMedia('(orientation: portrait)');
    const recompute = () => {
      if (portraitMq.matches) { setPageSize(10); return; }
      const w = window.innerWidth;
      const cols = w >= 1280 ? 5 : w >= 1024 ? 4 : w >= 768 ? 3 : w >= 640 ? 2 : 1;
      setPageSize(cols * 3);
    };
    recompute();
    window.addEventListener('resize', recompute);
    portraitMq.addEventListener('change', recompute);
    return () => { window.removeEventListener('resize', recompute); portraitMq.removeEventListener('change', recompute); };
  }, [open]);

  // Reset to page 1 when the result set changes; clamp if hiding shrinks it below the current page.
  useEffect(() => { setCurrentPage(1); }, [searchQuery, authorFilter, tagFilter, tagMode, sortField, sortOrder]);
  useEffect(() => { if (currentPage > totalPages) setCurrentPage(totalPages); }, [currentPage, totalPages]);

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

  // Fetch + stream + migrate a remote world's content, reporting streaming progress on
  // downloadProgress[worldId]. Shared by the new-copy download and the in-place overwrite paths.
  const fetchWorldContent = async (
    world: WorldRecord,
    worldId: string,
  ): Promise<{ migrated: World; thumbnailUrl: string }> => {
    const response = await fetch(`${WorldStorageService.API_URL}/worlds/${worldId}/content`, {
      headers: AuthService.isAuthenticated() ? {
        'Authorization': `Bearer ${AuthService.token}`
      } : {}
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Failed to download world');
    }

    // Stream the (often large) response body so we can report download progress. Falls back to a
    // plain json() read when streaming isn't available. Content-Length may be absent/compressed,
    // so we clamp the fraction and treat a missing total as indeterminate (-1).
    const total = Number(response.headers.get('Content-Length')) || 0;
    const reader = response.body?.getReader();
    let worldData: { success?: boolean; data?: { contentData?: unknown } };
    if (reader) {
      const decoder = new TextDecoder();
      let text = '';
      let received = 0;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        received += value.length;
        text += decoder.decode(value, { stream: true });
        setDownloadProgress((p) => ({ ...p, [worldId]: total ? Math.min(received / total, 1) : -1 }));
      }
      text += decoder.decode();
      worldData = JSON.parse(text);
    } else {
      worldData = await response.json();
    }

    if (!worldData.success || !worldData.data) {
      throw new Error('Invalid world data received');
    }

    // Capture into a const so narrowing survives the awaits below (property narrowing would reset).
    const contentData = worldData.data.contentData;
    const migrated = migrateWorld(contentData);

    let thumbnailUrl = '';
    if (world.thumbnail_file) {
      thumbnailUrl = `${WorldStorageService.API_URL}/thumbnails/${world.thumbnail_file}`;
    } else if (world.thumbnail) {
      thumbnailUrl = world.thumbnail;
    }

    return { migrated, thumbnailUrl };
  };

  // Download a remote world as a new local entry.
  const handleDownloadWorld = async (world: WorldRecord) => {
    const worldId = world._id || world.id;
    // Mark this world as in-flight (indeterminate until we know the size) so the card swaps to a bar.
    setDownloadProgress((p) => ({ ...p, [worldId]: -1 }));
    try {
      const { migrated, thumbnailUrl } = await fetchWorldContent(world, worldId);

      const localWorldId = `downloaded-${Date.now()}`;
      const name = world.name || 'Downloaded World';
      const description = world.description || 'Downloaded from server';
      const author = world.author?.username || '';
      const now = new Date().toISOString();

      await WorldStorageService.storeWorld({
        id: localWorldId,
        name,
        description,
        thumbnail: thumbnailUrl,
        author,
        // Link back to the Discover entry so the "Downloaded" state survives reloads. Record the
        // source version we hold (server updated_at) and when, for refresh/update detection.
        sourceId: worldId,
        dirty: false,
        downloadedAt: now,
        sourceUpdatedAt: world.updated_at,
        // Sanitize at the download boundary so the stored copy is already current.
        data: migrated
      });

      setWorlds(prev => [...prev, {
        id: localWorldId,
        name,
        description,
        thumbnail: thumbnailUrl,
        author,
        tags: migrated.worldOverview?.tags || [],
        sourceId: worldId,
        dirty: false,
        downloadedAt: now,
        sourceUpdatedAt: world.updated_at,
        lastAccessed: now,
        isLoading: false
      }]);

      toast.success(`"${name}" downloaded successfully`);
    } catch (error) {
      console.error('Error downloading world:', error);
      toast.error((error as Error).message || 'Failed to download world');
    } finally {
      // Clear the in-flight bar whether it succeeded or failed.
      setDownloadProgress((p) => { const next = { ...p }; delete next[worldId]; return next; });
    }
  };

  // Overwrite an existing local copy in place with the current server content (refresh or update).
  const overwriteWorld = async (world: WorldRecord, localId: string) => {
    const worldId = world._id || world.id;
    setDownloadProgress((p) => ({ ...p, [worldId]: -1 }));
    try {
      const { migrated, thumbnailUrl } = await fetchWorldContent(world, worldId);

      const name = world.name || 'Downloaded World';
      const description = world.description || 'Downloaded from server';
      const author = world.author?.username || '';
      const now = new Date().toISOString();

      // Same local id ⇒ storeWorld overwrites the record in place; flags/stamps reset to a clean copy.
      await WorldStorageService.storeWorld({
        id: localId,
        name,
        description,
        thumbnail: thumbnailUrl,
        author,
        sourceId: worldId,
        dirty: false,
        downloadedAt: now,
        sourceUpdatedAt: world.updated_at,
        data: migrated
      });

      setWorlds(prev => prev.map(w => w.id === localId ? {
        ...w,
        name,
        description,
        thumbnail: thumbnailUrl,
        author,
        tags: migrated.worldOverview?.tags || [],
        sourceId: worldId,
        dirty: false,
        downloadedAt: now,
        sourceUpdatedAt: world.updated_at,
        lastAccessed: now,
      } : w));

      toast.success(`"${name}" updated successfully`);
    } catch (error) {
      console.error('Error updating world:', error);
      toast.error((error as Error).message || 'Failed to update world');
    } finally {
      setDownloadProgress((p) => { const next = { ...p }; delete next[worldId]; return next; });
    }
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
