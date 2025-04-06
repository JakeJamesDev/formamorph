class WorldStorageService {
  constructor() {
    this.dbName = 'worldsDB';
    this.storeName = 'worlds';
    this.db = null;
    this.initialize();
  }

  async initialize() {
    if (this.db) return; // Already initialized
    
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, 1);
      
      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains(this.storeName)) {
          db.createObjectStore(this.storeName, { keyPath: 'id' });
        }
      };

      request.onsuccess = (event) => {
        this.db = event.target.result;
        resolve();
      };

      request.onerror = (event) => {
        reject(`IndexedDB error: ${event.target.errorCode}`);
      };
    });
  }

  async ensureInitialized() {
    if (!this.db) {
      await this.initialize();
    }
  }

  async getWorldMetadata() {
    await this.ensureInitialized();
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      const request = store.getAll();

      request.onsuccess = () => {
        const worlds = request.result.map(world => ({
          id: world.id,
          name: world.name,
          description: world.description,
          author: world.author || '',
          thumbnail: world.thumbnail
        }));
        resolve(worlds);
      };

      request.onerror = () => {
        reject('Failed to get world metadata');
      };
    });
  }

  async getWorldData(worldId) {
    await this.ensureInitialized();

    console.log("WorldID: ", worldId);
    
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
        const transaction = this.db.transaction([this.storeName], 'readonly');
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
              resolve(request.result.data);
            }
          } else {
            reject('World not found');
          }
        };
        request.onerror = (event) => {
          console.error('Database error:', event.target.error);
          reject(`Failed to get world data: ${event.target.error}`);
        };
      } catch (error) {
        console.error('Transaction setup error:', error);
        reject(`Failed to set up database transaction: ${error.message}`);
      }
    });
  }

  async storeWorld(world) {
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

    console.log(world.id);

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.put({
        id: world.id,
        name: world.name,
        description: world.description || '',
        author: world.author || '',
        thumbnail: world.thumbnail || '',
        data: world.data,
        createdAt: new Date().toISOString(),
        lastAccessed: new Date().toISOString()
      });

      request.onsuccess = () => resolve();
      request.onerror = () => reject('Failed to store world');
    });
  }

  async loadDefaultWorlds(defaultWorlds) {
    try {
      const existingWorlds = await this.getWorldMetadata();
      const worldsToLoad = defaultWorlds.filter(
        world => !existingWorlds.some(existing => existing.id === world.id)
      );

      await Promise.all(
        worldsToLoad.map(async world => {
          try {
            // Import the world JSON file
            const module = await import(`../defaultworlds/${world.id}.json`);
            const worldData = module.default;
            
            // Create a full world object with the correct structure
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
                  use3DModel: true
                },
                stats: worldData.stats || [],
                locations: worldData.locations || [],
                entities: worldData.entities || [],
                traits: worldData.traits || [],
                statUpdates: worldData.statUpdates || []
              }
            };
            return this.storeWorld(fullWorld);
          } catch (error) {
            console.error(`Error loading world ${world.id}:`, error);
            return Promise.resolve(); // Skip this world but continue with others
          }
        })
      );
    } catch (error) {
      console.error('Error loading default worlds:', error);
    }
  }

  async deleteWorld(worldId) {
    await this.ensureInitialized();
    
    if (!worldId) {
      throw new Error('World ID is required');
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.delete(worldId);

      request.onsuccess = () => resolve();
      request.onerror = () => reject('Failed to delete world');
    });
  }
}

export default new WorldStorageService();
