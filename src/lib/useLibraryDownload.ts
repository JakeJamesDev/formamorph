import { useState, useMemo } from "react";
import { toast } from "react-toastify";
import { fetchCatalogContent } from "@/lib/fetchCatalogContent";
import { randomUUID } from "@/lib/uuid";
import { getDownloadState, type DownloadState } from "@/lib/downloadState";
import { KIND_LABELS, type CatalogKind } from "@/lib/catalogKinds";
import { type WorldRecord } from "@/components/WorldDetails";
import type { CommunityLink } from "@/types";

/** A local library record with its community link — the slice this flow needs, whichever kind it is. */
export interface LibraryRecord extends CommunityLink {
  id: string;
  name: string;
}

/**
 * How one kind reaches its library. Characters and dictionaries differ only in which service they store
 * through and what their content looks like, so that difference is passed in rather than branched on.
 */
export interface LibraryTarget<T> {
  kind: CatalogKind;
  /** Records already held, so a listing already downloaded can be recognized. */
  records: LibraryRecord[];
  /** Persist a downloaded copy under `id`, with `link`'s community fields stored alongside it. */
  store: (
    id: string,
    content: T,
    link: Required<Pick<CommunityLink, 'sourceId' | 'downloadedAt'>> & CommunityLink,
  ) => Promise<void>;
  /** Refresh the caller's list after a store. */
  refresh: () => void;
  /** Optional pre-store pass (e.g. offer to shrink an oversized portrait); returns the content to store. */
  onFetched?: (content: T) => Promise<T>;
}

/**
 * Download a community character or dictionary into its local library.
 *
 * Unlike worlds, each listing maps to exactly one local copy: re-downloading refreshes that copy in place
 * rather than making a second one, so there's no copy-vs-overwrite picker. But it also means an update has
 * nowhere to put your edits, so an edited copy asks first — that's what `dirty` is for.
 *
 * The copy gets its own record id, never the downloaded content's. Two listings forked from one ancestor
 * share a content id, as does a local original you published; keying on it would make them collide.
 */
export function useLibraryDownload<T extends { id?: string }>(target: LibraryTarget<T>) {
  const [downloadProgress, setDownloadProgress] = useState<Record<string, number>>({});
  /** The listing awaiting an "this will replace your edits" answer, or null. */
  const [dirtyConfirm, setDirtyConfirm] = useState<WorldRecord | null>(null);

  // One local copy per listing, so this maps to a single record rather than a list.
  const copyBySource = useMemo(() => {
    const map = new Map<string, LibraryRecord>();
    for (const r of target.records) {
      if (r.sourceId) map.set(r.sourceId, r);
    }
    return map;
  }, [target.records]);

  const copyFor = (listing: WorldRecord): LibraryRecord | undefined =>
    copyBySource.get(listing._id || listing.id);

  const downloadStateFor = (listing: WorldRecord): DownloadState => {
    const copy = copyFor(listing);
    return getDownloadState(listing.updated_at, copy ? [copy] : []);
  };

  /** Fetch and store, replacing any copy of this listing. */
  const run = async (listing: WorldRecord) => {
    const listingId = listing._id || listing.id;
    const noun = KIND_LABELS[target.kind].one;
    // Indeterminate until the size is known, so the card swaps to a bar immediately.
    setDownloadProgress((p) => ({ ...p, [listingId]: -1 }));
    try {
      const content = await fetchCatalogContent(listingId, (fraction) =>
        setDownloadProgress((p) => ({ ...p, [listingId]: fraction })));

      const item = content as T;
      const final = target.onFetched ? await target.onFetched(item) : item;

      // Re-download reuses this listing's existing copy (one copy per listing); a first download mints a
      // fresh id rather than storing under the *content's* own id. That id belongs to the author's
      // original: a hand-made character you never published, or another listing forked from the same
      // ancestor, can carry it too — writing there would silently replace a record this flow can't see,
      // since the guard below only knows copies by `sourceId`. Worlds mint per-copy ids for this reason.
      const recordId = copyFor(listing)?.id ?? `downloaded-${randomUUID()}`;

      await target.store(recordId, { ...final, id: recordId }, {
        sourceId: listingId,
        downloadedAt: new Date().toISOString(),
        sourceUpdatedAt: listing.updated_at,
        // A fresh download is by definition unedited; this also clears the flag on a copy you'd edited.
        dirty: false,
      });
      target.refresh();
      toast.success(`"${listing.name || noun}" downloaded successfully`);
    } catch (error) {
      console.error(`Error downloading ${target.kind}:`, error);
      toast.error((error as Error).message || `Failed to download ${noun.toLowerCase()}`);
    } finally {
      setDownloadProgress((p) => { const next = { ...p }; delete next[listingId]; return next; });
    }
  };

  /**
   * Start a download. An edited copy asks first — the replacement would otherwise discard the user's work
   * with no warning and nowhere to recover it from.
   */
  const startDownload = (listing: WorldRecord) => {
    const listingId = listing._id || listing.id;
    // The card's click handler calls this directly, so a double-click would start two runs on one listing:
    // their progress writes fight over a single key, and whichever finishes first deletes it — dropping the
    // bar while the other is still streaming — then both store to the same record.
    if (downloadProgress[listingId] !== undefined) return;

    if (copyFor(listing)?.dirty) {
      setDirtyConfirm(listing);
      return;
    }
    run(listing);
  };

  const confirmDirtyDownload = () => {
    const listing = dirtyConfirm;
    setDirtyConfirm(null);
    if (listing) run(listing);
  };

  return {
    downloadProgress,
    downloadStateFor,
    copyFor,
    /** Exposed so callers can memoize on it — `downloadStateFor`'s only input. */
    copyBySource,
    startDownload,
    dirtyConfirm,
    setDirtyConfirm,
    confirmDirtyDownload,
  };
}
