const db = require('../config/db');
const { v4: uuidv4 } = require('uuid');
const { readWorldContent, getThumbnailBase64 } = require('../utils/fileStorage');

/**
 * World model
 */
const World = {
  /**
   * Find a world by ID
   * @param {string} id - World ID
   * @returns {Object|null} World object or null if not found
   */
  findById: (id) => {
    return db.prepare('SELECT * FROM worlds WHERE id = ?').get(id);
  },

  /**
   * Find a world by ID and populate with author data
   * @param {string} id - World ID
   * @returns {Object|null} World object with author data or null if not found
   */
  findByIdWithAuthor: (id) => {
    const world = World.findById(id);
    
    if (!world) {
      return null;
    }
    
    // Get author data
    const author = db.prepare('SELECT id, username FROM users WHERE id = ?').get(world.author_id);
    
    // Parse tags
    world.tags = world.tags ? JSON.parse(world.tags) : [];
    
    // Don't include preview_data as it contains megabytes due to thumbnail
    
    // Return world with author but without preview_data
    const { preview_data, ...worldWithoutPreviewData } = world;
    
    // Add thumbnail URL - ensure we're using the correct path
    // The thumbnail_file might contain a full path, so we need to extract just the filename
    const thumbnailFilename = world.thumbnail_file.split('/').pop();
    const thumbnailUrl = `/api/thumbnails/${thumbnailFilename}`;
    
    return {
      ...worldWithoutPreviewData,
      thumbnailUrl,
      author
    };
  },

  /**
   * Get all worlds with pagination and filtering
   * @param {Object} options - Query options
   * @returns {Object} Object containing worlds, count, and pagination info
   */
  getAll: (options = {}) => {
    try {
      const {
        page = 1,
        limit = 10,
        search = '',
        tags = '',
        searchByAuthor = false,
        authorId = null
      } = options;
      
      // Calculate offset
      const offset = (page - 1) * limit;
      
      // Base query
      let query = 'SELECT w.*, u.username as author_username FROM worlds w JOIN users u ON w.author_id = u.id';
      let countQuery = 'SELECT COUNT(*) as count FROM worlds w JOIN users u ON w.author_id = u.id';
      let whereClause = [];
      let params = [];
      
      // Filter by author ID
      if (authorId) {
        whereClause.push('w.author_id = ?');
        params.push(authorId);
      }
      
      // Search by author name
      if (searchByAuthor && search) {
        whereClause.push('u.username LIKE ?');
        params.push(`%${search}%`);
      }
      
      // Search by world name, description, or tags
      if (!searchByAuthor && search) {
        whereClause.push('(w.name LIKE ? OR w.description LIKE ? OR w.tags LIKE ?)');
        params.push(`%${search}%`, `%${search}%`, `%${search}%`);
      }
      
      // Filter by tags
      if (tags) {
        const tagList = tags.split(',');
        const tagConditions = tagList.map(tag => `w.tags LIKE ?`);
        whereClause.push(`(${tagConditions.join(' OR ')})`);
        tagList.forEach(tag => params.push(`%${tag}%`));
      }
      
      // Add where clause to queries
      if (whereClause.length > 0) {
        query += ' WHERE ' + whereClause.join(' AND ');
        countQuery += ' WHERE ' + whereClause.join(' AND ');
      }
      
      // Add order by and limit to main query
      query += ' ORDER BY w.created_at DESC LIMIT ? OFFSET ?';
      params.push(limit, offset);
      
      // Execute queries
      const worlds = db.prepare(query).all(...params);
      const countResult = db.prepare(countQuery).get(...params.slice(0, params.length - 2));
      const total = countResult ? countResult.count : 0;
      
      // Process worlds
      const processedWorlds = worlds.map(world => {
        // Parse tags
        world.tags = world.tags ? JSON.parse(world.tags) : [];
        
        // Format author
        world.author = {
          id: world.author_id,
          username: world.author_username
        };
        
        // Remove redundant fields
        delete world.author_id;
        delete world.author_username;
        delete world.content_file;
        delete world.preview_data; // Don't include preview_data as it contains megabytes due to thumbnail
        
        // Add thumbnail URL - ensure we're using the correct path
        // The thumbnail_file might contain a full path, so we need to extract just the filename
        const thumbnailFilename = world.thumbnail_file.split('/').pop();
        world.thumbnailUrl = `/api/thumbnails/${thumbnailFilename}`;
        
        return world;
      });
      
      // Calculate pagination
      const pagination = {};
      
      if (offset + limit < total) {
        pagination.next = {
          page: page + 1,
          limit
        };
      }
      
      if (page > 1) {
        pagination.prev = {
          page: page - 1,
          limit
        };
      }
      
      return {
        worlds: processedWorlds,
        count: processedWorlds.length,
        pagination,
        total
      };
    } catch (error) {
      throw error;
    }
  },

  /**
   * Create a new world
   * @param {Object} worldData - World data
   * @param {string} contentFile - Content file name
   * @param {string} thumbnailFile - Thumbnail file name
   * @returns {Object} Created world object
   */
  create: (worldData, contentFile, thumbnailFile) => {
    try {
      // Generate UUID for world ID
      const worldId = worldData.id || uuidv4();
      
      // Parse tags if they're a string
      const tags = typeof worldData.tags === 'string' 
        ? worldData.tags 
        : JSON.stringify(worldData.tags || []);
      
      // Parse preview data if it's a string
      const previewData = typeof worldData.preview_data === 'string'
        ? worldData.preview_data
        : JSON.stringify(worldData.preview_data || {});
      
      // Insert world into database
      db.prepare(`
        INSERT INTO worlds (
          id, name, description, author_id, thumbnail_file,
          preview_data, content_file, tags
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        worldId,
        worldData.name,
        worldData.description,
        worldData.author_id,
        thumbnailFile,
        previewData,
        contentFile,
        tags
      );
      
      // Return created world
      return World.findById(worldId);
    } catch (error) {
      throw error;
    }
  },

  /**
   * Update a world
   * @param {string} id - World ID
   * @param {Object} worldData - World data to update
   * @returns {Object} Updated world object
   */
  update: (id, worldData) => {
    try {
      // Update timestamp
      worldData.updated_at = new Date().toISOString();
      
      // Parse tags if they're an array
      if (worldData.tags && Array.isArray(worldData.tags)) {
        worldData.tags = JSON.stringify(worldData.tags);
      }
      
      // Parse preview data if it's an object
      if (worldData.preview_data && typeof worldData.preview_data === 'object') {
        worldData.preview_data = JSON.stringify(worldData.preview_data);
      }
      
      // Build update query
      const fields = Object.keys(worldData).filter(key => key !== 'id');
      const placeholders = fields.map(field => `${field} = ?`).join(', ');
      const values = fields.map(field => worldData[field]);
      
      // Add ID to values
      values.push(id);
      
      // Update world in database
      db.prepare(`
        UPDATE worlds
        SET ${placeholders}
        WHERE id = ?
      `).run(...values);
      
      // Return updated world
      return World.findById(id);
    } catch (error) {
      throw error;
    }
  },

  /**
   * Delete a world
   * @param {string} id - World ID
   * @returns {boolean} True if world was deleted successfully
   */
  delete: (id) => {
    try {
      // Delete world from database
      const result = db.prepare('DELETE FROM worlds WHERE id = ?').run(id);
      
      return result.changes > 0;
    } catch (error) {
      throw error;
    }
  },

  /**
   * Increment download count for a world
   * @param {string} id - World ID
   * @returns {number} New download count
   */
  incrementDownloads: (id) => {
    try {
      // Update download count
      db.prepare(`
        UPDATE worlds
        SET downloads = downloads + 1, updated_at = ?
        WHERE id = ?
      `).run(new Date().toISOString(), id);
      
      // Get updated world
      const world = World.findById(id);
      
      return world ? world.downloads : 0;
    } catch (error) {
      throw error;
    }
  },

  /**
   * Get worlds by author ID
   * @param {string} authorId - Author ID
   * @returns {Array} Array of world objects
   */
  getByAuthor: (authorId) => {
    try {
      return World.getAll({ authorId });
    } catch (error) {
      throw error;
    }
  },

  /**
   * Get world content
   * @param {string} id - World ID
   * @returns {Object} World content
   */
  getContent: async (id) => {
    try {
      // Get world
      const world = World.findByIdWithAuthor(id);
      
      if (!world) {
        throw new Error('World not found');
      }
      
      // Read content from file
      const contentData = await readWorldContent(world.content_file);
      
      // Get thumbnail as base64
      const thumbnail = await getThumbnailBase64(world.thumbnail_file);
      
      // Return world with content
      return {
        ...world,
        thumbnail,
        contentData
      };
    } catch (error) {
      throw error;
    }
  }
};

module.exports = World;
