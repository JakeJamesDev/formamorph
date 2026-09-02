import { useState, useEffect } from "react";
import { toast } from "react-toastify";
import WorldStorageService from "@/services/WorldStorageService";
import AuthService from "@/services/AuthService";
import { getCatalog, getCatalogTag, replaceCatalog } from "@/lib/worldCatalog";
import { COMMUNITY_ENABLED } from "@/lib/featureFlags";
import { isAgeAttested } from "@/lib/ageGate";
import { type WorldRecord } from "@/components/WorldDetails";
import { type CatalogWorld } from "@/lib/worldCatalog";

/** Who the catalog in hand belongs to: a signed-in reader's id, or the empty string for anonymous. */
const currentReader = (): string => {
  const id = AuthService.currentUser?.id;
  return AuthService.isAuthenticated() && id != null ? String(id) : '';
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
 */
export function useCatalogSync(open: boolean) {
  const [remoteWorlds, setRemoteWorlds] = useState<WorldRecord[]>([]);
  const [isLoadingRemoteWorlds, setIsLoadingRemoteWorlds] = useState(false);
  const [isSyncingCatalog, setIsSyncingCatalog] = useState(false);
  // Whether a refresh attempt has finished during this open. Until then the list in hand is at best
  // last visit's snapshot, so a lookup miss (e.g. a listing named by a notification) proves nothing.
  const [catalogSettled, setCatalogSettled] = useState(false);

  const loadCatalog = async (force = false) => {
    try {
      const cached = await getCatalog();
      if (cached.length && !force) {
        setRemoteWorlds(cached);
      } else {
        setIsLoadingRemoteWorlds(true);
      }
      setIsSyncingCatalog(true);

      // The tag is only worth sending back while the same reader is asking: liked marks and the
      // listings a reader can see are their own, so another reader's tag would name another reader's
      // catalog. A forced refresh sends none — it is asking for the list again on purpose.
      const reader = currentReader();
      const stored = cached.length ? await getCatalogTag() : null;
      const tag = !force && stored && stored.reader === reader ? stored.tag : null;

      // One request returns the entire catalog, every kind; replace the cache wholesale (which also drops
      // anything removed server-side).
      const result = await WorldStorageService.fetchCatalog(tag);
      if (result.status === 'fresh') {
        setRemoteWorlds(result.data as WorldRecord[]);
        await replaceCatalog(result.data as CatalogWorld[], result.tag ? { tag: result.tag, reader } : null);
      } else if (result.status === 'error' && !cached.length) {
        toast.error(result.error || 'Failed to fetch worlds');
      }
      // 'unchanged': the rows already rendered are the answer. Nothing is written, and the tag beside
      // them still describes them.
    } catch (error) {
      console.error('Error loading world catalog:', error);
    } finally {
      setIsLoadingRemoteWorlds(false);
      setIsSyncingCatalog(false);
      // Success or failure, an attempt finished: misses may now be trusted.
      setCatalogSettled(true);
    }
  };

  // Load the world catalog when the community browser opens (never in the hosted build — no remote server,
  // and never before the age gate is answered — the catalog is the listing of what other players wrote).
  useEffect(() => {
    if (open && COMMUNITY_ENABLED && isAgeAttested()) {
      loadCatalog();
    } else if (!open) {
      // The next open must wait for its own refresh before a lookup miss means anything.
      setCatalogSettled(false);
    }
  }, [open]);

  return { remoteWorlds, setRemoteWorlds, isLoadingRemoteWorlds, isSyncingCatalog, catalogSettled, loadCatalog };
}
