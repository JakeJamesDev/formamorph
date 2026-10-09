import AuthService from './AuthService';
import { codedResponseError, readFailure, responseError } from './responseError';
import type { CatalogKindQuery } from '@/lib/catalogKinds';
import { API_BASE_URL } from '@/lib/apiBase';
import type { PublishPayload } from '@/lib/publishPayload';
import { PUBLISH_LIMITS, publishLimitRefusal } from '@/lib/publishLimits';
import { buildPublishBodyInWorker } from '@/lib/jsonFileWorkerUtils';
import { toast } from 'react-toastify';
import { promisifyRequest, transactionDone, writeAfterRead } from '@/lib/idb';
import {
  WORLD_META_STORE, WORLD_STORE, deleteWorldRecord, libraryTransaction, listFieldsOf, openWorldLibrary,
  putWorldRecord, readAllWorldMeta, readWorldMeta, type LinkedCopy, type WorldMetaRecord,
} from '@/lib/worldLibrary';
import { contentHash } from '@/lib/contentHash';
import { announceWorldDeleted, announceWorldSaved } from '@/lib/worldChangeSignal';
import { readDeletedDefaultWorlds, seedWorldData, tombstoneDefaultWorld, type DefaultWorldSeed } from '@/lib/defaultWorlds';
import { changelogOf, type ChangelogDraft, type ChangelogEntry } from '@/lib/listingChangelog';
import type { ReviewState, WorldAssociation } from '@/lib/compatibleWorlds';
import type { ListingVisibility } from '@/lib/publishLinks';
import type { AddonRow, DependencyRow } from '@/lib/worldDependencies';
import type { SourceCheckStatus } from '@/lib/sourceChecks';
import type { LikeState } from '@/lib/likeCount';
import type {
  AnonymousLikeRow, AnonymousLikesRemoved, LikerAuditRow, LikerRow, VrmLicense, WorldMetadata,
} from '@/types';
import {
  INSTALL_HEADER_NAME, installHeaderInUse, noteInstallHeaderRefused, readerInstallId, storedInstallId,
} from '@/lib/anonymousLikes';

/**
 * What a conditional catalog fetch answers with: a fresh snapshot and the tag to store beside it, the
 * word that the local copy still stands, or the error that stopped the request.
 */
export type CatalogFetch =
  | { status: 'fresh'; data: unknown[]; tag: string | null; anonymousLikes: boolean }
  | { status: 'unchanged' }
  | { status: 'error'; error: string };

/** A like reply: the reader's state, and the count as the reader may see it. */
type LikeReply = LikeState & { liked: boolean };

/**
 * A press the server would not take, named by its code.
 *
 * The code and not the wording, so each refusal gets the answer it deserves: the cap is worth a message,
 * a switched-off server sends the guest to sign-in, and a listing that has gone quiet needs nothing said
 * about it.
 */
export class AnonymousLikeRefused extends Error {
  readonly code: string;
  readonly details: string;

  constructor(code: string, message: string, details = '') {
    super(message);
    this.name = 'AnonymousLikeRefused';
    this.code = code;
    this.details = details;
  }
}

/**
 * What one listing says about itself beyond its row: its history, an Avatar's license, and the
 * relationships a publish over it has to preserve. Every field past `changelog` is absent against a
 * server that predates it.
 */
export interface ListingDetails {
  changelog: ChangelogEntry[] | null;
  /** Whether this server takes a like from somebody who is not signed in. False against an older one. */
  anonymousLikes: boolean;
  modelLicense?: VrmLicense;
  visibility?: ListingVisibility;
  /** The listing ids a world requires today, resolved or not. */
  requiredDependencies?: string[];
  /** The worlds a component is offered for today, with the world author's answer to each. */
  compatibleWorlds?: WorldAssociation[];
}

/** One listing read: its details, word that this reader may not see it, or no answer at all. */
export type ListingDetailsRead =
  | { status: 'ok'; details: ListingDetails }
  | { status: 'gone' }
  | { status: 'unreachable' };

/** The toast shown while another tab on an older build holds the library upgrade back. */
const LIBRARY_BLOCKED_TOAST = 'world-library-upgrade-blocked';
export const LIBRARY_BLOCKED_MESSAGE = 'Your world library is waiting to update. Close other Formamorph tabs to finish.';

/** The publish refused because this author already has an entry in the contest. */
export const CONTEST_ALREADY_ENTERED = 'CONTEST_ALREADY_ENTERED';

/** The publish named a contest that isn't taking entries — the wrong one, or one that has since closed. */
export const CONTEST_NOT_ACTIVE = 'CONTEST_NOT_ACTIVE';

/** The withdrawal was refused because this entry is on the contest's podium. */
export const CONTEST_PLACED = 'CONTEST_PLACED';

/** A locally-stored world record (metadata + nested world `data`). Inner fields stay loose since
 *  they round-trip through IndexedDB/JSON and aren't read field-by-field here. */
export interface StoredWorldRecord {
  id: string;
  name: string;
  description?: string;
  author?: string;
  thumbnail?: string;
  /** Server `_id` of the community world this was downloaded from, if any. Local-only wrapper field:
   *  never part of `data`, so it isn't published or exported with the world content. Sticky: it
   *  survives edits (storeWorld preserves it) so the download link persists; only delete removes it. */
  sourceId?: string;
  /** Whether this download has been edited locally and so diverges from its source (git-dirty model).
   *  Set true on an editor save, reset false on (re)download. Local-only, like `sourceId`. */
  dirty?: boolean;
  /** Wall-clock time of the user's most recent editor save. Unset until the first edit, so a never-edited
   *  world has no edited date. Sticky across non-edit stores; local-only. */
  editedAt?: string;
  /** Wall-clock time this copy was (re)downloaded. Sticky across edits; local-only. */
  downloadedAt?: string;
  /** The server world's `updated_at` captured at (re)download — i.e. the source version we hold.
   *  Compared against the server's live `updated_at` to detect refresh vs update. Sticky; local-only. */
  sourceUpdatedAt?: string;
  /** The account that published the listing this copy came from, captured at (re)download. Lets the
   *  author line open their profile — the authored `author` string is free text and names nobody in
   *  particular, while this is exactly who put it on Community Creations. Sticky; local-only. */
  sourceAuthorId?: string;
  /** Bundled defaults only: a hash of the bundle's raw JSON this copy was seeded from, so a later launch can
   *  tell whether the shipped content actually changed. Derived (never hand-written) and local-only, so it
   *  isn't exported and needs no version bump. Absent on copies seeded before hashing existed. */
  sourceHash?: string;
  data: {
    version?: string; // stamped on save/export (see lib/version)
    worldOverview: unknown;
    stats: unknown[];
    locations: unknown[];
    entities: unknown[];
    entityGroups?: unknown[];
    traits: unknown[];
    traitGroups?: unknown[];
    statUpdates: unknown[];
    dictionary?: unknown[]; // legacy v1.2.0 flat form (read-only; folded to `dictionaries` on load)
    dictionaries?: unknown[]; // v2.x books
    placeholders?: unknown[]; // v2.x author-defined variables/wildcards
    placeholderGroups?: unknown[]; // editor folders over the shared placeholders
  };
}


/** Result of a default-world seed/update pass: ids that failed to load, the error behind each (named by
 *  its id, the caught error as its cause), and display names that were auto-updated in place (so the
 *  caller can notify the player). */
export interface DefaultWorldSyncResult {
  failed: string[];
  errors: Error[];
  updated: string[];
}

/**
 * The bundled default worlds as raw JSON text, so their content can be hashed without re-serializing the
 * parsed object (they carry base64 images and run to megabytes). Parsing happens only when a world actually
 * needs (re)seeding.
 */
const DEFAULT_WORLD_RAW = import.meta.glob('../defaultworlds/*.json', {
  query: '?raw',
  import: 'default',
}) as Record<string, () => Promise<string>>;

/** Singleton owning local world persistence (the world library in `@/lib/worldLibrary`) and community server calls
 *  (fetch/publish/comments). Default-exported as one shared instance; the constructor kicks off DB init. */
class WorldStorageService {
  db: IDBDatabase | null;
  private opening: Promise<void> | null = null;
  API_URL: string;

  constructor() {
    this.db = null;
    this.API_URL = API_BASE_URL;
    // No eager open: every operation awaits `ensureInitialized` first, so opening here only adds an
    // import-time IndexedDB touch — which throws an unhandled rejection in test files that import this
    // module without a fake IndexedDB. Lazy init matches ModelStorageService.
  }

  /**
   * Who is asking, in the one header the server reads to answer it.
   *
   * A session or an Install, never both: the account route is what a signed-in client presses, and an
   * Install header beside a token would name a second reader of the same request. A guest sends the
   * Install so the catalog and the listing come back with their hearts already filled.
   *
   * A guest names no Install where nothing may name one: on the website, and on a server that has
   * refused the header once already.
   */
  private readerHeaders(): Record<string, string> {
    if (AuthService.isAuthenticated()) return { Authorization: `Bearer ${AuthService.token}` };

    const install = readerInstallId();
    return install ? { [INSTALL_HEADER_NAME]: install } : {};
  }

  /**
   * Fetch, and once more without the Install header when the request never reached the server.
   *
   * A server whose CORS allow list omits the Install header refuses the preflight, and the browser
   * reports that as a network failure. Offline looks the same. Asking again without the header tells
   * the two apart: an answer means the header was the whole problem, and the session stops sending it,
   * which costs the guest their like and nothing else. Two failures mean the network, and the caller
   * sees exactly what it saw before this existed.
   *
   * The refusal is only recorded when the second request answers, and not when it answers with a fault
   * of the server's own. A dead network and a bad minute must neither cost a guest their hearts for the
   * rest of the session.
   *
   * @param url - Where to ask
   * @param init - The request, whose headers decide whether there is anything to fall back from
   */
  private async installFallbackFetch(
    url: string,
    init: RequestInit & { headers: Record<string, string> },
  ): Promise<Response> {
    try {
      return await fetch(url, init);
    } catch (error) {
      if (init.signal?.aborted || !(INSTALL_HEADER_NAME in init.headers)) throw error;

      const headers = { ...init.headers };
      delete headers[INSTALL_HEADER_NAME];
      const response = await fetch(url, { ...init, headers });
      if (response.status < 500) noteInstallHeaderRefused();
      return response;
    }
  }

  /** Open the IndexedDB connection (idempotent — no-op once `db` is set). */
  async initialize() {
    if (this.db) return;
    let blocked = false;
    this.opening ??= openWorldLibrary(() => {
      blocked = true;
      toast.info(LIBRARY_BLOCKED_MESSAGE, { toastId: LIBRARY_BLOCKED_TOAST, autoClose: false });
    }).then((db) => {
      db.addEventListener('versionchange', () => { if (this.db === db) this.db = null; });
      this.db = db;
    }).finally(() => {
      this.opening = null;
      if (blocked) toast.dismiss(LIBRARY_BLOCKED_TOAST);
    });
    await this.opening;
  }

  /** Lazily open the DB if not yet connected; awaited at the top of every store operation. */
  async ensureInitialized() {
    if (!this.db) {
      await this.initialize();
    }
  }

  /**
   * Every stored world's id, and nothing else.
   *
   * `getAllKeys` reads the key index, so no record is deserialized — the library's whole payload stays
   * on disc. That is what lets the menu draw its real tile layout before a single world is loaded, and
   * it is how a caller that only needs a count should ask for one.
   */
  async getWorldIds(): Promise<string[]> {
    await this.ensureInitialized();
    const transaction = this.db!.transaction([WORLD_STORE], 'readonly');
    const keys = await promisifyRequest(transaction.objectStore(WORLD_STORE).getAllKeys());
    return keys.map(String);
  }

  /** Every metadata record, read from the metadata store alone. */
  private async readMeta(): Promise<WorldMetaRecord[]> {
    await this.ensureInitialized();
    return readAllWorldMeta(this.db!);
  }

  /** One world's metadata record, or undefined when it is not stored. */
  private async readMetaOf(worldId: string): Promise<WorldMetaRecord | undefined> {
    await this.ensureInitialized();
    return readWorldMeta(this.db!, worldId);
  }

  /** List all stored worlds' list fields, for menu/library rendering. Reads no world data. */
  async getWorldMetadata(): Promise<WorldMetadata[]> {
    return (await this.readMeta()).map(listFieldsOf);
  }

  /**
   * Where one stored world came from: its listing and when this copy was downloaded.
   *
   * @param worldId - The local record's id
   * @returns The listing link, empty when the world has none or the record is gone
   */
  async getWorldListingLink(worldId: string): Promise<{ sourceId?: string; downloadedAt?: string }> {
    if (!worldId) return {};
    const meta = await this.readMetaOf(worldId);
    return { sourceId: meta?.sourceId, downloadedAt: meta?.downloadedAt };
  }

  /**
   * Whether a stored world is a bundled default that no save has edited, so it still takes bundled updates.
   *
   * @param worldId - The local record's id
   */
  async isUneditedDefault(worldId: string): Promise<boolean> {
    const meta = await this.readMetaOf(worldId);
    return meta?.sourceHash !== undefined && !meta.dirty;
  }

  /**
   * The local worlds holding a copy that follows `libraryId`.
   *
   * This is what a component's Compatible Worlds section is derived from. `sourceId` is the world's own
   * listing, and a world without one has no published identity to offer the component for.
   *
   * @param libraryId - The library item the copies follow
   * @returns One entry per world, in stored order
   */
  async worldsLinking(libraryId: string): Promise<{ id: string; name: string; sourceId?: string }[]> {
    if (!libraryId) return [];
    return (await this.readMeta())
      .filter((meta) => meta.linkedCopies.some((copy) => copy.link.libraryId === libraryId))
      .map((meta) => ({ id: meta.id, name: meta.name, ...(meta.sourceId ? { sourceId: meta.sourceId } : {}) }));
  }

  /**
   * Every stored copy that follows `libraryId`, with the world holding it.
   *
   * One row per copy rather than per world: a world may hold the same library item twice, and two copies
   * can be in different states. The copy's own content is not read — the update review asks for that per
   * world, only for the worlds the player acts on.
   *
   * @param libraryId - The library item the copies follow
   * @returns One row per copy, in stored world order
   */
  async linkedCopies(libraryId: string): Promise<(LinkedCopy & { worldId: string; worldName: string })[]> {
    if (!libraryId) return [];
    return (await this.readMeta()).flatMap((meta) => meta.linkedCopies
      .filter((copy) => copy.link.libraryId === libraryId)
      .map((copy) => ({ worldId: meta.id, worldName: meta.name, ...copy })));
  }

  /**
   * Rewrite one stored world's content in place.
   *
   * `revise` receives the world's `data` and returns what replaces it. Everything outside `data` is left
   * exactly as it stands — the download link, the edited stamp, the record's own name and thumbnail, and
   * `lastAccessed` too, because a write the player never opened the world for is not an access. That is
   * what `storeWorld` cannot do: it takes a whole record and writes every wrapper field from it.
   *
   * `revise` runs inside the write transaction, so it must be synchronous. Returning the same reference
   * writes nothing.
   *
   * @param worldId - The world to rewrite
   * @param revise - The new content, from the stored content
   */
  async updateWorldContent(
    worldId: string, revise: (data: Record<string, unknown>) => Record<string, unknown>,
  ): Promise<void> {
    await this.ensureInitialized();
    if (!worldId) throw new Error('World ID is required');

    const transaction = libraryTransaction(this.db!, 'readwrite');
    let wrote = false;
    await writeAfterRead(transaction, transaction.objectStore(WORLD_STORE).get(worldId), (record) => {
      if (!record?.data || typeof record.data !== 'object') throw new Error('World not found');
      const revised = revise(record.data as Record<string, unknown>);
      if (revised === record.data) return;
      putWorldRecord(transaction, { ...record, data: revised });
      wrote = true;
    });
    if (wrote) announceWorldSaved(worldId);
  }

  /** Load one world's full `data` (with `id` injected); rejects if missing, malformed, or lacking any
   *  required section. */
  async getWorldData(worldId: string) {
    await this.ensureInitialized();

    // Validate worldId
    if (!worldId) {
      return Promise.reject('World ID is required');
    }

    // Normalize worldId
    const normalizedWorldId = String(worldId).trim();
    if (!normalizedWorldId) {
      console.error('Invalid world ID:', worldId);
      return Promise.reject('Invalid world ID');
    }

    return new Promise((resolve, reject) => {
      try {
        const transaction = this.db!.transaction([WORLD_STORE], 'readonly');
        const store = transaction.objectStore(WORLD_STORE);

        // Validate the store exists
        if (!store) {
          throw new Error('Object store not found');
        }
        const request = store.get(worldId);
        request.onsuccess = () => {
          if (request.result) {
            //console.log('Retrieved world data:', request.result);
            // Validate the world data structure
            if (!request.result.data || typeof request.result.data !== 'object') {
              console.error('Missing or invalid data object');
              reject('Invalid world data format');
            } else if (!request.result.data.worldOverview ||
                       !request.result.data.stats ||
                       !request.result.data.locations ||
                       !request.result.data.entities ||
                       !request.result.data.traits ||
                       !request.result.data.statUpdates) {
              console.error('Missing required fields in data:', {
                worldOverview: !!request.result.data.worldOverview,
                stats: !!request.result.data.stats,
                locations: !!request.result.data.locations,
                entities: !!request.result.data.entities,
                traits: !!request.result.data.traits,
                statUpdates: !!request.result.data.statUpdates
              });
              reject('Invalid world data format');
            } else {
              // Add the ID to the data before returning it
              const worldData = request.result.data;
              worldData.id = worldId; // Ensure the ID is included in the returned data
              resolve(worldData);
            }
          } else {
            reject('World not found');
          }
        };
        request.onerror = (event) => {
          console.error('Database error:', (event.target as IDBRequest).error);
          reject(`Failed to get world data: ${(event.target as IDBRequest).error}`);
        };
      } catch (error) {
        console.error('Transaction setup error:', error);
        reject(`Failed to set up database transaction: ${(error as Error).message}`);
      }
    });
  }

  /** Upsert a world by `id`, read-merging sticky local-only fields (`sourceId`, `dirty`, `createdAt`, etc.)
   *  so the community download link and creation stamp survive edits; throws on missing required fields. */
  async storeWorld(world: StoredWorldRecord) {
    await this.ensureInitialized();

    //Generate unique ID always
    // world.id = `world-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    //  console.log('Generated new world ID:', world.id);

    // Validate world data structure
    if (!world.name || !world.data ||
        !world.data.worldOverview || !world.data.stats ||
        !world.data.locations || !world.data.entities ||
        !world.data.traits || !world.data.statUpdates) {
      throw new Error('Invalid world data: missing required fields');
    }

    const transaction = libraryTransaction(this.db!, 'readwrite');
    // Read-merge so the download link survives saves: sourceId is sticky (inherited unless the
    // caller supplies one), and dirty defaults to the existing/false unless the caller sets it.
    // The sticky fields all live in the metadata record, so the old world data is never read.
    const read = transaction.objectStore(WORLD_META_STORE).get(world.id) as IDBRequest<WorldMetaRecord | undefined>;
    await writeAfterRead(transaction, read, (existing) => {
      putWorldRecord(transaction, {
        id: world.id,
        name: world.name,
        description: world.description || '',
        author: world.author || '',
        thumbnail: world.thumbnail || '',
        sourceId: world.sourceId ?? existing?.sourceId,
        dirty: world.dirty ?? existing?.dirty ?? false,
        editedAt: world.editedAt ?? existing?.editedAt,
        downloadedAt: world.downloadedAt ?? existing?.downloadedAt,
        sourceUpdatedAt: world.sourceUpdatedAt ?? existing?.sourceUpdatedAt,
        sourceAuthorId: world.sourceAuthorId ?? existing?.sourceAuthorId,
        sourceHash: world.sourceHash ?? existing?.sourceHash,
        data: world.data,
        // createdAt is sticky: stamped once on first store, preserved across later saves.
        createdAt: existing?.createdAt ?? new Date().toISOString(),
        lastAccessed: new Date().toISOString()
      });
    });
    announceWorldSaved(world.id);
  }

  /** Seed missing default worlds and auto-update unedited ones whose bundled content no longer matches the
   *  stored copy's `sourceHash`. Runs every launch (cheap when nothing changed). A world is left untouched if
   *  the player has edited it (`dirty`), since that diverges from the bundled default (git-dirty model), or if
   *  they deleted it — absent alone can't be trusted to mean "never seeded", so a deleted default carries a
   *  tombstone and stays gone even when the bundled copy changes.
   *  Returns the ids that failed to load plus the display names auto-updated in place. */
  async loadDefaultWorlds(defaultWorlds: DefaultWorldSeed[]): Promise<DefaultWorldSyncResult> {
    await this.ensureInitialized();
    const deleted = readDeletedDefaultWorlds();
    defaultWorlds = defaultWorlds.filter((w) => !deleted.has(w.id));
    // Metadata by id: only the bundled defaults are compared, and only their `sourceHash` and `dirty`.
    const stored = await Promise.all(defaultWorlds.map((w) => readWorldMeta(this.db!, w.id)));
    const byId = new Map<string, { dirty?: boolean; sourceHash?: string }>(
      stored.filter((w): w is WorldMetaRecord => !!w).map((w) => [w.id, w]),
    );

    const failed: string[] = [];
    const errors: Error[] = [];
    const updated: string[] = [];
    await Promise.all(
      defaultWorlds.map(async world => {
        try {
          const existing = byId.get(world.id);
          const loadRaw = DEFAULT_WORLD_RAW[`../defaultworlds/${world.id}.json`];
          if (!loadRaw) throw new Error(`No bundled JSON for default world "${world.id}"`);
          // Hash the raw text, then parse it — one read, and no re-serializing a multi-MB parsed world.
          const raw = await loadRaw();
          const hash = contentHash(raw);
          // A copy seeded before hashing existed has no hash to compare; reseed once to adopt the current
          // bundle (its content may genuinely differ), then it converges like any other.
          const backfill = existing !== undefined && existing.sourceHash === undefined;

          if (existing) {
            // Replace only an unedited copy whose content differs from the bundle. An edited world (`dirty`)
            // is always left alone (git-dirty model). Comparing the *content* — not a version — is what makes
            // this converge: after a reseed the hashes match, so it can't re-fire on every launch.
            if (existing.dirty || existing.sourceHash === hash) return;
          }

          // storeWorld keeps sticky local fields (createdAt, sourceId) and a false `dirty` on this update.
          const data = seedWorldData(JSON.parse(raw), world);
          const fullWorld = {
            id: world.id,
            name: data.worldOverview?.name || world.defaultName,
            description: data.worldOverview?.description || `Default ${world.defaultName} world`,
            author: data.worldOverview?.author || '',
            thumbnail: data.worldOverview?.thumbnail || '',
            data,
          };
          await this.storeWorld({ ...fullWorld, sourceHash: hash });
          // Only announce a real content change: a first-run seed has nothing to compare, and a backfill is
          // just adopting the hash — neither is news to the player.
          if (existing && !backfill) updated.push(fullWorld.name);
        } catch (error) {
          console.error(`Error loading world ${world.id}:`, error);
          failed.push(world.id); // Skip this world but continue with others; report it as failed.
          errors.push(new Error(world.id, { cause: error }));
        }
      }),
    );
    return { failed, errors, updated };
  }

  /**
   * Point a local world at the community listing it was just published to.
   *
   * The download path stamps the same two fields; this is the publish side of it, so an author's own copy
   * is a copy of their listing rather than an unrelated world that happens to look like one. Only the
   * wrapper fields are written — `storeWorld` wants a whole record, and a publish has no reason to
   * rewrite the content it just uploaded.
   *
   * A world deleted between the upload and the reply is left alone rather than resurrected.
   *
   * @param worldId - The local library record that was published
   * @param sourceId - The listing's server id
   * @param sourceUpdatedAt - The listing's `updated_at` after the publish, so the author's own card offers
   *                          no update against the version they just uploaded. Absent clears whatever was
   *                          stamped before: an old download's stamp against a listing that has since been
   *                          republished reads as exactly the update this is here to prevent, while no
   *                          stamp at all reads as a plain re-download
   */
  async linkWorldToListing(worldId: string, sourceId: string, sourceUpdatedAt?: string): Promise<void> {
    await this.ensureInitialized();

    const transaction = libraryTransaction(this.db!, 'readwrite');
    return writeAfterRead(transaction, transaction.objectStore(WORLD_STORE).get(worldId), (existing) => {
      if (existing) putWorldRecord(transaction, { ...existing, sourceId, sourceUpdatedAt });
    });
  }

  /** Remove a world from IndexedDB by `id`; this is the only path that drops the sticky `sourceId` link. */
  async deleteWorld(worldId: string) {
    await this.ensureInitialized();

    if (!worldId) {
      throw new Error('World ID is required');
    }

    const transaction = libraryTransaction(this.db!, 'readwrite');
    deleteWorldRecord(transaction, worldId);
    await transactionDone(transaction);
    announceWorldDeleted(worldId);
    // Deleting a default is permanent: without this the next seed pass sees it missing and re-creates it.
    // A no-op for any non-default id.
    tombstoneDefaultWorld(worldId);
  }

  /**
   * Fetch the whole community catalog, conditionally.
   *
   * Given the tag the local copy was fetched with, the request carries `If-None-Match` and bypasses the
   * browser's own HTTP cache, so a `304` reaches the caller rather than being answered as a `200` from
   * store. A server that answers no tag at all leaves the caller storing none, and the next open asks
   * unconditionally — which is exactly what shipped before. The bypass has to leave the request's own
   * cache headers alone; see the comment on it.
   *
   * @param tag - The tag the stored catalog carries, when there is one worth sending back
   * @returns The rows and the new tag, the word that nothing changed, or the error that stopped it
   */
  async fetchCatalog(tag?: string | null): Promise<CatalogFetch> {
    try {
      const headers = this.readerHeaders();
      // `no-store` and not `reload`: `reload` sends `Cache-Control: no-cache`, which the server reads
      // as an end-to-end reload and answers `200` with the whole body however well the tag matches.
      const init = tag
        ? { headers: { ...headers, 'If-None-Match': tag }, cache: 'no-store' as RequestCache }
        : { headers };

      const response = await this.installFallbackFetch(`${this.API_URL}/worlds?page=1&limit=1000&kind=all`, init);
      if (response.status === 304) return { status: 'unchanged' };
      if (!response.ok) throw new Error('Failed to fetch worlds');

      const body = await response.json();
      // Absent against a server that predates the feature, which reads as off — the same answer the
      // route itself gives there, so the heart behaves one way rather than two. Off too where nothing
      // may name an Install, because a like this reader cannot address is no like on offer.
      return {
        status: 'fresh',
        data: body.data || [],
        tag: response.headers.get('ETag'),
        anonymousLikes: installHeaderInUse() && body.anonymousLikes === true,
      };
    } catch (error) {
      console.error('Error fetching the world catalog:', error);
      return { status: 'error', error: (error as Error).message };
    }
  }

  /** Fetch a page of community worlds with optional search/sort; `ownedOnly` switches to the caller's own
   *  worlds and requires auth. Never throws — errors resolve to `{success:false, error, data:[]}`. */
  async fetchRemoteWorlds(page = 1, limit = 10, search = '', ownedOnly = false, searchByAuthor = false, sort = '', order = 'desc', kind: CatalogKindQuery = 'world') {
    try {
      let url = `${this.API_URL}/worlds?page=${page}&limit=${limit}`;
      if (search) url += `&search=${encodeURIComponent(search)}`;
      if (searchByAuthor) url += `&searchByAuthor=true`;
      if (sort) url += `&sort=${encodeURIComponent(sort)}&order=${encodeURIComponent(order)}`;
      // Omitted entirely for 'world' so the request stays byte-identical to what shipped before kinds.
      if (kind !== 'world') url += `&kind=${encodeURIComponent(kind)}`;

      const headers: Record<string, string> = {};
      if (AuthService.isAuthenticated()) {
        headers['Authorization'] = `Bearer ${AuthService.token}`;
      }

      // If ownedOnly is true, fetch only the user's worlds
      if (ownedOnly) {
        if (!AuthService.isAuthenticated()) {
          return { success: false, error: 'Authentication required', data: [] };
        }
        url = `${this.API_URL}/users/me/worlds`;
      }

      const response = await fetch(url, { headers });

      if (!response.ok) {
        throw new Error('Failed to fetch worlds');
      }

      const responseData = await response.json();

      return {
        success: true,
        data: responseData.data || [],
        pagination: responseData.pagination,
        total: responseData.total || 0
      };
    } catch (error) {
      console.error('Error fetching remote worlds:', error);
      return { success: false, error: (error as Error).message, data: [] as unknown[] };
    }
  }

  /**
   * Like a listing, or take the like back.
   *
   * Answers with the count as well as the state, so the heart and the number beside it can never disagree
   * about what just happened — the same reason following does.
   *
   * @param worldId - The listing's server id
   * @param liked - True to like it, false to take it back
   * @returns The new state and count
   */
  async setRemoteWorldLiked(worldId: string, liked: boolean) {
    const response = await fetch(`${this.API_URL}/worlds/${worldId}/like`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${AuthService.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ liked }),
    });

    if (!response.ok) throw await responseError(response, 'Failed to change that');
    const body = await response.json().catch(() => ({}));

    return body.data as LikeReply;
  }

  /**
   * Like a listing as this Install, or take that like back.
   *
   * The same press as {@link setRemoteWorldLiked} with no account behind it. It answers the same shape,
   * so the heart and the number beside it are patched from one place either way.
   *
   * A refusal carries a code, and each one deserves a different answer, so it throws
   * {@link AnonymousLikeRefused} rather than a plain error. One refusal is not a refusal at all: the
   * listing is liked by the account that claimed this Install, which the server answers 200 with, so it
   * reaches the caller as the state it is.
   *
   * @param worldId - The listing's server id
   * @param liked - True to like it, false to take it back
   * @returns The new state and count
   */
  async setAnonymousWorldLiked(worldId: string, liked: boolean) {
    const install = readerInstallId();
    const response = await this.installFallbackFetch(`${this.API_URL}/worlds/${worldId}/anonymous-like`, {
      method: 'PUT',
      headers: {
        ...(install ? { [INSTALL_HEADER_NAME]: install } : {}),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ liked }),
    });

    if (!response.ok) {
      const { body, message, details } = await readFailure(response, 'Failed to change that');
      throw new AnonymousLikeRefused(typeof body.code === 'string' ? body.code : '', message, details);
    }
    const body = await response.json().catch(() => ({}));

    return body.data as LikeReply;
  }

  /**
   * What the in-game like prompt needs to know about a listing before it shows.
   *
   * The same listing request {@link fetchListingDetails} makes, read for two other fields: whether this
   * reader already likes it, and whether the server takes a like from somebody who is not signed in. The
   * server fills the liked flag for a guest from the Install header, so it answers for both readers.
   *
   * Separate from `fetchListingDetails` because of what the two do with a refusal. That one answers null
   * either way, and the prompt has to tell the two apart: a listing that has gone quiet is answered and
   * never asked about again, while a dead network is not the player's fault and must leave the question
   * open for a later turn.
   *
   * `ownListing` answers for a signed-in reader, whose account the response's author is compared against.
   * A guest has no account to compare, so their own listing is the server's to refuse on the press.
   *
   * @param worldId - The listing's server id
   * @returns The reader's state, the word that the listing is not theirs to see, or that nothing answered
   */
  async fetchListingLikeState(worldId: string): Promise<
    | { status: 'ok'; liked: boolean; ownListing: boolean; anonymousLikes: boolean }
    | { status: 'gone' }
    | { status: 'unreachable' }
  > {
    try {
      const response = await this.installFallbackFetch(`${this.API_URL}/worlds/${worldId}`, {
        headers: this.readerHeaders(),
      });
      // Only the two refusals that mean the listing is not this reader's to see are an answer. A 500, a
      // 429 or anything else is the server having a bad day, and reading that as "gone" would spend the
      // one ask a player gets on a deploy that was over a minute later.
      if (response.status === 403 || response.status === 404) return { status: 'gone' };
      if (!response.ok) return { status: 'unreachable' };

      const body = await response.json();
      const me = AuthService.getCurrentUser();
      const author = body.data?.author;
      return {
        status: 'ok',
        liked: body.data?.liked === true,
        ownListing: Boolean(me && author && (author.id === me.id || author.username === me.username)),
        // Absent against a server that predates the feature, which reads as off — the same answer the
        // route itself gives there. Off too where nothing may name an Install.
        anonymousLikes: installHeaderInUse() && body.anonymousLikes === true,
      };
    } catch {
      return { status: 'unreachable' };
    }
  }

  /**
   * Move this Install's Anonymous Likes onto the account now signed in.
   *
   * The one request that carries a session and an Install together, because joining them is what it is
   * for. Everywhere else the two would name two readers of one answer; here they name the account the
   * marks go to and the Install they come from.
   *
   * A copy of the app that has never needed an Install has no marks to move, so it asks nothing. Making
   * an id to ask with would link a fresh Install to the account and move nothing.
   *
   * The server runs this in one transaction and repeating it changes nothing, so a caller may call it on
   * every sign-in rather than remembering whether it has.
   *
   * @returns How many marks became account Likes. Zero is the ordinary answer
   */
  async claimAnonymousLikes(): Promise<number> {
    // Nothing to move where nothing may name an Install: the website never made marks, and a server
    // that refuses the header would refuse this request's preflight too.
    const install = installHeaderInUse() ? storedInstallId() : null;
    if (!install) return 0;

    const response = await fetch(`${this.API_URL}/users/me/anonymous-likes/claim`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${AuthService.token}`,
        [INSTALL_HEADER_NAME]: install,
      },
    });

    if (!response.ok) throw await responseError(response, 'Failed to claim those likes');
    const body = await response.json().catch(() => ({}));

    return Number(body.data?.claimed) || 0;
  }

  /**
   * Put a published listing into quarantine: out of the catalog for everyone but its author, and deleted
   * when the deadline passes unless an admin releases it first. Admin only.
   *
   * @param worldId - The listing's server id
   * @param days - How long the author has, in whole days
   * @returns The new quarantine state
   */
  async quarantineRemoteWorld(worldId: string, days: number) {
    const response = await fetch(`${this.API_URL}/worlds/${worldId}/quarantine`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${AuthService.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ days }),
    });

    if (!response.ok) throw await responseError(response, 'Failed to quarantine this');
    const body = await response.json().catch(() => ({}));

    return body.data as { quarantinedAt: string; quarantineExpiresAt: string; quarantineExtended: boolean };
  }

  /**
   * Lift a quarantine, returning the listing to the catalog exactly as it was. Admin only.
   *
   * @param worldId - The listing's server id
   */
  async releaseRemoteWorld(worldId: string) {
    const response = await fetch(`${this.API_URL}/worlds/${worldId}/quarantine`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${AuthService.token}` },
    });

    if (!response.ok) throw await responseError(response, 'Failed to release this');
  }

  /** Fetch a page of comments for a published world; auth is optional. Never throws — errors resolve to
   *  a `{success:false}` shape. */
  async fetchComments(worldId: string, page = 1, limit = 20, signal?: AbortSignal) {
    try {
      const headers: Record<string, string> = {};
      if (AuthService.isAuthenticated()) {
        headers['Authorization'] = `Bearer ${AuthService.token}`;
      }
      const response = await fetch(
        `${this.API_URL}/worlds/${worldId}/comments?page=${page}&limit=${limit}`,
        { headers, signal },
      );
      if (!response.ok) throw new Error('Failed to fetch comments');
      const responseData = await response.json();
      return {
        success: true,
        data: responseData.data || [],
        pagination: responseData.pagination,
        total: responseData.total || 0,
      };
    } catch (error) {
      if (!signal?.aborted) console.error('Error fetching comments:', error);
      return { success: false, error: (error as Error).message, data: [] as unknown[], total: 0, pagination: {} };
    }
  }

  /** Post a comment on a published world; throws if unauthenticated or the request fails. */
  async postComment(worldId: string, content: string) {
    if (!AuthService.isAuthenticated()) {
      throw new Error('You must be logged in to comment');
    }
    const response = await fetch(`${this.API_URL}/worlds/${worldId}/comments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${AuthService.token}`,
      },
      body: JSON.stringify({ content }),
    });
    if (!response.ok) throw await responseError(response, 'Failed to post comment', ['message']);
    const responseData = await response.json();
    return responseData.data || responseData;
  }

  /**
   * Rewrite one's own comment. The server allows nobody else, moderators included.
   *
   * Addressed to the comment rather than to the world it sits on — the server has no world-scoped edit
   * path. The returned row carries the server's `edited_at`, which is what the thread shows.
   *
   * @param commentId - The comment's server id
   * @param content - The replacement text
   */
  async updateComment(commentId: string, content: string) {
    if (!AuthService.isAuthenticated()) {
      throw new Error('You must be logged in to comment');
    }
    const response = await fetch(`${this.API_URL}/comments/${commentId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${AuthService.token}`,
      },
      body: JSON.stringify({ content }),
    });
    if (!response.ok) throw await responseError(response, 'Failed to save the comment');
    const responseData = await response.json();
    return responseData.data || responseData;
  }

  /**
   * Remove a comment: its author, the author of the listing it sits on, or staff moderating.
   *
   * @param commentId - The comment's server id
   */
  async deleteComment(commentId: string) {
    if (!AuthService.isAuthenticated()) {
      throw new Error('You must be logged in to comment');
    }
    const response = await fetch(`${this.API_URL}/comments/${commentId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${AuthService.token}` },
    });
    if (!response.ok) throw await responseError(response, 'Failed to delete the comment');
  }

  /**
   * Read what a listing shows only when it is opened on its own: its changelog, and an Avatar's license.
   *
   * One request for both, because the server serves both as part of the listing row rather than from
   * routes of their own. A null changelog means the deploy predates that feature — see `changelogOf`,
   * which every surface reads the answer through, so the feature is invisible against an older server
   * rather than broken. A failed request is null throughout for the same reason: nothing here is worth an
   * error toast over a panel the reader did not ask for.
   *
   * @param worldId - The listing's server id
   */
  async fetchListingDetails(worldId: string): Promise<ListingDetails | null> {
    const read = await this.readListingDetails(worldId);
    return read.status === 'ok' ? read.details : null;
  }

  /**
   * The same read as {@link fetchListingDetails}, telling a listing this reader may not see apart from
   * a request that got no answer. A 403 or 404 is gone; any other refusal or a thrown fetch is unreachable.
   *
   * @param worldId - The listing's server id
   * @param signal - Cancels the read, which then answers unreachable
   */
  async readListingDetails(worldId: string, signal?: AbortSignal): Promise<ListingDetailsRead> {
    try {
      const headers = this.readerHeaders();
      const response = await this.installFallbackFetch(
        `${this.API_URL}/worlds/${worldId}?includeChangelog=true`,
        { headers, signal },
      );
      if (response.status === 403 || response.status === 404) return { status: 'gone' };
      if (!response.ok) return { status: 'unreachable' };

      const body = await response.json();

      // The relationship fields are absent against a server that has never heard of them, which is what
      // keeps the Linked Content and Compatible Worlds sections empty there rather than wrong.
      return {
        status: 'ok',
        details: {
          changelog: changelogOf(body.data),
          anonymousLikes: installHeaderInUse() && body.anonymousLikes === true,
          modelLicense: body.data?.modelLicense,
          visibility: body.data?.visibility,
          requiredDependencies: (body.data?.requiredDependencies ?? []).map(
            (row: { id?: string } | string) => (typeof row === 'string' ? row : String(row?.id ?? '')),
          ).filter(Boolean),
          compatibleWorlds: body.data?.compatibleWorlds ?? [],
        },
      };
    } catch (error) {
      if (!signal?.aborted) console.error('Error fetching the listing:', error);
      return { status: 'unreachable' };
    }
  }

  /**
   * Ask whether one source listing is still there.
   *
   * The two answers are worth very different things, so this reads the response itself rather than going
   * through a helper that reports every refusal the same way. A 404 is the server saying the listing is
   * gone. Everything else — a refusal, a timeout, no connection at all — says only that this attempt
   * failed, which is never evidence that anything was deleted.
   *
   * The reader's own token goes with it, so a source only its author can see answers for its author.
   *
   * @param listingId - The source listing's server id
   * @returns What the answer was worth
   */
  async checkSource(listingId: string): Promise<SourceCheckStatus> {
    try {
      const headers: Record<string, string> = {};
      if (AuthService.isAuthenticated()) {
        headers['Authorization'] = `Bearer ${AuthService.token}`;
      }
      const response = await fetch(`${this.API_URL}/worlds/${listingId}`, { headers });
      if (response.status === 404) return 'not_found';
      return response.ok ? 'ok' : 'unavailable';
    } catch {
      return 'unavailable';
    }
  }

  /**
   * Read one relationship route for a world, with the reader's own token so an unlisted source and a
   * declined offering are answered by the rules that apply to them.
   *
   * Every refusal but one throws. A download that could not read these must stop and say so rather than
   * install a world with nothing following anything, and an add-on the reader picked must not vanish
   * because a request failed. The exception is `absent`, answered on a 404: a server that predates the
   * route has no relationships to report, which is what it answered before the routes existed.
   *
   * @param path - The route, from the API root
   * @param fallback - What to say when the refusal carries no message of its own
   * @param absent - What a 404 means here. Omitted, a 404 throws like any other refusal
   */
  private async fetchRelationship<T>(path: string, fallback: string, absent?: T): Promise<T> {
    const headers: Record<string, string> = {};
    if (AuthService.isAuthenticated()) {
      headers['Authorization'] = `Bearer ${AuthService.token}`;
    }
    const response = await fetch(`${this.API_URL}${path}`, { headers });
    if (response.status === 404 && absent !== undefined) return absent;
    if (!response.ok) throw await responseError(response, fallback);
    return (await response.json()).data as T;
  }

  /**
   * What a world requires, each source resolved to its listing or reported gone.
   *
   * @param worldId - The world listing's server id
   * @returns One row per required source, in the order the world declares them
   */
  async fetchDependencies(worldId: string): Promise<DependencyRow[]> {
    const body = await this.fetchRelationship<{ dependencies?: DependencyRow[] } | null>(
      `/worlds/${worldId}/dependencies`, 'Failed to read what this world requires', null,
    );
    return body?.dependencies ?? [];
  }

  /**
   * One required source's content. This is the only route that hands out an unlisted component, and only
   * to a reader who can already open the world that requires it.
   *
   * @param worldId - The world listing the source is required by
   * @param sourceId - The required source's listing id
   */
  async fetchDependencyContent(worldId: string, sourceId: string): Promise<unknown> {
    const body = await this.fetchRelationship<{ contentData?: unknown }>(
      `/worlds/${worldId}/dependencies/${sourceId}/content`, 'Failed to download this source',
    );
    return body?.contentData;
  }

  /**
   * The components offered as add-ons for a world, each with the world author's review state.
   *
   * @param worldId - The world listing's server id
   * @returns The offerings, or none against a server that predates the route
   */
  async fetchAddons(worldId: string): Promise<AddonRow[]> {
    return this.fetchRelationship<AddonRow[]>(
      `/worlds/${worldId}/addons`, 'Failed to read this world\'s add-ons', [],
    );
  }

  /**
   * Answer one offer made for your world.
   *
   * The world's author alone writes this. Sending the state the offer already holds acknowledges a source
   * that changed since the answer: the decision persists and the reviewed revision is set to the source's
   * current one.
   *
   * @param worldId - The world listing's server id
   * @param componentId - The offered component's listing id
   * @param reviewState - The answer to record
   */
  async setAddonReview(worldId: string, componentId: string, reviewState: ReviewState): Promise<void> {
    const response = await fetch(`${this.API_URL}/worlds/${worldId}/addons/${componentId}/review`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${AuthService.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ reviewState }),
    });

    if (!response.ok) throw await responseError(response, 'Failed to save this decision');
  }

  /**
   * Add an entry to a listing's changelog.
   *
   * @param worldId - The listing's server id
   * @param draft - The three authored fields
   */
  async createChangelogEntry(worldId: string, draft: ChangelogDraft): Promise<ChangelogEntry> {
    return this.writeChangelog('POST', `/worlds/${worldId}/changelog`, draft, 'Failed to add the entry');
  }

  /**
   * Rewrite one entry. Addressed through its listing, because an entry has no meaning apart from it.
   *
   * @param worldId - The listing's server id
   * @param entryId - The entry's id
   * @param draft - The replacement fields
   */
  async updateChangelogEntry(worldId: string, entryId: string, draft: ChangelogDraft): Promise<ChangelogEntry> {
    return this.writeChangelog(
      'PUT', `/worlds/${worldId}/changelog/${entryId}`, draft, 'Failed to save the entry',
    );
  }

  /**
   * Remove one entry.
   *
   * @param worldId - The listing's server id
   * @param entryId - The entry's id
   */
  async deleteChangelogEntry(worldId: string, entryId: string): Promise<void> {
    if (!AuthService.isAuthenticated()) throw new Error('You must be logged in to edit a changelog');

    const response = await fetch(`${this.API_URL}/worlds/${worldId}/changelog/${entryId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${AuthService.token}` },
    });

    if (!response.ok) throw await responseError(response, 'Failed to delete the entry');
  }

  /** The half `createChangelogEntry` and `updateChangelogEntry` share: same body, same auth, same refusal. */
  private async writeChangelog(
    method: 'POST' | 'PUT',
    path: string,
    draft: ChangelogDraft,
    fallbackError: string,
  ): Promise<ChangelogEntry> {
    if (!AuthService.isAuthenticated()) throw new Error('You must be logged in to edit a changelog');

    const response = await fetch(`${this.API_URL}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${AuthService.token}`,
      },
      body: JSON.stringify({ title: draft.title.trim(), body: draft.body.trim(), date: draft.date }),
    });

    if (!response.ok) throw await responseError(response, fallbackError);

    const body = await response.json();

    return body.data as ChangelogEntry;
  }

  /** Fetch the current user's published worlds; returns `[]` when unauthenticated or on error. */
  async getUserWorlds(kind: CatalogKindQuery = 'world') {
    if (!AuthService.isAuthenticated()) return [];

    // Omitted for 'world' so the request stays byte-identical to what shipped before kinds.
    const query = kind === 'world' ? '' : `?kind=${encodeURIComponent(kind)}`;
    try {
      const response = await fetch(`${this.API_URL}/users/me/worlds${query}`, {
        headers: {
          'Authorization': `Bearer ${AuthService.token}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch user worlds');
      }

      const responseData = await response.json();

      // Return just the data array, not the entire response object
      return responseData.data || [];
    } catch (error) {
      console.error('Error fetching user worlds:', error);
      return [];
    }
  }

  /**
   * Publish a world, character, or dictionary: `PUT` updates when `targetId` names one of the user's own
   * listings, else `POST` creates. Requires auth; rethrows on failure. Build `payload` with the per-kind
   * helpers in `lib/publishPayload`, which own where each kind's fields come from.
   *
   * Refuses before authenticating or sending anything when the content is over its kind's limit. The
   * limit comes from `lib/publishLimits`, the one place the client states one.
   *
   * `contestEventId` enters the new listing into a contest. It rides top-level beside the tags and is
   * omitted when absent: it is intent about this upload rather than part of the content, so it never
   * reaches the world's own shape, and a server without an events layer is sent nothing new.
   */
  async publishItem(payload: PublishPayload, targetId: string | null = null, contestEventId: string | null = null) {
    // Sized and built in the worker: stringifying a world that carries its images blocks the page for seconds.
    const { bytes, body } = await buildPublishBodyInWorker(payload, contestEventId);
    if (bytes > PUBLISH_LIMITS[payload.kind]) {
      throw new Error(publishLimitRefusal(payload.kind, bytes));
    }

    if (!AuthService.isAuthenticated()) {
      throw new Error('You must be logged in to publish');
    }

    const endpoint = targetId
      ? `${this.API_URL}/worlds/${targetId}` // Update an existing listing
      : `${this.API_URL}/worlds`;            // Create a new one

    const method = targetId ? 'PUT' : 'POST';

    try {
      const response = await fetch(endpoint, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${AuthService.token}`
        },
        body
      });

      if (!response.ok) {
        // The refusal carries a `code` when a policy blocked it; attach it so the caller can open the
        // right dialog instead of matching on error text.
        throw await codedResponseError(response, 'Failed to publish', ['message', 'error']);
      }

      // The listing itself, not the envelope around it: what the caller wants is its id and its fresh
      // `updated_at`, to link the local copy to what was just published.
      const responseData = await response.json();
      return responseData.data || responseData;
    } catch (error) {
      console.error('Error publishing:', error);
      throw error;
    }
  }

  /**
   * Take a listing back out of the contest it was entered in.
   *
   * A withdrawal, never a move: the listing itself stays published and keeps its likes, comments and
   * downloads — only the entry flag goes. The server allows the author or a moderator, audits every one,
   * and refuses to release a placed world with a `CONTEST_PLACED` code.
   *
   * @param listingId - The published listing's server id
   */
  async withdrawFromContest(listingId: string): Promise<void> {
    if (!AuthService.isAuthenticated()) {
      throw new Error('You must be logged in to withdraw an entry');
    }

    const response = await fetch(`${this.API_URL}/worlds/${listingId}/contest`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${AuthService.token}` },
    });

    if (!response.ok) throw await codedResponseError(response, 'Failed to withdraw the entry');
  }

  /**
   * Who liked a listing, newest like first. Staff only.
   *
   * Answers with the full count as well as the rows, which the server caps: a listing with more likes
   * than the cap is exactly the one worth looking at, and a list that quietly stopped short would say
   * the opposite of what it means.
   *
   * @param worldId - The listing's server id
   * @returns The full like count, and as many likers as the server will send
   */
  async fetchLikers(worldId: string): Promise<{ total: number; rows: LikerRow[]; anonymous: number }> {
    const response = await fetch(`${this.API_URL}/worlds/${worldId}/likes`, {
      headers: { 'Authorization': `Bearer ${AuthService.token}` },
    });

    if (!response.ok) throw await responseError(response, 'Failed to load who liked this');
    const body = await response.json().catch(() => ({}));

    const data = body.data as { total?: number; rows?: LikerRow[]; anonymous?: number } | undefined;

    return {
      total: Number(data?.total) || 0,
      rows: data?.rows ?? [],
      anonymous: Number(data?.anonymous) || 0,
    };
  }

  /**
   * The same likers with the network Signals behind them read across. Staff only.
   *
   * Asked for only when somebody opens the audit, never with the list: the server writes an audit row
   * per call, so counting the likes on a listing would otherwise file a look at everyone who gave one.
   *
   * Anonymous Likes come back beside the accounts and in the same grouping. They are half of what a
   * listing's number counts, so an audit that read only the account side would miss a flood entirely.
   *
   * @param worldId - The listing's server id
   * @returns The full like count, the account rows with their group and author link, how many
   *   Anonymous Likes the listing has, and as many of their rows as the server will send
   */
  async fetchLikersAudit(worldId: string): Promise<{
    total: number;
    rows: LikerAuditRow[];
    anonymous: number;
    anonymousRows: AnonymousLikeRow[];
  }> {
    const response = await fetch(`${this.API_URL}/worlds/${worldId}/likes/audit`, {
      headers: { 'Authorization': `Bearer ${AuthService.token}` },
    });

    if (!response.ok) throw await responseError(response, 'Failed to audit these likes');
    const body = await response.json().catch(() => ({}));

    const data = body.data as {
      total?: number;
      rows?: LikerAuditRow[];
      anonymous?: number;
      anonymousRows?: AnonymousLikeRow[];
    } | undefined;

    return {
      total: Number(data?.total) || 0,
      rows: data?.rows ?? [],
      anonymous: Number(data?.anonymous) || 0,
      anonymousRows: data?.anonymousRows ?? [],
    };
  }

  /**
   * Take one address's Anonymous Likes off a listing. Staff only.
   *
   * Keyed by the address the audit named, never by the group number beside it: the number is assigned
   * by scan order and would point somewhere else by the time somebody presses it.
   *
   * @param worldId - The listing's server id
   * @param addressKey - The address as the audit row carries it
   * @returns What went, the listing's new like count, and its remaining Anonymous Like count
   */
  async removeAnonymousLikeGroup(worldId: string, addressKey: string): Promise<AnonymousLikesRemoved> {
    return this.deleteAnonymousLikes(
      `${this.API_URL}/worlds/${worldId}/anonymous-likes/address/${encodeURIComponent(addressKey)}`
    );
  }

  /**
   * Take every Anonymous Like off a listing. Staff only.
   *
   * The blunt half of the pair, for a flood old enough that the retention sweep has emptied the
   * addresses behind it and left the narrow removal nothing to act on.
   *
   * @param worldId - The listing's server id
   * @returns What went, the listing's new like count, and its remaining Anonymous Like count
   */
  async removeAnonymousLikes(worldId: string): Promise<AnonymousLikesRemoved> {
    return this.deleteAnonymousLikes(`${this.API_URL}/worlds/${worldId}/anonymous-likes`);
  }

  /** The DELETE both Anonymous Like removals make, which differ only in what they aim at. */
  private async deleteAnonymousLikes(url: string): Promise<AnonymousLikesRemoved> {
    const response = await fetch(url, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${AuthService.token}` },
    });

    if (!response.ok) throw await responseError(response, 'Failed to remove those Anonymous Likes');
    const body = await response.json().catch(() => ({}));

    const data = body.data as AnonymousLikesRemoved | undefined;

    return {
      removed: Number(data?.removed) || 0,
      likes: Number(data?.likes) || 0,
      anonymous: Number(data?.anonymous) || 0,
    };
  }

  /**
   * Take one account's like off a listing. Staff only.
   *
   * Answers with the new count for the same reason liking does: the number on the card behind the
   * dialog has to move with the row that left the list.
   *
   * @param worldId - The listing's server id
   * @param userId - Whose like to remove
   * @returns The listing's new like count
   */
  async removeLike(worldId: string, userId: string): Promise<number> {
    const response = await fetch(
      `${this.API_URL}/worlds/${worldId}/likes/${encodeURIComponent(userId)}`,
      { method: 'DELETE', headers: { 'Authorization': `Bearer ${AuthService.token}` } }
    );

    if (!response.ok) throw await responseError(response, 'Failed to remove that like');
    const body = await response.json().catch(() => ({}));

    return Number((body.data as { likes?: number } | undefined)?.likes) || 0;
  }
}

export default new WorldStorageService();
