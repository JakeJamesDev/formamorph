import React, { createContext, useContext, useState, useRef, useCallback, useEffect } from 'react';
import { saveToDB, loadFromDB } from '../components/modals/dbUtils';
import { toast } from 'react-toastify';
import { convertSaveFile, terminateWorker } from '../lib/saveConversionWorkerUtils';

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
  const [isProcessingStatCode, setIsProcessingStatCode] = useState(false);
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
  const [playerNotes, setPlayerNotes] = useState('');

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

  // Note: flattenNestedGameStates has been moved to a web worker to prevent UI freezing

  const saveCurrentGameState = useCallback(() => {
    // Create a state object without the gameStates array
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
      playerNotes,
      // Add a reference to the previous state index instead of the full array
      previousStateIndex: currentPage > 1 ? currentPage - 2 : null,
      // Add a version flag for backward compatibility
      stateVersion: 2
    };
  }, [playerStats, playerTraits, visibleEntities, logEntries, gameplayText, currentLocation, 
      gameTime, fullMessageHistory, characterData, choices, isGameStarted, playerNotes, currentPage]);

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
      
      // Load notes from the game state or from the latest game state if available
      if (gameState.playerNotes !== undefined) {
        setPlayerNotes(gameState.playerNotes);
      } else if (gameState.gameStates && gameState.gameStates.length > 0) {
        // Find the latest game state with notes
        const latestStateWithNotes = [...gameState.gameStates].reverse().find(state => state && state.playerNotes !== undefined);
        if (latestStateWithNotes) {
          setPlayerNotes(latestStateWithNotes.playerNotes);
        } else {
          setPlayerNotes('');
        }
      } else {
        setPlayerNotes('');
      }

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
      
      // Save the current gameStates array separately from the current state
      const saveObject = {
        currentState: gameState,
        stateHistory: gameStates,
        version: 2 // Add version for migration handling
      };
      
      await saveToDB(saveName, saveObject);
      addLogEntry(`Game saved as "${saveName}"`);
      return true;
    } catch (error) {
      console.error('Error saving game:', error);
      toast.error('Failed to save game');
      addLogEntry('Failed to save game');
      return false;
    }
  }, [saveCurrentGameState, gameStates, addLogEntry]);

  const loadGame = useCallback(async (saveName, locations) => {
    try {
      const savedData = await loadFromDB(saveName);
      
      if (!savedData) {
        addLogEntry('No save data found');
        return false;
      }

      // Check if this is a new format save (version 2)
      if (savedData.version === 2 && savedData.currentState && savedData.stateHistory) {
        // Load the current state
        const success = loadGameState(savedData.currentState, locations);
        if (success) {
          // Load the state history
          setGameStates(savedData.stateHistory);
          addLogEntry(`Game loaded from "${saveName}"`);
        }
        return success;
      } 
      // Handle legacy format (version 1 or unversioned)
      else {
        try {
          // Show a loading toast for large save files
          const loadingToastId = toast.info('Processing save file...', {
            position: "top-right",
            autoClose: false,
            hideProgressBar: false,
            closeOnClick: false,
            pauseOnHover: true,
            draggable: false,
            progress: undefined,
          });
          
          // Use web worker to convert old save format to prevent UI freezing
          const { convertedData, flattenedStates } = await convertSaveFile(savedData);
          
          // Close the loading toast
          toast.dismiss(loadingToastId);
          
          // If we have flattened states, use them
          if (flattenedStates && flattenedStates.length > 0) {
            setGameStates(flattenedStates);
            
            // Show toast message for successful conversion
            toast.success('Old save format converted to new format successfully', {
              position: "top-right",
              autoClose: 3000,
              hideProgressBar: false,
              closeOnClick: true,
              pauseOnHover: true,
              draggable: true
            });
            
            addLogEntry('Old save format converted to new format successfully');
          }
          
          const success = loadGameState(convertedData, locations);
          if (success) {
            addLogEntry(`Game loaded from "${saveName}"`);
          }
          return success;
        } catch (error) {
          console.error('Error converting old save format:', error);
          toast.error('Failed to convert old save format. Some features may not work correctly.', {
            position: "top-right",
            autoClose: 5000,
            hideProgressBar: false,
            closeOnClick: true,
            pauseOnHover: true,
            draggable: true
          });
          
          addLogEntry('Failed to convert old save format');
          
          // Try to load the save anyway
          try {
            const success = loadGameState(savedData, locations);
            if (success) {
              addLogEntry(`Game loaded from "${saveName}" (with conversion errors)`);
            }
            return success;
          } catch (loadError) {
            console.error('Error loading game after conversion failure:', loadError);
            toast.error('Failed to load game');
            addLogEntry('Failed to load game');
            return false;
          }
        }
      }
    } catch (error) {
      console.error('Error loading game:', error);
      toast.error('Failed to load game');
      addLogEntry('Failed to load game');
      return false;
    }
  }, [loadGameState, addLogEntry]);

  // Cleanup web worker when component unmounts
  useEffect(() => {
    return () => {
      // Terminate the web worker when the component unmounts
      terminateWorker();
    };
  }, []);

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
    playerNotes,
    setPlayerNotes,
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
