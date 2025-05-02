import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import WorldStorageService from '../services/WorldStorageService';

const GameDataContext = createContext();

export const useGameData = () => {
  const context = useContext(GameDataContext);
  if (!context) {
    throw new Error('useGameData must be used within a GameDataProvider');
  }
  return context;
};

export const GameDataProvider = ({ children }) => {
  const [worldMetadata, setWorldMetadata] = useState([]);
  const [worldOverview, setWorldOverview] = useState({
    name: '',
    description: '',
    author: '', 
    thumbnail: null, // Base64 encoded string of the image file
    bgm: null, // Base64 encoded string of the audio file
    systemPrompt: '',
    use3DModel: true,
    tags: []
  });
  const [stats, setStats] = useState([]);
  const [locations, setLocations] = useState([]);
  const [entities, setEntities] = useState([]);
  const [traits, setTraits] = useState([]);
  const [statUpdates, setStatUpdates] = useState([]);
  const [worldId, setWorldId] = useState(null);

  const addStat = useCallback((newStat) => {
    const defaultDescriptors = [
      { id: Date.now(), threshold: 30, description: `${newStat.name} is low` },
      { id: Date.now() + 1, threshold: 60, description: `${newStat.name} is medium` },
      { id: Date.now() + 2, threshold: 100, description: `${newStat.name} is high` },
    ];
    const statWithDescriptors = { ...newStat, descriptors: defaultDescriptors };
    setStats(prevStats => [...prevStats, statWithDescriptors]);
  }, []);

  const updateStat = useCallback((updatedStat) => {
    setStats(prevStats => prevStats.map(stat => 
      stat.id === updatedStat.id ? updatedStat : stat
    ));
  }, []);

  const removeStat = useCallback((statId) => {
    setStats(prevStats => prevStats.filter(stat => stat.id !== statId));
  }, []);

  const addLocation = useCallback((newLocation) => {
    setLocations(prevLocations => [...prevLocations, newLocation]);
  }, []);

  const updateLocation = useCallback((updatedLocation) => {
    setLocations(prevLocations => prevLocations.map(location => 
      location.id === updatedLocation.id ? updatedLocation : location
    ));
  }, []);

  const removeLocation = useCallback((locationId) => {
    setLocations(prevLocations => prevLocations.filter(location => location.id !== locationId));
  }, []);

  const addEntity = useCallback((newEntity) => {
    setEntities(prevEntities => [...prevEntities, newEntity]);
  }, []);

  const updateEntity = useCallback((updatedEntity) => {
    setEntities(prevEntities => prevEntities.map(entity => 
      entity.id === updatedEntity.id ? updatedEntity : entity
    ));
  }, []);

  const removeEntity = useCallback((entityId) => {
    setEntities(prevEntities => prevEntities.filter(entity => entity.id !== entityId));
  }, []);

  const addTrait = useCallback((newTrait) => {
    setTraits(prevTraits => [...prevTraits, newTrait]);
  }, []);

  const updateTrait = useCallback((updatedTrait) => {
    setTraits(prevTraits => prevTraits.map(trait => 
      trait.id === updatedTrait.id ? updatedTrait : trait
    ));
  }, []);

  const removeTrait = useCallback((traitId) => {
    setTraits(prevTraits => prevTraits.filter(trait => trait.id !== traitId));
  }, []);

  const addStatUpdate = useCallback((newStatUpdate) => {
    setStatUpdates(prevStatUpdates => [...prevStatUpdates, {
      ...newStatUpdate,
      messageHistory: newStatUpdate.messageHistory || []
    }]);
  }, []);

  const updateStatUpdate = useCallback((updatedStatUpdate) => {
    setStatUpdates(prevStatUpdates => prevStatUpdates.map(statUpdate => 
      statUpdate.id === updatedStatUpdate.id ? {
        ...updatedStatUpdate,
        messageHistory: updatedStatUpdate.messageHistory || statUpdate.messageHistory || []
      } : statUpdate
    ));
  }, []);

  const removeStatUpdate = useCallback((statUpdateId) => {
    setStatUpdates(prevStatUpdates => prevStatUpdates.filter(statUpdate => statUpdate.id !== statUpdateId));
  }, []);

  const updateWorldOverview = useCallback((updates) => {
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

  const loadWorldData = useCallback((worldData, isDefault = false) => {
    const defaultOverview = {
      name: '',
      description: '',
      author: '',
      thumbnail: null,
      bgm: null,
      systemPrompt: '',
      use3DModel: true,
      tags: []
    };
    
    // Handle world overview with validation
    const overview = worldData.worldOverview || defaultOverview;
    updateWorldOverview({
      name: overview.name || defaultOverview.name,
      description: overview.description || defaultOverview.description,
      author: overview.author || defaultOverview.author,
      thumbnail: overview.thumbnail || defaultOverview.thumbnail,
      bgm: overview.bgm || defaultOverview.bgm,
      systemPrompt: overview.systemPrompt || defaultOverview.systemPrompt,
      use3DModel: typeof overview.use3DModel === 'boolean' ? overview.use3DModel : defaultOverview.use3DModel,
      tags: Array.isArray(overview.tags) ? overview.tags : defaultOverview.tags
    });

    // Load other data with array validation
    console.log("setworldId", worldData.id)
    console.log(Object.keys(worldData))
    setWorldId(worldData.id);
    setStats(Array.isArray(worldData.stats) ? worldData.stats : []);
    setLocations(Array.isArray(worldData.locations) ? worldData.locations : []);
    setEntities(Array.isArray(worldData.entities) ? worldData.entities : []);
    setTraits(Array.isArray(worldData.traits) ? worldData.traits : []);
    setStatUpdates(Array.isArray(worldData.statUpdates) ? worldData.statUpdates : []);

    return isDefault;
  }, [updateWorldOverview, setStats, setLocations, setEntities, setTraits, setStatUpdates]);

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
    setStats,
    setLocations,
    setEntities,
    setTraits,
    setStatUpdates,
    loadWorldData,
    worldId, setWorldId
  };

  return (
    <GameDataContext.Provider value={value}>
      {children}
    </GameDataContext.Provider>
  );
};
