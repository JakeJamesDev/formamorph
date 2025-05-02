import AuthService from './AuthService';

class WorldStorageService {
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

  // Fetch worlds from the server with optional filtering
  async fetchRemoteWorlds(page = 1, limit = 10, search = '', ownedOnly = false, searchByAuthor = false) {
    try {
      let url = `${this.API_URL}/worlds?page=${page}&limit=${limit}`;
      if (search) url += `&search=${encodeURIComponent(search)}`;
      if (searchByAuthor) url += `&searchByAuthor=true`;
      
      const headers = {};
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
      console.log('Remote worlds response:', responseData);
      
      return {
        success: true,
        data: responseData.data || [],
        pagination: responseData.pagination,
        total: responseData.total || 0
      };
    } catch (error) {
      console.error('Error fetching remote worlds:', error);
      return { success: false, error: error.message, data: [] };
    }
  }
  
  // Get worlds published by the current user
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
      console.log('User worlds response:', responseData);
      
      // Return just the data array, not the entire response object
      return responseData.data || [];
    } catch (error) {
      console.error('Error fetching user worlds:', error);
      return [];
    }
  }

  // Publish a world to the server
  async publishWorld(worldData, worldId = null) {
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
