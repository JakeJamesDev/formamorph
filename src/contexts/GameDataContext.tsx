import { randomUUID } from "@/lib/uuid";
import { createContext, useContext, useState, useCallback, useMemo, useEffect, useRef, type ReactNode } from 'react';
import WorldStorageService from '../services/WorldStorageService';
import { canonicalStringify } from '@/lib/canonicalStringify';
import { migrateWorld, APP_VERSION } from '@/lib/version';
import { dropLocationFromEntities } from '@/lib/entityPresence';
import { dropLocationFromConnections } from '@/lib/locationGraph';
import { newLocationPosition } from '@/lib/locationCanvas';
import { renamedPlaceholderValues, repinRenamedValues } from '@/lib/traitEffects';
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
  Connection,
  Dictionary,
  Placeholder,
  World,
} from '@/types';

/** A fresh, empty "Default" book — the ≥1-book invariant's seed. */
const makeDefaultBook = (): Dictionary => ({ id: randomUUID(), name: 'Default', enabled: true, entries: [] });

// The canonical world payload: the single field list every serialize/save/export path shares. Add a new
// world field here and it flows to dirty-detection, save, and download at once.
function buildWorldData(
  overview: WorldOverview,
  stats: Stat[],
  locations: GameLocation[],
  connections: Connection[],
  entities: Entity[],
  entityGroups: EntityGroup[],
  traits: Trait[],
  traitGroups: TraitGroup[],
  statUpdates: StatUpdate[],
  dictionaries: Dictionary[],
  placeholders: Placeholder[],
): Omit<World, 'id' | 'version'> {
  return { worldOverview: overview, stats, locations, connections, entities, entityGroups, traits, traitGroups, statUpdates, dictionaries, placeholders };
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
  const [connections, setConnections] = useState<Connection[]>([]);
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

  // A new location is given a place on the canvas as it is created, wherever it was created from: the map is
  // manual-first, so one arriving without a position of its own would sit wherever the fallback left it.
  const addLocation = useCallback((newLocation: GameLocation) => {
    setLocations(prevLocations => [...prevLocations, {
      ...newLocation,
      canvasPosition: newLocation.canvasPosition
        ?? newLocationPosition(prevLocations, newLocation.parentId ?? null),
    }]);
  }, []);

  const updateLocation = useCallback((updatedLocation: GameLocation) => {
    setLocations(prevLocations => prevLocations.map(location =>
      location.id === updatedLocation.id ? updatedLocation : location
    ));
  }, []);

  const removeLocation = useCallback((locationId: string) => {
    setLocations(prevLocations => prevLocations.filter(location => location.id !== locationId));
    // Membership is entity-owned, so a deleted location would otherwise stay listed on everyone who
    // belonged to it — invisible in every roster, but riding along into the exported world forever.
    setEntities(prevEntities => dropLocationFromEntities(locationId, prevEntities));
    // Same for its Connections: a record with one dead endpoint links nothing and can never be edited away,
    // since neither the list nor the canvas has an end to select it by.
    setConnections(prevConnections => dropLocationFromConnections(locationId, prevConnections));
  }, []);

  const addConnection = useCallback((newConnection: Connection) => {
    setConnections(prevConnections => [...prevConnections, newConnection]);
  }, []);

  const updateConnection = useCallback((updatedConnection: Connection) => {
    setConnections(prevConnections => prevConnections.map(connection =>
      connection.id === updatedConnection.id ? updatedConnection : connection
    ));
  }, []);

  const removeConnection = useCallback((connectionId: string) => {
    setConnections(prevConnections => prevConnections.filter(connection => connection.id !== connectionId));
  }, []);

  const addEntity = useCallback((newEntity: Entity) => {
    setEntities(prevEntities => [...prevEntities, newEntity]);
  }, []);

  const updateEntity = useCallback((updatedEntity: Entity) => {
    setEntities(prevEntities => prevEntities.map(entity =>
      entity.id === updatedEntity.id ? updatedEntity : entity
    ));
  }, []);

  // Membership rides on the entity itself, so deleting it takes every location link with it — no
  // location-side cleanup to do.
  const removeEntity = useCallback((entityId: string) => {
    setEntities(prevEntities => prevEntities.filter(entity => entity.id !== entityId));
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

  // Renaming a value carries the trait pins that targeted it, so vocabulary cleanup is one field edit
  // rather than a hunt through every trait. Pins are keyed by value string, so nothing else links them.
  const updatePlaceholder = useCallback((updated: Placeholder) => {
    const before = placeholders.find(p => p.id === updated.id);
    setPlaceholders(prev => prev.map(p => (p.id === updated.id ? updated : p)));
    if (!before) return;
    const renames = renamedPlaceholderValues(before.values ?? [], updated.values ?? []);
    if (renames.length) setTraits(prev => repinRenamedValues(prev, updated.id, renames));
  }, [placeholders]);

  const removePlaceholder = useCallback((id: string) => {
    setPlaceholders(prev => prev.filter(p => p.id !== id));
  }, []);

  // The world's placeholders as a scoped store, so the same editing widgets can be reused elsewhere
  // (the library editors) against an isolated store. The world's own update path replaces the generic
  // one so the editing widgets get the pin sweep too; a library item has no traits and needs none.
  const phStore = useMemo(
    () => ({ ...placeholderStore(placeholders, setPlaceholders), updatePlaceholder }),
    [placeholders, updatePlaceholder],
  );

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

  // Returns the migrated world so a caller that also needs the loaded data (e.g. to seed a cross-world save
  // load, or to cache it for later reuse) uses the current-shape version rather than the raw input — which
  // would otherwise bypass the migration this function just applied.
  const loadWorldData = useCallback((rawWorldData: World, isDefault = false): { world: World; isDefault: boolean } => {
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
      readme: overview.readme || defaultOverview.readme,
      introReadme: overview.introReadme || defaultOverview.introReadme,
      // Allowlisted like everything above — omitting it here would silently drop a world's authored
      // narration prompt on load, and the next saveWorld would write the loss back to disk.
      ...(overview.promptOverrides ? { promptOverrides: overview.promptOverrides } : {}),
      // Same allowlist rule. The flag is spread only when it is actually a boolean: absent means "applied
      // if there is text", which is not the same as `false`.
      ...(typeof overview.openingCue === 'string' ? { openingCue: overview.openingCue } : {}),
      ...(typeof overview.openingCueEnabled === 'boolean'
        ? { openingCueEnabled: overview.openingCueEnabled }
        : {})
    };
    // Replace, never merge: a merge lets a field the normalizer doesn't set survive from the previously
    // loaded world, leaking it into this one and into the next saveWorld.
    setWorldOverview(normalizedOverview);

    // Load other data with array validation
    const nextStats = Array.isArray(worldData.stats) ? worldData.stats : [];
    const nextLocations = Array.isArray(worldData.locations) ? worldData.locations : [];
    const nextConnections = Array.isArray(worldData.connections) ? worldData.connections : [];
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
    setConnections(nextConnections);
    setEntities(nextEntities);
    setEntityGroups(nextEntityGroups);
    setTraits(nextTraits);
    setTraitGroups(nextTraitGroups);
    setStatUpdates(nextStatUpdates);
    setDictionaries(nextDictionaries);
    setPlaceholders(nextPlaceholders);

    // Baseline for dirty detection: a freshly loaded world has no pending changes.
    setSavedSnapshot(JSON.stringify(buildWorldData(
      normalizedOverview, nextStats, nextLocations, nextConnections, nextEntities, nextEntityGroups, nextTraits, nextTraitGroups, nextStatUpdates, nextDictionaries, nextPlaceholders,
    )));

    return { world: worldData, isDefault };
  }, [setWorldOverview, setStats, setLocations, setEntities, setTraits, setStatUpdates, setDictionaries]);

  // The current editor state as a canonical world payload; the one source consumers serialize/save/export from.
  const getWorldData = useCallback(
    () => buildWorldData(worldOverview, stats, locations, connections, entities, entityGroups, traits, traitGroups, statUpdates, dictionaries, placeholders),
    [worldOverview, stats, locations, connections, entities, entityGroups, traits, traitGroups, statUpdates, dictionaries, placeholders],
  );

  // Per-keystroke dirty check over image-heavy world data: canonicalStringify caches by identity, so an
  // edit re-serializes only that record and its ancestors and the base64 elsewhere is left alone.
  //
  // Both sides go through the same canonical form rather than raw JSON, because raw JSON called a world
  // changed over things no author did: a record rebuilt with its keys in another order, and an optional
  // field that keeps an empty `[]` once it has been filled in and cleared again.
  const stringifyCache = useRef(new WeakMap<object, string>());
  // Derived from the stored snapshot rather than captured beside it, so the baseline cannot be built by a
  // different route than the value it is compared against. Recomputed only on load and save.
  const savedCanonical = useMemo(
    () => (savedSnapshot ? canonicalStringify(JSON.parse(savedSnapshot), new WeakMap()) : ''),
    [savedSnapshot],
  );
  const isWorldDirty = useMemo(
    () => !!savedSnapshot && canonicalStringify(getWorldData(), stringifyCache.current) !== savedCanonical,
    [getWorldData, savedCanonical, savedSnapshot],
  );

  /**
   * Drop every pending edit and restore the last saved (or freshly loaded) world.
   *
   * The editor's managers write straight through to this store as you type, so "exit without saving" has
   * nothing of its own to roll back — the only record of the pre-edit world is `savedSnapshot`, and reloading
   * from it is the revert. `loadWorldData` re-baselines the snapshot, so `isWorldDirty` clears as a side effect.
   */
  const discardChanges = useCallback(() => {
    // No baseline means nothing has been loaded yet; there is no state worth restoring.
    if (!savedSnapshot) return;
    // The snapshot is `buildWorldData` output — `Omit<World, 'id' | 'version'>` — so the id has to go back on.
    loadWorldData({ ...JSON.parse(savedSnapshot), id: worldId ?? '' } as World);
  }, [savedSnapshot, worldId, loadWorldData]);

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
        data: { version: APP_VERSION, ...getWorldData() },
      });
      setSavedSnapshot(JSON.stringify(getWorldData()));
      return true;
    } catch (error) {
      console.error('Error saving world:', error);
      return false;
    }
  }, [worldId, worldOverview, getWorldData]);

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
    connections,
    entities,
    entityGroups,
    traits,
    traitGroups,
    statUpdates,
    dictionaries,
    placeholders,
    getWorldData,
    addStat,
    updateStat,
    removeStat,
    addLocation,
    updateLocation,
    removeLocation,
    addConnection,
    updateConnection,
    removeConnection,
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
    setConnections,
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
    discardChanges,
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
