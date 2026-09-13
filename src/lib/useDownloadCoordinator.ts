import { useState, useMemo, useRef, type Dispatch, type SetStateAction } from "react";
import { toast } from "react-toastify";
import WorldStorageService from "@/services/WorldStorageService";
import { migrateWorld } from "@/lib/version";
import { fetchCatalogContent } from "@/lib/fetchCatalogContent";
import { randomUUID } from "@/lib/uuid";
import { getDownloadState, type DownloadState } from "@/lib/downloadState";
import { libraryItems, saveDownloadToLibrary } from "@/lib/librarySources";
import type { LinkableContent } from "@/lib/linkedContent";
import {
  componentKind, linkInstalledSources, listingId,
  type DependencyRow, type InstalledSource,
} from "@/lib/worldDependencies";
import {
  buildWorldUpdateReview, keepInstalledCopies, protectedCopies,
  type HeldSource, type WorldContentSlices, type WorldUpdateRow,
} from "@/lib/worldUpdateReview";
import type { UpdateAction } from "@/lib/componentUpdates";
import { type WorldRecord } from "@/components/WorldDetails";
import type { World } from "@/types";

/** One add-on the player ticked. The name travels with the id so a row the world has since stopped
 *  offering can still be named in the report rather than shown as a listing id. */
export interface SelectedAddon {
  id: string;
  name: string;
}

/** What a player chose to take alongside the world. Required sources are not in here: the world declares
 *  those, and every download installs them. */
export interface DownloadPlan {
  addons: SelectedAddon[];
}

/** One item a download could not finish. `id` is the listing it is about, so a retry can name this row
 *  alone; a read that failed before any listing was known carries one of the ids below. */
export interface DownloadFailure {
  id: string;
  name: string;
  message: string;
}

/** The two failures that belong to a request rather than to one listing. */
const REQUIRED_READ = 'required-set';
const ADDON_READ = 'addon-set';

/** What a download left unfinished, as the retry surface reads it. */
export interface PendingDownload {
  worldName: string;
  /**
   * The world is installed and only add-ons are outstanding. False means the world is still pending: a
   * required source failed, so the world is not presented as ready.
   */
  worldReady: boolean;
  failures: DownloadFailure[];
}

/** What the player answered in the world update review, and the copy their answers protect. */
export interface WorldUpdatePlan {
  /** The installed copy's content before the update, which every protected component is restored from. */
  previous: WorldContentSlices;
  /** What the review listed, which says what each answer is about. */
  rows: WorldUpdateRow[];
  /** The chosen action per required or dropped listing. */
  actions: Record<string, UpdateAction>;
}

/** The review a world update opens before it writes anything. */
export interface WorldUpdateReview {
  world: WorldRecord;
  /** The local copy the update replaces in place. */
  localId: string;
  localName: string;
  rows: WorldUpdateRow[];
  previous: WorldContentSlices;
}

/** One download in flight or awaiting a retry, with everything a retry needs to finish it rather than
 *  start again. */
interface DownloadRun {
  world: WorldRecord;
  localId: string;
  /** Replace an existing local copy in place, rather than adding one. */
  overwrite: boolean;
  /** The world's own content, kept so a retry does not download it a second time. */
  content?: { migrated: World; thumbnailUrl: string };
  /** The components this run has already placed in the library. */
  installed: InstalledSource[];
  /** The add-ons the player selected, and the ones already installed. */
  addons: SelectedAddon[];
  addonsDone: Set<string>;
  /** Why each outstanding add-on is outstanding, so a retry of one still reports the rest truthfully. */
  addonMessages: Record<string, string>;
  /** Each outstanding required source, as its own reported row. Only an update run reports one: a first
   *  download withholds the world instead. */
  requiredFailures: Record<string, DownloadFailure>;
  /** The world is stored. What is left is optional. */
  worldReady: boolean;
  /** Present when this run updates an installed copy in place rather than adding one. */
  update?: WorldUpdatePlan;
}

/** A source the player cannot be given, by why. Each reads as the reason a retry would hit again. */
const MISSING_SOURCE = 'This required source is no longer on the server.';
const UNSUPPORTED_SOURCE = 'This source is not a character or a dictionary, so it cannot be installed.';
const WITHDRAWN_ADDON = 'This world no longer offers this add-on.';

/**
 * Owns the "download a community world to the local library" flow: per-world progress, the contextual
 * decision state (download a copy vs overwrite an existing one), the world's required sources and
 * selected add-ons, and the fetch/store handlers. Reads the local `worlds` to group copies by their source
 * community catalog entry (driving the none/refresh/update button state), and calls `setWorlds` to
 * add/replace local copies.
 *
 * A required source that fails leaves the world pending: what already installed is kept, and a retry
 * finishes the rest. A failed add-on never holds up the world.
 */
export function useDownloadCoordinator(
  worlds: WorldRecord[],
  setWorlds: Dispatch<SetStateAction<WorldRecord[]>>,
  // Optional post-store hook (e.g. offer to downscale oversized images). Returns a replacement world to
  // re-store in place, or null to leave the stored copy as-is.
  onStored?: (id: string, data: World) => Promise<World | null>,
) {
  // In-flight downloads keyed by remote world id → fraction 0..1, or -1 when total size is unknown.
  const [downloadProgress, setDownloadProgress] = useState<Record<string, number>>({});
  // The world awaiting a refresh/update decision (copy vs overwrite), or null when none is pending.
  const [contextualAction, setContextualAction] = useState<{ world: WorldRecord; mode: DownloadState } | null>(null);
  const [overwriteSelectedId, setOverwriteSelectedId] = useState<string | null>(null);
  const [showOverwriteSelect, setShowOverwriteSelect] = useState(false);
  // What the last download could not finish, or null when nothing is waiting on a retry.
  const [pendingDownload, setPendingDownload] = useState<PendingDownload | null>(null);
  // The update review on screen, or null when none is open. Nothing is written while it stands.
  const [worldUpdateReview, setWorldUpdateReview] = useState<WorldUpdateReview | null>(null);
  // The run behind that report, so Retry resumes it rather than starting over.
  const runRef = useRef<DownloadRun | null>(null);
  // The add-on selection the player made before the copy-vs-overwrite dialog opened, so the answer to
  // that dialog carries it through.
  const planRef = useRef<DownloadPlan>({ addons: [] });

  // Local copies grouped by the community catalog entry they were downloaded from (sourceId). Drives the
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
    localCopiesBySource.get(listingId(world)) ?? [];

  const downloadStateForWorld = (world: WorldRecord): DownloadState =>
    getDownloadState(world.updated_at, copiesForWorld(world));

  // Fetch + stream + migrate a remote world's content, reporting streaming progress on
  // downloadProgress[worldId]. Shared by the new-copy download and the in-place overwrite paths.
  const fetchWorldContent = async (
    world: WorldRecord,
    worldId: string,
  ): Promise<{ migrated: World; thumbnailUrl: string }> => {
    const contentData = await fetchCatalogContent(worldId, (fraction) =>
      setDownloadProgress((p) => ({ ...p, [worldId]: fraction })));

    const migrated = migrateWorld(contentData);

    // An author who never filled the field still made the world, so credit the uploader's account name.
    // Only when it is genuinely blank — any authored text, including a pen name, is left alone.
    const uploaderName = typeof world.author?.username === 'string' ? world.author.username.trim() : '';
    if (migrated.worldOverview && !migrated.worldOverview.author?.trim() && uploaderName) {
      migrated.worldOverview.author = uploaderName;
    }

    // Prefer the world's own embedded thumbnail (base64, already in the downloaded content) so the local
    // copy is self-contained and renders offline. A cross-origin server URL would also be blocked from
    // embedding by the thumbnail response's `Cross-Origin-Resource-Policy: same-origin` header. Fall back to
    // the server URL only if the content somehow carries no embedded thumbnail.
    let thumbnailUrl = '';
    if (migrated.worldOverview?.thumbnail) {
      thumbnailUrl = migrated.worldOverview.thumbnail;
    } else if (world.thumbnail_file) {
      thumbnailUrl = `${WorldStorageService.API_URL}/thumbnails/${world.thumbnail_file}`;
    } else if (world.thumbnail) {
      thumbnailUrl = world.thumbnail;
    }

    return { migrated, thumbnailUrl };
  };

  /** Put one component listing's content in its library and note where it landed. */
  const installComponent = async (
    listing: WorldRecord, load: () => Promise<unknown>,
  ): Promise<InstalledSource> => {
    const kind = componentKind(listing);
    if (!kind) throw new Error(UNSUPPORTED_SOURCE);
    const content = await load();
    return saveDownloadToLibrary(kind, content as LinkableContent, {
      sourceId: listingId(listing),
      name: listing.name,
      sourceUpdatedAt: listing.updated_at,
      authorId: listing.author?.id,
      authorName: listing.author?.username,
    });
  };

  /**
   * Install every required source the run has not already placed.
   *
   * Each success is recorded as it lands, so a retry skips it: a source that installed is in the library
   * whatever happens to the rest of the run.
   *
   * `only` is one reported row's Retry, which an update offers: every other outstanding source stays
   * reported rather than being dropped.
   */
  const installRequired = async (
    run: DownloadRun, dependencies: DependencyRow[], only?: Set<string>,
  ): Promise<DownloadFailure[]> => {
    const failures: DownloadFailure[] = [];
    const worldId = listingId(run.world);

    for (const dependency of dependencies) {
      if (run.installed.some((source) => source.sourceId === dependency.id)) continue;
      const listing = dependency.listing;
      const name = listing?.name || dependency.id;
      if (only && !only.has(dependency.id)) {
        const held = run.requiredFailures[dependency.id];
        failures.push(held ?? { id: dependency.id, name, message: 'Not downloaded yet.' });
        continue;
      }
      const fail = (message: string) => {
        const failure = { id: dependency.id, name, message };
        run.requiredFailures[dependency.id] = failure;
        failures.push(failure);
      };
      if (dependency.status !== 'ok' || !listing) {
        fail(MISSING_SOURCE);
        continue;
      }
      try {
        run.installed.push(await installComponent(
          listing, () => WorldStorageService.fetchDependencyContent(worldId, dependency.id),
        ));
        delete run.requiredFailures[dependency.id];
      } catch (error) {
        fail((error as Error).message || 'Failed to download this source.');
      }
    }

    return failures;
  };

  /**
   * Install the add-ons the player selected. Each is a listing of its own, downloaded the way a player
   * downloading it on its own would, so one that fails leaves the others alone.
   *
   * `only` is a single row's Retry: every other outstanding add-on stays reported rather than being
   * dropped, so a player who retries one still sees what the rest are waiting on.
   */
  const installAddons = async (
    run: DownloadRun, addons: WorldRecord[], only?: Set<string>,
  ): Promise<DownloadFailure[]> => {
    const failures: DownloadFailure[] = [];

    for (const listing of addons) {
      const id = listingId(listing);
      if (run.addonsDone.has(id)) continue;
      if (only && !only.has(id)) {
        failures.push({ id, name: listing.name || id, message: run.addonMessages[id] ?? 'Not downloaded yet.' });
        continue;
      }
      try {
        run.installed.push(await installComponent(listing, () => fetchCatalogContent(id, () => {})));
        run.addonsDone.add(id);
        delete run.addonMessages[id];
      } catch (error) {
        const message = (error as Error).message || 'Failed to download this add-on.';
        run.addonMessages[id] = message;
        failures.push({ id, name: listing.name || id, message });
      }
    }

    return failures;
  };

  /** What an earlier attempt left unfinished, so a read that fails now reports beside those rows rather
   *  than in place of them. Each keeps the message it last failed with. */
  const outstanding = (run: DownloadRun): DownloadFailure[] => [
    ...Object.values(run.requiredFailures),
    ...run.addons
      .filter((addon) => run.addonMessages[addon.id])
      .map((addon) => ({ id: addon.id, name: addon.name || addon.id, message: run.addonMessages[addon.id] })),
  ];

  /** Store the world under its local id and put it in the caller's list. */
  const storeWorld = async (run: DownloadRun, content: { migrated: World; thumbnailUrl: string }) => {
    const world = run.world;
    const name = world.name || 'Downloaded World';
    const description = world.description || 'Downloaded from server';
    const author = world.author?.username || '';
    const now = new Date().toISOString();
    // Link back to the community catalog entry so the "Downloaded" state survives reloads; record the
    // source version we hold (server updated_at) and when, for refresh/update detection.
    const meta = {
      name, description, thumbnail: content.thumbnailUrl, author,
      sourceId: listingId(world), dirty: false, downloadedAt: now, sourceUpdatedAt: world.updated_at,
      // Kept alongside the name so the author line can open their profile: `author` above is only a
      // name, and a name is not an account.
      sourceAuthorId: world.author?.id,
    };

    // The world's own copies name the listings they follow; this is where each gains the library item
    // this download stored for it, which is what the editor reads as Linked. An update then puts back
    // every copy the review protected, so the write cannot discard what the player kept.
    const update = run.update;
    const linked = keepInstalledCopies(
      linkInstalledSources(content.migrated, run.installed),
      update?.previous ?? {},
      update ? protectedCopies(update.rows, update.actions, run.installed) : [],
    );

    // Sanitize at the download boundary so the stored copy is already current. Same local id ⇒ storeWorld
    // overwrites in place (the overwrite path); a fresh id adds a new record.
    await WorldStorageService.storeWorld({ id: run.localId, ...meta, data: linked });

    // Offer to downscale oversized images; if accepted, overwrite the just-stored copy in place.
    let finalData = linked;
    if (onStored) {
      const w = await onStored(run.localId, linked);
      if (w) {
        finalData = w;
        await WorldStorageService.storeWorld({ id: run.localId, ...meta, data: finalData });
      }
    }

    const record: WorldRecord = { id: run.localId, ...meta, tags: finalData.worldOverview?.tags || [], lastAccessed: now };
    if (run.overwrite) setWorlds((prev) => prev.map((w) => (w.id === run.localId ? { ...w, ...record } : w)));
    else setWorlds((prev) => [...prev, { ...record, isLoading: false }]);
    toast.success(`"${name}" ${run.overwrite ? 'updated' : 'downloaded'} successfully`);
  };

  /**
   * Run or resume one download: the world, everything it requires, and the add-ons the player selected.
   *
   * The world waits for its required sources. A retry re-enters here with the same run, so the world
   * content and the sources already installed are not fetched twice.
   */
  const runDownload = async (run: DownloadRun, only?: Set<string>) => {
    const worldId = listingId(run.world);
    const worldName = run.world.name || 'This world';
    // Mark this world as in-flight (indeterminate until we know the size) so the card swaps to a bar.
    setDownloadProgress((p) => ({ ...p, [worldId]: -1 }));
    setPendingDownload(null);
    // What the required set could not deliver. An update carries this to the end and reports it beside the
    // add-ons; a first download stops on it.
    let requiredFailures: DownloadFailure[] = [];
    try {
      // An update re-enters here on every Retry: the world is rewritten from the author's content and the
      // sources installed so far, so a source that lands late still reaches the copies following it.
      if (!run.worldReady || run.update) {
        run.content ??= await fetchWorldContent(run.world, worldId);
        let dependencies: DependencyRow[];
        try {
          dependencies = await WorldStorageService.fetchDependencies(worldId);
        } catch (error) {
          // The world requires an unknown set, so installing it would present it as complete when it is
          // not. Reported as its own row, with Retry, exactly as a source that would not download.
          // Whatever a previous attempt left outstanding stays reported beside it: this read failing says
          // nothing about those rows, and dropping them would show the run as smaller than it is.
          setPendingDownload({ worldName, worldReady: run.worldReady, failures: [...outstanding(run), {
            id: REQUIRED_READ,
            name: worldName,
            message: (error as Error).message || 'Could not read what this world requires.',
          }] });
          return;
        }
        requiredFailures = await installRequired(run, dependencies, run.update ? only : undefined);
        if (requiredFailures.length && !run.update) {
          // The world is not presented as ready: what installed is kept, and Retry finishes the rest.
          setPendingDownload({ worldName, worldReady: false, failures: requiredFailures });
          return;
        }
        // An update writes the world whatever its sources did. The copy already holds the previous content
        // of every component, so a source that will not download keeps what it has.
        await storeWorld(run, run.content);
        run.worldReady = true;
      }

      if (!run.addons.length || run.addons.every((addon) => run.addonsDone.has(addon.id))) {
        if (requiredFailures.length) setPendingDownload({ worldName, worldReady: true, failures: requiredFailures });
        return;
      }
      let addons: WorldRecord[];
      try {
        addons = await WorldStorageService.fetchAddons(worldId);
      } catch (error) {
        // The world is installed; only the add-ons are unknown. Answering an empty list here would drop
        // the player's selections in silence, which is the one thing this must never do.
        setPendingDownload({ worldName, worldReady: true, failures: [...requiredFailures, {
          id: ADDON_READ,
          name: 'Add-ons',
          message: (error as Error).message || 'Could not read this world\'s add-ons.',
        }] });
        return;
      }
      const picked = new Set(run.addons.map((addon) => addon.id));
      const wanted = addons.filter((addon) => picked.has(listingId(addon)));
      // An add-on the world stopped offering between the review and the press — declined, unlisted, or
      // taken down. Reported rather than dropped: the player ticked it and is owed an answer.
      const offered = new Set(wanted.map(listingId));
      const withdrawn: DownloadFailure[] = run.addons
        .filter((addon) => !offered.has(addon.id) && !run.addonsDone.has(addon.id))
        .map((addon) => ({ id: addon.id, name: addon.name || addon.id, message: WITHDRAWN_ADDON }));
      const failures = [...requiredFailures, ...await installAddons(run, wanted, only), ...withdrawn];
      if (failures.length) {
        setPendingDownload({ worldName, worldReady: true, failures });
      }
    } catch (error) {
      console.error('Error downloading world:', error);
      toast.error((error as Error).message || 'Failed to download world');
    } finally {
      // Clear the in-flight bar whether it succeeded or failed.
      setDownloadProgress((p) => { const next = { ...p }; delete next[worldId]; return next; });
    }
  };

  /** Start a download, replacing whatever the last one left pending. */
  const startDownload = (
    world: WorldRecord, localId: string, overwrite: boolean, plan: DownloadPlan, update?: WorldUpdatePlan,
  ) => {
    const run: DownloadRun = {
      world, localId, overwrite,
      installed: [], addons: plan.addons, addonsDone: new Set(),
      addonMessages: {}, requiredFailures: {}, worldReady: false,
      ...(update ? { update } : {}),
    };
    runRef.current = run;
    return runDownload(run);
  };

  // Download a remote world as a new local entry.
  const handleDownloadWorld = (world: WorldRecord, plan: DownloadPlan = planRef.current) =>
    startDownload(world, `downloaded-${randomUUID()}`, false, plan);

  // Overwrite an existing local copy in place with the current server content (refresh or update).
  const overwriteWorld = (world: WorldRecord, localId: string, update?: WorldUpdatePlan) =>
    startDownload(world, localId, true, planRef.current, update);

  /**
   * Open the review that stands between "update an existing copy" and the write.
   *
   * A copy with nothing to review is overwritten as it always was. Everything else waits: the write would
   * replace the player's copy of every linked component, and the review is where they say which of those
   * they keep.
   */
  const openWorldUpdateReview = async (world: WorldRecord, localId: string) => {
    const localName = worlds.find((copy) => copy.id === localId)?.name || world.name || 'This world';
    let previous: WorldContentSlices;
    let rows: WorldUpdateRow[];
    try {
      const [content, dependencies, entities, dictionaries] = await Promise.all([
        WorldStorageService.getWorldData(localId) as Promise<WorldContentSlices>,
        WorldStorageService.fetchDependencies(listingId(world)),
        libraryItems('entity'),
        libraryItems('dictionary'),
      ]);
      previous = content;
      const held: HeldSource[] = [...entities, ...dictionaries].flatMap((item) => (item.sourceId
        ? [{ sourceId: item.sourceId, revision: item.revision, sourceUpdatedAt: item.sourceUpdatedAt }]
        : []));
      rows = buildWorldUpdateReview(content, dependencies, held);
    } catch (error) {
      // What the update would do to this copy's components is unknown, and writing anyway could discard
      // the player's own edits. Nothing is written.
      toast.error((error as Error).message
        || `Formamorph could not read what "${localName}" holds, so it was not updated.`);
      return;
    }

    if (!rows.length) { void overwriteWorld(world, localId); return; }
    setWorldUpdateReview({ world, localId, localName, rows, previous });
  };

  /** Run the update the player confirmed. `actions` is keyed by listing, as the review's rows are. */
  const applyWorldUpdate = (actions: Record<string, UpdateAction>) => {
    const review = worldUpdateReview;
    if (!review) return;
    setWorldUpdateReview(null);
    void overwriteWorld(review.world, review.localId, {
      previous: review.previous,
      rows: review.rows,
      actions,
    });
  };

  /**
   * Finish what the last download could not. The world content and every installed source are kept.
   *
   * `only` retries one reported row, which an add-on offers: the rest stay reported rather than being
   * dropped. A world still waiting on a required source always retries the whole outstanding set,
   * because it cannot be installed until every one of them is in.
   */
  const retryDownload = (only?: string) => {
    const run = runRef.current;
    if (run) void runDownload(run, only && run.worldReady ? new Set([only]) : undefined);
  };

  /** Stop reporting the failures. Nothing installed is undone, and the run is kept: pressing Download
   *  again resumes it rather than downloading what already landed a second time. */
  const dismissPendingDownload = () => setPendingDownload(null);

  // Contextual button click: new worlds download immediately; already-downloaded ones open the
  // refresh/update decision dialog (copy vs overwrite).
  const handleContextualDownload = (world: WorldRecord, state: DownloadState, plan: DownloadPlan = { addons: [] }) => {
    planRef.current = plan;
    if (state === 'none') { void handleDownloadWorld(world, plan); return; }
    setContextualAction({ world, mode: state });
  };

  // "Overwrite an existing copy": review the one match, else pick which copy first.
  const handleChooseOverwrite = () => {
    if (!contextualAction) return;
    const copies = copiesForWorld(contextualAction.world);
    if (copies.length <= 1) {
      if (copies[0]) void openWorldUpdateReview(contextualAction.world, copies[0].id);
      setContextualAction(null);
      return;
    }
    setOverwriteSelectedId(copies[0]?.id ?? null);
    setShowOverwriteSelect(true);
  };

  // Confirm the chosen copy in the selection dialog.
  const handleConfirmOverwrite = () => {
    if (contextualAction && overwriteSelectedId) {
      void openWorldUpdateReview(contextualAction.world, overwriteSelectedId);
    }
    setShowOverwriteSelect(false);
    setContextualAction(null);
    setOverwriteSelectedId(null);
  };

  return {
    downloadProgress,
    contextualAction, setContextualAction,
    overwriteSelectedId, setOverwriteSelectedId,
    showOverwriteSelect, setShowOverwriteSelect,
    localCopiesBySource,
    copiesForWorld,
    downloadStateForWorld,
    handleContextualDownload,
    handleChooseOverwrite,
    handleConfirmOverwrite,
    handleDownloadWorld,
    pendingDownload,
    retryDownload,
    dismissPendingDownload,
    worldUpdateReview,
    applyWorldUpdate,
    cancelWorldUpdate: () => setWorldUpdateReview(null),
  };
}
