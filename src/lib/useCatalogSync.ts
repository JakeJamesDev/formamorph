import { useState, useEffect } from "react";
import { toast } from "react-toastify";
import WorldStorageService from "@/services/WorldStorageService";
import { getCatalog, replaceCatalog } from "@/lib/worldCatalog";
import { type WorldRecord } from "@/components/WorldDetails";

/**
 * Owns the Discover catalog: the cached list of published worlds plus its loading/syncing flags.
 * On `open` it renders the cached copy instantly, then refreshes the whole catalog from the server in
 * the background (one request) and re-caches it. `setRemoteWorlds` is exposed so callers can drop a
 * world locally (e.g. after deleting it on the server) without a full re-sync.
 */
export function useCatalogSync(open: boolean) {
  const [remoteWorlds, setRemoteWorlds] = useState<WorldRecord[]>([]);
  const [isLoadingRemoteWorlds, setIsLoadingRemoteWorlds] = useState(false);
  const [isSyncingCatalog, setIsSyncingCatalog] = useState(false);

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

  // Load the world catalog when Discover opens.
  useEffect(() => {
    if (open) {
      loadCatalog();
    }
  }, [open]);

  return { remoteWorlds, setRemoteWorlds, isLoadingRemoteWorlds, isSyncingCatalog, loadCatalog };
}
