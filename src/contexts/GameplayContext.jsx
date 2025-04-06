import React, { createContext, useContext, useState, useRef, useCallback } from 'react';
import { saveToDB, loadFromDB } from '../components/modals/dbUtils';
import { toast } from 'react-toastify';

const GameplayContext = createContext();

export const useGameplay = () => {
  const context = useContext(GameplayContext);
  if (!context) {
    throw new Error('useGameplay must be used within a GameplayProvider');
  }
  return context;
};

export const GameplayProvider = ({ children }) => {
  const [characterData, setCharacterData] = useState(null);
  const [visibleEntities, setVisibleEntities] = useState([]);
  const [logEntries, setLogEntries] = useState([]);
  const [gameTime, setGameTime] = useState(0);
  const [currentLocation, setCurrentLocation] = useState(null);
  const [playerStats, setPlayerStats] = useState([]);
  const [playerTraits, setPlayerTraits] = useState([]);
  const [recentStatChanges, setRecentStatChanges] = useState({});
  const [activeTab, setActiveTab] = useState("stats");
  const [stomachPercent, setStomachPercent] = useState(0);
  const [fatnessPercent, setFatnessPercent] = useState(0);
  const [breastsizePercent, setBreastsizePercent] = useState(0);
  const [gameplayText, setGameplayText] = useState("");
  const [isFlashing, setIsFlashing] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [ttsAudio, setTTSAudio] = useState(null);
  const [choices, setChoices] = useState([]);
  const [isGameStarted, setIsGameStarted] = useState(false);
  const [playerInput, setPlayerInput] = useState('');
  const [isWaitingForAI, setIsWaitingForAI] = useState(false);
  const [fullMessageHistory, setFullMessageHistory] = useState([]);
  const [displayedMessages, setDisplayedMessages] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [gameStates, setGameStates] = useState([]);

  const logsEndRef = useRef(null);

  const addLogEntry = useCallback((entry) => {
    setLogEntries(prevEntries => {
      if (prevEntries.length > 0 && prevEntries[prevEntries.length - 1].text === entry) {
        // If the new entry matches the last entry, increment its repeat count
        const updatedEntries = [...prevEntries];
        const lastEntry = updatedEntries[updatedEntries.length - 1];
        lastEntry.repeat = (lastEntry.repeat || 0) + 1;
        return updatedEntries;
      } else {
        // Otherwise, add a new entry with game time
        return [...prevEntries, { 
          text: entry, 
          gameTime: gameTime,
          repeat: 0
        }];
      }
    });
  }, [gameTime]);

  const changeLocation = useCallback((newLocation) => {
    setCurrentLocation(newLocation);
    addLogEntry(`Entered new location: ${newLocation.name}`);
  }, [addLogEntry]);

  const saveCurrentGameState = useCallback(() => {
    return {
      playerStats,
      playerTraits,
      visibleEntities,
      logEntries,
      gameplayText,
      locationId: currentLocation?.id,
      gameTime,
      fullMessageHistory,
      characterData,
      choices,
      isGameStarted,
      timestamp: new Date().toISOString(),
      worldName: null, // Will be set by GameViewer when saving
      gameStates // Include gameStates array for rollback feature
    };
  }, [playerStats, playerTraits, visibleEntities, logEntries, gameplayText, currentLocation, 
      gameTime, fullMessageHistory, characterData, choices, isGameStarted, gameStates]);

  const loadGameState = useCallback((gameState, locations) => {
    try {
      // Restore all state
      setPlayerStats(gameState.playerStats);
      setPlayerTraits(gameState.playerTraits);
      setVisibleEntities(gameState.visibleEntities);
      setLogEntries(gameState.logEntries);
      setGameplayText(gameState.gameplayText);
      setGameTime(gameState.gameTime);
      setFullMessageHistory(gameState.fullMessageHistory);
      setCharacterData(gameState.characterData);
      setChoices(gameState.choices);
      setIsGameStarted(gameState.isGameStarted);

      // Restore gameStates array for rollback feature
      if (gameState.gameStates) {
        setGameStates(gameState.gameStates);
      }

      // Handle location separately since we need to find the full location object
      if (gameState.locationId && locations) {
        const fullLocation = locations.find(loc => loc.id === gameState.locationId);
        if (fullLocation) {
          setCurrentLocation(fullLocation);
        }
      }
      
      return true;
    } catch (error) {
      console.error('Error loading game state:', error);
      toast.error('Failed to load game state');
      addLogEntry('Failed to load game state');
      return false;
    }
  }, [addLogEntry]);

  const saveGame = useCallback(async (saveName, worldName) => {
    try {
      const gameState = saveCurrentGameState();
      gameState.worldName = worldName;
      await saveToDB(saveName, gameState);
      addLogEntry(`Game saved as "${saveName}"`);
      return true;
    } catch (error) {
      console.error('Error saving game:', error);
      toast.error('Failed to save game');
      addLogEntry('Failed to save game');
      return false;
    }
  }, [saveCurrentGameState, addLogEntry]);

  const loadGame = useCallback(async (saveName, locations) => {
    try {
      const savedState = await loadFromDB(saveName);
      
      if (!savedState) {
        addLogEntry('No save data found');
        return false;
      }

      const success = loadGameState(savedState, locations);
      if (success) {
        addLogEntry(`Game loaded from "${saveName}"`);
      }
      return success;
    } catch (error) {
      console.error('Error loading game:', error);
      toast.error('Failed to load game');
      addLogEntry('Failed to load game');
      return false;
    }
  }, [loadGameState, addLogEntry]);

  const value = {
    characterData,
    setCharacterData,
    stomachPercent,
    setStomachPercent,
    fatnessPercent,
    setFatnessPercent,
    breastsizePercent,
    setBreastsizePercent,
    visibleEntities,
    setVisibleEntities,
    logEntries,
    setLogEntries,
    addLogEntry,
    gameTime,
    setGameTime,
    currentLocation,
    setCurrentLocation,
    changeLocation,
    playerStats,
    setPlayerStats,
    playerTraits,
    setPlayerTraits,
    recentStatChanges,
    setRecentStatChanges,
    activeTab,
    setActiveTab,
    logsEndRef,
    gameplayText,
    setGameplayText,
    isFlashing,
    setIsFlashing,
    isEditMode,
    setIsEditMode,
    ttsAudio,
    setTTSAudio,
    choices,
    setChoices,
    isGameStarted,
    setIsGameStarted,
    playerInput,
    setPlayerInput,
    isWaitingForAI,
    setIsWaitingForAI,
    fullMessageHistory,
    setFullMessageHistory,
    displayedMessages,
    setDisplayedMessages,
    currentPage,
    setCurrentPage,
    gameStates,
    setGameStates,
    saveGame,
    loadGame,
    saveCurrentGameState,
    loadGameState
  };

  return (
    <GameplayContext.Provider value={value}>
      {children}
    </GameplayContext.Provider>
  );
};
