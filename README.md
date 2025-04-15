# AI Text RPG Framework Documentation

## Installation and Usage

### Prerequisites
- Node.js (v16 or higher)
- npm or yarn

### Installation
```bash
# Clone the repository
git clone https://github.com/FieryLionite/formamorph.git
cd formamorph

# Install dependencies
npm install
# or
yarn
```

### Running the Application
```bash
# Start the development server
npm run dev
# or
yarn dev
```

The application will be available at http://localhost:5173

### Building for Production
```bash
# Build the application
npm run build
# or
yarn build

# Preview the production build
npm run preview
# or
yarn preview
```

## Project Overview

This project is a sophisticated React-based framework for creating and playing AI-driven text-based RPG experiences. It allows users to select from pre-built worlds, upload custom worlds, and even create or edit worlds using a built-in editor. The framework leverages AI to generate dynamic game content, providing an interactive storytelling experience.

## Folder Structure

```
src/
├── App.css                   # Main application styles
├── App.jsx                   # Main application component
├── index.css                 # Global styles
├── main.jsx                  # Entry point
├── components/               # UI and game components
│   ├── ConfirmDialog.jsx     # Reusable confirmation dialog
│   ├── theme-provider.jsx    # Theme provider for UI
│   ├── game/                 # Game-specific components
│   │   ├── GameModals.jsx    # Game-related modal components
│   │   ├── GamePanels.jsx    # Game UI panels (left, middle, right)
│   │   ├── GamePrompts.js    # AI prompt templates
│   │   └── TTSModal.jsx      # Text-to-speech modal
│   ├── menu/                 # Menu-related components
│   ├── modals/               # Modal components
│   │   ├── dbUtils.js        # Database utility functions
│   │   ├── EditTextModal.jsx # Text editing modal
│   │   ├── EntityModal.jsx   # Entity details modal
│   │   ├── LocationModal.jsx # Location selection modal
│   │   ├── MenuModal.jsx     # Game menu modal
│   │   └── SettingsModal.jsx # Settings configuration modal
│   └── ui/                   # Shadcn UI components
│       ├── button.jsx        # Button component
│       ├── card.jsx          # Card component
│       ├── dialog.jsx        # Dialog component
│       └── ...               # Other UI components
├── contexts/                 # React context providers
│   ├── GameDataContext.jsx   # Game data state management
│   ├── GameplayContext.jsx   # Gameplay state management
│   └── SettingsContext.jsx   # Application settings
├── defaultworlds/            # Default world JSON files
│   ├── drone.json            # "Reincarnated Drone" world
│   ├── rampage.json          # "Rampage" world
│   ├── slime.json            # "Slime" world
│   ├── sugarscape.json       # "Sugarscape" world
│   ├── valentines.json       # "Valentines Survival" world
│   └── veilwood.json         # "Veilwood" world
├── lib/                      # Utility functions and components
│   ├── UtilityComponents.jsx # Reusable utility components
│   └── utils.js              # General utility functions
├── managers/                 # World editor management components
│   ├── EntityManager.jsx     # Entity creation/editing
│   ├── LocationManager.jsx   # Location creation/editing
│   ├── StatManager.jsx       # Stat creation/editing
│   ├── StatUpdatesManager.jsx # Stat updates management
│   ├── TraitManager.jsx      # Trait creation/editing
│   └── WorldOverviewManager.jsx # World overview editing
├── notes/                    # Documentation and TODO files
├── services/                 # Service classes
│   └── WorldStorageService.js # World data storage service
├── teststuff/                # Testing utilities
└── views/                    # Main view components
    ├── CharacterCustomization.jsx # Character customization screen
    ├── GameViewer.jsx        # Main game screen
    ├── MainMenu.jsx          # Main menu screen
    ├── ModelViewer.jsx       # 3D model viewer
    ├── TraitSelectionModal.jsx # Trait selection interface
    ├── VRMViewer.jsx         # VRM model viewer
    └── WorldEditor.jsx       # World creation/editing tool
```

## Main Views

### MainMenu.jsx

The main menu is the entry point for users to select and interact with game worlds.

#### Key Features:
- Displays a grid of available worlds with thumbnails
- Allows uploading custom world JSON files
- Provides options to enter a world (with or without character customization)
- Includes a world editor access button
- Handles world deletion
- Supports trait selection before entering a world

#### Key Components:
- World selection grid with thumbnails
- World detail modal with description and options
- Upload functionality for custom worlds
- Mobile warning for world editor access
- Trait selection modal integration

#### State Management:
- Manages selected world state
- Handles world metadata loading
- Manages modal visibility states
- Integrates with WorldStorageService for data persistence

### GameViewer.jsx

The GameViewer is the core gameplay component where the actual game takes place. It handles the interaction between the player and the AI, manages game state, and renders the game interface.

#### Key Features:
- Three-panel layout (entities, game content, location/settings)
- AI-driven text generation for game content
- Player choice selection
- Stat management and updates
- Entity and location interaction
- Text-to-speech integration
- Game state saving/loading
- Ambient sound and background music

#### AI Integration:
- Uses fetch API to communicate with AI endpoints
- Supports streaming responses for real-time text generation
- Processes AI responses to extract game text, choices, and stat changes
- Handles different request types (gametext, choices, statUpdates)
- Supports multiple language options
- Includes error handling for AI requests

```jsx
// Example of AI request handling
const makeAIRequest = async (systemPrompt, messages, requestType = 'gametext') => {
  try {
    const response = await fetch(getEndpointUrl(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiToken}`
      },
      body: JSON.stringify({
        model: modelName,
        messages: [
          { role: 'system', content: systemPrompt },
          ...messages,
        ],
        max_tokens: maxTokens,
        stream: true,
        ...(requestType === 'gametext' && shortform && { stop: ["\n"] })
      })
    });

    // ... streaming response handling
  } catch (error) {
    // ... error handling
  }
};
```

#### Game State Management:
- Tracks player stats and updates them based on AI responses
- Manages visible entities based on game text
- Handles time progression and its effects on stats
- Maintains game log entries
- Supports rollback to previous game states

#### UI Components:
- Left panel for entity display and interaction
- Middle panel for game text, player input, and choices
- Right panel for location information and settings
- Various modals for settings, TTS, entities, and locations

### WorldEditor.jsx

The WorldEditor is a comprehensive tool for creating and editing game worlds, allowing users to define all aspects of their game universe.

#### Key Features:
- Two-panel resizable layout
- Tab-based navigation for different world aspects
- Creation and editing of stats, entities, locations, and traits
- World overview configuration
- World data import/export
- Persistent storage of world data

#### Editor Sections:
- **Overview**: General world settings and metadata
- **Stats**: Define player statistics (health, hunger, etc.)
- **Entities**: Create game characters, objects, and creatures
- **Locations**: Design game areas with descriptions and properties
- **Traits**: Define character traits with stat effects

#### State Management:
- Uses the GameDataContext for accessing and modifying world data
- Maintains local state for UI elements like active tab and selected item
- Handles file operations for importing and exporting world data

## State Management

The application uses React Context API for state management across three main contexts:

### GameDataContext

Manages the core game world data:
- World overview information
- Stats definitions
- Locations and their properties
- Entities and their attributes
- Character traits
- Stat update rules

Provides methods for:
- Adding, updating, and removing game elements
- Loading world data from files or storage
- Accessing current game world state

### GameplayContext

Handles the active gameplay state:
- Current location
- Player stats and their values
- Visible entities
- Game log entries
- Player choices
- Message history with AI
- Game time tracking
- Character customization data

Provides functionality for:
- Saving and loading game progress
- Managing game state history for rollbacks
- Updating player stats
- Adding log entries
- Processing AI responses

### SettingsContext

Manages application-wide settings:
- AI endpoint configuration
- API tokens
- Model selection
- Language preferences
- Audio settings (BGM, TTS)
- UI preferences
- System prompts for AI

## UI Components

The application uses Shadcn UI, a collection of reusable components built on Radix UI. Key components include:

- **Button**: Used throughout the application for actions
- **Card**: Container component for structured content
- **Dialog**: Modal dialogs for focused interactions
- **Tabs**: Used in the WorldEditor for navigation
- **Input**: Text input fields
- **ScrollArea**: Scrollable containers with custom scrollbars
- **Skeleton**: Loading placeholders
- **Progress**: Visual indicators for stat values

Custom game-specific components include:
- **GamePanels**: Left, middle, and right panels for the game interface
- **EntityModal**: Displays entity details and interactions
- **LocationModal**: Shows location information and navigation options
- **TTSModal**: Interface for text-to-speech functionality
- **ConfirmDialog**: Reusable confirmation dialog

## Game Mechanics

### World Structure
- **Worlds**: Container for all game elements
- **Locations**: Places the player can visit
- **Entities**: Characters, objects, and creatures in the game
- **Stats**: Numerical attributes that track player state
- **Traits**: Special characteristics that affect gameplay

### AI Integration
The game uses AI to generate:
- Narrative text based on player actions
- Choices for player decision-making
- Stat changes based on game events

The AI integration uses:
- System prompts that define the game world and rules
- Message history for context
- Streaming responses for real-time text generation
- Multiple specialized requests for different aspects (game text, choices, stat updates)

### Character Customization
- Players can customize their character appearance
- 3D model support for visual representation
- Trait selection for gameplay effects

### Game Progression
- Time-based stat changes (regeneration, hunger effects)
- Location-based ambient sounds and visuals
- Entity interactions based on game context
- Stat-based gameplay consequences

## Services

### WorldStorageService

Handles the persistence of world data:
- Loading default worlds
- Storing custom worlds
- Retrieving world metadata
- Saving and loading game progress
- Deleting worlds

## Conclusion

This AI Text RPG Framework provides a comprehensive platform for creating and playing text-based RPG experiences powered by AI. The modular architecture allows for easy extension and customization, while the built-in world editor enables non-technical users to create rich game worlds without coding knowledge.

The combination of React for the UI, context API for state management, and AI integration for dynamic content generation creates a powerful and flexible system for interactive storytelling.
