import { randomUUID } from "@/lib/uuid";
import { createContext, useContext, useState, useCallback, useMemo, useEffect, type ReactNode } from 'react';
import WorldStorageService from '../services/WorldStorageService';
import { migrateWorld, APP_VERSION } from '@/lib/version';
import { useDictionaryStoreState, DictionaryStoreProvider } from '@/contexts/DictionaryStoreContext';
import { placeholderStore, PlaceholderStoreProvider } from '@/contexts/PlaceholderStoreContext';
import type {
  WorldMetadata,
  WorldOverview,
  Stat,
  GameLocation,
  Entity,
  EntityGroup,
  Trait,
  TraitGroup,
  StatUpdate,
  Dictionary,
  Placeholder,
  World,
} from '@/types';

/** A fresh, empty "Default" book — the ≥1-book invariant's seed. */
const makeDefaultBook = (): Dictionary => ({ id: randomUUID(), name: 'Default', enabled: true, entries: [] });

// Stable serialization of the full world definition, used for dirty detection.
function serializeWorld(
  overview: WorldOverview,
  stats: Stat[],
  locations: GameLocation[],
  entities: Entity[],
  entityGroups: EntityGroup[],
  traits: Trait[],
  traitGroups: TraitGroup[],
  statUpdates: StatUpdate[],
  dictionaries: Dictionary[],
  placeholders: Placeholder[],
) {
  return JSON.stringify({ worldOverview: overview, stats, locations, entities, entityGroups, traits, traitGroups, statUpdates, dictionaries, placeholders });
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
  const [entityGroups, setEntityGroups] = useState<EntityGroup[]>([]);
  const [traits, setTraits] = useState<Trait[]>([]);
  const [traitGroups, setTraitGroups] = useState<TraitGroup[]>([]);
  const [statUpdates, setStatUpdates] = useState<StatUpdate[]>([]);
  const [placeholders, setPlaceholders] = useState<Placeholder[]>([]);
  // The world's books live in a scoped dictionary store (shared, unchanged CRUD) so the same editing
  // widgets can be reused elsewhere against an isolated store.
  const dictStore = useDictionaryStoreState([]);
  const {
    dictionaries, setDictionaries,
    addDictionary, updateDictionary, removeDictionary,
    addDictionaryEntry, updateDictionaryEntry, removeDictionaryEntry,
  } = dictStore;
  const [worldId, setWorldId] = useState<string | null>(null);
  // Serialized last-saved world; compared against current data to flag pending edits.
  const [savedSnapshot, setSavedSnapshot] = useState<string>('');

  const addStat = useCallback((newStat: Omit<Stat, 'descriptors'>) => {
    const defaultDescriptors = [
      { id: randomUUID(), threshold: 30, description: `${newStat.name} is low` },
      { id: randomUUID(), threshold: 60, description: `${newStat.name} is medium` },
      { id: randomUUID(), threshold: 100, description: `${newStat.name} is high` },
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
    // The entity↔location link is stored on the location, so dropping the entity alone strands its id in
    // every location that listed it. The AI feed skips ids it can't resolve, but they'd ride along into the
    // exported world and accumulate. The link sits on `entities` (current) or the legacy `entity` alias
    // (pre-audience-split worlds, which migration never folds) — clean whichever holds it. Returns the
    // original array when nothing referenced the entity.
    setLocations(prevLocations => {
      let changed = false;
      const next = prevLocations.map((location) => {
        const legacy = (location as GameLocation & { entity?: string[] }).entity;
        const inEntities = location.entities?.includes(entityId) ?? false;
        const inLegacy = legacy?.includes(entityId) ?? false;
        if (!inEntities && !inLegacy) return location;
        changed = true;
        const cleaned: GameLocation & { entity?: string[] } = { ...location };
        if (inEntities) cleaned.entities = location.entities!.filter((id) => id !== entityId);
        if (inLegacy) cleaned.entity = legacy!.filter((id) => id !== entityId);
        return cleaned;
      });
      return changed ? next : prevLocations;
    });
  }, []);

  const addEntityGroup = useCallback((newGroup: EntityGroup) => {
    setEntityGroups(prev => [...prev, newGroup]);
  }, []);

  const updateEntityGroup = useCallback((updatedGroup: EntityGroup) => {
    setEntityGroups(prev => prev.map(group =>
      group.id === updatedGroup.id ? updatedGroup : group
    ));
  }, []);

  // Removing a group reparents its direct children (subgroups + entities) to the group's own parent,
  // rather than orphaning them under a deleted id.
  const removeEntityGroup = useCallback((groupId: string) => {
    setEntityGroups(prev => {
      const parentId = prev.find(g => g.id === groupId)?.parentId ?? null;
      return prev
        .filter(g => g.id !== groupId)
        .map(g => (g.parentId === groupId ? { ...g, parentId } : g));
    });
    setEntities(prev => {
      const parentId = entityGroups.find(g => g.id === groupId)?.parentId ?? null;
      return prev.map(e => (e.groupId === groupId ? { ...e, groupId: parentId } : e));
    });
  }, [entityGroups]);

  const addPlaceholder = useCallback((newPlaceholder: Placeholder) => {
    setPlaceholders(prev => [...prev, newPlaceholder]);
  }, []);

  const updatePlaceholder = useCallback((updated: Placeholder) => {
    setPlaceholders(prev => prev.map(p => (p.id === updated.id ? updated : p)));
  }, []);

  const removePlaceholder = useCallback((id: string) => {
    setPlaceholders(prev => prev.filter(p => p.id !== id));
  }, []);

  // The world's placeholders as a scoped store, so the same editing widgets can be reused elsewhere
  // (the library editors) against an isolated store.
  const phStore = useMemo(() => placeholderStore(placeholders, setPlaceholders), [placeholders]);

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

  const addTraitGroup = useCallback((newGroup: TraitGroup) => {
    setTraitGroups(prev => [...prev, newGroup]);
  }, []);

  const updateTraitGroup = useCallback((updatedGroup: TraitGroup) => {
    setTraitGroups(prev => prev.map(group =>
      group.id === updatedGroup.id ? updatedGroup : group
    ));
  }, []);

  // Removing a group reparents its direct children (subgroups + traits) to the group's own parent,
  // rather than orphaning them under a deleted id.
  const removeTraitGroup = useCallback((groupId: string) => {
    setTraitGroups(prev => {
      const parentId = prev.find(g => g.id === groupId)?.parentId ?? null;
      return prev
        .filter(g => g.id !== groupId)
        .map(g => (g.parentId === groupId ? { ...g, parentId } : g));
    });
    setTraits(prev => {
      const parentId = traitGroups.find(g => g.id === groupId)?.parentId ?? null;
      return prev.map(t => (t.groupId === groupId ? { ...t, groupId: parentId } : t));
    });
  }, [traitGroups]);

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
      customPlayerVRM: overview.customPlayerVRM || defaultOverview.customPlayerVRM,
      readme: overview.readme || defaultOverview.readme
    };
    // Replace, never merge: a merge lets a field the normalizer doesn't set survive from the previously
    // loaded world, leaking it into this one and into the next saveWorld.
    setWorldOverview(normalizedOverview);

    // Load other data with array validation
    const nextStats = Array.isArray(worldData.stats) ? worldData.stats : [];
    const nextLocations = Array.isArray(worldData.locations) ? worldData.locations : [];
    const nextEntities = Array.isArray(worldData.entities) ? worldData.entities : [];
    const nextEntityGroups = Array.isArray(worldData.entityGroups) ? worldData.entityGroups : [];
    const nextTraits = Array.isArray(worldData.traits) ? worldData.traits : [];
    const nextTraitGroups = Array.isArray(worldData.traitGroups) ? worldData.traitGroups : [];
    const nextStatUpdates = Array.isArray(worldData.statUpdates) ? worldData.statUpdates : [];
    // migrateWorld guarantees ≥1 book; default defensively in case a raw World reaches here another way.
    const nextDictionaries = Array.isArray(worldData.dictionaries) && worldData.dictionaries.length
      ? worldData.dictionaries : [makeDefaultBook()];
    const nextPlaceholders = Array.isArray(worldData.placeholders) ? worldData.placeholders : [];
    setWorldId(worldData.id);
    setStats(nextStats);
    setLocations(nextLocations);
    setEntities(nextEntities);
    setEntityGroups(nextEntityGroups);
    setTraits(nextTraits);
    setTraitGroups(nextTraitGroups);
    setStatUpdates(nextStatUpdates);
    setDictionaries(nextDictionaries);
    setPlaceholders(nextPlaceholders);

    // Baseline for dirty detection: a freshly loaded world has no pending changes.
    setSavedSnapshot(serializeWorld(
      normalizedOverview, nextStats, nextLocations, nextEntities, nextEntityGroups, nextTraits, nextTraitGroups, nextStatUpdates, nextDictionaries, nextPlaceholders,
    ));

    return isDefault;
  }, [setWorldOverview, setStats, setLocations, setEntities, setTraits, setStatUpdates, setDictionaries]);

  const isWorldDirty = useMemo(
    () => serializeWorld(worldOverview, stats, locations, entities, entityGroups, traits, traitGroups, statUpdates, dictionaries, placeholders) !== savedSnapshot,
    [worldOverview, stats, locations, entities, entityGroups, traits, traitGroups, statUpdates, dictionaries, placeholders, savedSnapshot],
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
        // A save means the local copy was edited; flag it dirty and stamp the edit time (sourceId and
        // other sticky fields are preserved by storeWorld).
        dirty: true,
        editedAt: new Date().toISOString(),
        data: { version: APP_VERSION, worldOverview, stats, locations, entities, entityGroups, traits, traitGroups, statUpdates, dictionaries, placeholders },
      });
      setSavedSnapshot(serializeWorld(worldOverview, stats, locations, entities, entityGroups, traits, traitGroups, statUpdates, dictionaries, placeholders));
      return true;
    } catch (error) {
      console.error('Error saving world:', error);
      return false;
    }
  }, [worldId, worldOverview, stats, locations, entities, entityGroups, traits, traitGroups, statUpdates, dictionaries, placeholders]);

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
    entityGroups,
    traits,
    traitGroups,
    statUpdates,
    dictionaries,
    placeholders,
    addStat,
    updateStat,
    removeStat,
    addLocation,
    updateLocation,
    removeLocation,
    addEntity,
    updateEntity,
    removeEntity,
    addEntityGroup,
    updateEntityGroup,
    removeEntityGroup,
    addTrait,
    updateTrait,
    removeTrait,
    addTraitGroup,
    updateTraitGroup,
    removeTraitGroup,
    addStatUpdate,
    updateStatUpdate,
    removeStatUpdate,
    addDictionary,
    updateDictionary,
    removeDictionary,
    addDictionaryEntry,
    updateDictionaryEntry,
    removeDictionaryEntry,
    addPlaceholder,
    updatePlaceholder,
    removePlaceholder,
    setStats,
    setLocations,
    setEntities,
    setEntityGroups,
    setTraits,
    setTraitGroups,
    setStatUpdates,
    setDictionaries,
    setPlaceholders,
    loadWorldData,
    worldId, setWorldId,
    isWorldDirty,
    saveWorld,
    // The scoped dictionary store, forwarded so the provider can bind the editing widgets to the world's books.
    dictStore,
    // Likewise for placeholders, so the same editing widgets bind to the world's placeholders.
    phStore,
  };

  return value;
}

type GameDataContextValue = ReturnType<typeof useProvideGameData>;

const GameDataContext = createContext<GameDataContextValue | null>(null);

/** Access the editor's world-definition store (overview, stats, locations, entities, traits, trait groups,
 *  stat updates, dictionary) plus their CRUD callbacks, load/save, and the `isWorldDirty` flag. Throws
 *  if called outside a `GameDataProvider`. */
// eslint-disable-next-line react-refresh/only-export-components
export const useGameData = () => {
  const context = useContext(GameDataContext);
  if (!context) {
    throw new Error('useGameData must be used within a GameDataProvider');
  }
  return context;
};

/** Provides the world-editor data store (see `useGameData`); on mount it initializes storage and loads
 *  the world-metadata list. */
export const GameDataProvider = ({ children }: { children: ReactNode }) => {
  const value = useProvideGameData();

  return (
    <GameDataContext.Provider value={value}>
      <DictionaryStoreProvider value={value.dictStore}>
        <PlaceholderStoreProvider value={value.phStore}>
          {children}
        </PlaceholderStoreProvider>
      </DictionaryStoreProvider>
    </GameDataContext.Provider>
  );
};
