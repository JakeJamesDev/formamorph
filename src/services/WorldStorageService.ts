import AuthService from './AuthService';
import type { CatalogKindQuery } from '@/lib/catalogKinds';
import { API_BASE_URL } from '@/lib/apiBase';
import type { PublishPayload } from '@/lib/publishPayload';
import { PUBLISH_LIMITS, measurePublishBytes, publishLimitRefusal } from '@/lib/publishLimits';
import { openDatabase, promisifyRequest } from '@/lib/idb';
import { migrateCarriedPlaceholders, migrateWorld } from '@/lib/version';
import { contentHash } from '@/lib/contentHash';
import { describePlaceholders } from '@/lib/placeholders';
import { allPlaceholders } from '@/lib/placeholderHomes';
import { readDeletedDefaultWorlds, tombstoneDefaultWorld, type DefaultWorldSeed } from '@/lib/defaultWorlds';
import { changelogOf, type ChangelogDraft, type ChangelogEntry } from '@/lib/listingChangelog';
import type { ReviewState, WorldAssociation } from '@/lib/compatibleWorlds';
import type { ListingVisibility } from '@/lib/publishLinks';
import type { AddonRow, DependencyRow } from '@/lib/worldDependencies';
import type { SourceCheckStatus } from '@/lib/sourceChecks';
import type { ContentLink, LikerAuditRow, LikerRow, VrmLicense, WorldMetadata } from '@/types';

/**
 * What a conditional catalog fetch answers with: a fresh snapshot and the tag to store beside it, the
 * word that the local copy still stands, or the error that stopped the request.
 */
export type CatalogFetch =
  | { status: 'fresh'; data: unknown[]; tag: string | null }
  | { status: 'unchanged' }
  | { status: 'error'; error: string };

/**
 * What one listing says about itself beyond its row: its history, an Avatar's license, and the
 * relationships a publish over it has to preserve. Every field past `changelog` is absent against a
 * server that predates it.
 */
export interface ListingDetails {
  changelog: ChangelogEntry[] | null;
  modelLicense?: VrmLicense;
  visibility?: ListingVisibility;
  /** The listing ids a world requires today, resolved or not. */
  requiredDependencies?: string[];
  /** The worlds a component is offered for today, with the world author's answer to each. */
  compatibleWorlds?: WorldAssociation[];
}

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


/** Result of a default-world seed/update pass: ids that failed to load, and display names that were
 *  auto-updated in place (so the caller can notify the player). */
export interface DefaultWorldSyncResult {
  failed: string[];
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

/** Singleton owning local world persistence (IndexedDB `worldsDB`/`worlds`) and community server calls
 *  (fetch/publish/comments). Default-exported as one shared instance; the constructor kicks off DB init. */
class WorldStorageService {
  dbName: string;
  storeName: string;
  db: IDBDatabase | null;
  API_URL: string;

  constructor() {
    this.dbName = 'worldsDB';
    this.storeName = 'worlds';
    this.db = null;
    this.API_URL = API_BASE_URL;
    // No eager open: every operation awaits `ensureInitialized` first, so opening here only adds an
    // import-time IndexedDB touch — which throws an unhandled rejection in test files that import this
    // module without a fake IndexedDB. Lazy init matches ModelStorageService.
  }

  /** Open the IndexedDB connection (idempotent — no-op once `db` is set). */
  async initialize() {
    if (this.db) return; // Already initialized
    this.db = await openDatabase(this.dbName, 1, [{ name: this.storeName, keyPath: 'id' }]);
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
    const transaction = this.db!.transaction([this.storeName], 'readonly');
    const keys = await promisifyRequest(transaction.objectStore(this.storeName).getAllKeys());
    return keys.map(String);
  }

  /** List all stored worlds as lightweight metadata (no nested `data`), for menu/library rendering. */
  async getWorldMetadata(): Promise<WorldMetadata[]> {
    await this.ensureInitialized();
    const transaction = this.db!.transaction([this.storeName], 'readonly');
    const store = transaction.objectStore(this.storeName);
    const worlds = await promisifyRequest(store.getAll());
    return worlds.map(world => ({
      id: world.id,
      name: world.name,
      // The stored blurb keeps its raw chips; the card renders them display-only against the world's defs,
      // since a library card has no playthrough whose rolls it could read.
      // Stored records never pass through `migrateWorld`, so their defs take the value-record conversion
      // here — the same read-boundary treatment the dictionary library gives its keyword arrays.
      description: describePlaceholders(world.description ?? '', allPlaceholders({ ...world.data, placeholders: migrateCarriedPlaceholders(world.data?.placeholders) })),
      author: world.author || '',
      // A remote (http) thumbnail can't render offline and is blocked cross-origin by the server's CORP
      // header, so prefer the world's own embedded thumbnail (base64) when the stored one is a URL. New
      // downloads already store the embedded thumbnail; this heals worlds downloaded before that fix.
      thumbnail: (world.thumbnail && !/^https?:\/\//i.test(world.thumbnail))
        ? world.thumbnail
        : (world.data?.worldOverview?.thumbnail || world.thumbnail),
      tags: world.data?.worldOverview?.tags || [],
      sourceId: world.sourceId,
      dirty: world.dirty,
      editedAt: world.editedAt,
      downloadedAt: world.downloadedAt,
      sourceUpdatedAt: world.sourceUpdatedAt,
      sourceAuthorId: world.sourceAuthorId,
      createdAt: world.createdAt,
      lastAccessed: world.lastAccessed
    }));
  }

  /**
   * The local worlds holding a copy that follows `libraryId`.
   *
   * This is what a component's Compatible Worlds section is derived from, so it reads the whole stored
   * record rather than the metadata projection: the links live inside each world's content. `sourceId` is
   * the world's own listing, and a world without one has no published identity to offer the component for.
   *
   * @param libraryId - The library item the copies follow
   * @returns One entry per world, in stored order
   */
  async worldsLinking(libraryId: string): Promise<{ id: string; name: string; sourceId?: string }[]> {
    await this.ensureInitialized();
    if (!libraryId) return [];

    const transaction = this.db!.transaction([this.storeName], 'readonly');
    const worlds = await promisifyRequest<{
      id: string; name: string; sourceId?: string;
      data?: { entities?: { link?: ContentLink }[]; dictionaries?: { link?: ContentLink }[] };
    }[]>(transaction.objectStore(this.storeName).getAll());

    return worlds
      .filter((world) => [...(world.data?.entities ?? []), ...(world.data?.dictionaries ?? [])]
        .some((item) => item.link?.libraryId === libraryId))
      .map((world) => ({
        id: world.id,
        name: world.name,
        ...(world.sourceId ? { sourceId: world.sourceId } : {}),
      }));
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
  async linkedCopies(libraryId: string): Promise<{
    worldId: string; worldName: string; itemId: string; itemName: string;
    kind: 'entity' | 'dictionary'; link: ContentLink;
  }[]> {
    await this.ensureInitialized();
    if (!libraryId) return [];

    type Copy = { id?: string; name?: string; link?: ContentLink };
    const transaction = this.db!.transaction([this.storeName], 'readonly');
    const worlds = await promisifyRequest<{
      id: string; name: string; data?: { entities?: Copy[]; dictionaries?: Copy[] };
    }[]>(transaction.objectStore(this.storeName).getAll());

    return worlds.flatMap((world) => [
      ...(world.data?.entities ?? []).map((item) => ({ item, kind: 'entity' as const })),
      ...(world.data?.dictionaries ?? []).map((item) => ({ item, kind: 'dictionary' as const })),
    ]
      .filter(({ item }) => item.link?.libraryId === libraryId)
      .map(({ item, kind }) => ({
        worldId: world.id,
        worldName: world.name,
        itemId: item.id ?? '',
        itemName: item.name ?? '',
        kind,
        link: item.link as ContentLink,
      })));
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

    return new Promise<void>((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const read = store.get(worldId);
      read.onsuccess = () => {
        const record = read.result;
        if (!record?.data || typeof record.data !== 'object') {
          reject(new Error('World not found'));
          return;
        }
        let revised: Record<string, unknown>;
        try {
          revised = revise(record.data as Record<string, unknown>);
        } catch (error) {
          reject(error instanceof Error ? error : new Error(String(error)));
          return;
        }
        if (revised === record.data) { resolve(); return; }
        const write = store.put({ ...record, data: revised });
        write.onsuccess = () => resolve();
        write.onerror = () => reject(new Error('Failed to store world'));
      };
      read.onerror = () => reject(new Error('Failed to read world'));
    });
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
        const transaction = this.db!.transaction([this.storeName], 'readonly');
        const store = transaction.objectStore(this.storeName);

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

    return new Promise<void>((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      // Read-merge so the download link survives saves: sourceId is sticky (inherited unless the
      // caller supplies one), and dirty defaults to the existing/false unless the caller sets it.
      const getRequest = store.get(world.id);
      getRequest.onsuccess = () => {
        const existing = getRequest.result;
        const putRequest = store.put({
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
        putRequest.onsuccess = () => resolve();
        putRequest.onerror = () => reject('Failed to store world');
      };
      getRequest.onerror = () => reject('Failed to store world');
    });
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
    // Full records (not getWorldMetadata) so we can read each stored copy's `sourceHash` and `dirty`,
    // but fetched by id rather than as a whole-store read: only the bundled defaults are ever compared,
    // so reading the player's own worlds here loaded a library's worth of payload to look at none of it.
    const transaction = this.db!.transaction([this.storeName], 'readonly');
    const store = transaction.objectStore(this.storeName);
    const stored = await Promise.all(
      defaultWorlds.map((w) => promisifyRequest(store.get(w.id))),
    );
    const byId = new Map<string, { dirty?: boolean; sourceHash?: string }>(
      stored.filter(Boolean).map((w) => [w.id, w]),
    );

    const failed: string[] = [];
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

          const worldData = JSON.parse(raw);

          // Preserve every authored section by passing the parsed world through untouched — `migrateWorld`
          // spreads it (so present and future sections survive) and folds the legacy flat `dictionary` into
          // books. Only `id` and a default `worldOverview` are stamped. storeWorld read-merges sticky local
          // fields (createdAt, sourceId) and keeps `dirty` false for an unedited update.
          const data = migrateWorld({
            ...worldData,
            id: world.id,
            worldOverview: worldData.worldOverview || {
              name: world.defaultName,
              description: `Default ${world.defaultName} world`,
              author: '',
              thumbnail: '',
              bgm: null,
              systemPrompt: '',
              use3DModel: true,
            },
          });
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
        }
      }),
    );
    return { failed, updated };
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

    return new Promise<void>((resolve, reject) => {
      const store = this.db!.transaction([this.storeName], 'readwrite').objectStore(this.storeName);
      const getRequest = store.get(worldId);
      getRequest.onsuccess = () => {
        const existing = getRequest.result;
        if (!existing) return resolve();
        const putRequest = store.put({
          ...existing,
          sourceId,
          sourceUpdatedAt,
        });
        putRequest.onsuccess = () => resolve();
        putRequest.onerror = () => reject('Failed to link world to its listing');
      };
      getRequest.onerror = () => reject('Failed to link world to its listing');
    });
  }

  /** Remove a world from IndexedDB by `id`; this is the only path that drops the sticky `sourceId` link. */
  async deleteWorld(worldId: string) {
    await this.ensureInitialized();

    if (!worldId) {
      throw new Error('World ID is required');
    }

    const transaction = this.db!.transaction([this.storeName], 'readwrite');
    const store = transaction.objectStore(this.storeName);
    await promisifyRequest(store.delete(worldId));
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
      const headers: Record<string, string> = {};
      if (AuthService.isAuthenticated()) {
        headers['Authorization'] = `Bearer ${AuthService.token}`;
      }
      // `no-store` and not `reload`: `reload` sends `Cache-Control: no-cache`, which the server reads
      // as an end-to-end reload and answers `200` with the whole body however well the tag matches.
      const init: RequestInit = tag
        ? { headers: { ...headers, 'If-None-Match': tag }, cache: 'no-store' }
        : { headers };

      const response = await fetch(`${this.API_URL}/worlds?page=1&limit=1000&kind=all`, init);
      if (response.status === 304) return { status: 'unchanged' };
      if (!response.ok) throw new Error('Failed to fetch worlds');

      const body = await response.json();
      return { status: 'fresh', data: body.data || [], tag: response.headers.get('ETag') };
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

    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.error || body.message || 'Failed to change that');

    return body.data as { liked: boolean; likes: number };
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

    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.error || body.message || 'Failed to quarantine this');

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

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(body.error || body.message || 'Failed to release this');
    }
  }

  /** Fetch a page of comments for a published world; auth is optional. Never throws — errors resolve to
   *  a `{success:false}` shape. */
  async fetchComments(worldId: string, page = 1, limit = 20) {
    try {
      const headers: Record<string, string> = {};
      if (AuthService.isAuthenticated()) {
        headers['Authorization'] = `Bearer ${AuthService.token}`;
      }
      const response = await fetch(
        `${this.API_URL}/worlds/${worldId}/comments?page=${page}&limit=${limit}`,
        { headers },
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
      console.error('Error fetching comments:', error);
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
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || 'Failed to post comment');
    }
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
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || errorData.message || 'Failed to save the comment');
    }
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
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || errorData.message || 'Failed to delete the comment');
    }
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
    try {
      const headers: Record<string, string> = {};
      if (AuthService.isAuthenticated()) {
        headers['Authorization'] = `Bearer ${AuthService.token}`;
      }
      const response = await fetch(`${this.API_URL}/worlds/${worldId}?includeChangelog=true`, { headers });
      if (!response.ok) return null;

      const body = await response.json();

      // The relationship fields are absent against a server that has never heard of them, which is what
      // keeps the Linked Content and Compatible Worlds sections empty there rather than wrong.
      return {
        changelog: changelogOf(body.data),
        modelLicense: body.data?.modelLicense,
        visibility: body.data?.visibility,
        requiredDependencies: (body.data?.requiredDependencies ?? []).map(
          (row: { id?: string } | string) => (typeof row === 'string' ? row : String(row?.id ?? '')),
        ).filter(Boolean),
        compatibleWorlds: body.data?.compatibleWorlds ?? [],
      };
    } catch (error) {
      console.error('Error fetching the listing:', error);
      return null;
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
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(body.error || body.message || fallback);
    }
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

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(body.error || body.message || 'Failed to save this decision');
    }
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

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(body.error || body.message || 'Failed to delete the entry');
    }
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

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(body.error || body.message || fallbackError);
    }

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
    const bytes = measurePublishBytes(payload.contentData);
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
        body: JSON.stringify({
          name: payload.name,
          description: payload.description,
          thumbnail: payload.thumbnail,
          contentData: payload.contentData,
          kind: payload.kind,
          // Sent top-level because only a world keeps a copy inside its content, where the server looks
          // first. A character or a book has nowhere in its own shape to hide these.
          tags: payload.tags ?? [],
          ...(contestEventId ? { contestEventId } : {}),
          // Each omitted unless this publish has something to declare, so a publish that says nothing
          // about relationships leaves the listing's own exactly as they are.
          ...(payload.visibility ? { visibility: payload.visibility } : {}),
          ...(payload.requiredDependencies ? { requiredDependencies: payload.requiredDependencies } : {}),
          ...(payload.compatibleWorlds ? { compatibleWorlds: payload.compatibleWorlds } : {})
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        // The refusal carries a `code` when a policy blocked it; attach it so the caller can open the
        // right dialog instead of matching on error text.
        const failure = new Error(errorData.message || errorData.error || 'Failed to publish') as Error & { code?: string };
        if (errorData.code) failure.code = errorData.code;
        throw failure;
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

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      const failure = new Error(
        body.error || body.message || 'Failed to withdraw the entry',
      ) as Error & { code?: string };
      if (body.code) failure.code = body.code;
      throw failure;
    }
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
  async fetchLikers(worldId: string): Promise<{ total: number; rows: LikerRow[] }> {
    const response = await fetch(`${this.API_URL}/worlds/${worldId}/likes`, {
      headers: { 'Authorization': `Bearer ${AuthService.token}` },
    });

    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.error || body.message || 'Failed to load who liked this');

    const data = body.data as { total?: number; rows?: LikerRow[] } | undefined;

    return { total: Number(data?.total) || 0, rows: data?.rows ?? [] };
  }

  /**
   * The same likers with the network Signals behind them read across. Staff only.
   *
   * Asked for only when somebody opens the audit, never with the list: the server writes an audit row
   * per call, so counting the likes on a listing would otherwise file a look at everyone who gave one.
   *
   * @param worldId - The listing's server id
   * @returns The full like count, and the rows with their group and author link
   */
  async fetchLikersAudit(worldId: string): Promise<{ total: number; rows: LikerAuditRow[] }> {
    const response = await fetch(`${this.API_URL}/worlds/${worldId}/likes/audit`, {
      headers: { 'Authorization': `Bearer ${AuthService.token}` },
    });

    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.error || body.message || 'Failed to audit these likes');

    const data = body.data as { total?: number; rows?: LikerAuditRow[] } | undefined;

    return { total: Number(data?.total) || 0, rows: data?.rows ?? [] };
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

    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.error || body.message || 'Failed to remove that like');

    return Number((body.data as { likes?: number } | undefined)?.likes) || 0;
  }
}

export default new WorldStorageService();
