import React, { useState, useEffect, useCallback, useRef } from "react";
import { useGameData } from "../contexts/GameDataContext";
import { useSettings } from "@/contexts/SettingsContext";
import { useGameplay } from "@/contexts/GameplayContext";
import { processStatCode } from "@/contexts/GameplayContextUtils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { Music, SquarePen, Database, ScrollText, ChevronDown, ChevronRight, ChevronsDownUp, ChevronsUpDown, Search } from "lucide-react";
import IndeterminateProgress from "../components/ui/indeterminate-progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import TTSModal, { type TTSModalHandle } from "../components/game/TTSModal";
import { EntityModal } from "../components/modals/EntityModal";
import { LocationModal } from "../components/modals/LocationModal";
import { SettingsModal } from "../components/modals/SettingsModal";
import { MenuModal } from "../components/modals/MenuModal";
import WorldEditor from "./WorldEditor";
import type { CharacterData, ChatMessage, ChatRole, PlayerStat, AIRequestType, StatChange, Trait, GameLocation, MediaAsset } from "@/types";
import { UnsavedChangesDialog } from "../components/UnsavedChangesDialog";
import { estimateHistoryChars, estimateTokens } from "../lib/memoryUtils";
import { parseGameText, stripReasoning, stripReasoningLive } from "../lib/aiResponse";
import { INLINE_THINKING_DIRECTIVE } from "../components/game/GamePrompts";
import { lengthGuidance, trimToLastSentence } from "../lib/outputLength";
import { useSmoothedReveal } from "../lib/useSmoothedReveal";
import { parseSlashCommand } from "../lib/slashCommands";
import { MARKDOWN_SAMPLE } from "../lib/markdownSample";
import { normalizeStatChanges, applyAiStatChanges, applyTraitStatChanges, parseStatUpdates, applyAiMaxChanges } from "../lib/statChanges";
import { matchLocationResponse } from "../lib/locationMatch";
import { getActivatedDictionary, buildDictionaryContext, parseKeywords } from "../lib/dictionaryUtils";
import { highlightSegments, type HighlightRule, type HighlightSegment } from "../lib/highlightUtils";
import { useIsMobile } from "../lib/useIsMobile";
import {
  LeftPanel,
  MiddlePanel,
  RightPanel,
} from "../components/game/GamePanels";
import { ConfirmDialog } from "../components/ConfirmDialog";
import json5 from "json5";

// Debug utility function - only logs on error
const debugLog = (message: string, data: unknown, isError = false) => {
  return; //DISABLED
  if (isError) {
    console.error(`[DEBUG] ${message}:`, data);
  }
};

interface GameViewerProps {
  initialTraits?: string[];
  initialCharacterData: CharacterData | null;
  onExitToMenu: () => void;
}

// One AI sub-request captured per turn for the AI-context viewer (its sent messages + raw response).
interface DebugRequest {
  type: string;
  messages: ChatMessage[];
  response?: string;
}
interface DebugTurn {
  action: string;
  requests: DebugRequest[];
}

const GameViewer = ({
  initialTraits = [],
  initialCharacterData,
  onExitToMenu,
}: GameViewerProps) => {
  // AbortController reference for canceling AI requests
  const abortControllerRef = useRef<AbortController | null>(null);
  const {
    stats,
    locations,
    entities,
    traits,
    dictionary,
    updateStat,
    worldOverview,
    isWorldDirty,
    saveWorld,
  } = useGameData();

  const {
    bgmEnabled,
    setBgmEnabled,
    language,
    setLanguage,
    paragraphLimit,
    hideStatNumbers,
    // Active endpoint settings: the user's values when "Use Custom Endpoint" is on, built-in defaults otherwise.
    activeEndpointUrl: endpointUrl,
    activeApiToken: apiToken,
    activeModelName: modelName,
    activeMaxTokens: maxTokens,
    contextWindow,
    systemPrompt,
    choicesPrompt,
    statUpdatesPrompt,
    locationChangePromptText,
    thinkingMode,
    thinkingPrompt,
  } = useSettings();

  const {
    characterData,
    setCharacterData,
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
    setGameTime,
    logsEndRef,
    gameplayText,
    setGameplayText,
    setTTSAudio,
    setChoices,
    isGameStarted,
    setIsGameStarted,
    playerInput,
    setPlayerInput,
    isWaitingForAI,
    setIsWaitingForAI,
    fullMessageHistory,
    setFullMessageHistory,
    setDisplayedMessages,
    currentPage,
    setCurrentPage,
    gameStates,
    setGameStates,
    setStomachPercent,
    setFatnessPercent,
    setBreastsizePercent,
    playerNotes,
    setPlayerNotes,
    saveGame,
    loadGame,
    saveCurrentGameState,
    loadGameState,
  } = useGameplay();

  // Smoothly plays streamed narration into gameplayText so it reads as continuous typing and the
  // truncation trim happens off-screen (see lib/useSmoothedReveal).
  const reveal = useSmoothedReveal(setGameplayText);

  // Slash-command preview (e.g. `/markdown test`): drives `reveal` with local text, off the AI path.
  const [commandPreview, setCommandPreview] = useState(false);
  const commandTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopCommandPreview = useCallback(() => {
    if (commandTimer.current !== null) {
      clearInterval(commandTimer.current);
      commandTimer.current = null;
    }
    setCommandPreview(false);
  }, []);

  // Type a sample through the real narration path (reveal → autoCloseMarkdown → GameText), simulating
  // token arrival so the markdown renderer can be eyeballed without invoking the AI.
  const runMarkdownTest = useCallback(() => {
    if (commandTimer.current !== null) clearInterval(commandTimer.current);
    setCommandPreview(true);
    reveal.reset();
    let shown = 0;
    commandTimer.current = setInterval(() => {
      shown = Math.min(MARKDOWN_SAMPLE.length, shown + 24);
      if (shown >= MARKDOWN_SAMPLE.length) {
        if (commandTimer.current !== null) clearInterval(commandTimer.current);
        commandTimer.current = null;
        reveal.finish(MARKDOWN_SAMPLE);
        return;
      }
      reveal.push(MARKDOWN_SAMPLE.slice(0, shown));
    }, 40);
  }, [reveal]);

  // Dispatch a parsed slash command; returns true if it was handled (caller then skips the AI).
  const runSlashCommand = useCallback((input: string): boolean => {
    const parsed = parseSlashCommand(input);
    if (!parsed) return false;
    if (parsed.command === "markdown" && parsed.args[0] === "test") {
      runMarkdownTest();
      return true;
    }
    toast.info(`Unknown command: /${parsed.command}`);
    return true;
  }, [runMarkdownTest]);

  // Clear any running command preview when this view unmounts.
  useEffect(() => () => {
    if (commandTimer.current !== null) clearInterval(commandTimer.current);
  }, []);

  useEffect(() => {
    setCharacterData(initialCharacterData);
  }, [initialCharacterData, setCharacterData]);

  // Function to extract entity names from text
  const extractEntities = useCallback(
    (text: string) => {
      if (!text || !entities) return [];

      // Create a Set to store unique entities
      const foundEntities = new Set<string>();

      // For each entity, check if its name appears in the text
      entities.forEach((entity) => {
        // Get base name (singular form)
        const baseName = entity.name.toLowerCase();

        // Create regex that matches the entity name, ignoring case and potential plural 's'
        const regex = new RegExp(`\\b${baseName}(?:s)?\\b`, "i");

        if (regex.test(text)) {
          foundEntities.add(entity.name);
        } else {
          // If no exact match, try loose word matching for multi-word entity names
          const words = baseName.split(" ");
          if (words.length > 1) {
            // Check if all words from the entity name appear in the text
            const allWordsPresent = words.every((word) =>
              // Check for word with optional 's' at the end
              new RegExp(`\\b${word}(?:s)?\\b`, "i").test(text),
            );

            if (allWordsPresent) {
              foundEntities.add(entity.name);
            }
          }
        }
      });

      return Array.from(foundEntities);
    },
    [entities],
  );
  const [isTTSModalOpen, setIsTTSModalOpen] = useState(false);
  const [ttsLoaded, setTtsLoaded] = useState(false);
  const [ttsGenerating, setTtsGenerating] = useState(false);
  const ttsModalRef = useRef<TTSModalHandle>(null);

  // Generate TTS for `text` (or the current game text) with the busy flag set, so both the
  // manual refresh button and auto-narration show the same spinner.
  const generateTTS = async (text?: string): Promise<boolean> => {
    setTtsGenerating(true);
    try {
      return (await ttsModalRef.current?.regenerate(text)) ?? false;
    } finally {
      setTtsGenerating(false);
    }
  };

  // Refresh button: regenerate for the current text; if no model is loaded, open the modal.
  const handleRegenerateTTS = async () => {
    const ok = await generateTTS();
    if (!ok) setIsTTSModalOpen(true);
  };
  const [selectedEntity, setSelectedEntity] = useState<string | null>(null);
  const [isEntityModalOpen, setIsEntityModalOpen] = useState(false);
  const [ambientSound, setAmbientSound] = useState<MediaAsset | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isEditingWorld, setIsEditingWorld] = useState(false);
  const [showEditorExitPrompt, setShowEditorExitPrompt] = useState(false);
  const [lastPromptChars, setLastPromptChars] = useState(0);
  const [suggestedLocation, setSuggestedLocation] = useState<GameLocation | null>(null);
  // AI progress feedback: which request is running, its streamed output estimate (null = indeterminate), and
  // whether the player may already type their next action (choices done, background requests still finishing).
  const [aiRequestType, setAiRequestType] = useState<AIRequestType | null>(null);
  const [choicesReady, setChoicesReady] = useState(false);
  const [isDebugOpen, setIsDebugOpen] = useState(false);
  // One entry per game turn, each holding the AI requests captured that turn (newest last).
  const [debugTurns, setDebugTurns] = useState<DebugTurn[]>([]);
  const [debugPage, setDebugPage] = useState(1); // 1-based page = turn index
  const [disabledHighlights, setDisabledHighlights] = useState<Record<string, boolean>>({});
  const [debugSearch, setDebugSearch] = useState("");
  const [collapsedDebug, setCollapsedDebug] = useState<Record<string | number, boolean>>({});
  // Jump to the newest turn whenever one is captured.
  useEffect(() => {
    if (debugTurns.length > 0) setDebugPage(debugTurns.length);
  }, [debugTurns.length]);
  const isMobile = useIsMobile();
  const [mobilePanel, setMobilePanel] = useState("game");
  const [showPotatoPCDialog, setShowPotatoPCDialog] = useState(false);
  const [isLocationModalOpen, setIsLocationModalOpen] = useState(false);

  const getStatByName = useCallback(
    (name: string) => {
      return playerStats.find((stat) => stat.name === name);
    },
    [playerStats],
  );

  const setStatByName = useCallback((name: string, value: number) => {
    setPlayerStats((prevStats) =>
      prevStats.map((stat) =>
        stat.name === name
          ? { ...stat, value: Math.max(stat.min, Math.min(stat.max, value)) }
          : stat,
      ),
    );
  }, [setPlayerStats]);
  const messagesPerPage = 2; // One AI message + one user message

  const handleRollback = () => {
    if (currentPage < totalPages) {
      const targetState = gameStates[currentPage - 1];
      if (targetState) {
        // Use existing loadGameState function to restore state
        const success = loadGameState(targetState, locations);
        if (success) {
          // We no longer need to remove states after current page
          // This allows for potential "redo" functionality in the future
          addLogEntry("Rolled back to previous game state");

          // Ensure notes are loaded from the target state
          if (targetState.playerNotes !== undefined) {
            setPlayerNotes(targetState.playerNotes);
          }
        }
      }
    }
  };
  const addMessageToHistory = useCallback((role: ChatRole, content: string) => {
    setFullMessageHistory((prev) => [...prev, { role, content }]);
  }, [setFullMessageHistory]);

  const getTrimmedMessageHistory = useCallback((promptTokens = 0) => {
    let trimmedHistory: ChatMessage[] = [];
    let usedTokens = 0;

    // History gets whatever's left of the context window after the system prompt and reserved output,
    // minus a small safety margin (token estimates can under-count the real tokenizer).
    const margin = Math.max(256, Math.round(contextWindow * 0.05));
    const historyBudget = Math.max(0, contextWindow - promptTokens - maxTokens - margin);

    // Start from most recent messages and work backwards
    for (let i = fullMessageHistory.length - 1; i >= 1; i -= 2) {
      const assistantMessage = fullMessageHistory[i];
      const userMessage = fullMessageHistory[i - 1];

      // Skip if either message is missing
      if (!assistantMessage || !userMessage) continue;

      // Parse assistant message to get only game_text
      let assistantGameText: ChatMessage;
      try {
        const parsed = json5.parse(assistantMessage.content);
        assistantGameText = {
          role: "assistant",
          content: parsed.game_text,
        };
      } catch {
        continue; // Skip if parsing fails
      }

      const pairTokens = estimateTokens(JSON.stringify([userMessage, assistantGameText]).length);

      // Check if adding this pair would exceed the history budget
      if (usedTokens + pairTokens <= historyBudget) {
        trimmedHistory = [userMessage, assistantGameText, ...trimmedHistory];
        usedTokens += pairTokens;
      } else {
        break;
      }
    }

    return trimmedHistory;
  }, [fullMessageHistory, contextWindow, maxTokens]);

  // Function to calculate percentage of a stat
  const calculateFIXEDStatPercentage = (stat: PlayerStat) => {
    //return ((stat.value - stat.min) / (stat.max - stat.min));
    return stat.value / 100;
  };

  useEffect(() => {
    if (characterData) {
      const stomach = playerStats.find((stat) => stat.name === "Stomach");
      const fatness = playerStats.find((stat) => stat.name === "Fatness");
      const breastsize = playerStats.find((stat) => stat.name === "Breastsize");

      //these stats CAN exceed 100%
      if (stomach) setStomachPercent(calculateFIXEDStatPercentage(stomach));
      if (fatness) setFatnessPercent(calculateFIXEDStatPercentage(fatness));
      if (breastsize)
        setBreastsizePercent(calculateFIXEDStatPercentage(breastsize));
    }
  }, [playerStats, characterData, setStomachPercent, setFatnessPercent, setBreastsizePercent]);

  const handleTimePassed = useCallback(
    (hours: number) => {
      setGameTime((prevTime) => prevTime + hours);

      // Track regen changes
      const regenChanges: Record<string, number> = {};

      setPlayerStats((prevStats) =>
        prevStats.map((stat) => {
          if (stat.regen) {
            const baseRegenAmount = stat.regen * hours;
            const newValue = Math.max(
              stat.min,
              Math.min(stat.max, stat.value + baseRegenAmount),
            );

            // Calculate the actual change that occurred
            const actualRegenAmount = newValue - stat.value;

            if (actualRegenAmount !== 0) {
              regenChanges[stat.name.toLowerCase()] = actualRegenAmount;
            }

            return { ...stat, value: newValue };
          }
          return stat;
        }),
      );

      // Update recent stat changes with regen changes
      setRecentStatChanges((prev) => {
        const newChanges = { ...prev };
        Object.entries(regenChanges).forEach(([key, value]) => {
          newChanges[key] = (newChanges[key] || 0) + value;
        });
        return newChanges;
      });

      const health = getStatByName("Health");
      const hunger = getStatByName("Hunger");
      if (health && hunger) {
        if (hunger.value <= 20) {
          const healthLoss = 5 * hours;
          setStatByName("Health", health.value - healthLoss);
          addLogEntry(`You're starving! Lost ${healthLoss} health.`);
          // Add health loss to recent changes
          setRecentStatChanges((prev) => ({
            ...prev,
            health: (prev.health || 0) - healthLoss,
          }));
        }
      }

      // Process any code-based stats after all direct changes
      //REMOVE
      // setTimeout(async () => {
      //   try {
      //     const updatedStats = await processStatCode(playerStats);
      //     if (updatedStats !== playerStats) {
      //       setPlayerStats(updatedStats);
      //     }
      //   } catch (error) {
      //     console.error('Error processing stat code after time passed:', error);
      //   }
      // }, 0);
    },
    [getStatByName, setStatByName, addLogEntry, setGameTime, setPlayerStats, setRecentStatChanges],
  );

  const getEndpointUrl = () => endpointUrl;

  const generateTraitDescriptions = useCallback(() => {
    if (!playerTraits.length) {
      return "<NO TRAITS AVAILABLE>";
    }
    return playerTraits
      .map((trait) => `${trait.name}: ${trait.description}`)
      .join("\n");
  }, [playerTraits]);

  const generateStatDescriptions = useCallback((includeValues = true) => {
    return playerStats
      .map((stat) => {
        const percentage =
          ((stat.value - stat.min) / (stat.max - stat.min)) * 100;
        const descriptor = stat.descriptors.find(
          (d) => percentage <= d.threshold,
        );
        // Value-free (narration) form: descriptor only, falling back to the number when a stat
        // has no descriptor so the narrator isn't left blind.
        if (!includeValues && descriptor) return `${stat.name}: ${descriptor.description}`;
        return `${stat.name}: ${stat.value}/${stat.max} (${descriptor ? descriptor.description : "Unknown"})`;
      })
      .join("\n");
  }, [playerStats]);

  const sendGameAction = async (action: string) => {
    if (!isGameStarted && action !== "START GAME") return;
    stopCommandPreview(); // a real turn supersedes any command preview

    const sanitizeLocationData = (location: (GameLocation & { entity?: string[] }) | null) => {
      if (!location) return "";

      const {
        backgroundImage,
        ambientSound,
        id,
        inGameDescription,
        detailedDescription,
        entity,
        entities: locationEntities,
        ...otherProps
      } = location;

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
        output += "entities:\n";
        entityList.forEach((entityId: string) => {
          const entityItem = entities.find((f) => f.id === entityId);
          if (entityItem) {
            const {
              id,
              image,
              sound,
              model,
              inGameDescription,
              detailedDescription,
              ...entityProps
            } = entityItem;
            output += `  - name: ${entityItem.name}\n`;
            output += `    description: ${detailedDescription}\n`;
            // Add other entity properties
            Object.entries(entityProps).forEach(([key, value]) => {
              if (value !== undefined && value !== null && key !== "name") {
                output += `    ${key}: ${value}\n`;
              }
            });
          }
        });
      }

      return output;
    };

    const locationDataString = sanitizeLocationData(currentLocation);

    const statDescriptions = generateStatDescriptions(); // with numbers — used by stat-updates
    // Narration, planning, and choices use descriptor-only stats when enabled (immersion).
    const statDescriptionsNarrative = hideStatNumbers
      ? generateStatDescriptions(false)
      : statDescriptions;

    let updatedPrompt = systemPrompt
      .replace("<WORLD DESCRIPTION>", worldOverview.systemPrompt || "")
      .replace("<LOCATION JSON DATA>", locationDataString)
      .replace("<STATS DESCRIPTION>", statDescriptionsNarrative)
      .replace("<TRAITS DESCRIPTION>", generateTraitDescriptions())
      .replace("<LENGTH GUIDANCE>", lengthGuidance(paragraphLimit, maxTokens));

    // Add player notes to the system prompt
    if (updatedPrompt.includes("<NOTES>")) {
      updatedPrompt = updatedPrompt.replace(
        "<NOTES>",
        playerNotes || "No notes available",
      );
    } else {
      // If <NOTES> placeholder doesn't exist, add notes section before the location data
      const notesSection = `
Player Notes:
${playerNotes || "No notes available"}

`;
      // Insert notes before Current Location section
      const locationIndex = updatedPrompt.indexOf("Current Location:");
      if (locationIndex !== -1) {
        updatedPrompt =
          updatedPrompt.slice(0, locationIndex) +
          notesSection +
          updatedPrompt.slice(locationIndex);
      }
    }
    setIsWaitingForAI(true);

    if (language.toLowerCase() != "english")
      updatedPrompt += `\n Narration language: ` + language;

    // Inject dictionary entries whose keywords appear in the current location context
    // (location + entities present), the action, or the message history. Scanning the
    // location context activates lore proactively the same turn a term enters play,
    // rather than a turn late. The always-present world description is intentionally
    // excluded so its terms don't fire every turn.
    const activatedEntries = getActivatedDictionary(dictionary, [
      locationDataString,
      action,
      ...fullMessageHistory.map((m) => m.content),
    ]);
    const dictionaryContext = buildDictionaryContext(activatedEntries);
    if (dictionaryContext) {
      updatedPrompt += `\n\n${dictionaryContext}`;
    }

    // Get trimmed history before adding new action (history fills the window left by the prompt)
    const trimmedHistory = getTrimmedMessageHistory(estimateTokens(updatedPrompt.length));

    try {
      // Clear the box now (the action is captured in `action`), so anything the player types
      // after choices unlock the box isn't wiped when the turn finishes.
      setPlayerInput("");
      setChoices([]);
      setChoicesReady(false);
      setSuggestedLocation(null);
      // Start a new turn in the AI-context history (cap to the last 50 turns).
      setDebugTurns((prev) => [...prev, { action, requests: [] }].slice(-50));

      // Create message array for game text request
      const gameTextMessages: ChatMessage[] = [
        ...trimmedHistory,
        { role: "user", content: `Player action: ${action}` },
      ];

      // Add user message to history after getting trimmed history
      addMessageToHistory("user", action);

      // Optional thinking step (runs exactly once). 'precall': a hidden planning request whose
      // short output is injected below. 'inline': append a <think> directive to the game-text
      // request (the reasoning is stripped before the player sees it).
      if (thinkingMode === "precall") {
        const thinkPrompt = thinkingPrompt
          .replace("<WORLD DESCRIPTION>", worldOverview.systemPrompt || "")
          .replace("<STATS DESCRIPTION>", statDescriptionsNarrative)
          .replace("<TRAITS DESCRIPTION>", generateTraitDescriptions())
          .replace("<LOCATION JSON DATA>", locationDataString)
          .replace("<NOTES>", playerNotes || "No notes available");
        // Frame the planning task as a single instruction. Reusing the narration message history
        // (turns of action -> story) primes the model to just continue the story instead of planning.
        const lastStory =
          [...trimmedHistory].reverse().find((m) => m.role === "assistant")?.content || "";
        const thinkMessages: ChatMessage[] = [
          {
            role: "user",
            content: `${lastStory ? `What just happened:\n${lastStory}\n\n` : ""}The player's next action: ${action}\n\nWrite the brief plan now. Do not narrate.`,
          },
        ];
        const plan = await makeAIRequest(thinkPrompt, thinkMessages, "thinking", 256);
        if (plan) {
          updatedPrompt += `\n\nPlanning notes (use these to shape the narration; do not repeat them):\n${plan}`;
        }
      } else if (thinkingMode === "inline") {
        updatedPrompt += INLINE_THINKING_DIRECTIVE;
      }

      // Track the assembled system-prompt size for the memory-usage breakdown
      setLastPromptChars(updatedPrompt.length);

      // Get game text first since choices and stat updates depend on it
      const gameTextResponse = await makeAIRequest(
        updatedPrompt,
        gameTextMessages,
        "gametext",
      );

      // If the request was aborted, exit early without throwing an error
      if (!gameTextResponse) {
        // Clean up any partial state updates
        setIsWaitingForAI(false);
        return; // Exit the function early
      }

      // Auto-narrate the new game text if a TTS model is loaded (fire-and-forget).
      if (ttsLoaded) {
        generateTTS(gameTextResponse);
      }

      // Make choices and stat updates requests concurrently since they both only depend on game text
      let choicesResponse = "";
      let statUpdatesResponse = "";

      // Only prepare and make choices request if not disabled
      if (choicesPrompt !== "DISABLED") {
        let updatedChoicesPrompt = choicesPrompt
          .replace("<WORLD DESCRIPTION>", worldOverview.systemPrompt || "")
          .replace("<STATS DESCRIPTION>", statDescriptionsNarrative)
          .replace("<LOCATION JSON DATA>", locationDataString)
          .replace("<TRAITS DESCRIPTION>", generateTraitDescriptions());

        // Add player notes to the choices prompt
        if (updatedChoicesPrompt.includes("<NOTES>")) {
          updatedChoicesPrompt = updatedChoicesPrompt.replace(
            "<NOTES>",
            playerNotes || "No notes available",
          );
        }

        if (language.toLowerCase() != "english")
          updatedChoicesPrompt += `\n Choice language: ` + language;

        choicesResponse = await makeAIRequest(
          updatedChoicesPrompt,
          [{ role: "user", content: `Game text: ${gameTextResponse}` }],
          "choices",
        );
      }

      // Choices (the interactive part of the turn) are ready — let the player start composing their next
      // action while stat-updates / location requests finish in the background.
      setChoicesReady(true);

      // Only prepare and make stat updates request if not disabled
      if (statUpdatesPrompt !== "DISABLED") {
        let updatedStatUpdatesPrompt = statUpdatesPrompt
          .replace("<WORLD DESCRIPTION>", worldOverview.systemPrompt || "")
          .replace("<LOCATION JSON DATA>", locationDataString)
          .replace("<STATS DESCRIPTION>", statDescriptions)
          .replace("<TRAITS DESCRIPTION>", generateTraitDescriptions());

        // Add player notes to the stat updates prompt
        if (updatedStatUpdatesPrompt.includes("<NOTES>")) {
          updatedStatUpdatesPrompt = updatedStatUpdatesPrompt.replace(
            "<NOTES>",
            playerNotes || "No notes available",
          );
        }

        if (language.toLowerCase() != "english")
          updatedStatUpdatesPrompt += "\n Please write in english";

        statUpdatesResponse = await makeAIRequest(
          updatedStatUpdatesPrompt.replace(
            "<STATS DESCRIPTION>",
            statDescriptions,
          ),
          [{ role: "user", content: `Game events: ${gameTextResponse}` }],
          "statUpdates",
        );
      }

      // Ask the AI whether the player should move to a different location (v1.2.0)
      if (locationChangePromptText && locationChangePromptText !== "DISABLED") {
        const locationList = locations.map((loc) => loc.name).join("\n");
        const updatedLocationPrompt = locationChangePromptText
          .replace("<WORLD DESCRIPTION>", worldOverview.systemPrompt || "")
          .replace("<LOCATION JSON DATA>", locationDataString)
          .replace("<LOCATION LIST>", locationList);

        const locationResponse = await makeAIRequest(
          updatedLocationPrompt,
          [{ role: "user", content: `Game events: ${gameTextResponse}` }],
          "locationChange",
        );

        // Exact name match, else the longest available name appearing as a whole word.
        const matchedName = matchLocationResponse(
          locationResponse,
          locations.map((loc) => loc.name),
        );
        if (matchedName) {
          const target = locations.find((loc) => loc.name === matchedName);
          if (target && target.id !== currentLocation?.id) {
            setSuggestedLocation(target);
          }
        }
      }

      // Parse choices (line-separated), hard-capped to 6 to stop the AI over-producing
      const choicesList =
        choicesPrompt === "DISABLED"
          ? []
          : choicesResponse
              .split("\n")
              .filter((choice) => choice.trim())
              .slice(0, 6);
      setChoices(choicesList);

      // Update visible entities based on game text
      const newEntities = extractEntities(gameTextResponse);
      setVisibleEntities(newEntities);

      // Parse stat updates into current-value deltas and max-cap deltas (see lib/statChanges).
      let statChanges: Record<string, number>[] = [];
      if (statUpdatesPrompt !== "DISABLED" && statUpdatesResponse) {
        const { values, maxes } = parseStatUpdates(statUpdatesResponse);
        statChanges = Object.entries(values).map(([k, v]) => ({ [k]: v }));
        if (Object.keys(maxes).length > 0) {
          // Max changes re-clamp the current value into the new range (lib handles the guards).
          setPlayerStats((prevStats) => applyAiMaxChanges(prevStats, maxes));
        }
      }

      // Update final assistant message with complete data
      setFullMessageHistory((prev) => {
        const updatedHistory = [...prev];
        if (
          updatedHistory.length > 0 &&
          updatedHistory[updatedHistory.length - 1].role === "assistant"
        ) {
          updatedHistory[updatedHistory.length - 1] = {
            role: "assistant",
            content: JSON.stringify({
              game_text: gameTextResponse,
              choices: choicesList,
              stat_changes: statChanges,
            }),
          };
        }
        return updatedHistory;
      });

      // Save game state after successful action
      const newState = saveCurrentGameState();
      setGameStates((prevStates) => {
        const newStates = [...prevStates];
        // Store state at the current page index
        const pageIndex =
          Math.ceil(fullMessageHistory.length / messagesPerPage) - 1;

        // Check if we already have a state at this index
        if (pageIndex < newStates.length) {
          newStates[pageIndex] = newState;
        } else {
          // Add the new state to the array
          newStates.push(newState);
        }
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

      // Only set game as started after successful START GAME action
      if (action === "START GAME") {
        setIsGameStarted(true);
      }
    } catch (error) {
      const err = error as { response?: { status?: number }; message?: string };
      // Reset game started state if START GAME action fails
      if (action === "START GAME") {
        setIsGameStarted(false);
      }
      debugLog("Error in sendGameAction", error, true);

      let errorMessage = "Failed to complete action. Please try again.";

      // Handle specific error codes
      if (err.response) {
        if (err.response.status === 404) {
          errorMessage =
            "Request failed (404) Invalid endpoint URL or model name. Please check your settings.";
        } else if (err.response.status === 400) {
          errorMessage =
            "Request failed (400). Either model name is wrong or memory limit exceeded model limit.";
        }
      }
      // Handle JSON parse errors
      else if (err.message === "Unable to parse input") {
        errorMessage =
          "The AI model was unable to produce the correct JSON format. Try a different model.";
      }

      toast.error(errorMessage, {
        position: "top-right",
        autoClose: 3000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
      });
      addLogEntry(errorMessage);
    } finally {
      setIsWaitingForAI(false);
      setAiRequestType(null);
    }
  };

  useEffect(() => {
    const startIndex = (currentPage - 1) * messagesPerPage;
    const endIndex = startIndex + messagesPerPage;
    setDisplayedMessages(fullMessageHistory.slice(startIndex, endIndex));
  }, [fullMessageHistory, currentPage, gameplayText, setDisplayedMessages]);

  useEffect(() => {
    // Move to the last page whenever we receive new AI game text
    setCurrentPage(Math.ceil(fullMessageHistory.length / messagesPerPage));
  }, [fullMessageHistory.length, messagesPerPage, setCurrentPage]);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const totalPages = Math.ceil(fullMessageHistory.length / messagesPerPage);

  // Latest committed stats, so off-render derivations (below) don't rely on a stale closure.
  const playerStatsRef = useRef(playerStats);
  playerStatsRef.current = playerStats;
  // Pending "clear recent changes" timer, tracked so a new turn or unmount can cancel it.
  const recentStatTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (recentStatTimerRef.current) clearTimeout(recentStatTimerRef.current);
    },
    [],
  );

  // Update the applyStatChanges function to handle specific stat updates
  const applyStatChanges = useCallback(
    async (changes: Record<string, number>[], affectedStats: string[] | null = null) => {
      // Merge the AI's change objects into one normalized (name→delta) map.
      const normalizedChanges = normalizeStatChanges(changes);

      // Surface the changes, then clear the highlight after 10s. Cancel any prior timer first so a
      // stale clear can't wipe a newer turn's changes.
      setRecentStatChanges(normalizedChanges);
      if (recentStatTimerRef.current) clearTimeout(recentStatTimerRef.current);
      recentStatTimerRef.current = setTimeout(() => setRecentStatChanges({}), 10000);

      // Apply the AI's direct changes, then derive any code-based stats from that result. Both run
      // outside the state updater (updaters must stay pure), reading the latest stats via the ref.
      const directApplied = applyAiStatChanges(playerStatsRef.current, normalizedChanges, affectedStats);
      setPlayerStats(directApplied);
      try {
        // processStatCode is typed over Stat[]; playerStats is the narrower PlayerStat[] (value: number).
        const coded = await processStatCode(directApplied);
        if (coded !== directApplied) setPlayerStats(coded as typeof playerStats);
      } catch (error) {
        console.error("Error processing stat code after changes:", error);
      }
    },
    [setPlayerStats, setRecentStatChanges],
  );

  // Function to abort ongoing AI generation
  const abortGeneration = () => {
    if (abortControllerRef.current) {
      // Abort the fetch request
      abortControllerRef.current.abort();
      abortControllerRef.current = null;

      // Reset waiting state
      setIsWaitingForAI(false);
      setAiRequestType(null);
      setChoicesReady(false);

      // Reset any partial UI updates
      setChoices([]);

      // Drop the aborted turn (partial assistant + its user action) so history stays paired.
      // A leftover unpaired user message corrupts getTrimmedMessageHistory's pair-walking.
      setFullMessageHistory((prev) => {
        let next = [...prev];
        if (next.length > 0 && next[next.length - 1].role === "assistant") {
          next = next.slice(0, -1);
        }
        if (next.length > 0 && next[next.length - 1].role === "user") {
          next = next.slice(0, -1);
        }
        return next;
      });

      // Add log entry
      addLogEntry("AI generation aborted");
    }
  };

  const makeAIRequest = async (
    systemPrompt: string,
    messages: ChatMessage[],
    requestType: AIRequestType = "gametext",
    maxTokensOverride: number | null = null,
  ) => {
    try {
      // Create a new AbortController for this request
      const controller = new AbortController();
      abortControllerRef.current = controller;
      const signal = controller.signal;

      // Surface which request is currently running.
      setAiRequestType(requestType);

      // Capture the exact payload into the current turn for the AI-context viewer
      setDebugTurns((prev) => {
        if (!prev.length) return prev;
        const next = prev.slice();
        const last = next[next.length - 1];
        next[next.length - 1] = {
          ...last,
          requests: [
            ...last.requests,
            { type: requestType, messages: [{ role: "system", content: systemPrompt }, ...messages] },
          ],
        };
        return next;
      });

      const response = await fetch(getEndpointUrl(), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiToken}`,
        },
        body: JSON.stringify({
          model: modelName,
          messages: [{ role: "system", content: systemPrompt }, ...messages],
          max_tokens: maxTokensOverride ?? maxTokens,
          stream: true,
          // Single-paragraph stop, but not in inline-thinking mode — the <think> block needs newlines.
          ...(requestType === "gametext" && paragraphLimit === "single" && thinkingMode !== "inline" && { stop: ["\n"] }),
        }),
        signal, // Add the abort signal to the fetch request
      });

      if (!response.ok) {
        const error = new Error("HTTP error") as Error & { response?: Response };
        error.response = response;
        throw error;
      }

      if (!response.body) throw new Error("Response has no body to stream");
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let content = "";
      let finishReason = null;
      // Start a fresh smoothed reveal for this turn's narration.
      if (requestType === "gametext") reveal.reset();

      // Handle one complete SSE line. Lines are buffered across reads (below) so a `data:` payload
      // split across network chunks is never JSON.parsed half-formed.
      const processLine = (sseLine: string) => {
        if (!sseLine.startsWith("data: ")) return;
        const data = sseLine.slice(6);
        if (data === "[DONE]") return;
        try {
          const parsed = JSON.parse(data);
          const delta = parsed.choices[0]?.delta?.content || "";
          content += delta;
          if (parsed.choices[0]?.finish_reason) {
            finishReason = parsed.choices[0].finish_reason;
          }

          // Handle different request types
          if (requestType === "gametext") {
            // Feed the full (reasoning-stripped) content; the smoothed reveal trails it so the
            // display reads as continuous typing and the late truncation trim stays off-screen.
            const display = stripReasoningLive(content);
            reveal.push(display);

            // Update visible entities based on streaming content
            const newEntities = extractEntities(display);
            setVisibleEntities(newEntities);

            // Update the latest assistant message in history if it exists
            setFullMessageHistory((prev) => {
              if (
                prev.length > 0 &&
                prev[prev.length - 1].role === "assistant"
              ) {
                const updatedHistory = [...prev];
                updatedHistory[updatedHistory.length - 1] = {
                  role: "assistant",
                  content: JSON.stringify({
                    game_text: display,
                    choices: [],
                    stat_changes: [],
                  }),
                };
                return updatedHistory;
              }
              // If no assistant message exists yet, add one
              return [
                ...prev,
                {
                  role: "assistant",
                  content: JSON.stringify({
                    game_text: display,
                    choices: [],
                    stat_changes: [],
                  }),
                },
              ];
            });
          } else if (requestType === "choices") {
            // Update choices in real-time, ensuring we handle partial content correctly
            const choicesList = stripReasoningLive(content)
              .split("\n")
              .map((line) => line.trim())
              .filter((line) => line.length > 0)
              .slice(0, 6);
            if (choicesList.length > 0) {
              setChoices(choicesList);
            }
          }
          // For statUpdates type, we do nothing during streaming
        } catch (e) {
          console.error("Error parsing streaming response:", e);
        }
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        // Accumulate decoded text and dispatch only complete lines; the trailing partial line (and
        // any partial multi-byte char, via { stream: true }) is carried into the next read.
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split(/\r?\n/);
        buffer = lines.pop() ?? "";
        for (const line of lines) processLine(line);
      }
      // Flush the decoder and process a final line that arrived without a trailing newline.
      buffer += decoder.decode();
      if (buffer.trim()) processLine(buffer.trim());

      // Show the raw output (including any <think> block) in the AI-context viewer, but return the
      // cleaned text so reasoning never reaches the narration, TTS, choices/stats/location, or history.
      const rawContent = content.trim();
      let finalContent = stripReasoning(content).trim();
      // On a mid-sentence truncation (hit the token cap), trim back to the last complete sentence.
      if (requestType === "gametext") {
        if (finishReason === "length") finalContent = trimToLastSentence(finalContent);
        // Hand the authoritative final text to the smoothed reveal to play out cleanly.
        reveal.finish(finalContent);
      }
      // Record the raw output on this turn's matching request so the AI-context viewer can show it.
      setDebugTurns((prev) => {
        if (!prev.length) return prev;
        const next = prev.slice();
        const last = { ...next[next.length - 1] };
        last.requests = last.requests.map((r) =>
          r.type === requestType && r.response === undefined
            ? { ...r, response: rawContent }
            : r,
        );
        next[next.length - 1] = last;
        return next;
      });
      return finalContent;
    } catch (error) {
      // Check if this is an abort error (user canceled the request)
      if ((error as Error).name === "AbortError") {
        if (requestType === "gametext") reveal.reset();
        // Return empty content for aborted requests instead of throwing
        return "";
      }

      console.error("Error in makeAIRequest:", error);
      toast.error("Failed to process AI request");
      throw error;
    }
  };

  const handleSendAction = () => {
    const input = playerInput.trim();
    if (!input || isWaitingForAI) return;
    if (input.startsWith("/")) {
      runSlashCommand(input);
      setPlayerInput("");
      return;
    }
    sendGameAction(input);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !isWaitingForAI) {
      handleSendAction();
    }
  };

  const handleStatChanges = useCallback(
    (statChanges: StatChange[]) => {
      setPlayerStats((prevStats) => {
        const { stats, changedIds } = applyTraitStatChanges(prevStats, statChanges);
        // Persist each changed stat back to the world definition.
        stats.forEach((stat) => {
          if (changedIds.has(stat.id)) updateStat(stat);
        });
        return stats;
      });
    },
    [updateStat, setPlayerStats],
  );

  const applyTrait = useCallback(
    (trait: Trait) => {
      handleStatChanges(trait.statChanges);
      setPlayerTraits((prevTraits) => [...prevTraits, trait]);
      addLogEntry(`Applied trait: ${trait.name}`);
    },
    [handleStatChanges, addLogEntry, setPlayerTraits],
  );

  const changeLocation = useCallback(
    (newLocation: GameLocation) => {
      setCurrentLocation(newLocation);

      if (newLocation.ambientSound) {
        setAmbientSound(newLocation.ambientSound);
      } else {
        setAmbientSound(null);
      }
    },
    [setCurrentLocation],
  );

  useEffect(() => {
    setPlayerStats(
      stats.map((stat) => ({ ...stat, value: (stat.value as number) || stat.min || 0 })),
    );
  }, [stats, setPlayerStats]);

  const isInitialized = useRef(false);

  useEffect(() => {
    if (!isInitialized.current && locations.length > 0) {
      isInitialized.current = true;

      initialTraits.forEach((traitId) => {
        const trait = traits.find((t) => t.id === traitId);
        if (trait) {
          applyTrait(trait);
        }
      });

      // Prefer locations flagged as starting points; fall back to any location.
      const startingLocations = locations.filter((loc) => loc.isStarting);
      const pickFrom =
        startingLocations.length > 0 ? startingLocations : locations;
      const randomLocation =
        pickFrom[Math.floor(Math.random() * pickFrom.length)];
      changeLocation(randomLocation);
      addLogEntry(`Starting in location: ${randomLocation.name}`);
    }
  }, [
    initialTraits,
    traits,
    locations,
    applyTrait,
    changeLocation,
    addLogEntry,
  ]);

  const scrollToBottom = useCallback(() => {
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logsEndRef]);

  useEffect(() => {
    scrollToBottom();
  }, [logEntries, scrollToBottom]);

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

  // Extract the displayed game_text from an assistant message (see lib/aiResponse).
  const parseAssistantMessage = parseGameText;

  // Status line shown above the input while a turn is being generated, naming the current AI
  // request (Game Text / Choices / Stat Updates / Location) so the player knows what's processing.
  const progressBar = isWaitingForAI ? (() => {
    const labels = {
      thinking: "Plan",
      gametext: "Game Text",
      choices: "Choices",
      statUpdates: "Stat Updates",
      locationChange: "Location",
    };
    const label = aiRequestType ? labels[aiRequestType] : "Response";
    return (
      <div className="flex items-center gap-2 mb-1">
        <span className="text-xs text-muted-foreground whitespace-nowrap">
          Generating {label}…
        </span>
        <div className="flex-grow">
          <IndeterminateProgress />
        </div>
      </div>
    );
  })() : null;

  const memoryBar = (() => {
    // Token breakdown of the model's context window: prompt + history + reserved output vs the window.
    const windowTokens = contextWindow || 1;
    const promptTokens = estimateTokens(lastPromptChars);
    const trimmed = getTrimmedMessageHistory(promptTokens);
    const historyTokens = estimateTokens(estimateHistoryChars(trimmed)); // what's actually sent
    const outputTokens = maxTokens;
    const usedTokens = promptTokens + historyTokens + outputTokens;
    const pct = (n: number) => (n / windowTokens) * 100;
    const usedPct = pct(usedTokens);
    const availableTokens = Math.max(0, windowTokens - usedTokens);
    const fillPct = Math.min(100, usedPct);
    const barColor =
      usedPct >= 90
        ? "bg-red-500"
        : usedPct >= 70
          ? "bg-yellow-500"
          : "bg-green-500";
    const row = (label: string, tokens: number) => (
      <div className="flex justify-between"><span>{label}:</span><span>{tokens.toLocaleString()} tok ({pct(tokens).toFixed(0)}%)</span></div>
    );
    return (
      <div className="flex items-center gap-2 mb-1">
        <Popover>
          <PopoverTrigger asChild>
            <button
              className="text-muted-foreground hover:text-foreground"
              title="Memory usage"
            >
              <Database className="h-4 w-4" />
            </button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-64 text-xs space-y-1">
            <div className="font-semibold">Context window: {windowTokens.toLocaleString()} tok</div>
            {row("Prompt", promptTokens)}
            {row("History", historyTokens)}
            {row("Reserved output", outputTokens)}
            <div className="flex justify-between font-medium"><span>Available:</span><span>{availableTokens.toLocaleString()} tok ({Math.max(0, 100 - usedPct).toFixed(0)}%)</span></div>
            <div className="flex justify-between"><span>Messages kept:</span><span>{trimmed.length} / {fullMessageHistory.length}</span></div>
          </PopoverContent>
        </Popover>
        <div className="flex-grow h-2 rounded-full bg-muted/70 overflow-hidden">
          <div
            className={`h-full ${barColor} transition-all`}
            style={{ width: `${fillPct}%` }}
          />
        </div>
      </div>
    );
  })();

  // AI location-change suggestion (rendered at the bottom of the center panel, above pagination).
  const locationSuggestion = suggestedLocation ? (
    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-30 flex items-center justify-center gap-2 whitespace-nowrap rounded-md border bg-background px-3 py-2 text-sm shadow-lg">
      <span>
        Move to <b>{suggestedLocation.name}</b>?
      </span>
      <Button
        size="sm"
        onClick={() => {
          changeLocation(suggestedLocation);
          addLogEntry(`Moved to location: ${suggestedLocation.name}`);
          setSuggestedLocation(null);
        }}
      >
        Go
      </Button>
      <Button
        size="sm"
        variant="ghost"
        onClick={() => setSuggestedLocation(null)}
      >
        Dismiss
      </Button>
    </div>
  ) : null;

  const leftPanel = (
    <LeftPanel
      entities={entities}
      onEntityClick={(entityId) => {
        setSelectedEntity(entityId);
        setIsEntityModalOpen(true);
      }}
    />
  );

  const middlePanel = (
    <MiddlePanel
      parseAssistantMessage={parseAssistantMessage}
      totalPages={totalPages}
      handlePageChange={handlePageChange}
      sendGameAction={sendGameAction}
      handleSendAction={handleSendAction}
      handleKeyPress={handleKeyPress}
      handleRollback={handleRollback}
      abortGeneration={abortGeneration}
      disabled={isWaitingForAI && !choicesReady}
      onTTSClick={() => setIsTTSModalOpen(true)}
      onRegenerateTTS={handleRegenerateTTS}
      ttsLoaded={ttsLoaded}
      ttsGenerating={ttsGenerating}
      memoryBar={memoryBar}
      progressBar={progressBar}
      locationSuggestion={locationSuggestion}
      commandPreview={commandPreview}
      onDismissCommandPreview={stopCommandPreview}
    />
  );

  const rightPanel = (
    <RightPanel
      onLocationClick={() => setIsLocationModalOpen(true)}
      language={language}
      setLanguage={setLanguage}
    />
  );

  return (
    <div
      className={`flex ${isMobile ? "flex-col" : ""} h-screen p-4 text-sm md:text-base bg-cover bg-center overflow-hidden`}
      style={{
        backgroundImage: currentLocation
          ? `url(${currentLocation.backgroundImage})`
          : "url(./default-background.jpg)",
      }}
    >
      <ToastContainer theme="dark" />

      {isMobile && (
        <div className="flex shrink-0 gap-1 mb-1">
          {[
            { key: "character", label: "Character" },
            { key: "game", label: "Game" },
            { key: "status", label: "Status" },
          ].map((t) => (
            <button
              key={t.key}
              onClick={() => setMobilePanel(t.key)}
              className={`flex-1 rounded py-2 text-sm ${
                mobilePanel === t.key
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      )}

      {isMobile ? (
        <div className="flex-grow min-h-0 flex flex-col">
          {mobilePanel === "character" && leftPanel}
          {mobilePanel === "game" && middlePanel}
          {mobilePanel === "status" && rightPanel}
        </div>
      ) : (
        <>
          {leftPanel}
          {middlePanel}
          {rightPanel}
        </>
      )}

      {/* BGM + AI-context buttons */}
      <div className="absolute top-16 left-2 md:top-2 flex gap-2">
        <Button
          onClick={() => setBgmEnabled(!bgmEnabled)}
          className="flex items-center justify-center rounded-full w-10 h-10 p-0"
        >
          <Music
            className={`h-5 w-5 ${bgmEnabled ? "" : "text-muted-foreground"}`}
          />
        </Button>
        <Button
          onClick={() => setIsDebugOpen(true)}
          className="flex items-center justify-center rounded-full w-10 h-10 p-0"
          title="Show the full AI context sent each turn"
        >
          <ScrollText className="h-5 w-5" />
        </Button>
      </div>

      {/* Edit-world + Menu buttons */}
      <div className="absolute top-16 right-2 md:top-2 flex gap-2">
        <Button
          onClick={() => setIsEditingWorld(true)}
          className="flex items-center justify-center rounded-full w-10 h-10 p-0"
          title="Edit World"
        >
          <SquarePen className="h-5 w-5" />
        </Button>
        <MenuModal
          onSettingsClick={() => setIsSettingsOpen(true)}
          onSave={(name) => saveGame(name, worldOverview.name)}
          onLoad={(name) => loadGame(name, locations)}
          worldOverview={worldOverview}
          onExitToMenu={onExitToMenu}
        />
      </div>

      {/* Modals */}
      {selectedEntity && (
        <EntityModal
          entity={entities.find((f) =>
            f.name.length >= selectedEntity.length
              ? f.name.substring(0, selectedEntity.length) === selectedEntity
              : selectedEntity.substring(0, f.name.length) === f.name,
          ) ?? null}
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


      {/* Edit-world popup: non-fullscreen; keeps GameViewer + live session mounted */}
      <Dialog
        open={isEditingWorld}
        onOpenChange={(open) => {
          if (open) { setIsEditingWorld(true); return; }
          // Guard close (X / Esc / overlay): prompt if there are pending edits.
          if (isWorldDirty) setShowEditorExitPrompt(true);
          else setIsEditingWorld(false);
        }}
      >
        <DialogContent className="max-w-[95vw] w-[95vw] h-[90vh] p-0 overflow-hidden">
          <WorldEditor embedded onClose={() => setIsEditingWorld(false)} />
        </DialogContent>
      </Dialog>
      <UnsavedChangesDialog
        open={showEditorExitPrompt}
        onOpenChange={setShowEditorExitPrompt}
        onSave={async () => { await saveWorld(); setShowEditorExitPrompt(false); setIsEditingWorld(false); }}
        onExit={() => { setShowEditorExitPrompt(false); setIsEditingWorld(false); }}
      />

      {/* Full AI context sent each turn, paginated by turn */}
      <Dialog open={isDebugOpen} onOpenChange={setIsDebugOpen}>
        <DialogContent className="max-w-[90vw] w-[90vw] h-[85vh] flex flex-col overflow-hidden">
          {(() => {
            const palette = [
              "#fde68a", "#bbf7d0", "#bfdbfe", "#fbcfe8",
              "#ddd6fe", "#fed7aa", "#a5f3fc", "#fecaca",
            ];
            const colorMap: Record<string, string> = {};
            // Trigger keywords highlight in the narrative/history (showing why an entry
            // activated); inside the injected "Relevant Information:" block only the entry
            // name declaration ("Name:") highlights — not keyword occurrences in the value.
            const triggerRules: HighlightRule[] = [];
            const declarationRules: HighlightRule[] = [];
            dictionary.forEach((entry, i) => {
              const color = palette[i % palette.length];
              colorMap[entry.id] = color;
              if (disabledHighlights[entry.id]) return;
              parseKeywords(entry).forEach((term) => triggerRules.push({ term, color }));
              if (entry.name) declarationRules.push({ term: `${entry.name}:`, color });
            });
            const RELEVANT_MARKER = "Relevant Information:";
            // Highlight only a "Name:" at the start of a line — the declaration prepended by
            // buildDictionaryContext — not a "Name:" that recurs inside the entry's value text.
            const highlightDeclarations = (block: string) => {
              const segments: HighlightSegment[] = [];
              block.split("\n").forEach((line, li) => {
                if (li > 0) segments.push({ text: "\n" });
                const rule = declarationRules
                  .filter((r) => line.startsWith(r.term))
                  .sort((a, b) => b.term.length - a.term.length)[0];
                if (rule) {
                  segments.push({ text: rule.term, color: rule.color });
                  segments.push({ text: line.slice(rule.term.length) });
                } else if (line) {
                  segments.push({ text: line });
                }
              });
              return segments;
            };
            const searchTerms = debugSearch.trim().toLowerCase().split(/\s+/).filter(Boolean);
            const searchActive = searchTerms.length > 0;
            // Keep only lines matching any search term; collapse each run of dropped lines into "...".
            const filterLines = (text: string) => {
              const out = [];
              let pendingGap = false;
              let shownAny = false;
              text.split("\n").forEach((line) => {
                if (searchTerms.some((t) => line.toLowerCase().includes(t))) {
                  if (pendingGap) out.push("...");
                  out.push(line);
                  shownAny = true;
                  pendingGap = false;
                } else {
                  pendingGap = true;
                }
              });
              if (shownAny && pendingGap) out.push("...");
              return shownAny ? out.join("\n") : "";
            };
            // Section-aware highlight (+ optional search filter); returns [] when search hides everything.
            const buildSegments = (text: string) => {
              const idx = text.indexOf(RELEVANT_MARKER);
              let body = idx === -1 ? text : text.slice(0, idx);
              let block = idx === -1 ? "" : text.slice(idx);
              if (searchActive) {
                body = filterLines(body);
                block = filterLines(block);
              }
              const segs: HighlightSegment[] = [];
              if (body) segs.push(...highlightSegments(body, triggerRules));
              if (searchActive && body && block) segs.push({ text: "\n" });
              if (block) segs.push(...highlightDeclarations(block));
              return segs;
            };
            const renderSegs = (segs: HighlightSegment[]) =>
              segs.map((seg, k) =>
                seg.color ? (
                  <mark
                    key={k}
                    style={{ backgroundColor: seg.color, color: "#000" }}
                    className="rounded px-0.5"
                  >
                    {seg.text}
                  </mark>
                ) : (
                  <span key={k}>{seg.text}</span>
                ),
              );
            // Page = turn; show the requests captured for the currently selected turn.
            const totalDebugPages = debugTurns.length;
            const pageIndex = Math.min(Math.max(debugPage, 1), Math.max(totalDebugPages, 1)) - 1;
            const currentTurn = debugTurns[pageIndex];
            const currentRequests = currentTurn?.requests ?? [];
            // Collapse keys: one per request, plus one per captured raw output ("out-<i>").
            const collapseKeys: (string | number)[] = [];
            currentRequests.forEach((req, i) => {
              collapseKeys.push(i);
              if (typeof req.response === "string") collapseKeys.push(`out-${i}`);
            });
            const allCollapsed =
              collapseKeys.length > 0 && collapseKeys.every((k) => collapsedDebug[k]);
            const toggleAll = () => {
              if (allCollapsed) {
                setCollapsedDebug({});
              } else {
                const next: Record<string | number, boolean> = {};
                collapseKeys.forEach((k) => { next[k] = true; });
                setCollapsedDebug(next);
              }
            };
            const renderDebugPaginationItems = () => {
              const items = [];
              for (let i = 1; i <= totalDebugPages; i++) {
                if (i === 1 || i === totalDebugPages || (i >= debugPage - 1 && i <= debugPage + 1)) {
                  items.push(
                    <PaginationItem key={i}>
                      <PaginationLink
                        href="#"
                        onClick={(e) => { e.preventDefault(); setDebugPage(i); }}
                        isActive={debugPage === i}
                      >
                        {i}
                      </PaginationLink>
                    </PaginationItem>,
                  );
                } else if (i === debugPage - 2 || i === debugPage + 2) {
                  items.push(
                    <PaginationItem key={i}>
                      <PaginationEllipsis />
                    </PaginationItem>,
                  );
                }
              }
              return items;
            };
            return (
              <>
                <DialogHeader className="flex-shrink-0">
                  <DialogTitle>AI context</DialogTitle>
                </DialogHeader>
                {dictionary.length > 0 && (
                  <div className="flex flex-wrap items-center gap-2 flex-shrink-0 text-xs">
                    <span className="text-muted-foreground">Dictionary:</span>
                    {dictionary.map((entry) => {
                      const disabled = disabledHighlights[entry.id];
                      return (
                        <button
                          key={entry.id}
                          onClick={() =>
                            setDisabledHighlights((prev) => ({
                              ...prev,
                              [entry.id]: !prev[entry.id],
                            }))
                          }
                          className="rounded border px-1.5 py-0.5"
                          style={
                            disabled
                              ? { borderColor: colorMap[entry.id], opacity: 0.5 }
                              : {
                                  backgroundColor: colorMap[entry.id],
                                  borderColor: colorMap[entry.id],
                                  color: "#000",
                                }
                          }
                          title={
                            disabled
                              ? "Click to enable highlight"
                              : "Click to disable highlight"
                          }
                        >
                          {entry.name || parseKeywords(entry)[0] || "unnamed"}
                        </button>
                      );
                    })}
                  </div>
                )}
                <div className="flex items-center gap-2 flex-shrink-0">
                  <div className="relative flex-grow">
                    <Search className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      value={debugSearch}
                      onChange={(e) => setDebugSearch(e.target.value)}
                      placeholder="Search lines (space-separated terms)…"
                      className="pl-8 h-8 text-xs"
                    />
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={toggleAll}
                    disabled={searchActive || currentRequests.length === 0}
                    className="h-8 flex-shrink-0 gap-1"
                    title={searchActive ? "Disabled while searching" : undefined}
                  >
                    {allCollapsed ? (
                      <ChevronsUpDown className="h-4 w-4" />
                    ) : (
                      <ChevronsDownUp className="h-4 w-4" />
                    )}
                    {allCollapsed ? "Expand all" : "Collapse all"}
                  </Button>
                </div>
                {currentTurn && (
                  <div className="flex-shrink-0 text-xs text-muted-foreground truncate">
                    Turn {pageIndex + 1} of {totalDebugPages}
                    {currentTurn.action ? ` — "${currentTurn.action}"` : ""}
                  </div>
                )}
                <div className="flex-grow min-h-0">
                  <ScrollArea className="h-full">
                    <div className="space-y-4 text-xs">
                      {totalDebugPages === 0 ? (
                        <p className="text-muted-foreground">
                          No AI context captured yet. Take an action first, then reopen this.
                        </p>
                      ) : (
                        currentRequests.map((req, i) => {
                          const msgSegs = req.messages.map((m) => ({
                            role: m.role,
                            segs: buildSegments(m.content),
                          }));
                          const hasReqMatch = msgSegs.some((ms) => ms.segs.length > 0);
                          // Raw, unmodified AI output for this request (captured in makeAIRequest).
                          const outSegs =
                            typeof req.response === "string" ? buildSegments(req.response) : null;
                          const hasOutMatch = outSegs !== null && outSegs.length > 0;
                          // While searching, drop the whole block only if neither the request nor its output matches.
                          if (searchActive && !hasReqMatch && !hasOutMatch) return null;
                          const reqOpen = searchActive ? true : !collapsedDebug[i];
                          const outOpen = searchActive ? true : !collapsedDebug[`out-${i}`];
                          return (
                            <React.Fragment key={i}>
                              {(!searchActive || hasReqMatch) && (
                                <Collapsible
                                  open={reqOpen}
                                  onOpenChange={(o) =>
                                    setCollapsedDebug((prev) => ({ ...prev, [i]: !o }))
                                  }
                                  className="border border-border rounded-md"
                                >
                                  <CollapsibleTrigger asChild>
                                    <button className="flex w-full items-center justify-between gap-2 p-2 text-left font-semibold">
                                      <span>Request {i + 1}: {req.type}</span>
                                      {reqOpen ? (
                                        <ChevronDown className="h-4 w-4 flex-shrink-0" />
                                      ) : (
                                        <ChevronRight className="h-4 w-4 flex-shrink-0" />
                                      )}
                                    </button>
                                  </CollapsibleTrigger>
                                  <CollapsibleContent className="p-2 pt-0">
                                    {msgSegs.map((ms, j) => {
                                      if (searchActive && ms.segs.length === 0) return null;
                                      return (
                                        <div key={j} className="mb-2">
                                          <div className="font-medium text-muted-foreground uppercase">
                                            {ms.role}
                                          </div>
                                          <pre className="whitespace-pre-wrap break-words bg-muted/50 p-2 rounded">
                                            {renderSegs(ms.segs)}
                                          </pre>
                                        </div>
                                      );
                                    })}
                                  </CollapsibleContent>
                                </Collapsible>
                              )}
                              {outSegs !== null && (!searchActive || hasOutMatch) && (
                                <Collapsible
                                  open={outOpen}
                                  onOpenChange={(o) =>
                                    setCollapsedDebug((prev) => ({ ...prev, [`out-${i}`]: !o }))
                                  }
                                  className="border border-border rounded-md"
                                >
                                  <CollapsibleTrigger asChild>
                                    <button className="flex w-full items-center justify-between gap-2 p-2 text-left font-semibold">
                                      <span>Raw Output {i + 1}: {req.type}</span>
                                      {outOpen ? (
                                        <ChevronDown className="h-4 w-4 flex-shrink-0" />
                                      ) : (
                                        <ChevronRight className="h-4 w-4 flex-shrink-0" />
                                      )}
                                    </button>
                                  </CollapsibleTrigger>
                                  <CollapsibleContent className="p-2 pt-0">
                                    <pre className="whitespace-pre-wrap break-words bg-muted/50 p-2 rounded">
                                      {req.response ? (
                                        renderSegs(outSegs)
                                      ) : (
                                        <span className="text-muted-foreground">(empty output)</span>
                                      )}
                                    </pre>
                                  </CollapsibleContent>
                                </Collapsible>
                              )}
                            </React.Fragment>
                          );
                        })
                      )}
                    </div>
                  </ScrollArea>
                </div>
                {totalDebugPages > 1 && (
                  <div className="flex-shrink-0 flex justify-center pt-2">
                    <Pagination>
                      <PaginationContent>
                        <PaginationItem>
                          <PaginationPrevious
                            href="#"
                            onClick={(e) => { e.preventDefault(); if (debugPage > 1) setDebugPage(debugPage - 1); }}
                            className={debugPage === 1 ? "pointer-events-none opacity-50" : ""}
                          />
                        </PaginationItem>
                        {renderDebugPaginationItems()}
                        <PaginationItem>
                          <PaginationNext
                            href="#"
                            onClick={(e) => { e.preventDefault(); if (debugPage < totalDebugPages) setDebugPage(debugPage + 1); }}
                            className={debugPage === totalDebugPages ? "pointer-events-none opacity-50" : ""}
                          />
                        </PaginationItem>
                      </PaginationContent>
                    </Pagination>
                  </div>
                )}
              </>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* Potato PC Dialog */}
      <ConfirmDialog
        open={showPotatoPCDialog}
        onOpenChange={setShowPotatoPCDialog}
        title="Server is overwhelmed!"
        description={
          "By default the game uses the AI running on my potato PC and it is struggling with too many requests ☹️ I strongly recommend following my OpenRouter guide to setup a free account and use their free model that is 100 times more memory and 10x faster!"
        }
        onConfirm={() => {
          window.open(
            "https://fierylion.itch.io/formamorph/devlog/885513/quick-setup-guide-free-openrouter-setup",
            "_blank",
          );
          setShowPotatoPCDialog(false);
        }}
        onCancel={() => setShowPotatoPCDialog(false)}
      />

      <TTSModal
        ref={ttsModalRef}
        isOpen={isTTSModalOpen}
        onOpenChange={setIsTTSModalOpen}
        gameText={gameplayText}
        onTTSGenerated={setTTSAudio}
        onLoadedChange={setTtsLoaded}
      />

      <SettingsModal
        isOpen={isSettingsOpen}
        onOpenChange={setIsSettingsOpen}
      />
    </div>
  );
};

export default GameViewer;
