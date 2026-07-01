import { useState, useEffect, useMemo } from "react";
import { sanitizeTag, collectSanitizedTags } from "@/lib/tagUtils";
import { getDownloadState } from "@/lib/downloadState";
import { toEpoch } from "@/lib/thumbnailCache";
import { type WorldRecord } from "@/components/WorldDetails";

const DEFAULT_PAGE_SIZE = 12;
const ROWS_PER_PAGE = 3; // the grid shows this many full rows per page…
const PORTRAIT_PAGE_SIZE = 10; // …except a flat count in portrait orientation.

/** Columns the responsive grid renders at width `w` — mirrors the Tailwind sm/md/lg/xl breakpoints
 *  on the grid class so the page size matches what's actually visible. */
const gridColumns = (w: number): number =>
  w >= 1280 ? 5 : w >= 1024 ? 4 : w >= 768 ? 3 : w >= 640 ? 2 : 1;

/**
 * The Discover browse pipeline: search/author/tag/sort filters, client-side hide preferences (persisted),
 * and pagination sized to the responsive grid. Derives the filtered/sorted/paged world list from the
 * catalog. `localCopiesBySource` (from the download coordinator) powers the "updates first" sort.
 */
export function useDiscoverFilters(
  remoteWorlds: WorldRecord[],
  localCopiesBySource: Map<string, WorldRecord[]>,
  open: boolean,
) {
  const [searchQuery, setSearchQuery] = useState('');
  const [authorFilter, setAuthorFilter] = useState<string[]>([]);
  const [tagFilter, setTagFilter] = useState<string[]>([]);
  const [tagMode, setTagMode] = useState<'any' | 'all'>('any');
  const [sortField, setSortField] = useState('updated_at'); // updated_at | created_at | downloads
  const [sortOrder, setSortOrder] = useState('desc'); // asc | desc
  const [sortUpdatesFirst, setSortUpdatesFirst] = useState(true); // float worlds with an update to the front
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

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

  // Page size = 3 rows of however many columns the grid renders at the current viewport, except a flat
  // count in portrait orientation.
  useEffect(() => {
    if (!open) return;
    const portraitMq = window.matchMedia('(orientation: portrait)');
    const recompute = () => {
      if (portraitMq.matches) { setPageSize(PORTRAIT_PAGE_SIZE); return; }
      setPageSize(gridColumns(window.innerWidth) * ROWS_PER_PAGE);
    };
    recompute();
    window.addEventListener('resize', recompute);
    portraitMq.addEventListener('change', recompute);
    return () => { window.removeEventListener('resize', recompute); portraitMq.removeEventListener('change', recompute); };
  }, [open]);

  // Reset to page 1 when the result set changes; clamp if hiding shrinks it below the current page.
  useEffect(() => { setCurrentPage(1); }, [searchQuery, authorFilter, tagFilter, tagMode, sortField, sortOrder]);
  useEffect(() => { if (currentPage > totalPages) setCurrentPage(totalPages); }, [currentPage, totalPages]);

  return {
    searchQuery, setSearchQuery,
    authorFilter, setAuthorFilter,
    tagFilter, setTagFilter,
    tagMode, setTagMode,
    sortField, setSortField,
    sortOrder, setSortOrder,
    sortUpdatesFirst, setSortUpdatesFirst,
    currentPage, setCurrentPage,
    hiddenWorldIds, hiddenTags, hiddenAuthors,
    hideRemoteWorld, hideRemoteTag, hideRemoteAuthor,
    resetHiddenWorlds, unhideWorld, unhideTag, unhideAuthor, hiddenWorldName,
    allAuthors, allTags,
    filteredRemoteWorlds, totalPages, pagedRemoteWorlds,
  };
}
