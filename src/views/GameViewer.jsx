import React, { useState, useEffect, useCallback, useRef  } from 'react';
import { useGameData } from '../contexts/GameDataContext';
import { useSettings, DEFAULT_ENDPOINT } from '@/contexts/SettingsContext';
import { useGameplay, GameplayProvider } from '@/contexts/GameplayContext';
import { Button } from "@/components/ui/button";
import { Menu, Music } from "lucide-react";
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import TTSModal from '../components/game/TTSModal';
import { EntityModal } from '../components/modals/EntityModal';
import { LocationModal } from '../components/modals/LocationModal';
import { SettingsModal } from '../components/modals/SettingsModal';
import { MenuModal } from '../components/modals/MenuModal';
import { LeftPanel, MiddlePanel, RightPanel } from '../components/game/GamePanels';
import { getModelType } from '../lib/UtilityComponents';
import { ConfirmDialog } from '../components/ConfirmDialog';
import json5 from 'json5';

// Debug utility function - only logs on error
const debugLog = (message, data, isError = false) => {
  return; //DISABLED
  if (isError) {
    console.error(`[DEBUG] ${message}:`, data);
  }
};

const GameViewer = ({ initialTraits = [], initialCharacterData, onExitToMenu }) => {
  const { 
    stats, locations, entities, traits, statUpdates,
    updateStat, worldOverview 
  } = useGameData();

  const {
    bgmEnabled,
    setBgmEnabled,
    language,
    setLanguage,
    shortform,
    endpointUrl,
    apiToken,
    modelName,
    maxTokens,
    aiMessageLimit,
    systemPrompt,
    choicesPrompt,
    statUpdatesPrompt,
  } = useSettings();

  const {
    characterData,
    setCharacterData,
    visibleEntities,
    setVisibleEntities,
    currentLocation,
    setCurrentLocation,
    playerStats,
    setPlayerStats,
    playerTraits,
    setPlayerTraits,
    setRecentStatChanges,
    addLogEntry,
    logEntries,
    setLogEntries,
    gameTime,
    setGameTime,
    logsEndRef,
    gameplayText,
    setGameplayText,
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
    setStomachPercent,
    fatnessPercent,
    setFatnessPercent,
    breastsizePercent,
    setBreastsizePercent,
    saveGame,
    loadGame,
    saveCurrentGameState,
    loadGameState
  } = useGameplay();

  useEffect(() => {
    setCharacterData(initialCharacterData);
  }, [initialCharacterData, setCharacterData]);

  // Function to extract entity names from text
  const extractEntities = useCallback((text) => {
    if (!text || !entities) return [];
    
    // Create a Set to store unique entities
    const foundEntities = new Set();
    const lowerText = text.toLowerCase();
    
    // For each entity, check if its name appears in the text
    entities.forEach(entity => {
      // Get base name (singular form)
      const baseName = entity.name.toLowerCase();
      
      // Create regex that matches the entity name, ignoring case and potential plural 's'
      const regex = new RegExp(`\\b${baseName}(?:s)?\\b`, 'i');
      
      if (regex.test(text)) {
        foundEntities.add(entity.name);
      } else {
        // If no exact match, try loose word matching for multi-word entity names
        const words = baseName.split(' ');
        if (words.length > 1) {
          // Check if all words from the entity name appear in the text
          const allWordsPresent = words.every(word => 
            // Check for word with optional 's' at the end
            new RegExp(`\\b${word}(?:s)?\\b`, 'i').test(text)
          );
          
          if (allWordsPresent) {
            foundEntities.add(entity.name);
          }
        }
      }
    });
    
    return Array.from(foundEntities);
  }, [entities]);
  const [isTTSModalOpen, setIsTTSModalOpen] = useState(false);
  const [error, setError] = useState(null);
  const [selectedEntity, setSelectedEntity] = useState(null);
  const [isEntityModalOpen, setIsEntityModalOpen] = useState(false);
  const [ambientSound, setAmbientSound] = useState(null);
  const [isMenuOpen, setIsMenuOpen ] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [showPotatoPCDialog, setShowPotatoPCDialog] = useState(false);
  const [isLocationModalOpen, setIsLocationModalOpen] = useState(false);


  const getStatByName = useCallback((name) => {
    return playerStats.find(stat => stat.name === name);
  }, [playerStats]);

  const setStatByName = useCallback((name, value) => {
    setPlayerStats(prevStats => prevStats.map(stat => 
      stat.name === name ? { ...stat, value: Math.max(stat.min, Math.min(stat.max, value)) } : stat
    ));
  }, []);
  const messagesPerPage = 2; // One AI message + one user message

  const handleRollback = () => {
    if (currentPage < totalPages) {
      const targetState = gameStates[currentPage - 1];
      if (targetState) {
        // Use existing loadGameState function to restore state
        const success = loadGameState(targetState, locations);
        if (success) {
          // Remove states after current page
          setGameStates(prevStates => prevStates.slice(0, currentPage));
          addLogEntry('Rolled back to previous game state');
        }
      }
    }
  };
  const addMessageToHistory = useCallback((role, content) => {
    setFullMessageHistory(prev => [...prev, { role, content }]);
  }, []);

  const getTrimmedMessageHistory = useCallback(() => {
    let trimmedHistory = [];
    let currentLength = 0;
    
    // Start from most recent messages and work backwards
    for (let i = fullMessageHistory.length - 1; i >= 1; i -= 2) {
      const assistantMessage = fullMessageHistory[i];
      const userMessage = fullMessageHistory[i - 1];
      
      // Skip if either message is missing
      if (!assistantMessage || !userMessage) continue;
      
      // Parse assistant message to get only game_text
      let assistantGameText;
      try {
        const parsed = json5.parse(assistantMessage.content);
        assistantGameText = {
          role: 'assistant',
          content: parsed.game_text
        };
      } catch (error) {
        continue; // Skip if parsing fails
      }
      
      const messagePair = JSON.stringify([userMessage, assistantGameText]);
      const pairLength = messagePair.length;
      
      // Check if adding this pair would exceed the limit
      if (currentLength + pairLength <= aiMessageLimit) {
        trimmedHistory = [userMessage, assistantGameText, ...trimmedHistory];
        currentLength += pairLength;
      } else {
        break;
      }
    }
    
    return trimmedHistory;
  }, [fullMessageHistory, aiMessageLimit]);

  const testMessage = [
    { role: 'user', content: 'Write a sample response with correct formatting.' },
    { role: 'assistant', content: `{"game_text":"A single paragraph of game events.","choices":["run away", "come closer"],"visible_entity":["creature name"],"stat_changes":[{"Health":-1}],"hour_passed": 2}`}
  ];

  // Function to calculate percentage of a stat
  const calculateFIXEDStatPercentage = (stat) => {
    //return ((stat.value - stat.min) / (stat.max - stat.min));
    return stat.value/100;
  };

  useEffect(() => {
    if (characterData) {
      const stomach = playerStats.find(stat => stat.name === 'Stomach');
      const fatness = playerStats.find(stat => stat.name === 'Fatness');
      const breastsize = playerStats.find(stat => stat.name === 'Breastsize');

      //these stats CAN exceed 100%
      if (stomach) setStomachPercent(calculateFIXEDStatPercentage(stomach));
      if (fatness) setFatnessPercent(calculateFIXEDStatPercentage(fatness));
      if (breastsize) setBreastsizePercent(calculateFIXEDStatPercentage(breastsize));
      
    }
  }, [playerStats, characterData]);

  const handleTimePassed = useCallback((hours) => {
    setGameTime(prevTime => prevTime + hours);
    
    // Track regen changes
    const regenChanges = {};

    setPlayerStats(prevStats => prevStats.map(stat => {
      if (stat.regen) {
        const baseRegenAmount = stat.regen * hours;
        const newValue = Math.max(stat.min, Math.min(stat.max, stat.value + baseRegenAmount));
        
        // Calculate the actual change that occurred
        const actualRegenAmount = newValue - stat.value;
        
        if (actualRegenAmount !== 0) {
          regenChanges[stat.name.toLowerCase()] = actualRegenAmount;
        }
        
        return { ...stat, value: newValue };
      }
      return stat;
    }));

    // Update recent stat changes with regen changes
    setRecentStatChanges(prev => {
      const newChanges = { ...prev };
      Object.entries(regenChanges).forEach(([key, value]) => {
        newChanges[key] = (newChanges[key] || 0) + value;
      });
      return newChanges;
    });

    const health = getStatByName('Health');
    const hunger = getStatByName('Hunger');
    if (health && hunger) {
      if (hunger.value <= 20) {
        const healthLoss = 5 * hours;
        setStatByName('Health', health.value - healthLoss);
        addLogEntry(`You're starving! Lost ${healthLoss} health.`);
        // Add health loss to recent changes
        setRecentStatChanges(prev => ({
          ...prev,
          health: (prev.health || 0) - healthLoss
        }));
      }
    }
  }, [getStatByName, setStatByName, addLogEntry]);

  function safeJsonParse(input) {
    try {
      // Attempt to parse with json5, which is more lenient
      return json5.parse(input);
    } catch (json5Error) {
      debugLog('Failed to parse input with JSON5', json5Error, true);
      debugLog('Problematic input', input, true);
      addLogEntry('Failed to parse AI response, retrying...');
      throw new Error('Unable to parse input');
    }
  }

  const getEndpointUrl = () => {
     // Apply load balancing for default endpoint
     let requestEndpoint = endpointUrl;
     if (endpointUrl === DEFAULT_ENDPOINT) {
      const rand = Math.random();
      if (rand < 0.25) {
        requestEndpoint = endpointUrl.replace('mistral', 'mistral3');
      } else if (rand < 0.5) {
        requestEndpoint = endpointUrl.replace('mistral', 'mistral4');
      } else {
        requestEndpoint = endpointUrl.replace('mistral', 'mistral5');
      }
    }

     return requestEndpoint;
  }

  const handleSettingsSave = () => {
    setIsSettingsOpen(false);
  };

  const generateTraitDescriptions = useCallback(() => {
    if (!playerTraits.length) {
        return '<NO TRAITS AVAILABLE>';
    }
    return playerTraits.map(trait => `${trait.name}: ${trait.description}`).join('\n');
  }, [playerTraits]);

  const generateStatDescriptions = useCallback(() => {
    return playerStats.map(stat => {
      const percentage = ((stat.value - stat.min) / (stat.max - stat.min)) * 100;
      const descriptor = stat.descriptors.find(d => percentage <= d.threshold);
      return `${stat.name}: ${stat.value}/${stat.max} (${descriptor ? descriptor.description : 'Unknown'})`;
    }).join('\n');
  }, [playerStats]);

  const sendGameAction = async (action) => {
    if (!isGameStarted && action !== "START GAME") return;
  
  const sanitizeLocationData = (location) => {
      if (!location) return '';
      
      const { backgroundImage, ambientSound, id, inGameDescription, detailedDescription, entity, entities: locationEntities, ...otherProps } = location;
      
      // Start with name and description
      let output = `name: ${location.name}\n`;
      output += `description: ${detailedDescription}\n`;
      
      // Add other location properties (excluding special ones we handled)
      Object.entries(otherProps).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          output += `${key}: ${value}\n`;
        }
      });
      
      // Add entities last
      const entityList = locationEntities || entity || [];
      if (entityList.length > 0) {
        output += 'entities:\n';
        entityList.forEach(entityId => {
          const entityItem = entities.find(f => f.id === entityId);
          if (entityItem) {
            const { id, image, sound, model, inGameDescription, detailedDescription, ...entityProps } = entityItem;
            output += `  - name: ${entityItem.name}\n`;
            output += `    description: ${detailedDescription}\n`;
            // Add other entity properties
            Object.entries(entityProps).forEach(([key, value]) => {
              if (value !== undefined && value !== null && key !== 'name') {
                output += `    ${key}: ${value}\n`;
              }
            });
          }
        });
      }
      
      return output;
    };
  
    const locationDataString = sanitizeLocationData(currentLocation);

    const statDescriptions = generateStatDescriptions();

    let updatedPrompt = systemPrompt
      .replace('<WORLD DESCRIPTION>', worldOverview.systemPrompt || '')
      .replace('<LOCATION JSON DATA>', locationDataString)
      .replace('<STATS DESCRIPTION>', statDescriptions)
      .replace('<TRAITS DESCRIPTION>', generateTraitDescriptions());
      setIsWaitingForAI(true);

    if (language.toLowerCase() != 'english')
        updatedPrompt += `\n Narration language: ` + language;

      // Get trimmed history before adding new action
      const trimmedHistory = getTrimmedMessageHistory(action);
    
    try {
      setChoices([]);
      
      // Create message array for game text request
      const gameTextMessages = [
        ...trimmedHistory,
        { role: 'user', content: `Player action: ${action}` }
      ];
      
      // Add user message to history after getting trimmed history
      addMessageToHistory('user', action);
      
      // Get game text first since choices and stat updates depend on it
      const gameTextResponse = await makeAIRequest(
        updatedPrompt,
        gameTextMessages,
        'gametext'
      );
      
      if (!gameTextResponse) {
        throw new Error('Received null or empty game text from AI');
      }


      // Make choices and stat updates requests concurrently since they both only depend on game text
      let updatedChoicesPrompt = choicesPrompt
        .replace('<WORLD DESCRIPTION>', worldOverview.systemPrompt || '')
        .replace('<STATS DESCRIPTION>', statDescriptions)
        .replace('<LOCATION JSON DATA>', locationDataString)
        .replace('<TRAITS DESCRIPTION>', generateTraitDescriptions());
      
        if (language.toLowerCase() != 'english')
          updatedChoicesPrompt += `\n Choice language: ` + language;

      let updatedStatUpdatesPrompt = statUpdatesPrompt
      .replace('<WORLD DESCRIPTION>', worldOverview.systemPrompt || '')
      .replace('<LOCATION JSON DATA>', locationDataString)
      .replace('<STATS DESCRIPTION>', statDescriptions)
      .replace('<TRAITS DESCRIPTION>', generateTraitDescriptions());

      if (language.toLowerCase() != 'english')
        updatedStatUpdatesPrompt += '\n Please write in english';

      const [choicesResponse, statUpdatesResponse] = await Promise.all([
        makeAIRequest(
          updatedChoicesPrompt,
          [{ role: 'user', content: `Game text: ${gameTextResponse}` }],
          'choices'
        ),
        makeAIRequest(
          updatedStatUpdatesPrompt.replace('<STATS DESCRIPTION>', statDescriptions),
          [{ role: 'user', content: `Game events: ${gameTextResponse}` }],
          'statUpdates'
        )
      ]);

      // Parse choices (line-separated)
      const choicesList = choicesResponse.split('\n').filter(choice => choice.trim());
      setChoices(choicesList);

      // Update visible entities based on game text
      const newEntities = extractEntities(gameTextResponse);
      setVisibleEntities(newEntities);

      // Parse stat updates (key: value pairs)
      const statChanges = [];
      statUpdatesResponse.split('\n').forEach(line => {
        const [key, valueWithComment] = line.split(':').map(s => s.trim());
        if (key && valueWithComment) {
          // Extract the first signed number from the value part
          const match = valueWithComment.match(/[+-]?\d+/);
          if (match) {
            const value = parseInt(match[0]);
            if (!isNaN(value)) {
              // Check if 'MAX' appears after the number
              const isMaxUpdate = valueWithComment.slice(match.index + match[0].length).toUpperCase().includes('MAX');
              if (isMaxUpdate) {
                // Update the stat's max value
                setPlayerStats(prevStats => prevStats.map(stat => 
                  stat.name.toLowerCase() === key.toLowerCase() 
                    ? { ...stat, max: stat.max + value } 
                    : stat
                ));
              } else {
                // Update the stat's current value
                statChanges.push({ [key]: value });
              }
            }
          }
        }
      });

      // Update final assistant message with complete data
      setFullMessageHistory(prev => {
        const updatedHistory = [...prev];
        if (updatedHistory.length > 0 && updatedHistory[updatedHistory.length - 1].role === 'assistant') {
          updatedHistory[updatedHistory.length - 1] = {
            role: 'assistant',
            content: JSON.stringify({
              game_text: gameTextResponse,
              choices: choicesList,
              stat_changes: statChanges
            })
          };
        }
        return updatedHistory;
      });
      
      // Save game state after successful action
      const newState = saveCurrentGameState();
      setGameStates(prevStates => {
        const newStates = [...prevStates];
        // Store state at the current page index
        const pageIndex = Math.ceil(fullMessageHistory.length / messagesPerPage) - 1;
        newStates[pageIndex] = newState;
        return newStates;
      });

      //setGameplayText(aiResponse.game_text);
      //setChoices(aiResponse.choices || []);

      // Apply stat changes
      if (statChanges.length > 0) {
        applyStatChanges(statChanges);
      }

      // Default 1 hour passed per action
      handleTimePassed(1);

  
      // Process additional stat updates
      //Currently disabled
      if (false){
      const updatePromises = statUpdates.map(statUpdate => 
        makeAIRequest(
          statUpdate.prompt,
          [
            ...(statUpdate.messageHistory || []),
            { role: 'user', content: `gametext: ${aiResponse.game_text}` }
          ]
        ).then(updateResponse => {
          try {
            const parsedUpdateResponse = safeJsonParse(updateResponse);
            applyStatChanges(parsedUpdateResponse, statUpdate.stats);
          } catch (error) {
      console.error('Error parsing stat update response:', error);
      toast.error('Failed to update game stats');
          }
        })
      );
      
      // Wait for all updates to finish, but don't block on their results
      Promise.all(updatePromises)
        .then(() => {
          debugLog('Stat updates processed', 'All updates completed', false);
        })
        .catch(error => {
          debugLog('Error during stat update processing', error, true);
        });
      }
  
      setPlayerInput('');
      
      // Only set game as started after successful START GAME action
      if (action === "START GAME") {
        setIsGameStarted(true);
      }
    } catch (error) {
      // Reset game started state if START GAME action fails
      if (action === "START GAME") {
        setIsGameStarted(false);
      }
      debugLog('Error in sendGameAction', error, true);

      let errorMessage = 'Failed to complete action. Please try again.';
      
      // Check if it's a network error (request dropped)
      if (!error.response && endpointUrl === DEFAULT_ENDPOINT && false) { //DISABLED FOR NOW
        setShowPotatoPCDialog(true);
      }
      // Handle specific error codes
      else if (error.response) {
        if (error.response.status === 404) {
          errorMessage = 'Request failed (404) Invalid endpoint URL or model name. Please check your settings.';
        } else if (error.response.status === 400) {
          errorMessage = 'Request failed (400). Either model name is wrong or memory limit exceeded model limit.';
        }
      }
      // Handle JSON parse errors
      else if (error.message === 'Unable to parse input') {
        errorMessage = 'The AI model was unable to produce the correct JSON format. Try a different model.';
      }

      toast.error(errorMessage, {
        position: "top-right",
        autoClose: 3000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true
      });
      addLogEntry(errorMessage);
    } finally {
      setIsWaitingForAI(false);
    }
  };

  useEffect(() => {
    const startIndex = (currentPage - 1) * messagesPerPage;
    const endIndex = startIndex + messagesPerPage;
    setDisplayedMessages(fullMessageHistory.slice(startIndex, endIndex));
  }, [fullMessageHistory, currentPage, gameplayText]); // Add gameplayText as dependency

  useEffect(() => {
    // Move to the last page whenever we receive new AI game text
    setCurrentPage(Math.ceil(fullMessageHistory.length / messagesPerPage));
  }, [fullMessageHistory.length, messagesPerPage]);

  const handlePageChange = (page) => {
    setCurrentPage(page);
  };

  const totalPages = Math.ceil(fullMessageHistory.length / messagesPerPage);


  // Update the applyStatChanges function to handle specific stat updates
  const applyStatChanges = useCallback((changes, affectedStats = null) => {
    // Merge all changes objects into a single normalized object
    const normalizedChanges = changes.reduce((acc, changeObj) => {
      // For each object in the changes array
      Object.entries(changeObj).forEach(([key, value]) => {
        // Convert key to lowercase and add to accumulator
        acc[key.toLowerCase()] = (acc[key.toLowerCase()] || 0) + value;
      });
      return acc;
    }, {});

    // Update recent stat changes
    setRecentStatChanges(normalizedChanges);
    
    // Clear stat changes after 10 seconds
    setTimeout(() => {
      setRecentStatChanges({});
    }, 10000);
  
    setPlayerStats(prevStats => {
      return prevStats.map(stat => {
        if (affectedStats === null || affectedStats.includes(stat.name)) {
          const change = typeof normalizedChanges[stat.name.toLowerCase()] === 'number'
            ? normalizedChanges[stat.name.toLowerCase()] : 0;
          const newValue = Math.max(stat.min, Math.min(stat.max, stat.value + change));
          return { ...stat, value: newValue };
        }
        return stat;
      });
    });
  }, []);

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

      if (!response.ok) {
        const error = new Error('HTTP error');
        error.response = response;
        throw error;
      }

      const reader = response.body.getReader();
      let content = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        // Convert the chunk to text
        const chunk = new TextDecoder().decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') continue;

            try {
              const parsed = JSON.parse(data);
              const delta = parsed.choices[0]?.delta?.content || '';
              content += delta;
              
              // Handle different request types
              if (requestType === 'gametext') {
                // Update both gameplay text and message history in real-time
                setGameplayText(content);
                
                // Update visible entities based on streaming content
                const newEntities = extractEntities(content);
                setVisibleEntities(newEntities);
                
                // Update the latest assistant message in history if it exists
                setFullMessageHistory(prev => {
                  if (prev.length > 0 && prev[prev.length - 1].role === 'assistant') {
                    const updatedHistory = [...prev];
                    updatedHistory[updatedHistory.length - 1] = {
                      role: 'assistant',
                      content: JSON.stringify({
                        game_text: content,
                        choices: [],
                        stat_changes: []
                      })
                    };
                    return updatedHistory;
                  }
                  // If no assistant message exists yet, add one
                  return [...prev, {
                    role: 'assistant',
                    content: JSON.stringify({
                      game_text: content,
                      choices: [],
                      stat_changes: []
                    })
                  }];
                });
              } else if (requestType === 'choices') {
                // Update choices in real-time, ensuring we handle partial content correctly
                const choicesList = content.split('\n')
                  .map(line => line.trim())
                  .filter(line => line.length > 0);
                if (choicesList.length > 0) {
                  setChoices(choicesList);
                }
              }
              // For statUpdates type, we do nothing during streaming
            } catch (e) {
              console.error('Error parsing streaming response:', e);
            }
          }
        }
      }

      return content.trim();
    } catch (error) {
      console.error('Error in makeAIRequest:', error);
      toast.error('Failed to process AI request');
      throw error;
    }
  };

  const handleSendAction = () => {
    if (playerInput.trim() && !isWaitingForAI) {
      sendGameAction(playerInput.trim());
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !isWaitingForAI) {
      handleSendAction();
    }
  };

  const handleStatChanges = useCallback((statChanges) => {
    setPlayerStats(prevStats => {
      const updatedStats = [...prevStats];
      
      // First pass: Process all max/min changes and collect value adjustments
      const valueAdjustments = new Map(); // Map of statId to value adjustment
      
      statChanges.forEach(change => {
        const statIndex = updatedStats.findIndex(stat => stat.id === change.statId);
        if (statIndex !== -1) {
          const stat = updatedStats[statIndex];
          
          if (change.type === "min") {
            const newMin = Math.max(stat.min, stat.min + change.value);
            stat.min = newMin;
            // If new min is higher than current value, we need to increase value
            if (newMin > stat.value) {
              valueAdjustments.set(stat.id, (valueAdjustments.get(stat.id) || 0) + (newMin - stat.value));
            }
          } else if (change.type === "max") {
            const oldMax = stat.max;
            const newMax = stat.max + change.value;
            stat.max = newMax;
            // When max increases, increase value by the same amount
            if (newMax > oldMax && stat.value == oldMax) {
              valueAdjustments.set(stat.id, (valueAdjustments.get(stat.id) || 0) + (newMax - oldMax));
            }
            // If new max is lower than current value, we need to decrease value
            else if (newMax < stat.value) {
              valueAdjustments.set(stat.id, (valueAdjustments.get(stat.id) || 0) + (newMax - stat.value));
            }
          } else if (change.type === "regen") {
            // Update the regen rate
            stat.regen = (stat.regen || 0) + change.value;
          }
        }
      });
      
      // Second pass: Apply starting changes and collected adjustments
      statChanges.forEach(change => {
        const statIndex = updatedStats.findIndex(stat => stat.id === change.statId);
        if (statIndex !== -1) {
          const stat = updatedStats[statIndex];
          
          if (change.type === "starting") {
            // Apply direct value changes
            stat.value = Math.max(stat.min, Math.min(stat.max, stat.value + change.value));
          }
          
          // Apply any collected adjustments
          const adjustment = valueAdjustments.get(stat.id) || 0;
          if (adjustment !== 0) {
            stat.value = Math.max(stat.min, Math.min(stat.max, stat.value + adjustment));
          }
          
          updateStat(stat);
        }
      });
      
      return updatedStats;
    });
  }, [updateStat]);

  const applyTrait = useCallback((trait) => {
    handleStatChanges(trait.statChanges);
    setPlayerTraits(prevTraits => [...prevTraits, trait]);
    addLogEntry(`Applied trait: ${trait.name}`);
  }, [handleStatChanges, addLogEntry]);

  const changeLocation = useCallback((newLocation) => {
    setCurrentLocation(newLocation);
    
    if (newLocation.ambientSound) {
      setAmbientSound(newLocation.ambientSound);
    } else {
      setAmbientSound(null);
    }
  }, [setCurrentLocation]);

  useEffect(() => {
    setPlayerStats(stats.map(stat => ({ ...stat, value: stat.value || stat.min || 0 })));
  }, [stats]);

  const isInitialized = useRef(false);

  useEffect(() => {
    if (!isInitialized.current && locations.length > 0) {
      isInitialized.current = true;
      
      initialTraits.forEach(traitId => {
        const trait = traits.find(t => t.id === traitId);
        if (trait) {
          applyTrait(trait);
        }
      });

      const randomLocation = locations[Math.floor(Math.random() * locations.length)];
      changeLocation(randomLocation);
      addLogEntry(`Starting in location: ${randomLocation.name}`);
    }
  }, [initialTraits, traits, locations, applyTrait, changeLocation, addLogEntry]);

  

  const scrollToBottom = () => {
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [logEntries]);

  // Handle BGM playback
  useEffect(() => {
    if (bgmEnabled && worldOverview?.bgm) {
      const bgmAudio = new Audio(worldOverview.bgm);
      bgmAudio.loop = true;
      bgmAudio.play();
      return () => bgmAudio.pause();
    }
  }, [bgmEnabled, worldOverview]);

  // Handle ambient sound playback
  useEffect(() => {
    if (ambientSound) {
      const audio = new Audio(ambientSound.data);
      audio.loop = true;
      audio.play();
      return () => audio.pause();
    }
  }, [ambientSound]);

      const parseAssistantMessage = (content) => {
        try {
          // Clean up the content before parsing
          const cleanContent = content.trim();
          
          // Try parsing with JSON5 first (more lenient)
          try {
            const parsed = json5.parse(cleanContent);
            return parsed.game_text || "No game text available";
          } catch (json5Error) {
            // If JSON5 fails, try standard JSON
            const parsed = JSON.parse(cleanContent);
            return parsed.game_text || "No game text available";
          }
    } catch (error) {
      debugLog("Error parsing assistant message", error, true);
      debugLog("Problematic content", content, true);
      
      // Try to extract game_text using regex as a fallback
      try {
        const gameTextMatch = content.match(/"game_text"\s*:\s*"([^"]+)"/);
        if (gameTextMatch && gameTextMatch[1]) {
          return gameTextMatch[1];
        }
      } catch (regexError) {
        debugLog("Regex extraction failed", regexError, true);
      }
      
      return `Error parsing message. Please check console for details.`;
    }
  };

  return (
      <div className="flex h-screen p-4 text-sm md:text-base bg-cover bg-center overflow-hidden" style={{backgroundImage: currentLocation ? `url(${currentLocation.backgroundImage})` : 'url(./default-background.jpg)'}}>
        <ToastContainer theme="dark" />
        <LeftPanel 
          entities={entities}
          onEntityClick={(entityId) => {
            setSelectedEntity(entityId);
            setIsEntityModalOpen(true);
          }}
        />

        <MiddlePanel 
          parseAssistantMessage={parseAssistantMessage}
          totalPages={totalPages}
          handlePageChange={handlePageChange}
          sendGameAction={sendGameAction}
          handleSendAction={handleSendAction}
          handleKeyPress={handleKeyPress}
          handleRollback={handleRollback}
          disabled={isWaitingForAI}
          onTTSClick={() => setIsTTSModalOpen(true)}
        />

        <RightPanel 
          onLocationClick={() => setIsLocationModalOpen(true)}
          onExitToMenu={onExitToMenu}
          language={language}
          setLanguage={setLanguage}
        />

        {/* BGM button */}
        <div className="absolute top-2 left-2 flex">
          <Button onClick={() => setBgmEnabled(!bgmEnabled)} className="flex items-center justify-center rounded-full w-10 h-10 p-0">
            <Music className={`h-5 w-5 ${bgmEnabled ? '' : 'text-muted-foreground'}`} />
          </Button>
        </div>

        {/* Menu button */}
        <div className="absolute top-2 right-2 flex">
          <Button onClick={() => setIsMenuOpen(true)} className="flex items-center justify-center rounded-full w-10 h-10 p-0">
            <Menu className="h-5 w-5" />
          </Button>
        </div>

        {/* Modals */}
        {selectedEntity && (
          <EntityModal 
            entity={entities.find(f => 
              f.name.length >= selectedEntity.length ? 
              f.name.substring(0, selectedEntity.length) === selectedEntity :
              selectedEntity.substring(0, f.name.length) === f.name
            )} 
            isOpen={isEntityModalOpen} 
            onOpenChange={setIsEntityModalOpen} 
          />
        )}

        <LocationModal 
          isOpen={isLocationModalOpen} 
          onOpenChange={setIsLocationModalOpen}
          locations={locations}
          changeLocation={changeLocation}
        />

        <MenuModal 
          isOpen={isMenuOpen}
          onOpenChange={setIsMenuOpen}
          onSettingsClick={() => {
            setIsMenuOpen(false);
            setIsSettingsOpen(true);
          }}
          onSave={saveGame}
          onLoad={loadGame}
          worldOverview={worldOverview}
          onExitToMenu={onExitToMenu}
        />
        
        {/* Potato PC Dialog */}
        <ConfirmDialog
          open={showPotatoPCDialog}
          onOpenChange={setShowPotatoPCDialog}
          title="Server is overwhelmed!"
          description={
            "By default the game uses the AI running on my potato PC and it is struggling with too many requests ☹️ I strongly recommend following my OpenRouter guide to setup a free account and use their free model that is 100 times more memory and 10x faster!"
          }
          onConfirm={() => {
            window.open('https://fierylion.itch.io/formamorph/devlog/885513/quick-setup-guide-free-openrouter-setup', '_blank');
            setShowPotatoPCDialog(false);
          }}
          onCancel={() => setShowPotatoPCDialog(false)}
        />

        <TTSModal
          isOpen={isTTSModalOpen}
          onOpenChange={setIsTTSModalOpen}
          gameText={gameplayText}
          onTTSGenerated={setTTSAudio}
        />

        <SettingsModal 
          isOpen={isSettingsOpen}
          onOpenChange={setIsSettingsOpen}
          onSave={handleSettingsSave}
        />
      </div>
  );
};

export default GameViewer;
