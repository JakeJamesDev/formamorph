# Publish Feature Implementation Plan

## Overview

This document outlines the plan to implement a "Publish" button in the world info modal that allows users to publish their worlds to the server. The button will only be visible when the user is logged in. When clicked, it will open a publish modal that displays the user's currently uploaded worlds (with options to override them) and provides a button to publish as a new world.

## UI Components

### 1. Publish Button in World Info Modal

- Add a "Publish" button to the existing world info modal in `views/MainMenu.jsx`
- The button should only be visible when `isAuthenticated` is true
- Position the button alongside the existing "Enter World", "Enter World (Skip Customize)", and "Edit World" buttons
- Use the same styling as the existing buttons for consistency
- Use an appropriate icon from lucide-react (e.g., `Upload`, `Share`, or `Cloud`)

```jsx
{isAuthenticated && (
  <Button
    className="w-full bg-gradient-to-r from-purple-100 to-indigo-200 hover:from-purple-200 hover:to-indigo-300 text-black font-bold"
    onClick={() => setShowPublishModal(true)}
  >
    <Upload className="mr-2 h-4 w-4" /> Publish World
  </Button>
)}
```

### 2. Publish Modal

Create a new modal component that will be shown when the "Publish" button is clicked:

- Add state for controlling the visibility of the modal: `const [showPublishModal, setShowPublishModal] = useState(false);`
- The modal should include:
  - A title: "Publish World"
  - A description explaining the publishing process
  - A list of the user's currently uploaded worlds (if any)
  - Radio buttons or similar UI to select an existing world to override
  - A "Publish as New" button
  - A "Cancel" button

```jsx
<Dialog open={showPublishModal} onOpenChange={setShowPublishModal}>
  <DialogContent className="sm:max-w-[500px]">
    <DialogHeader>
      <DialogTitle>Publish World</DialogTitle>
      <DialogDescription>
        Publish your world to share it with other players.
      </DialogDescription>
    </DialogHeader>
    
    <div className="py-4">
      {userWorlds.length > 0 ? (
        <div className="space-y-4">
          <h3 className="text-sm font-medium">Your Published Worlds</h3>
          <p className="text-sm text-gray-500">Select a world to update or publish as new:</p>
          
          <RadioGroup value={selectedWorldToOverride} onValueChange={setSelectedWorldToOverride}>
            {userWorlds.map(world => (
              <div key={world.id} className="flex items-start space-x-2 p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800">
                <RadioGroupItem value={world.id} id={world.id} />
                <div className="grid gap-1">
                  <Label htmlFor={world.id}>{world.name}</Label>
                  <p className="text-sm text-gray-500">{world.description}</p>
                </div>
              </div>
            ))}
          </RadioGroup>
        </div>
      ) : (
        <p className="text-sm text-gray-500">You haven't published any worlds yet.</p>
      )}
    </div>
    
    <DialogFooter className="flex flex-col sm:flex-row gap-2">
      <Button variant="outline" onClick={() => setShowPublishModal(false)}>
        Cancel
      </Button>
      
      {userWorlds.length > 0 && selectedWorldToOverride && (
        <Button onClick={handleOverrideWorld}>
          Update Selected World
        </Button>
      )}
      
      <Button onClick={handlePublishAsNew}>
        Publish as New World
      </Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

## State Management

### 1. New State Variables

Add the following state variables to the MainMenu component:

```jsx
// Publish modal states
const [showPublishModal, setShowPublishModal] = useState(false);
const [userWorlds, setUserWorlds] = useState([]);
const [selectedWorldToOverride, setSelectedWorldToOverride] = useState(null);
const [isPublishing, setIsPublishing] = useState(false);
const [publishError, setPublishError] = useState('');
```

### 2. Fetch User's Published Worlds

Create a function to fetch the user's published worlds when the publish modal is opened:

```jsx
const fetchUserWorlds = async () => {
  if (!isAuthenticated) return;
  
  try {
    const worlds = await WorldStorageService.getUserWorlds();
    setUserWorlds(worlds);
    
    // Reset selection
    setSelectedWorldToOverride(worlds.length > 0 ? worlds[0].id : null);
  } catch (error) {
    console.error('Error fetching user worlds:', error);
    setPublishError('Failed to load your published worlds');
  }
};
```

Call this function when the publish modal is opened:

```jsx
useEffect(() => {
  if (showPublishModal) {
    fetchUserWorlds();
  }
}, [showPublishModal, isAuthenticated]);
```

## API Integration

### 1. Update WorldStorageService

Add methods to the WorldStorageService to handle world publishing:

```javascript
// Add to WorldStorageService.js

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
    
    return await response.json();
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
```

### 2. Implement Publish Handlers

Add handler functions for publishing worlds:

```jsx
// Handle publishing as a new world
const handlePublishAsNew = async () => {
  setPublishError('');
  setIsPublishing(true);
  
  try {
    // Get the current world data
    const worldToPublish = selectedWorld.data || worldData;
    
    // Publish the world
    await WorldStorageService.publishWorld(worldToPublish);
    
    // Close the modal and show success message
    setShowPublishModal(false);
    toast.success('World published successfully!');
    
    // Refresh the user's worlds list
    fetchUserWorlds();
  } catch (error) {
    setPublishError(error.message || 'Failed to publish world');
  } finally {
    setIsPublishing(false);
  }
};

// Handle overriding an existing world
const handleOverrideWorld = async () => {
  if (!selectedWorldToOverride) return;
  
  setPublishError('');
  setIsPublishing(true);
  
  try {
    // Get the current world data
    const worldToPublish = selectedWorld.data || worldData;
    
    // Update the existing world
    await WorldStorageService.publishWorld(worldToPublish, selectedWorldToOverride);
    
    // Close the modal and show success message
    setShowPublishModal(false);
    toast.success('World updated successfully!');
    
    // Refresh the user's worlds list
    fetchUserWorlds();
  } catch (error) {
    setPublishError(error.message || 'Failed to update world');
  } finally {
    setIsPublishing(false);
  }
};
```

## Implementation Steps

1. **Update WorldStorageService.js**
   - Add `getUserWorlds()` method
   - Add `publishWorld()` method

2. **Update MainMenu.jsx**
   - Add new state variables for the publish modal
   - Add the publish button to the world info modal (only visible when logged in)
   - Implement the publish modal component
   - Add handler functions for publishing worlds

3. **Testing**
   - Test the publish button visibility (should only show when logged in)
   - Test fetching user worlds
   - Test publishing a new world
   - Test updating an existing world
   - Test error handling

## Considerations

- **Error Handling**: Implement proper error handling for API calls and display user-friendly error messages.
- **Loading States**: Show loading indicators during API calls to provide feedback to the user.
- **Validation**: Validate world data before publishing to ensure it meets the server requirements.
- **Confirmation**: Consider adding a confirmation dialog before overriding an existing world.
- **Permissions**: Ensure that users can only update their own worlds.

## Future Enhancements

- Add a preview of the world being published
- Add tags or categories for worlds
- Add the ability to make worlds public or private
- Add a search feature for finding published worlds
- Add ratings and comments for published worlds
