import { useState, useEffect, useRef, useSyncExternalStore } from "react";
import { toastError } from "@/lib/linkToast";
import WorldStorageService from "@/services/WorldStorageService";
import { getCatalog, getCatalogAnonymousLikes, getCatalogTag, replaceCatalog } from "@/lib/worldCatalog";
import { currentReader } from "@/lib/currentReader";
import { claimWatch, type ClaimWatch } from "@/lib/anonymousLikeClaim";
import { catalogStale, type StaleWatch } from "@/lib/catalogStale";
import { COMMUNITY_ENABLED } from "@/lib/featureFlags";
import { isAgeAttested } from "@/lib/ageGate";
import { type WorldRecord } from "@/components/WorldDetails";
import { type CatalogWorld } from "@/lib/worldCatalog";
import { reuseRows } from "@/lib/catalogRows";

/**
 * Owns the community catalog: the cached list of published items plus its loading/syncing flags.
 * On `open` it renders the cached copy instantly, then refreshes the whole catalog from the server in
 * the background (one request) and re-caches it. `setRemoteWorlds` is exposed so callers can drop an
 * item locally (e.g. after deleting it on the server) without a full re-sync.
 *
 * The one request asks for every kind, and callers split the result by `kind` in memory — the same way
 * search and pagination already work here. Records cached before kinds existed have no `kind` field;
 * `kindOf` reads those as worlds, so a stale cache renders correctly until the refresh lands.
 *
 * @param open - Whether the community browser is on screen
 * @param readerKey - Who is asking, so a change of reader forces a refresh rather than showing theirs
 * @param claim - The Claim to read around, so a sign-in's moved likes are in what the server answers
 * @param stale - Who reports that the cached catalog no longer describes the server, such as a settings write
 */
export function useCatalogSync(
  open: boolean,
  readerKey = currentReader(),
  claim: ClaimWatch = claimWatch,
  stale: StaleWatch = catalogStale,
) {
  const [remoteWorlds, setRemoteWorlds] = useState<WorldRecord[]>([]);
  const [isLoadingRemoteWorlds, setIsLoadingRemoteWorlds] = useState(false);
  const [isSyncingCatalog, setIsSyncingCatalog] = useState(false);
  // Whether a refresh attempt has finished during this open. Until then the list in hand is at best
  // last visit's snapshot, so a lookup miss (e.g. a listing named by a notification) proves nothing.
  const [catalogSettled, setCatalogSettled] = useState(false);
  // Whether this server takes a guest's like. Read from the cache first, so the heart is a control from
  // the first frame rather than after the refresh lands.
  const [anonymousLikes, setAnonymousLikes] = useState(false);
  // Claims that have moved marks. A change means the catalog in hand predates them.
  const claimsMoved = useSyncExternalStore(claim.subscribe, claim.moved);
  // Marks that the cached catalog is out of date. A change means a setting it carries was written.
  // Only a mounted reader sees a mark; the community host stays mounted while closed, so a mark raised
  // while it is closed still forces the read on the next open.
  const staleMarks = useSyncExternalStore(stale.subscribe, stale.marked);
  // Held rather than closed over, so the loader below is not rebuilt for a watch that never changes.
  const settled = useRef(claim.settled);
  useEffect(() => { settled.current = claim.settled; }, [claim]);
  const lastReaderKey = useRef(readerKey);
  const lastClaimsMoved = useRef(claimsMoved);
  const lastStaleMarks = useRef(staleMarks);
  const requestGeneration = useRef(0);
  // Declared here rather than through the shared hook: exhaustive-deps treats a ref from a custom
  // hook as unstable, which would pull `loadCatalog` into the open/reader effect's dependencies.
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const loadCatalog = async (force = false) => {
    const request = ++requestGeneration.current;
    const reader = currentReader();
    // Unmounted counts as superseded: the generation and the reader both still match a browser that
    // has closed, so a late answer would pass the guard and set state on a tree that is gone.
    const isCurrent = () => mountedRef.current
      && requestGeneration.current === request && currentReader() === reader;
    // Success or failure, an attempt finished: misses may now be trusted.
    const settle = () => {
      setIsLoadingRemoteWorlds(false);
      setIsSyncingCatalog(false);
      setCatalogSettled(true);
    };

    // Each step sets its states with no await between them, so one step is one commit.
    try {
      const [cached, cachedAnonymousLikes, storedTag] = await Promise.all([
        getCatalog(), getCatalogAnonymousLikes(), getCatalogTag(),
      ]);
      if (!isCurrent()) return;
      // Rows carry their reader's liked marks and private like counts, so only the reader the tag names
      // may see them. Untagged rows have no known reader and wait for the fetch.
      const stored = cached.length ? storedTag : null;
      const ownRows = stored?.reader === reader;
      setAnonymousLikes(cachedAnonymousLikes);
      if (ownRows && !force) {
        setRemoteWorlds(cached);
      } else {
        setIsLoadingRemoteWorlds(true);
      }
      setIsSyncingCatalog(true);

      // The tag is only worth sending back while the same reader is asking: another reader's tag would
      // name another reader's catalog. A forced refresh sends none — it asks for the list again on purpose.
      const tag = !force && ownRows && stored ? stored.tag : null;

      // A sign-in changes the reader and starts a Claim in the same breath, and this refresh is the one
      // the change asked for. Ask before the marks have moved and the answer is missing the hearts the
      // Claim is busy turning into Likes.
      await settled.current();
      if (!isCurrent()) return;

      // One request returns the entire catalog, every kind; replace the cache wholesale (which also drops
      // anything removed server-side).
      const result = await WorldStorageService.fetchCatalog(tag);
      if (!isCurrent()) return;
      if (result.status === 'fresh') {
        // Rows held are this reader's: a change of reader cleared them before this request.
        const fresh = result.data as WorldRecord[];
        setRemoteWorlds((held) => reuseRows(held, fresh));
        setAnonymousLikes(result.anonymousLikes);
      } else if (result.status === 'error' && !cached.length) {
        toastError(result.error, 'Failed to fetch worlds');
      }
      settle();

      // 'unchanged': the rows already rendered are the answer. Nothing is written, and the tag beside
      // them still describes them.
      if (result.status === 'fresh') {
        await replaceCatalog(
          result.data as CatalogWorld[],
          result.tag ? { tag: result.tag, reader } : null,
          result.anonymousLikes,
        ).catch((error: unknown) => console.error('Error caching world catalog:', error));
      }
    } catch (error) {
      if (isCurrent()) {
        console.error('Error loading world catalog:', error);
        settle();
      }
    }
  };

  // Load the world catalog when the community browser opens (never in the hosted build — no remote server,
  // and never before the age gate is answered — the catalog is the listing of what other players wrote).
  useEffect(() => {
    if (open && COMMUNITY_ENABLED && isAgeAttested()) {
      const readerChanged = lastReaderKey.current !== readerKey;
      // A Claim that landed since the last read leaves every heart it moved wrong in what is held. It
      // is its own reason to ask again, because the retry that ran it changed no reader.
      const claimLanded = lastClaimsMoved.current !== claimsMoved;
      // A setting the catalog carries was written since the last read. The stored tag would have the
      // server answer 'unchanged' and the old value would persist.
      const wentStale = lastStaleMarks.current !== staleMarks;
      lastReaderKey.current = readerKey;
      lastClaimsMoved.current = claimsMoved;
      lastStaleMarks.current = staleMarks;
      // A liked mark belongs to its reader. Do not show the old reader's catalog while the forced
      // request that replaces it is in flight.
      if (readerChanged) setRemoteWorlds([]);
      void loadCatalog(readerChanged || claimLanded || wentStale);
    } else if (!open) {
      // The next open must wait for its own refresh before a lookup miss means anything.
      setCatalogSettled(false);
    }
  }, [open, readerKey, claimsMoved, staleMarks]);

  return {
    remoteWorlds, setRemoteWorlds, isLoadingRemoteWorlds, isSyncingCatalog, catalogSettled, loadCatalog,
    anonymousLikes, setAnonymousLikes,
  };
}
