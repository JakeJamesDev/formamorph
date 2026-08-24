import { useState, useEffect } from "react";
import { toast } from "react-toastify";
import WorldStorageService from "@/services/WorldStorageService";
import { getCatalog, replaceCatalog } from "@/lib/worldCatalog";
import { COMMUNITY_ENABLED } from "@/lib/featureFlags";
import { type WorldRecord } from "@/components/WorldDetails";

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
      // One request returns the entire catalog, every kind; replace the cache wholesale (which also drops
      // anything removed server-side).
      const result = await WorldStorageService.fetchRemoteWorlds(1, 1000, '', false, false, '', 'desc', 'all');
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
      // Success or failure, an attempt finished: misses may now be trusted.
      setCatalogSettled(true);
    }
  };

  // Load the world catalog when the community browser opens (never in the hosted build — no remote server).
  useEffect(() => {
    if (open && COMMUNITY_ENABLED) {
      loadCatalog();
    } else if (!open) {
      // The next open must wait for its own refresh before a lookup miss means anything.
      setCatalogSettled(false);
    }
  }, [open]);

  return { remoteWorlds, setRemoteWorlds, isLoadingRemoteWorlds, isSyncingCatalog, catalogSettled, loadCatalog };
}
