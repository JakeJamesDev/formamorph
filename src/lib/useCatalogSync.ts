import { useState, useEffect, useRef, useSyncExternalStore } from "react";
import { toast } from "react-toastify";
import WorldStorageService from "@/services/WorldStorageService";
import AuthService from "@/services/AuthService";
import { getCatalog, getCatalogAnonymousLikes, getCatalogTag, replaceCatalog } from "@/lib/worldCatalog";
import { readerInstallId } from "@/lib/anonymousLikes";
import { claimWatch, type ClaimWatch } from "@/lib/anonymousLikeClaim";
import { COMMUNITY_ENABLED } from "@/lib/featureFlags";
import { isAgeAttested } from "@/lib/ageGate";
import { type WorldRecord } from "@/components/WorldDetails";
import { type CatalogWorld } from "@/lib/worldCatalog";

/**
 * Who the catalog in hand belongs to: a signed-in reader's id, or this Install.
 *
 * A guest has hearts of their own now, and the server marks them from the Install header, so two
 * guests on one machine would otherwise read each other's. The Install is what tells them apart.
 *
 * Where nothing may name an Install, every guest is the one guest. That shell's catalog carries no
 * hearts to keep apart, and asking for an id would make one for a reader who has no use for it.
 */
const currentReader = (): string => {
  const id = AuthService.currentUser?.id;
  if (AuthService.isAuthenticated() && id != null) return String(id);

  const install = readerInstallId();
  return install ? `install:${install}` : 'guest';
};

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
 */
export function useCatalogSync(open: boolean, readerKey = currentReader(), claim: ClaimWatch = claimWatch) {
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
  // Held rather than closed over, so the loader below is not rebuilt for a watch that never changes.
  const settled = useRef(claim.settled);
  useEffect(() => { settled.current = claim.settled; }, [claim]);
  const lastReaderKey = useRef(readerKey);
  const lastClaimsMoved = useRef(claimsMoved);
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

    try {
      const cached = await getCatalog();
      if (!isCurrent()) return;
      setAnonymousLikes(await getCatalogAnonymousLikes());
      if (!isCurrent()) return;
      if (cached.length && !force) {
        setRemoteWorlds(cached);
      } else {
        setIsLoadingRemoteWorlds(true);
      }
      setIsSyncingCatalog(true);

      // The tag is only worth sending back while the same reader is asking: liked marks and the
      // listings a reader can see are their own, so another reader's tag would name another reader's
      // catalog. A forced refresh sends none — it is asking for the list again on purpose.
      const stored = cached.length ? await getCatalogTag() : null;
      if (!isCurrent()) return;
      const tag = !force && stored && stored.reader === reader ? stored.tag : null;

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
        setRemoteWorlds(result.data as WorldRecord[]);
        setAnonymousLikes(result.anonymousLikes);
        await replaceCatalog(
          result.data as CatalogWorld[],
          result.tag ? { tag: result.tag, reader } : null,
          result.anonymousLikes,
        );
      } else if (result.status === 'error' && !cached.length) {
        toast.error(result.error || 'Failed to fetch worlds');
      }
      // 'unchanged': the rows already rendered are the answer. Nothing is written, and the tag beside
      // them still describes them.
    } catch (error) {
      if (isCurrent()) console.error('Error loading world catalog:', error);
    } finally {
      if (isCurrent()) {
        setIsLoadingRemoteWorlds(false);
        setIsSyncingCatalog(false);
        // Success or failure, an attempt finished: misses may now be trusted.
        setCatalogSettled(true);
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
      lastReaderKey.current = readerKey;
      lastClaimsMoved.current = claimsMoved;
      // A liked mark belongs to its reader. Do not show the old reader's catalog while the forced
      // request that replaces it is in flight.
      if (readerChanged) setRemoteWorlds([]);
      void loadCatalog(readerChanged || claimLanded);
    } else if (!open) {
      // The next open must wait for its own refresh before a lookup miss means anything.
      setCatalogSettled(false);
    }
  }, [open, readerKey, claimsMoved]);

  return {
    remoteWorlds, setRemoteWorlds, isLoadingRemoteWorlds, isSyncingCatalog, catalogSettled, loadCatalog,
    anonymousLikes, setAnonymousLikes,
  };
}
