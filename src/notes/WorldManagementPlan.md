# World Management Plan

## Goals
1. Optimize world loading performance
2. Implement flexible storage for world data
3. Support both default and user-uploaded worlds
4. Maintain essential metadata for previews

## Storage Strategy

### Database Structure
- Database: `worldsDB`
- Object Store: `worlds`
  - id: string (UUID)
  - name: string (required)
  - description: string (required)
  - thumbnail: string (Base64, required)
  - data: object (complete world JSON, flexible schema)
  - isDefault: boolean
  - createdAt: timestamp
  - lastAccessed: timestamp

### Key Principles
1. Flexible JSON Storage:
   - Store complete world data as-is
   - No schema validation beyond metadata
   - Future-proof for new fields
2. Metadata Requirements:
   - Name, description, thumbnail enforced
   - Used for preview grid and basic info
3. Default World Handling:
   - Load into IndexDB on first access
   - Maintain original JSON as fallback
4. User Uploads:
   - Store directly in IndexDB
   - Validate minimum metadata
   - Support management operations

## Implementation Plan

### 1. WorldStorageService
- Initialize IndexDB
- Handle CRUD operations
- Manage default world loading
- Implement cleanup mechanism

### 2. MainMenu Integration
- Load previews from IndexDB
- Handle world selection
- Show loading states
- Implement upload interface

### 3. GameDataContext Updates
- Support loading from IndexDB
- Handle default world fallback
- Maintain compatibility with existing code

### 4. Performance Optimization
- Load metadata separately to prevent loading all worlds data just to show worlds preview grid
- Lazy loading of world data
- Background loading of default worlds
- Caching frequently accessed worlds
- Periodic cleanup of unused worlds

## Migration Strategy
1. Phase 1: Implement new storage system
2. Phase 2: Add user upload support
3. Phase 3: Migrate default worlds on first access
  - On first game load, import default worlds as if they are user-uploaded worlds
