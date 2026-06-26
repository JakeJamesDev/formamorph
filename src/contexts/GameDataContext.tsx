import { createContext, useContext, useState, useCallback, useMemo, useEffect, type ReactNode } from 'react';
import WorldStorageService from '../services/WorldStorageService';
import { migrateWorld, APP_VERSION } from '@/lib/version';
import type {
  WorldMetadata,
  WorldOverview,
  Stat,
  GameLocation,
  Entity,
  Trait,
  StatUpdate,
  DictionaryEntry,
  World,
} from '@/types';

// Stable serialization of the full world definition, used for dirty detection.
function serializeWorld(
  overview: WorldOverview,
  stats: Stat[],
  locations: GameLocation[],
  entities: Entity[],
  traits: Trait[],
  statUpdates: StatUpdate[],
  dictionary: DictionaryEntry[],
) {
  return JSON.stringify({ worldOverview: overview, stats, locations, entities, traits, statUpdates, dictionary });
}

function useProvideGameData() {
  const [worldMetadata, setWorldMetadata] = useState<WorldMetadata[]>([]);
  const [worldOverview, setWorldOverview] = useState<WorldOverview>({
    name: '',
    description: '',
    author: '',
    thumbnail: null, // Base64 encoded string of the image file
    bgm: null, // Base64 encoded string of the audio file
    systemPrompt: '',
    use3DModel: true,
    tags: [],
    customPlayerVRM: null // { data, type } of an optional custom player VRM model
  });
  const [stats, setStats] = useState<Stat[]>([]);
  const [locations, setLocations] = useState<GameLocation[]>([]);
  const [entities, setEntities] = useState<Entity[]>([]);
  const [traits, setTraits] = useState<Trait[]>([]);
  const [statUpdates, setStatUpdates] = useState<StatUpdate[]>([]);
  const [dictionary, setDictionary] = useState<DictionaryEntry[]>([]);
  const [worldId, setWorldId] = useState<string | null>(null);
  // Serialized last-saved world; compared against current data to flag pending edits.
  const [savedSnapshot, setSavedSnapshot] = useState<string>('');

  const addStat = useCallback((newStat: Omit<Stat, 'descriptors'>) => {
    const defaultDescriptors = [
      { id: crypto.randomUUID(), threshold: 30, description: `${newStat.name} is low` },
      { id: crypto.randomUUID(), threshold: 60, description: `${newStat.name} is medium` },
      { id: crypto.randomUUID(), threshold: 100, description: `${newStat.name} is high` },
    ];
    const statWithDescriptors = { ...newStat, descriptors: defaultDescriptors };
    setStats(prevStats => [...prevStats, statWithDescriptors]);
  }, []);

  const updateStat = useCallback((updatedStat: Stat) => {
    setStats(prevStats => prevStats.map(stat =>
      stat.id === updatedStat.id ? updatedStat : stat
    ));
  }, []);

  const removeStat = useCallback((statId: string) => {
    setStats(prevStats => prevStats.filter(stat => stat.id !== statId));
  }, []);

  const addLocation = useCallback((newLocation: GameLocation) => {
    setLocations(prevLocations => [...prevLocations, newLocation]);
  }, []);

  const updateLocation = useCallback((updatedLocation: GameLocation) => {
    setLocations(prevLocations => prevLocations.map(location =>
      location.id === updatedLocation.id ? updatedLocation : location
    ));
  }, []);

  const removeLocation = useCallback((locationId: string) => {
    setLocations(prevLocations => prevLocations.filter(location => location.id !== locationId));
  }, []);

  const addEntity = useCallback((newEntity: Entity) => {
    setEntities(prevEntities => [...prevEntities, newEntity]);
  }, []);

  const updateEntity = useCallback((updatedEntity: Entity) => {
    setEntities(prevEntities => prevEntities.map(entity =>
      entity.id === updatedEntity.id ? updatedEntity : entity
    ));
  }, []);

  const removeEntity = useCallback((entityId: string) => {
    setEntities(prevEntities => prevEntities.filter(entity => entity.id !== entityId));
  }, []);

  const addTrait = useCallback((newTrait: Trait) => {
    setTraits(prevTraits => [...prevTraits, newTrait]);
  }, []);

  const updateTrait = useCallback((updatedTrait: Trait) => {
    setTraits(prevTraits => prevTraits.map(trait =>
      trait.id === updatedTrait.id ? updatedTrait : trait
    ));
  }, []);

  const removeTrait = useCallback((traitId: string) => {
    setTraits(prevTraits => prevTraits.filter(trait => trait.id !== traitId));
  }, []);

  const addStatUpdate = useCallback((newStatUpdate: StatUpdate) => {
    setStatUpdates(prevStatUpdates => [...prevStatUpdates, {
      ...newStatUpdate,
      messageHistory: newStatUpdate.messageHistory || []
    }]);
  }, []);

  const updateStatUpdate = useCallback((updatedStatUpdate: StatUpdate) => {
    setStatUpdates(prevStatUpdates => prevStatUpdates.map(statUpdate =>
      statUpdate.id === updatedStatUpdate.id ? {
        ...updatedStatUpdate,
        messageHistory: updatedStatUpdate.messageHistory || statUpdate.messageHistory || []
      } : statUpdate
    ));
  }, []);

  const removeStatUpdate = useCallback((statUpdateId: string) => {
    setStatUpdates(prevStatUpdates => prevStatUpdates.filter(statUpdate => statUpdate.id !== statUpdateId));
  }, []);

  const addDictionaryEntry = useCallback((newEntry: DictionaryEntry) => {
    setDictionary(prev => [...prev, newEntry]);
  }, []);

  const updateDictionaryEntry = useCallback((updatedEntry: DictionaryEntry) => {
    setDictionary(prev => prev.map(entry =>
      entry.id === updatedEntry.id ? updatedEntry : entry
    ));
  }, []);

  const removeDictionaryEntry = useCallback((entryId: string) => {
    setDictionary(prev => prev.filter(entry => entry.id !== entryId));
  }, []);

  const updateWorldOverview = useCallback((updates: Partial<WorldOverview>) => {
    setWorldOverview(prev => ({ ...prev, ...updates }));
  }, []);

  const loadWorldMetadata = useCallback(async () => {
    try {
      const metadata = await WorldStorageService.getWorldMetadata();
      setWorldMetadata(metadata);
    } catch (error) {
      console.error('Error loading world metadata:', error);
    }
  }, []);

  const loadWorldData = useCallback((rawWorldData: World, isDefault = false) => {
    // Central sanitation net: normalize any legacy import shape to the current version (idempotent),
    // so worlds reaching the editor are always current regardless of which entry point loaded them.
    const worldData = migrateWorld(rawWorldData);
    const defaultOverview: WorldOverview = {
      name: '',
      description: '',
      author: '',
      thumbnail: null,
      bgm: null,
      systemPrompt: '',
      use3DModel: true,
      tags: [],
      customPlayerVRM: null
    };

    // Handle world overview with validation (migrateWorld already moved any legacy VRM into worldOverview).
    const overview = worldData.worldOverview || defaultOverview;
    const normalizedOverview: WorldOverview = {
      name: overview.name || defaultOverview.name,
      description: overview.description || defaultOverview.description,
      author: overview.author || defaultOverview.author,
      thumbnail: overview.thumbnail || defaultOverview.thumbnail,
      bgm: overview.bgm || defaultOverview.bgm,
      systemPrompt: overview.systemPrompt || defaultOverview.systemPrompt,
      use3DModel: typeof overview.use3DModel === 'boolean' ? overview.use3DModel : defaultOverview.use3DModel,
      tags: Array.isArray(overview.tags) ? overview.tags : defaultOverview.tags,
      customPlayerVRM: overview.customPlayerVRM || defaultOverview.customPlayerVRM
    };
    updateWorldOverview(normalizedOverview);

    // Load other data with array validation
    const nextStats = Array.isArray(worldData.stats) ? worldData.stats : [];
    const nextLocations = Array.isArray(worldData.locations) ? worldData.locations : [];
    const nextEntities = Array.isArray(worldData.entities) ? worldData.entities : [];
    const nextTraits = Array.isArray(worldData.traits) ? worldData.traits : [];
    const nextStatUpdates = Array.isArray(worldData.statUpdates) ? worldData.statUpdates : [];
    const nextDictionary = Array.isArray(worldData.dictionary) ? worldData.dictionary : [];
    setWorldId(worldData.id);
    setStats(nextStats);
    setLocations(nextLocations);
    setEntities(nextEntities);
    setTraits(nextTraits);
    setStatUpdates(nextStatUpdates);
    setDictionary(nextDictionary);

    // Baseline for dirty detection: a freshly loaded world has no pending changes.
    setSavedSnapshot(serializeWorld(
      normalizedOverview, nextStats, nextLocations, nextEntities, nextTraits, nextStatUpdates, nextDictionary,
    ));

    return isDefault;
  }, [updateWorldOverview, setStats, setLocations, setEntities, setTraits, setStatUpdates]);

  const isWorldDirty = useMemo(
    () => serializeWorld(worldOverview, stats, locations, entities, traits, statUpdates, dictionary) !== savedSnapshot,
    [worldOverview, stats, locations, entities, traits, statUpdates, dictionary, savedSnapshot],
  );

  // Persist the current world and re-baseline so isWorldDirty clears. Returns success.
  const saveWorld = useCallback(async (): Promise<boolean> => {
    try {
      await WorldStorageService.storeWorld({
        id: worldId ?? '',
        name: worldOverview.name,
        description: worldOverview.description,
        author: worldOverview.author,
        thumbnail: worldOverview.thumbnail ?? undefined,
        // A save means the local copy was edited; flag it dirty (sourceId is preserved by storeWorld).
        dirty: true,
        data: { version: APP_VERSION, worldOverview, stats, locations, entities, traits, statUpdates, dictionary },
      });
      setSavedSnapshot(serializeWorld(worldOverview, stats, locations, entities, traits, statUpdates, dictionary));
      return true;
    } catch (error) {
      console.error('Error saving world:', error);
      return false;
    }
  }, [worldId, worldOverview, stats, locations, entities, traits, statUpdates, dictionary]);

  useEffect(() => {
    WorldStorageService.initialize();
    loadWorldMetadata();
  }, [loadWorldMetadata]);

  const value = {
    worldMetadata,
    worldOverview,
    updateWorldOverview,
    loadWorldMetadata,
    stats,
    locations,
    entities,
    traits,
    statUpdates,
    dictionary,
    addStat,
    updateStat,
    removeStat,
    addLocation,
    updateLocation,
    removeLocation,
    addEntity,
    updateEntity,
    removeEntity,
    addTrait,
    updateTrait,
    removeTrait,
    addStatUpdate,
    updateStatUpdate,
    removeStatUpdate,
    addDictionaryEntry,
    updateDictionaryEntry,
    removeDictionaryEntry,
    setStats,
    setLocations,
    setEntities,
    setTraits,
    setStatUpdates,
    setDictionary,
    loadWorldData,
    worldId, setWorldId,
    isWorldDirty,
    saveWorld
  };

  return value;
}

type GameDataContextValue = ReturnType<typeof useProvideGameData>;

const GameDataContext = createContext<GameDataContextValue | null>(null);

// eslint-disable-next-line react-refresh/only-export-components
export const useGameData = () => {
  const context = useContext(GameDataContext);
  if (!context) {
    throw new Error('useGameData must be used within a GameDataProvider');
  }
  return context;
};

export const GameDataProvider = ({ children }: { children: ReactNode }) => {
  const value = useProvideGameData();

  return (
    <GameDataContext.Provider value={value}>
      {children}
    </GameDataContext.Provider>
  );
};
