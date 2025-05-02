# Tags Implementation Instructions

## Issue Overview
The tags field is not being properly included when publishing worlds to the server. While the client-side code has been updated to support tags, the server-side code needs modifications to properly handle and store the tags array.

## Client-Side Implementation
On the client side, we've implemented:
1. A UI component in WorldOverviewManager.jsx for adding/removing tags
2. Updated GameDataContext.jsx to include tags in the worldOverview state
3. Modified MainMenu.jsx to ensure tags are included when publishing worlds

## Required Server-Side Changes

### 1. Update WorldStorageService.js
The current publishWorld method in WorldStorageService.js doesn't explicitly include tags in the request body. Update the method to explicitly include tags:

```javascript
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
    // Ensure tags is an array
    const tags = Array.isArray(worldData.worldOverview.tags) 
      ? worldData.worldOverview.tags 
      : [];
    
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
        tags: tags, // Explicitly include tags
        previewData: {
          name: worldData.worldOverview.name,
          description: worldData.worldOverview.description,
          thumbnail: worldData.worldOverview.thumbnail,
          tags: tags // Include tags in preview data too
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
```

### 2. Update Server-Side World Model

The server-side World model needs to properly handle tags in both create and update operations:

#### In World.create method:
```javascript
create: (worldData, contentFile, thumbnailFile) => {
  try {
    // Generate UUID for world ID
    const worldId = worldData.id || uuidv4();
    
    // Ensure tags is an array before stringifying
    let tags = [];
    if (worldData.tags) {
      if (Array.isArray(worldData.tags)) {
        tags = worldData.tags;
      } else if (typeof worldData.tags === 'string') {
        // Try to parse if it's a JSON string
        try {
          const parsedTags = JSON.parse(worldData.tags);
          tags = Array.isArray(parsedTags) ? parsedTags : [];
        } catch (e) {
          // If parsing fails, treat as a single tag
          tags = [worldData.tags];
        }
      }
    }
    
    // Stringify the tags array for storage
    const tagsString = JSON.stringify(tags);
    
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
      tagsString
    );
    
    // Return created world
    return World.findById(worldId);
  } catch (error) {
    throw error;
  }
}
```

#### In World.update method:
```javascript
update: (id, worldData) => {
  try {
    // Update timestamp
    worldData.updated_at = new Date().toISOString();
    
    // Handle tags properly
    if (worldData.tags !== undefined) {
      // Ensure tags is an array before stringifying
      let tags = [];
      if (worldData.tags) {
        if (Array.isArray(worldData.tags)) {
          tags = worldData.tags;
        } else if (typeof worldData.tags === 'string') {
          // Try to parse if it's a JSON string
          try {
            const parsedTags = JSON.parse(worldData.tags);
            tags = Array.isArray(parsedTags) ? parsedTags : [];
          } catch (e) {
            // If parsing fails, treat as a single tag
            tags = [worldData.tags];
          }
        }
      }
      
      // Stringify the tags array for storage
      worldData.tags = JSON.stringify(tags);
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
}
```

### 3. Update World Controller

Ensure the world controller properly extracts tags from the request body:

```javascript
// Create a new world
exports.createWorld = async (req, res) => {
  try {
    // Extract tags from request body
    const { name, description, thumbnail, tags, previewData, contentData } = req.body;
    
    // Validate required fields
    if (!name || !contentData) {
      return res.status(400).json({ success: false, message: 'Name and content data are required' });
    }
    
    // Create world data object
    const worldData = {
      name,
      description: description || '',
      author_id: req.user.id,
      tags: tags || [], // Use tags from request or empty array
      preview_data: previewData || {}
    };
    
    // ... rest of the function
  } catch (error) {
    // ... error handling
  }
};

// Update a world
exports.updateWorld = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, thumbnail, tags, previewData, contentData } = req.body;
    
    // Create world data object with only provided fields
    const worldData = {};
    if (name) worldData.name = name;
    if (description !== undefined) worldData.description = description;
    if (tags !== undefined) worldData.tags = tags; // Include tags if provided
    if (previewData) worldData.preview_data = previewData;
    
    // ... rest of the function
  } catch (error) {
    // ... error handling
  }
};
```

## Testing Instructions

After implementing these changes, test the tags functionality by:

1. Creating a new world with tags in the client
2. Publishing the world to the server
3. Verifying the tags are visible in the published world details
4. Updating the world with new tags
5. Verifying the updated tags are reflected in the published world

If issues persist, check the server logs for any errors related to tags parsing or storage.
