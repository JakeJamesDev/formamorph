import AuthService from './AuthService';
import type { CatalogKindQuery } from '@/lib/catalogKinds';
import type { PublishPayload } from '@/lib/publishPayload';
import { openDatabase, promisifyRequest } from '@/lib/idb';
import { migrateWorld } from '@/lib/version';
import { contentHash } from '@/lib/contentHash';
import { readDeletedDefaultWorlds, tombstoneDefaultWorld, type DefaultWorldSeed } from '@/lib/defaultWorlds';
import type { WorldMetadata } from '@/types';

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
    // Use different API URL based on environment
    this.API_URL = import.meta.env.MODE === 'production'
      ? import.meta.env.VITE_API_URL_PROD
      : import.meta.env.VITE_API_URL_DEV;
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

  /** List all stored worlds as lightweight metadata (no nested `data`), for menu/library rendering. */
  async getWorldMetadata(): Promise<WorldMetadata[]> {
    await this.ensureInitialized();
    const transaction = this.db!.transaction([this.storeName], 'readonly');
    const store = transaction.objectStore(this.storeName);
    const worlds = await promisifyRequest(store.getAll());
    return worlds.map(world => ({
      id: world.id,
      name: world.name,
      description: world.description,
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
      createdAt: world.createdAt,
      lastAccessed: world.lastAccessed
    }));
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
    // Full records (not getWorldMetadata) so we can read each stored copy's `sourceHash` and `dirty`.
    const transaction = this.db!.transaction([this.storeName], 'readonly');
    const stored = await promisifyRequest(transaction.objectStore(this.storeName).getAll());
    const byId = new Map<string, { dirty?: boolean; sourceHash?: string }>(
      stored.map((w) => [w.id, w]),
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
   */
  async publishItem(payload: PublishPayload, targetId: string | null = null) {
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
          // The catalog card reads previewData; it mirrors the list fields, never the content.
          previewData: {
            name: payload.name,
            description: payload.description,
            thumbnail: payload.thumbnail
          },
          contentData: payload.contentData,
          kind: payload.kind
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

      return await response.json();
    } catch (error) {
      console.error('Error publishing:', error);
      throw error;
    }
  }
}

export default new WorldStorageService();
