import { useState, useEffect, useMemo, useCallback, useRef, type Dispatch, type SetStateAction } from "react";
import { sanitizeTag, collectSanitizedTags } from "@/lib/tagUtils";
import { type DownloadState } from "@/lib/downloadState";
import { toEpoch } from "@/lib/thumbnailCache";
import { kindOf } from "@/lib/catalogKinds";
import { BROWSE_TABS, catalogKindOfTab, type BrowseTab } from "@/lib/browseTabs";
import { asStatusFacet, matchesStatusFacets, type StatusFacet } from "@/lib/communityStatusFacets";
import { extractFilterPrefixes } from "@/lib/filterPrefixes";
import { type WorldRecord } from "@/components/WorldDetails";

const DEFAULT_PAGE_SIZE = 12;
const ROWS_PER_PAGE = 3; // the grid shows this many full rows per page…
const PORTRAIT_PAGE_SIZE = 10; // …except a flat count in portrait orientation.

const FILTERS_KEY = 'FORMAMORPH_communityFilters';

/** Columns the responsive grid renders at width `w` — mirrors the Tailwind sm/md/lg/xl breakpoints
 *  on the grid class so the page size matches what's actually visible. */
const gridColumns = (w: number): number =>
  w >= 1280 ? 5 : w >= 1024 ? 4 : w >= 768 ? 3 : w >= 640 ? 2 : 1;

/** One tab's browse settings. Each tab keeps its own: a tag that exists on worlds usually doesn't on
 *  dictionaries, so carrying the filter across would silently empty the tab being switched to. The
 *  Contest tab has its own slot for the same reason — it shows worlds, but a filter set while browsing
 *  the catalog has nothing to do with the handful of listings in a contest. */
interface KindFilters {
  authorFilter: string[];
  tagFilter: string[];
  tagMode: 'any' | 'all';
  statusFilter: StatusFacet[];
  sortField: string; // updated_at | created_at | downloads | likes
  sortOrder: string; // asc | desc
  sortUpdatesFirst: boolean; // float listings with an update to the front
}

const emptyFilters = (): KindFilters => ({
  authorFilter: [],
  tagFilter: [],
  tagMode: 'any',
  statusFilter: [],
  sortField: 'updated_at',
  sortOrder: 'desc',
  sortUpdatesFirst: true,
});

const emptyByKind = (): Record<BrowseTab, KindFilters> =>
  Object.fromEntries(BROWSE_TABS.map((k) => [k, emptyFilters()])) as Record<BrowseTab, KindFilters>;

const stringList = (value: unknown): string[] =>
  Array.isArray(value) ? value.map((v) => String(v)).filter(Boolean) : [];

/** Rebuild the stored settings field by field, so a hand-edited or outdated key can only ever lose
 *  settings rather than seed the pipeline with a shape it doesn't understand. */
function readStoredFilters(): Record<BrowseTab, KindFilters> {
  const out = emptyByKind();
  try {
    const raw = JSON.parse(localStorage.getItem(FILTERS_KEY) || '{}');
    if (!raw || typeof raw !== 'object') return out;
    for (const kind of BROWSE_TABS) {
      const saved = (raw as Record<string, unknown>)[kind];
      if (!saved || typeof saved !== 'object') continue;
      const s = saved as Record<string, unknown>;
      out[kind] = {
        authorFilter: stringList(s.authorFilter),
        tagFilter: stringList(s.tagFilter).map(sanitizeTag).filter(Boolean),
        tagMode: s.tagMode === 'all' ? 'all' : 'any',
        statusFilter: stringList(s.statusFilter)
          .map(asStatusFacet)
          .filter((f): f is StatusFacet => f !== null),
        sortField: typeof s.sortField === 'string' ? s.sortField : 'updated_at',
        sortOrder: s.sortOrder === 'asc' ? 'asc' : 'desc',
        sortUpdatesFirst: s.sortUpdatesFirst !== false,
      };
    }
  } catch { /* a corrupt key falls back to the defaults, which the write effect then rewrites */ }
  return out;
}

/**
 * The Community Creations browse pipeline: search/author/tag/status/sort filters, client-side hide
 * preferences (persisted), and pagination sized to the responsive grid. Derives the filtered/sorted/paged
 * list from the catalog.
 *
 * `tab` scopes the whole pipeline: the catalog holds every kind in one list, so it's narrowed once here
 * and everything downstream — authors, tags, search, sort, paging — follows without needing to know. The
 * filter settings are held per tab and restored between sessions; the search box deliberately isn't, since
 * text left over from a previous session reads as an empty catalog rather than as a filter.
 *
 * `downloadStateOf` powers the "updates first" sort and the download-related status facets. It's a function
 * rather than a map of local copies because each kind keeps its copies in its own library: handing this one
 * library's map would silently make the sort a no-op on the other tabs, which is exactly what it did.
 *
 * `viewerId` is the signed-in account, which the Liked and Mine facets need; without one they match nothing.
 *
 * `order` replaces the sort stage for a tab whose order is not the reader's to choose — the contest tab,
 * whose entries are shuffled while it runs and stand by likes once it is judged. The filters still apply;
 * only what happens after them changes.
 */
export function useCommunityBrowserFilters(
  remoteWorlds: WorldRecord[],
  downloadStateOf: (record: WorldRecord) => DownloadState,
  open: boolean,
  tab: BrowseTab = 'world',
  viewerId?: string,
  order?: (list: WorldRecord[]) => WorldRecord[],
) {
  const kind = catalogKindOfTab(tab);
  const [searchQuery, setSearchQuery] = useState('');
  const [filtersByKind, setFiltersByKind] = useState<Record<BrowseTab, KindFilters>>(readStoredFilters);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

  useEffect(() => {
    localStorage.setItem(FILTERS_KEY, JSON.stringify(filtersByKind));
  }, [filtersByKind]);

  const filters = filtersByKind[tab] ?? emptyFilters();

  // One setter per field, each writing through to the tab being browsed. `tab` is read from a ref so the
  // setters keep a stable identity — they are dependencies of the memo below, which sorts the whole catalog.
  const kindRef = useRef<BrowseTab>(tab);
  kindRef.current = tab;
  const patch = useCallback((change: Partial<KindFilters>) => {
    const k = kindRef.current;
    setFiltersByKind((prev) => ({ ...prev, [k]: { ...(prev[k] ?? emptyFilters()), ...change } }));
  }, []);
  const setterFor = useCallback(<K extends keyof KindFilters>(field: K): Dispatch<SetStateAction<KindFilters[K]>> =>
    (value) => {
      const k = kindRef.current;
      setFiltersByKind((prev) => {
        const current = prev[k] ?? emptyFilters();
        const next = typeof value === 'function'
          ? (value as (prev: KindFilters[K]) => KindFilters[K])(current[field])
          : value;
        return { ...prev, [k]: { ...current, [field]: next } };
      });
    }, []);

  const setAuthorFilter = useMemo(() => setterFor('authorFilter'), [setterFor]);
  const setTagFilter = useMemo(() => setterFor('tagFilter'), [setterFor]);
  const setTagMode = useMemo(() => setterFor('tagMode'), [setterFor]);
  const setStatusFilter = useMemo(() => setterFor('statusFilter'), [setterFor]);
  const setSortField = useMemo(() => setterFor('sortField'), [setterFor]);
  const setSortOrder = useMemo(() => setterFor('sortOrder'), [setterFor]);
  const setSortUpdatesFirst = useMemo(() => setterFor('sortUpdatesFirst'), [setterFor]);

  const toggleStatus = useCallback((facet: StatusFacet) => {
    setStatusFilter((prev) => (prev.includes(facet) ? prev.filter((f) => f !== facet) : [...prev, facet]));
  }, [setStatusFilter]);

  /** Clear this tab's include filters. Sort is left alone — it is a view preference, not a narrowing, and
   *  resetting it would move the grid under a reader who only wanted their filters gone. */
  const clearFilters = useCallback(() => {
    setSearchQuery('');
    patch({ authorFilter: [], tagFilter: [], statusFilter: [] });
  }, [patch]);

  const {
    authorFilter, tagFilter, tagMode, statusFilter, sortField, sortOrder, sortUpdatesFirst,
  } = filters;

  /**
   * Search-box input, with any finished `author:`/`tag:`/`status:` token lifted out into a filter chip.
   *
   * Typed filters become the same chips the popover adds rather than a second, invisible way to narrow the
   * list: one place shows everything currently applied.
   *
   * `commit` is set when Enter is pressed, which also finishes the token still under the cursor.
   */
  const applySearchInput = useCallback((raw: string, commit = false) => {
    const { prefixes, rest } = extractFilterPrefixes(raw, commit);
    setSearchQuery(rest);
    if (!prefixes.length) return;
    const k = kindRef.current;
    setFiltersByKind((prev) => {
      const current = prev[k] ?? emptyFilters();
      const next = { ...current };
      for (const prefix of prefixes) {
        if (prefix.kind === 'author') {
          if (!next.authorFilter.some((a) => a.toLowerCase() === prefix.value.toLowerCase())) {
            next.authorFilter = [...next.authorFilter, prefix.value];
          }
        } else if (prefix.kind === 'tag') {
          const tag = sanitizeTag(prefix.value);
          if (tag && !next.tagFilter.includes(tag)) next.tagFilter = [...next.tagFilter, tag];
        } else if (!next.statusFilter.includes(prefix.value)) {
          next.statusFilter = [...next.statusFilter, prefix.value];
        }
      }
      return { ...prev, [k]: next };
    });
  }, []);

  // Community-browser hide preferences (client-side, persisted in localStorage). Global across the kind
  // tabs, unlike the filters above: hiding an author is "never show me this", not a way to browse.
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

  // Persist community-browser hide preferences
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
  // Whole-array setters for the Hidden popover's tag/author autocomplete boxes (TokenAutocomplete
  // hands back the full array and allows free text, so normalize the same way the single-add helpers do).
  const setHiddenTagsList = (tags: string[]) =>
    setHiddenTags(Array.from(new Set(tags.map(sanitizeTag).filter(Boolean))));
  const setHiddenAuthorsList = (names: string[]) => {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const raw of names) {
      const n = String(raw || '').trim();
      const key = n.toLowerCase();
      if (n && !seen.has(key)) { seen.add(key); out.push(n); }
    }
    setHiddenAuthors(out);
  };
  const unhideWorld = (id: string) => setHiddenWorldIds((prev) => prev.filter((w) => w !== id));
  const unhideTag = (tag: string) => setHiddenTags((prev) => prev.filter((t) => t !== tag));
  const unhideAuthor = (name: string) => setHiddenAuthors((prev) => prev.filter((a) => a !== name));
  // Resolve a hidden world id to its name from the catalog (falls back to a short id).
  const hiddenWorldName = (id: string) =>
    remoteWorlds.find((w) => (w._id || w.id) === id)?.name || `${id.slice(0, 8)}…`;

  // Unique authors/tags from the cached catalog (excluding hidden ones), for the filter autocomplete.
  // The catalog is one list of every kind; narrow it once so nothing below has to re-ask.
  const kindWorlds = useMemo(
    () => remoteWorlds.filter((w) => kindOf(w) === kind),
    [remoteWorlds, kind],
  );

  const allAuthors = useMemo(() => {
    const hidden = new Set(hiddenAuthors.map((a) => a.toLowerCase()));
    const set = new Set<string>();
    kindWorlds.forEach((w) => {
      const name = w.author?.username;
      if (name && !hidden.has(name.toLowerCase())) set.add(name);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [kindWorlds, hiddenAuthors]);
  // hiddenTags are already sanitized; collectSanitizedTags normalizes the rest.
  const allTags = useMemo(
    () => collectSanitizedTags(kindWorlds.map((w) => w.tags), new Set(hiddenTags)),
    [kindWorlds, hiddenTags],
  );

  // Client-side browse pipeline: hide filters → text search → author/tag/status include filters → sort.
  // Every include filter must hold — status facets stack with each other and with author and tag alike.
  // With "updates first" on, listings with an available update are floated to the front, each group then
  // ordered by the chosen sort field/direction.
  const filteredRemoteWorlds = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const authors = authorFilter.map((a) => a.toLowerCase());
    const tags = tagFilter.map((t) => sanitizeTag(t)).filter(Boolean);
    const list = kindWorlds.filter((world) => {
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
      if (statusFilter.length && !matchesStatusFacets(world, statusFilter, downloadStateOf(world), viewerId)) {
        return false;
      }
      return true;
    });
    if (order) return order(list);
    const dir = sortOrder === 'asc' ? 1 : -1;
    return [...list].sort((a, b) => {
      if (sortUpdatesFirst) {
        const au = downloadStateOf(a) === 'update' ? 1 : 0;
        const bu = downloadStateOf(b) === 'update' ? 1 : 0;
        if (au !== bu) return bu - au; // updates first, regardless of sort direction
      }
      // Dates parse to an epoch; the counts (downloads, likes) pass through `toEpoch` as the numbers they
      // already are, missing ones included, so both kinds of field compare on one line.
      const av = sortField === 'downloads' ? (a.downloads || 0) : toEpoch(a[sortField]);
      const bv = sortField === 'downloads' ? (b.downloads || 0) : toEpoch(b[sortField]);
      return (av - bv) * dir;
    });
  }, [kindWorlds, searchQuery, authorFilter, tagFilter, tagMode, statusFilter, viewerId, hiddenWorldIds, hiddenTags, hiddenAuthors, sortField, sortOrder, sortUpdatesFirst, downloadStateOf, order]);

  const totalPages = Math.max(1, Math.ceil(filteredRemoteWorlds.length / pageSize));
  const pagedRemoteWorlds = filteredRemoteWorlds.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  /** How many narrowings are in force on this tab — what the mobile "Filters" badge counts. Hides are
   *  included: an empty-looking grid is as often a hide as a filter. */
  const activeFilterCount =
    authorFilter.length + tagFilter.length + statusFilter.length
    + hiddenWorldIds.length + hiddenTags.length + hiddenAuthors.length;

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
  // `kind` included: switching tabs shortens the list, so a page-5 view would otherwise land on nothing.
  useEffect(() => { setCurrentPage(1); }, [searchQuery, authorFilter, tagFilter, tagMode, statusFilter, sortField, sortOrder, kind]);
  useEffect(() => { if (currentPage > totalPages) setCurrentPage(totalPages); }, [currentPage, totalPages]);

  return {
    searchQuery, setSearchQuery, applySearchInput,
    authorFilter, setAuthorFilter,
    tagFilter, setTagFilter,
    tagMode, setTagMode,
    statusFilter, setStatusFilter, toggleStatus,
    sortField, setSortField,
    sortOrder, setSortOrder,
    sortUpdatesFirst, setSortUpdatesFirst,
    clearFilters, activeFilterCount,
    currentPage, setCurrentPage,
    hiddenWorldIds, hiddenTags, hiddenAuthors,
    hideRemoteWorld, hideRemoteTag, hideRemoteAuthor,
    setHiddenTagsList, setHiddenAuthorsList,
    resetHiddenWorlds, unhideWorld, unhideTag, unhideAuthor, hiddenWorldName,
    allAuthors, allTags,
    filteredRemoteWorlds, totalPages, pagedRemoteWorlds,
  };
}
