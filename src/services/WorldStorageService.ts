import AuthService from './AuthService';
import { openDatabase, promisifyRequest } from '@/lib/idb';
import { migrateWorld } from '@/lib/version';
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

// A built-in world to seed on first run; its JSON is imported by `id`.
interface DefaultWorldSeed {
  id: string;
  defaultName: string;
}

/** Result of a default-world seed/update pass: ids that failed to load, and display names that were
 *  auto-updated in place (so the caller can notify the player). */
export interface DefaultWorldSyncResult {
  failed: string[];
  updated: string[];
}

/** True when dotted numeric version `a` is strictly newer than `b` (e.g. '2.3.0' beats '2.2.5'). Missing or
 *  non-numeric parts read as 0, so an unversioned/legacy stored copy is always older than a stamped bundle. */
function isVersionNewer(a?: string, b?: string): boolean {
  const pa = String(a ?? '0').split('.').map((n) => parseInt(n, 10) || 0);
  const pb = String(b ?? '0').split('.').map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] || 0) - (pb[i] || 0);
    if (d !== 0) return d > 0;
  }
  return false;
}

// The world payload sent to the server when publishing.
interface PublishableWorld {
  worldOverview: { name?: string; description?: string; thumbnail?: string } & Record<string, unknown>;
  [key: string]: unknown;
}

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
    this.initialize();
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

  /** Seed missing default worlds and auto-update unedited ones whose bundled `version` is newer than the
   *  stored copy's. Runs every launch (cheap when nothing changed). A world is left untouched if the player
   *  has edited it (`dirty`), since that diverges from the bundled default (git-dirty model). Returns the
   *  ids that failed to load plus the display names auto-updated in place. */
  async loadDefaultWorlds(defaultWorlds: DefaultWorldSeed[]): Promise<DefaultWorldSyncResult> {
    await this.ensureInitialized();
    // Full records (not getWorldMetadata) so we can read each stored copy's `data.version` and `dirty`.
    const transaction = this.db!.transaction([this.storeName], 'readonly');
    const stored = await promisifyRequest(transaction.objectStore(this.storeName).getAll());
    const byId = new Map<string, { dirty?: boolean; data?: { version?: string } }>(
      stored.map((w) => [w.id, w]),
    );

    const failed: string[] = [];
    const updated: string[] = [];
    await Promise.all(
      defaultWorlds.map(async world => {
        try {
          const existing = byId.get(world.id);
          const module = await import(`../defaultworlds/${world.id}.json`);
          const worldData = module.default;

          if (existing) {
            // Present already: replace only an unedited copy the bundle has moved past. An edited world
            // (`dirty`) or a same/older bundle version is left as-is.
            if (existing.dirty || !isVersionNewer(worldData.version, existing.data?.version)) return;
          }

          // Full record, preserving every authored section (dictionaries + placeholders included — omitting
          // them here silently dropped lorebooks/wildcards on seed). storeWorld read-merges sticky local
          // fields (createdAt, sourceId) and keeps `dirty` false for an unedited update.
          const fullWorld = {
            id: world.id,
            name: worldData.worldOverview?.name || world.defaultName,
            description: worldData.worldOverview?.description || `Default ${world.defaultName} world`,
            author: worldData.worldOverview?.author || '',
            thumbnail: worldData.worldOverview?.thumbnail || '',
            data: {
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
              stats: worldData.stats || [],
              locations: worldData.locations || [],
              entities: worldData.entities || [],
              entityGroups: worldData.entityGroups || [],
              traits: worldData.traits || [],
              traitGroups: worldData.traitGroups || [],
              statUpdates: worldData.statUpdates || [],
              // Pass both dictionary forms through: v2.x books directly, and the legacy flat `dictionary`
              // so migrateWorld can fold it into a book (older bundled defaults still use the flat form).
              dictionary: worldData.dictionary,
              dictionaries: worldData.dictionaries,
              placeholders: worldData.placeholders,
            },
          };
          await this.storeWorld({ ...fullWorld, data: migrateWorld(fullWorld.data) });
          if (existing) updated.push(fullWorld.name);
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
  }

  /** Fetch a page of community worlds with optional search/sort; `ownedOnly` switches to the caller's own
   *  worlds and requires auth. Never throws — errors resolve to `{success:false, error, data:[]}`. */
  async fetchRemoteWorlds(page = 1, limit = 10, search = '', ownedOnly = false, searchByAuthor = false, sort = '', order = 'desc') {
    try {
      let url = `${this.API_URL}/worlds?page=${page}&limit=${limit}`;
      if (search) url += `&search=${encodeURIComponent(search)}`;
      if (searchByAuthor) url += `&searchByAuthor=true`;
      if (sort) url += `&sort=${encodeURIComponent(sort)}&order=${encodeURIComponent(order)}`;

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
  async getUserWorlds() {
    if (!AuthService.isAuthenticated()) return [];

    try {
      const response = await fetch(`${this.API_URL}/users/me/worlds`, {
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

  /** Publish a world to the community server: `PUT` updates when `worldId` is given, else `POST` creates. Requires
   *  auth; rethrows on failure. */
  async publishWorld(worldData: PublishableWorld, worldId: string | null = null) {
    if (!AuthService.isAuthenticated()) {
      throw new Error('You must be logged in to publish worlds');
    }

    const endpoint = worldId
      ? `${this.API_URL}/worlds/${worldId}` // Update existing world
      : `${this.API_URL}/worlds`;           // Create new world

    const method = worldId ? 'PUT' : 'POST';

    try {
      const response = await fetch(endpoint, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${AuthService.token}`
        },
        body: JSON.stringify({
          name: worldData.worldOverview.name,
          description: worldData.worldOverview.description,
          thumbnail: worldData.worldOverview.thumbnail,
          previewData: {
            name: worldData.worldOverview.name,
            description: worldData.worldOverview.description,
            thumbnail: worldData.worldOverview.thumbnail
          },
          contentData: worldData
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to publish world');
      }

      return await response.json();
    } catch (error) {
      console.error('Error publishing world:', error);
      throw error;
    }
  }
}

export default new WorldStorageService();
