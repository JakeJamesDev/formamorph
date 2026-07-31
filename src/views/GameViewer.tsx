import { randomUUID } from "@/lib/uuid";
import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useGameData } from "../contexts/GameDataContext";
import { useSettings } from "@/contexts/SettingsContext";
import { useSettingsOpenRequest } from "@/lib/useSettingsOpenRequest";
import { useGameplay } from "@/contexts/GameplayContext";
import { processStatCode } from "@/contexts/GameplayContextUtils";
import { usesStatClock, type StatClock } from "@/lib/statCodeExecutor";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import { Pager } from "@/components/ui/pagination";
import { Music, SquarePen, Database, ScrollText, ChevronDown, ChevronRight, ChevronsDownUp, ChevronsUpDown, Search, Eye, EyeOff, Download, Braces } from "lucide-react";
import IndeterminateProgress from "../components/ui/indeterminate-progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "react-toastify";
import { ThemedToastContainer } from "@/components/ThemedToastContainer";
import "react-toastify/dist/ReactToastify.css";
import TTSModal, { type TTSModalHandle, type TTSProgress } from "../components/game/TTSModal";
import ReadmeModal from "../components/game/ReadmeModal";
import { useReadmeVisibility } from "@/lib/useReadmeVisibility";
import { EntityModal } from "../components/modals/EntityModal";
import { LocationModal } from "../components/modals/LocationModal";
import { SettingsModal } from "../components/modals/SettingsModal";
import { BugReportDialog } from "@/components/menu/BugReportDialog";
import { COMMUNITY_ENABLED } from "@/lib/featureFlags";
import AuthService from "@/services/AuthService";
import { useDevRoute } from "../lib/devRouter";
import { loadDevFixture } from "../lib/devFixtures";
import { putSaveRecord } from "../components/modals/dbUtils";
import WorldStorageService from "../services/WorldStorageService";
import { MenuModal } from "../components/modals/MenuModal";
import LlmSetupGuide from "../components/modals/LlmSetupGuide";
import { isLikelyConnectionError } from "../lib/connectionError";
import WorldEditor from "./WorldEditor";
import type { CharacterData, ChatMessage, ChatRole, AIRequestType, AITurnResult, StatChange, Trait, GameLocation, MediaAsset, Dictionary, Entity, SaveRecord, World, PlayerStat } from "@/types";
import { UnsavedChangesDialog } from "../components/UnsavedChangesDialog";
import { estimateHistoryChars, estimateTokens } from "../lib/memoryUtils";
import { parseNarration, stripReasoning, stripReasoningLive, extractReasoning, extractReasoningLive } from "../lib/aiResponse";
import { setLiveReasoning, getLiveReasoning } from "../lib/reasoningStreamStore";
import {
  INLINE_THINKING_DIRECTIVE,
  markdownGuidance,
  activeCharacterGuidance,
  planDirective,
  defaultDiscoverEntityPrompt,
  OPENING_SCENE_CUE,
  hasOocDirective,
  stripOocDirectives,
  defaultMilestoneIncrementalPrompt,
} from "../components/game/GamePrompts";
import {
  buildDiaryUserMessage,
  runStagedPlanning,
  parseDirectorCast,
  classifyCast,
  sanitizePlanForReveal,
  buildSceneList,
  type DirectorCastMember,
} from "../lib/stagedPlanning";
import { selectDueDiscovery, materializeDiscoveredEntity, mergeDiscoveredIntoLocation, cleanDiscoveredDescription, selectReachableVisitors, DISCOVER_NAME_LABEL, DISCOVER_PASSAGE_LABEL } from "../lib/runtimeCharacters";
import { lengthGuidance, trimToLastSentence } from "../lib/outputLength";
import { reasoningEffortBody, resolvePromptReasoning, reasoningBudgetBody } from "../lib/reasoningEffort";
import { splitSentenceSegments } from "../lib/ttsChunks";
import { selectDueDigests, applyDigest, applyImportance, parseTurnContent, recentParticipants, selectDueDiaries, pendingDiaryNames, applyDiary } from "../lib/turnDigest";
import { buildTraitContext } from "../lib/traitTree";
import { buildLocationContext, buildEntityContext, buildSublocationsContext, buildSublocationEntitiesContext, buildReachableLocationsContext, buildReachableEntitiesContext, buildDestinationsContext, buildParentLocationContext, buildSceneEntitiesContext, scenePresentHere, navigableDestinations, sublocationEntityIds } from "../lib/locationContext";
import { primeRolls, resolvePlaceholders } from "@/lib/placeholders";
import { resolveStartingLocation } from "../lib/startingLocation";
import { NONE_PLACEHOLDER } from "../lib/promptFallbacks";
import { buildStatContext } from "../lib/statContext";
import { variableForToken, variableVariantIds, decodeVariant, tokenVariant, withVariant } from "../lib/promptVariables";
import { renderPromptTemplate } from "../lib/promptTemplate";
import { useBaselineTestHook } from "../lib/baselineTestHook";
import { parseTurns, buildVerbatimHistory, buildBandedHistory, extractKeywords, type BandCounts } from "../lib/turnBanding";
import { buildStamper, formatAbsolute, hoursByPosition, parseTimeDelta, parseOpeningDaypart, FLAT_HOURS_PER_TURN } from "../lib/gameClock";
import { milestoneCandidates, agedMilestoneCandidates, resolveMilestoneDrop, resolveMilestoneKeep, buildIncrementalMilestoneUserMessage, parseIncrementalMilestoneReply, applyIncrementalVerdict } from "../lib/milestoneMemory";
import { applyMemoryOverrides, activeNotes } from "../lib/memoryOverrides";
import { buildRelevanceScores, vectorKey } from "../lib/memoryRelevance";
import { entryVectorKey, entryEmbedText, selectSemanticLore, applySemanticLore } from "../lib/semanticDictionary";
import { selectSemanticRehydrations, rehydrationCooldownBlocked } from "../lib/semanticRehydration";
import { embedTexts, isEmbeddingModelReady, loadEmbeddingModel } from "../lib/embeddingWorkerClient";
import { getVectors, putVector } from "../lib/embeddingCache";
import { findEntityNames, matchNames, matchNamesLoose, sameCharacterName, stripQuotedSpeech } from "../lib/entityMatch";
import { parseChoices } from "../lib/choices";
import { setGameplayText } from "../lib/gameplayTextStore";
import { useSentenceReveal } from "../lib/useSentenceReveal";
import { useSmoothedReveal } from "../lib/useSmoothedReveal";
import { revealActive } from "../lib/narrationRevealConfig";
import { REVEAL_TEST_NARRATION, REVEAL_TEST_PROFILES } from "../lib/revealTestScripts";
import { MARKDOWN_SAMPLE } from "../lib/markdownSample";
import { parseSlashCommand } from "../lib/slashCommands";
import { normalizeStatChanges, applyAiStatChanges, applyTraitStatChanges, parseStatUpdates, applyAiMaxChanges, appliedStatDeltas } from "../lib/statChanges";
import { resolvePromptSampler } from "../lib/promptSamplers";
import { composeSceneTags, stripPlaces, splitTags, MAX_SCENE_CHARACTERS, type SceneCharacter } from "../lib/sceneTags";
import { loadDanbooruTags } from "../lib/danbooruTags";
import { addSceneImage, removeSceneImage, pruneSceneImages, setSceneTags as patchSceneTags } from "../lib/sceneImages";
import { generateImage, buildImageRequest } from "../lib/imageGen";
import { buildImagePrompt } from "../lib/imagePrompt";
import { downloadBlob } from "../lib/downloadBlob";
import { matchLocationResponse } from "../lib/locationMatch";
import { rollbackState, regenerateState, canRegenerate, lastTurnAction, markRegeneratedTurn, markPrunedTurns, snapshotPageIndex, placeSnapshot, sliceHistoryToPage, pageAssistantIndex } from "../lib/turnHistory";
import { useDeferredSnapshot } from "../lib/useDeferredSnapshot";
import { statMorphMap } from "../lib/bodyMorphs";
import { extractCharacterCandidates, collectCandidateEvidence } from "../lib/characterCandidates";
import { explainActivation, buildDictionaryContext, parseKeywords, locateMatches, type EntryActivation, type ScanSource, type MatchHit, type MatchRule } from "../lib/dictionaryUtils";
import { buildScanCorpus } from "../lib/dictionaryScan";
import { restyle } from "../lib/sectionStyle";
import { highlightSegments, HIGHLIGHT_PALETTE, type HighlightRule, type HighlightSegment } from "../lib/highlightUtils";
import { useIsMobile } from "../lib/useIsMobile";
import {
  LeftPanel,
  MiddlePanel,
  RightPanel,
} from "../components/game/GamePanels";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { AiSetupGate } from "../components/AiSetupGate";
import { useAiReachable } from "../lib/useAiReachable";

interface GameViewerProps {
  initialTraits?: string[];
  initialCharacterData: CharacterData | null;
  initialLocationId?: string | null;
  /** Per-playthrough dictionary set chosen at the entry step; null when the step was skipped (falls back
   *  to the world's authored books). */
  initialDictionaries?: Dictionary[] | null;
  /** Library characters chosen at the entry step to place in the starting location this playthrough (runtime
   *  only — seeded as `discoveredEntities`, never written to the authored world). */
  initialCharacters?: Entity[] | null;
  /** Cold-load: a save id to restore on mount (main-menu Load Game) instead of starting a fresh game. The
   *  world it belongs to is loaded into GameData before this mounts. */
  initialSaveId?: string | null;
  onExitToMenu: () => void;
}

// One AI sub-request captured per turn for the AI-context viewer (its sent messages + raw response).
// The dictionary activation captured for a turn's narration request: the per-entry report plus the verbatim
// scanned strings (only those a hit landed in) so the AI-context viewer can mark real matches — and only real
// matches — even on historical turns whose live state has moved on.
interface DictionaryDebug {
  report: EntryActivation[];
  sources: ScanSource[];
}
interface DebugRequest {
  type: string;
  messages: ChatMessage[];
  response?: string;
  // Correlates a captured request to its own response, so concurrent same-type calls (the staged character
  // pass, parallel diaries) each land on the right entry instead of overwriting by (type + empty-response).
  id?: string;
  // Narration only: the dictionary activation behind this turn's injected lore.
  dictionary?: DictionaryDebug;
}
interface DebugTurn {
  action: string;
  requests: DebugRequest[];
  turnId?: string; // ties this turn to its assistant message, so the viewer can show its memory digest
  regenerated?: boolean; // this turn was superseded by a re-generate of the same action
  pruned?: boolean; // this turn was discarded by a rollback to an earlier page
  aborted?: boolean; // this turn was stopped before any narration landed (its user message was dropped)
}

// Each completed turn is digested as soon as it commits (same-turn), so a summary is always ready for
// the next turn's context assembly. Small cap on each digest request — a condensed retelling is short.
const DIGEST_MAX_TOKENS = 200;
// The clock pass answers with one value like "2h"; anything longer is stray prose the parser ignores.
const TIME_PASSED_MAX_TOKENS = 12;
// One daypart word; the contract is "nothing before or after it".
const OPENING_TIME_MAX_TOKENS = 8;
// The milestone selector replies with a comma-separated index list; sized for long histories.
const MILESTONE_SELECT_MAX_TOKENS = 300;

// Every Stats chip token (base + all piece/format combos), so buildContextValues can render each. The pieces
// (Values/Status/Meaning) are decoded per token and handed to buildStatContext; ids mirror encodeVariant.
const STATS_VARIABLE = variableForToken('<STATS DESCRIPTION>')!;
const STATS_TOKENS = ['<STATS DESCRIPTION>', ...variableVariantIds(STATS_VARIABLE).map((id) => withVariant('<STATS DESCRIPTION>', id))];

// Per-character diary entries are short, first-person, 1-2 sentences — a small cap keeps them terse.
const DIARY_MAX_TOKENS = 80;

// A discovered character's reference description runs ~2 short paragraphs; the response is trimmed to
// the last full sentence, so this cap just needs headroom to avoid a mid-word cut.
const DISCOVER_MAX_TOKENS = 200;

// A stable empty array for turns with no scene image, so the panel's prop identity doesn't churn.
const EMPTY_IMAGES: string[] = [];

// The scene-tag pass answers with one line of tags; enough for a rich action line, not for prose.
const SCENE_TAGS_MAX_TOKENS = 120;

// How many of a character's own recent diary entries to feed into its motivation pass (its memory).
const DIARY_MEMORY_ENTRIES = 5;

// Output caps for the staged planning passes. Sized for the verbose small tier (Rocinante 12B) so cast
// lists and intents complete rather than truncate mid-word — a cut cast member is lost from the whole turn.
const DIRECTOR_MAX_TOKENS = 320;
const CHARACTER_MAX_TOKENS = 256;
const STORYBOARD_MAX_TOKENS = 300;
// Cap on older turns rehydrated to full text per turn — rehydration is a targeted aid, not bulk restore.
const DIGEST_MAX_REHYDRATIONS = 3;
// How many recent turns count as "currently in the scene" for the choices entity filter (this turn plus
// the prior CHOICES_PRESENCE_TURNS-1), so a character named earlier but only implied now isn't dropped.
const CHOICES_PRESENCE_TURNS = 3;

// Participant names stored on the most recent `turns` assistant turns that carry participation data
// (turns predating the feature / the current placeholder have no `entities` field and are skipped).
/** The prefix of `text` up to the last complete sentence; '' until the first sentence finishes. The
 *  in-progress trailing sentence is held back so Streamdown's fade reveals whole sentences (and a late
 *  truncation trim of the unfinished tail never shows on screen). */
const revealedSentences = (text: string): string => {
  const segments = splitSentenceSegments(text);
  if (segments.length <= 1) return '';
  return text.slice(0, text.length - segments[segments.length - 1].length).replace(/\s+$/, '');
};

const GameViewer = ({
  initialTraits = [],
  initialCharacterData,
  initialLocationId = null,
  initialDictionaries = null,
  initialCharacters = null,
  initialSaveId = null,
  onExitToMenu,
}: GameViewerProps) => {
  // AbortController reference for canceling AI requests
  const abortControllerRef = useRef<AbortController | null>(null);
  const {
    stats,
    locations,
    entities,
    traits,
    traitGroups,
    dictionaries,
    placeholders,
    worldOverview,
    worldId,
    isWorldDirty,
    saveWorld,
    loadWorldData,
  } = useGameData();

  // World README popup — shown once on entry (new game or save load) when the world has README text and
  // its per-world "show readme" flag is on. The flag is shared with the main-menu "Show Readme" toggle.
  const { showReadme, setShowReadme } = useReadmeVisibility();
  const readmeText = worldOverview?.readme?.trim() ?? "";
  const [showReadmeModal, setShowReadmeModal] = useState(() => !!readmeText && showReadme(worldId));

  // The whole settings bag is kept as well as the destructured fields: buildImageRequest reads the image
  // preset off it, so the scene path and the editor's dialog cannot drift apart on request shape.
  const settings = useSettings();
  const {
    bgmEnabled,
    setBgmEnabled,
    language,
    setLanguage,
    paragraphLimit,
    markdownOutput,
    streamNarrationAudio,
    // Active endpoint settings: the user's values when "Use Custom Endpoint" is on, built-in defaults otherwise.
    activeEndpointUrl: endpointUrl,
    activeApiToken: apiToken,
    activeModelName: modelName,
    activeMaxTokens: maxTokens,
    contextWindow,
    localModelActive,
    disableThinking,
    genTemperature,
    genTopP,
    genRepetitionPenalty,
    genTopK,
    genMinP,
    promptSamplers,
    systemPrompt,
    choicesPrompt,
    statUpdatesPrompt,
    locationChangePromptText,
    choicesEnabled,
    statUpdatesEnabled,
    revealSpec,
    revealMinDuration,
    revealMinStagger,
    locationChangeEnabled,
    locationAutoApply,
    narrationVerbatimTurns,
    thinkingVerbatimTurns,
    thinkingMode,
    reasoningEffort,
    supportedReasoningEfforts,
    reasoningEngaged,
    promptReasoning,
    promptReasoningBudget,
    thinkingPrompt,
    memoryDigests,
    semanticMemory,
    semanticLore,
    semanticRehydration,
    semanticDiaries,
    semanticBandCap,
    timeContext,
    aiClock,
    nowLinePrompt,
    timePassedPrompt,
    openingTimePrompt,
    openingTimeUserPrompt,
    timePassedUserPrompt,
    concurrentTurnRequests,
    autosaveEnabled,
    limitActiveCharacters,
    activeCharacterLimit,
    summaryPrompt,
    characterDiaries,
    describeCharacters,
    diaryPrompt,
    directorPrompt,
    directorUserPrompt,
    characterPrompt,
    storyboardPrompt,
    narrationUserPrompt,
    oocDirectivePrompt,
    recapUserPrompt,
    rehydrateUserPrompt,
    choicesUserPrompt,
    statUpdatesUserPrompt,
    locationChangeUserPrompt,
    summaryUserPrompt,
    // Scene images: the tag pass's prompts and the toggles. The provider config itself is read off
    // `settings` by buildImageRequest, not destructured here.
    sceneTagsPrompt,
    sceneTagsUserPrompt,
    sceneImageAuto,
    imageTagPrompt,
    imageGenDisabled,
    imageLandscapeWidth,
    imageLandscapeHeight,
    showSilentRequests,
    activeSectionStyle,
    locationBackground,
    backgroundOverlay,
  } = settings;

  const {
    setCharacterData,
    setVisibleEntities,
    currentLocation,
    setCurrentLocation,
    playerStats,
    setPlayerStats,
    playerTraits,
    setPlayerTraits,
    recentStatChanges,
    setRecentStatChanges,
    setRecentStatFading,
    heldStatChanges,
    setHeldStatChanges,
    setDrainingStatChanges,
    addLogEntry,
    addSystemLogEntry,
    setContextMemoryIds,
    setRehydratedMemoryIds,
    logEntries,
    gameTime,
    setGameTime,
    startHour,
    setStartHour,
    calendar,
    logsEndRef,
    setChoices,
    isGameStarted,
    setIsGameStarted,
    playerInput,
    setPlayerInput,
    isWaitingForAI,
    setIsWaitingForAI,
    setIsRevealingNarration,
    fullMessageHistory,
    setFullMessageHistory,
    setDisplayedMessages,
    currentPage,
    setUserPage,
    totalPages,
    isViewingPast,
    viewStats,
    viewLocationId,
    gameStates,
    setGameStates,
    setBodyMorphValues,
    playerNotes,
    setPlayerNotes,
    saveGame,
    autosaveGame,
    loadGame,
    saveCurrentGameState,
    loadGameState,
    discoveredEntities,
    setDiscoveredEntities,
    suppressedCharacterNames,
    runtimeDictionary: dictionary,
    setRuntimeDictionaries,
    placeholderRolls,
    setPlaceholderRolls,
    memoryPins,
    setMemoryPins,
    milestoneSelection,
    setMilestoneSelection,
    memoryEdits,
    setMemoryEdits,
    memoryDeleted,
    setMemoryDeleted,
    memoryNotes,
    setMemoryNotes,
    sceneImages,
    setSceneImages,
  } = useGameplay();

  // Runtime characters (Slice 2): director-invented characters promoted to persisted entities this
  // playthrough behave like authored ones — union them into the AI-pipeline roster, and inject those
  // anchored to a location into that location's roster so the location-scoped context includes them.
  const allEntities = useMemo(
    () => [...entities, ...discoveredEntities.map((d) => d.entity)],
    [entities, discoveredEntities],
  );
  // Everything a capitalized word in the narration might be OTHER than a new character. Feeds the
  // narration name extractor so a place, a stat, a trait, a lore term, a wildcard value or the player
  // never gets promoted to a person. Location names include the whole world, not just here — the
  // narration routinely names somewhere the player isn't.
  // Split by kind: only real people carry the surname rule, because the last word of a location or
  // trait would block candidates for nothing (measured on real worlds: `office`, `demi-human`,
  // `studio`, `skill`). Location names cover the whole world, not just here — the narration routinely
  // names somewhere the player isn't.
  const characterExclusions = useMemo(() => {
    const clean = (xs: string[]) => xs.map((n) => (n ?? '').trim()).filter(Boolean);
    return {
      characters: clean(allEntities.map((e) => e.name)),
      terms: clean([
        ...locations.map((l) => l.name),
        ...stats.map((s) => s.name),
        ...traits.map((t) => t.name),
        ...dictionary.flatMap((entry) => [entry.name ?? '', ...parseKeywords(entry)]),
        ...placeholders.flatMap((p) => [p.name, ...p.values]),
        // The player's name lives in free-text notes, so every capitalized run there is off-limits.
        ...(playerNotes.match(/\b[A-Z][A-Za-z'’-]+/g) ?? []),
      ]),
    };
  }, [allEntities, locations, stats, traits, dictionary, placeholders, playerNotes]);

  const withDiscovered = useCallback(
    (loc: GameLocation | null | undefined): GameLocation | null =>
      mergeDiscoveredIntoLocation(loc ?? undefined, discoveredEntities) ?? null,
    [discoveredEntities],
  );

  // Two narration reveal styles, chosen by the Fade-in Narration setting: `fadeReveal` releases whole
  // sentences paced to Streamdown's per-word fade; `smoothReveal` is the classic character crawl that
  // trails the stream at its arrival rate. Only the selected one is fed per turn.
  const fadeReveal = useSentenceReveal(setGameplayText, revealMinStagger, revealMinDuration);
  const smoothReveal = useSmoothedReveal(setGameplayText);
  // Which reveal drives narration: any effect enabled ⇒ the paced fade path; none ⇒ the smooth crawl.
  const fadeRevealActive = revealActive(revealSpec);

  // Slash-command preview (e.g. `/markdown test`): drives the narration reveal with local text, off the AI path.
  const [commandPreview, setCommandPreview] = useState(false);
  const [connectionGuideOpen, setConnectionGuideOpen] = useState(false); // AI-server connection guide (web-only)
  const commandTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopCommandPreview = useCallback(() => {
    if (commandTimer.current !== null) {
      clearInterval(commandTimer.current);
      commandTimer.current = null;
    }
    setCommandPreview(false);
  }, []);

  // Replay a fixed narration through the REAL reveal path (pacer → renderer) at a scripted arrival
  // timing, so the reveal can be eyeballed/recorded reproducibly without the AI. The profile (see
  // revealTestScripts) picks the arrival pattern — default `burst` reproduces the LM Studio signature.
  // The pacer measures arrival timing itself (via Date.now on each push), so replaying the schedule at
  // real wall-clock times reproduces production pacing exactly, with no estimator to mirror here.
  const runMarkdownTest = useCallback((profileName?: string) => {
    if (commandTimer.current !== null) clearTimeout(commandTimer.current);
    // No profile (and the explicit `render`) previews the markdown sample at a steady pace — the reading
    // this command's name implies. Naming an arrival-timing profile instead replays the prose narration to
    // test the reveal pacer.
    const isRender = profileName === undefined || profileName === 'render';
    const profile = isRender ? REVEAL_TEST_PROFILES.steady : REVEAL_TEST_PROFILES[profileName];
    if (!profile) {
      toast.info(`Unknown profile. Try: render, ${Object.keys(REVEAL_TEST_PROFILES).join(', ')}`);
      return;
    }
    const text = isRender ? MARKDOWN_SAMPLE : REVEAL_TEST_NARRATION;
    const schedule = profile.schedule(text.length);
    setCommandPreview(true);
    fadeReveal.reset();
    smoothReveal.reset();

    const startedAt = performance.now();
    let i = 0;
    const step = () => {
      // Fire every arrival event that's due, then reschedule for the next.
      while (i < schedule.length && performance.now() - startedAt >= schedule[i].atMs) {
        const slice = text.slice(0, schedule[i].chars);
        if (fadeRevealActive) fadeReveal.push(revealedSentences(slice));
        else smoothReveal.push(slice);
        i++;
      }
      if (i >= schedule.length) {
        commandTimer.current = null;
        if (fadeRevealActive) fadeReveal.finish(text);
        else smoothReveal.finish(text);
        return;
      }
      commandTimer.current = setTimeout(step, Math.max(0, schedule[i].atMs - (performance.now() - startedAt)));
    };
    step();
  }, [fadeReveal, smoothReveal, fadeRevealActive]);

  // Dispatch a parsed slash command; returns true if it was handled (caller then skips the AI).
  const runSlashCommand = useCallback((input: string): boolean => {
    const parsed = parseSlashCommand(input);
    if (!parsed) return false;
    if (parsed.command === "markdown" && parsed.args[0] === "test") {
      // No arg renders the markdown sample; a profile name replays the prose reveal test instead.
      // /markdown test [render|burst|steady|slow|fast|erratic]
      runMarkdownTest(parsed.args[1]);
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

  const [isTTSModalOpen, setIsTTSModalOpen] = useState(false);
  const [ttsLoaded, setTtsLoaded] = useState(false);
  const [ttsGenerating, setTtsGenerating] = useState(false);
  const [ttsProgress, setTtsProgress] = useState<TTSProgress | null>(null);
  const ttsModalRef = useRef<TTSModalHandle>(null);
  const ttsSentenceCursorRef = useRef(0); // count of complete sentences already sent to streaming TTS
  const entitySentenceCursorRef = useRef(0); // count of complete sentences already parsed for the entity tab
  // This turn's scene-list inputs, read by makeAIRequest's narration streaming (which lives at component
  // scope, not inside the turn function): the planner cast (null in Off/Inline) and the prior-narration
  // reveal corpus. Set just before the narration request each turn.
  const sceneListCtxRef = useRef<{ cast: DirectorCastMember[] | null; prior: string }>({ cast: null, prior: "" });
  const assistantAddedRef = useRef(false); // whether this turn's in-progress assistant message is in history yet
  const userTurnAddedRef = useRef(false); // whether this turn's user message has been appended to history yet
  const currentTurnIdRef = useRef(""); // stable id for the in-progress turn, stamped into its assistant JSON
  // This turn's dictionary activation, computed at narration-assembly time and consumed by the narration
  // request's AI-context capture (reset per turn so a turn without one never reuses a stale report).
  const pendingDictionaryDebugRef = useRef<DictionaryDebug | null>(null);
  // This turn's captured reasoning (native `reasoning` stream field + inline <think>) + think duration (ms),
  // set by the narration request's stream and read into the committed turn JSON. Also drives the live block.
  const turnReasoningRef = useRef<{ text: string; ms: number }>({ text: "", ms: 0 });
  const digestDrainingRef = useRef(false); // a memory digest is in flight (serializes the drainer)
  const [digestActive, setDigestActive] = useState(false); // drives the status-bar indicator for a running digest
  const diaryDrainingRef = useRef(false); // a character diary entry is in flight (serializes the drainer)
  const [diaryActive, setDiaryActive] = useState(false); // drives the status-bar indicator for a running diary pass
  const discoverDrainingRef = useRef(false); // a runtime-character describe request is in flight (serializes the drainer)
  const [discoverActive, setDiscoverActive] = useState(false); // drives the status-bar indicator for a running discovery pass
  const milestoneDrainingRef = useRef(false); // a milestone selection is in flight (serializes the drainer)
  const [milestoneActive, setMilestoneActive] = useState(false); // drives the status-bar indicator for a running selection
  const embedDrainingRef = useRef(false); // an embedding batch is in flight (serializes the drainer)
  // Digest vectors by vectorKey, hydrated from the embedding cache and topped up by the drainer.
  // Session-local derived data — never persisted with the save.
  const embedVectorsRef = useRef<Map<string, Float32Array>>(new Map());
  const embedModelKickedRef = useRef(false); // one background model (re)load attempt per session
  // The last turn's relevance scores + action vector, reused by the context meter so its counts mirror
  // what actually rode (a null-scored meter run would otherwise report ranked drops as oldest-first
  // and show no recalled scenes).
  const lastRelevanceScoresRef = useRef<Map<string, number> | null>(null);
  const lastActionVecRef = useRef<Float32Array | null>(null);
  // Scene-recall cooldown (T1): each rehydrated turn's last-fired turn number, plus the turn the
  // live selection ran at so the context meter evaluates the same cooldown window instead of
  // hiding the scene that actually rode. Session-local, like the vectors above.
  const rehydrateLastFiredRef = useRef<Map<string, number>>(new Map());
  const lastRecallTurnRef = useRef<number | null>(null);

  // Generate TTS for `text` (or the current game text) with the busy flag set, so both the
  // manual refresh button and auto-narration show the same spinner + chunk progress.
  const generateTTS = async (text?: string): Promise<boolean> => {
    setTtsGenerating(true);
    setTtsProgress({ done: 0, total: 1 });
    try {
      return (await ttsModalRef.current?.regenerate(text, setTtsProgress)) ?? false;
    } finally {
      setTtsGenerating(false);
      setTtsProgress(null);
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
  // Filing needs an account, so the in-game entry point is only offered to someone signed in.
  const [showBugReport, setShowBugReport] = useState(false);
  const canReportBug = COMMUNITY_ENABLED && Boolean(AuthService.token);
  const [settingsTab, setSettingsTab] = useState<string | undefined>(undefined);
  const [settingsEndpointTab, setSettingsEndpointTab] = useState<string | undefined>(undefined);
  useSettingsOpenRequest((tab, endpointTab) => {
    setSettingsTab(tab);
    setSettingsEndpointTab(endpointTab);
    setIsSettingsOpen(true);
  });

  // --- AI setup gate -------------------------------------------------------------------------------
  // Warn on entering a world whose configured AI doesn't answer, rather than blocking the launch from the
  // menu — the player can still read, explore, and fix Settings; only the turn itself would fail. Raised at
  // most once per visit so dismissing it sticks.
  const { reachable: aiReachable, mode: aiMode, blocker: aiBlocker, recheck: aiRecheck } = useAiReachable();
  const [aiGateOpen, setAiGateOpen] = useState(false);
  const aiGateShownRef = useRef(false);
  useEffect(() => {
    if (aiGateShownRef.current || aiReachable !== false) return;
    aiGateShownRef.current = true;
    setAiGateOpen(true);
  }, [aiReachable]);
  // The AI came up while the warning was showing — nothing is queued behind it, so just dismiss.
  const handleAiGateReady = useCallback(() => setAiGateOpen(false), []);

  // DEV dev-router: open an in-game modal when the hash asks for it (Menu routes via MenuModal's own
  // devOpenLoad prop below). Tree-shaken in prod.
  const devRoute = useDevRoute();
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    switch (devRoute?.modal) {
      case 'settings': setIsSettingsOpen(true); break;
      case 'export': setIsExportModalOpen(true); break;
    }
  }, [devRoute?.modal]);
  // Entity modal is a per-entity detail view (needs a selected entity), so open the first one — and wait
  // for `entities` to load (a fixture boot populates them asynchronously). Tree-shaken in prod.
  useEffect(() => {
    if (!import.meta.env.DEV || devRoute?.modal !== 'entity' || entities.length === 0) return;
    setSelectedEntity(entities[0].name);
    setIsEntityModalOpen(true);
  }, [devRoute?.modal, entities]);
  // DEV dev-router: boot mid-game from a canned fixture. DevFixtureLoader has loaded the world (so
  // `locations` are present); seed the save into IndexedDB and run the real loadGame to override the
  // fresh-game init. Tree-shaken in prod.
  const devFixtureLoadedRef = useRef(false);
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const name = devRoute?.fixture;
    if (!name || devFixtureLoadedRef.current || locations.length === 0) return;
    devFixtureLoadedRef.current = true;
    void (async () => {
      const fx = await loadDevFixture(name);
      if (!fx) return;
      // Seed the fixture as an id-keyed record and load it by that id.
      const id = randomUUID();
      await putSaveRecord({ ...(fx.save as unknown as Record<string, unknown>), id, name: fx.saveName } as unknown as SaveRecord);
      await loadGame(id, locations, stats);
    })();
  }, [devRoute?.fixture, locations, stats, loadGame]);
  const [isEditingWorld, setIsEditingWorld] = useState(false);
  const [uiHidden, setUiHidden] = useState(false); // hide all panels/buttons to reveal the background image
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
  const [debugPage, setDebugPage] = useState(1); // 1-based page = index into visibleDebugTurns
  const [disabledHighlights, setDisabledHighlights] = useState<Record<string, boolean>>({});
  // AI-context highlight mode: dictionary entries vs the per-turn rehydration ("hydration") signal.
  // TODO(rehydration): the Hydrations mode visualizes the rehydration selection, which is currently
  // disabled in turnBanding.ts. The toggle + highlighter are left intact but dormant; remove or restore
  // together when rehydration is redesigned.
  const [debugHighlightMode, setDebugHighlightMode] = useState<"dictionary" | "hydrations">("dictionary");
  const [disabledHydrations, setDisabledHydrations] = useState<Record<string, boolean>>({});
  const [debugSearch, setDebugSearch] = useState("");
  const [collapsedDebug, setCollapsedDebug] = useState<Record<string | number, boolean>>({});
  // When on (default), the viewer hides turns that aren't part of the live context — re-generated,
  // rolled-back (pruned), and aborted ones — leaving only the pages the AI currently sees.
  const [debugCurrentContextOnly, setDebugCurrentContextOnly] = useState(true);
  const visibleDebugTurns = useMemo(
    () => debugCurrentContextOnly
      ? debugTurns.filter((t) => !t.regenerated && !t.pruned && !t.aborted)
      : debugTurns,
    [debugTurns, debugCurrentContextOnly],
  );
  // Jump to the newest visible turn whenever the set changes (a turn is captured, or the filter toggles).
  useEffect(() => {
    if (visibleDebugTurns.length > 0) setDebugPage(visibleDebugTurns.length);
  }, [visibleDebugTurns.length]);
  const isMobile = useIsMobile();
  const [mobilePanel, setMobilePanel] = useState("game");
  const [showPotatoPCDialog, setShowPotatoPCDialog] = useState(false);
  const [isLocationModalOpen, setIsLocationModalOpen] = useState(false);

  /**
   * Move a stat by `delta`, clamped to its range. Deltas rather than absolute values because a turn's other
   * updates to the same stat may still be queued: React runs updaters in order, so this lands on their result
   * instead of overwriting it with a value read before they applied.
   */
  const adjustStatByName = useCallback((name: string, delta: number) => {
    setPlayerStats((prevStats) =>
      prevStats.map((stat) =>
        stat.name === name
          ? { ...stat, value: Math.max(stat.min, Math.min(stat.max, stat.value + delta)) }
          : stat,
      ),
    );
  }, [setPlayerStats]);
  const messagesPerPage = 2; // One AI message + one user message

  const handleRollback = () => {
    if (currentPage >= totalPages) return;
    const targetState = rollbackState(gameStates, currentPage);
    if (!targetState) return;
    // Restore the target turn's mechanical state, but keep the live narration + notes: the snapshot's frozen
    // history/notes predate any edit the player made after the turn, so re-injecting them would revert those
    // edits. Narration is rewound by slicing the live flat history to the rolled-back page instead.
    const success = loadGameState(targetState, locations, { keepLiveHistory: true });
    if (!success) return;
    // A render still in flight targets a turn this rollback discards — stop it, or its finished image
    // would land back under the dead turn id (and ride into any opted-in save, invisible and unprunable).
    cancelSceneImage();
    const rewound = sliceHistoryToPage(fullMessageHistory, currentPage, messagesPerPage);
    setFullMessageHistory(rewound);
    // Scene images live beside the history now, so a rolled-away turn's pictures have to be swept
    // explicitly — inside the message they used to go with it.
    setSceneImages((prev) => pruneSceneImages(prev, rewound));
    setUserPage(null); // the rolled-back turn is now the latest — resume following it
    // Seed the live notes scratchpad from the rolled-back turn's own notes (per-turn notes live on the
    // message, and keepLiveHistory skips the snapshot's notes) so a later re-generate/action uses them.
    setPlayerNotes(parseTurnContent(fullMessageHistory[pageAssistantIndex(currentPage, messagesPerPage)]?.content ?? '')?.notes ?? '');
    addSystemLogEntry("Rolled back to previous game state");
    // Mark the AI-context entries for the turns this rollback discarded (those after the page we
    // rolled back to). States after the current page are kept, allowing future "redo" functionality.
    setDebugTurns((prev) => markPrunedTurns(prev, currentPage));
  };

  // Export the whole playthrough's narration as a plain-text or Markdown file (user picks the format
  // via the export dialog). Same sanitized text either way — format only sets the extension + MIME.
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const exportStory = (format: 'txt' | 'md') => {
    const story = fullMessageHistory
      .filter((m) => m.role === 'assistant')
      .map((m) => stripReasoning(parseNarration(m.content)).trim())
      .filter((text) => text && text !== 'No narration available')
      .join('\n\n');
    const type = format === 'md' ? 'text/markdown' : 'text/plain';
    const slug = (worldOverview?.name || "world").replace(/[^a-z0-9]+/gi, "-").toLowerCase();
    downloadBlob(new Blob([story], { type }), `story-${slug}.${format}`);
    setIsExportModalOpen(false);
  };

  // Export the full AI-context turn history (exactly the structure the debug viewer renders) as JSON,
  // so it can be handed off for inspection.
  const handleExportDebugContext = () => {
    const blob = new Blob([JSON.stringify(debugTurns, null, 2)], { type: "application/json" });
    const slug = (worldOverview?.name || "world").replace(/[^a-z0-9]+/gi, "-").toLowerCase();
    downloadBlob(blob, `ai-context-${slug}.json`);
  };

  // Re-generate the current turn: restore the snapshot from *before* it (which also rewinds the
  // message history past it), then re-send the same player action for a fresh response. The re-send is
  // deferred via `regenerateNonce` below — sendGameAction reads game state from its render's closure,
  // so it must run after loadGameState has committed, not synchronously alongside it.
  const pendingRegenerateRef = useRef<string | null>(null);
  // The real (editable) opening text last submitted, kept so re-generating the opening can re-fill the box
  // with it — history stores only the "START GAME" proxy (parity), which would otherwise lose the edit.
  const openingActionRef = useRef<string>("");
  // Snapshot of the pre-game state (before the opening turn), so page 1 can also be re-generated —
  // gameStates only holds post-turn snapshots, so the first turn has no predecessor there. Captured in
  // sendGameAction on the first turn.
  const initialStateRef = useRef<ReturnType<typeof saveCurrentGameState> | null>(null);
  // A completed turn dispatches several state updates together (finalized message, applied stat changes,
  // advanced time). Saving the snapshot synchronously alongside them captures a stale, half-applied state
  // — and inside the async turn flow the closure's length is stale too, which misaligns gameStates. So we
  // defer the snapshot to the next commit (after the batch lands) and index it by its own history length.
  // Bumped when a turn's snapshot commits (forward turn or regenerate — undo restores state without committing
  // a new snapshot, so it never bumps this). Drives the autosave effect below.
  const [turnCommitNonce, setTurnCommitNonce] = useState(0);
  const { arm: armTurnSnapshot } = useDeferredSnapshot(
    fullMessageHistory,
    saveCurrentGameState,
    (snapshot) => {
      const pageIndex = snapshotPageIndex(snapshot.fullMessageHistory?.length ?? 0, messagesPerPage);
      setGameStates((prev) => placeSnapshot(prev, pageIndex, snapshot));
      setTurnCommitNonce((n) => n + 1);
    },
  );

  // Autosave after each completed turn's snapshot lands (the effect runs post-commit, so it captures this
  // turn). First fire is the opening scene; loaded games fire on their next completed turn. Silent on success,
  // toasts once on failure (see autosaveGame). Gated on the setting.
  useEffect(() => {
    if (turnCommitNonce === 0 || !autosaveEnabled) return;
    void autosaveGame(worldOverview.name, worldId ? String(worldId) : undefined);
    // Only re-fire on a new committed turn — reading the latest setting/world at fire time is intentional.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [turnCommitNonce]);
  const [regenerateNonce, setRegenerateNonce] = useState(0);

  const handleRegenerate = () => {
    if (!canRegenerate(currentPage, totalPages)) return;
    // Re-generating the opening turn (page 1) restores the pre-game state, not a gameStates entry. On a
    // loaded save that snapshot was never captured (initialStateRef is only set during a live first turn),
    // so reconstruct a pre-opening baseline from the current state with its history emptied — re-sending
    // START GAME from there re-captures initialStateRef and regenerates the opening.
    const previousState =
      regenerateState(gameStates, initialStateRef.current, currentPage) ??
      (currentPage === 1 ? { ...saveCurrentGameState(), fullMessageHistory: [] } : null);
    const action = lastTurnAction(fullMessageHistory);
    if (!previousState || action === null) return;
    // Restore the prior turn's mechanical state but keep the live narration + notes (see handleRollback),
    // rewinding the flat history to just before the turn being re-rolled. The re-send appends a fresh turn.
    loadGameState(previousState, locations, { keepLiveHistory: true });
    // Stop a render aimed at the turn being re-rolled: left running, it would finish into a dead turn id
    // AND overlap the re-roll's language-model request on the one GPU.
    cancelSceneImage();
    const rewound = sliceHistoryToPage(fullMessageHistory, currentPage - 1, messagesPerPage);
    setFullMessageHistory(rewound);
    setSceneImages((prev) => pruneSceneImages(prev, rewound)); // the re-rolled turn's pictures go with it
    // Carry the re-rolled turn's own notes onto the fresh turn (per-turn notes live on the message; the live
    // scratchpad still holds the pre-rollback latest turn's notes, which would otherwise be frozen in).
    setPlayerNotes(parseTurnContent(fullMessageHistory[pageAssistantIndex(currentPage, messagesPerPage)]?.content ?? '')?.notes ?? '');
    // Mark the current turn's AI-context entry as superseded; sendGameAction appends a fresh one.
    setDebugTurns((prev) => markRegeneratedTurn(prev));
    // Re-generating the opening (page 1) returns to the not-started state and re-fills the box with the
    // prior opening action, so the player can edit their starting action before re-submitting it.
    if (currentPage === 1) {
      setIsGameStarted(false);
      // History holds the "START GAME" proxy, so recover the player's real opening text from the ref (falling
      // back to the default cue for a loaded save, where it was never captured this session).
      setPlayerInput(openingActionRef.current || (action === "START GAME" ? OPENING_SCENE_CUE : action));
      return;
    }
    pendingRegenerateRef.current = action;
    setRegenerateNonce((n) => n + 1);
  };

  // Read the committed latest turn + its originating action, or null when a partial re-generate can't run
  // (busy, not on the latest page, or the turn can't be parsed).
  const partialRegenTarget = () => {
    // A running scene render blocks these too: it holds the graphics card, and unlike rollback /
    // re-generate these keep the turn, so its picture is still the correct one and must not be canceled.
    if (isWaitingForAI || sceneImageJob !== null || !canRegenerate(currentPage, totalPages)) return null;
    const last = fullMessageHistory[fullMessageHistory.length - 1];
    if (!last || last.role !== "assistant") return null;
    const prev = parseTurnContent(last.content);
    const action = lastTurnAction(fullMessageHistory);
    if (!prev || action === null) return null;
    return { prev, action };
  };

  // Replace one slice of the latest assistant turn's JSON, preserving every other field.
  const patchLatestTurn = (patch: Partial<AITurnResult>) => {
    setFullMessageHistory((history) => {
      const updated = [...history];
      const i = updated.length - 1;
      const cur = i >= 0 && updated[i].role === "assistant" ? parseTurnContent(updated[i].content) : null;
      if (cur) updated[i] = { role: "assistant", content: JSON.stringify({ ...cur, ...patch }) };
      return updated;
    });
  };

  // Shared busy/abort wrapper for a partial re-generate (one aux request against the existing narration).
  const runPartialRegen = async (run: (signal: AbortSignal) => Promise<void>) => {
    const controller = new AbortController();
    abortControllerRef.current = controller;
    setIsWaitingForAI(true);
    try {
      await run(controller.signal);
    } catch (error) {
      addSystemLogEntry((error as Error).message);
    } finally {
      setIsWaitingForAI(false);
      setAiRequestType(null);
      if (abortControllerRef.current === controller) abortControllerRef.current = null;
    }
  };

  // Re-roll only the choices for the latest turn, keeping its narration and stats.
  const handleRegenerateChoices = () => {
    const target = partialRegenTarget();
    if (!target || !choicesEnabled) return;
    const { prev, action } = target;
    void runPartialRegen(async (signal) => {
      const presentNames = new Set([
        ...(prev.entities ?? []),
        ...recentParticipants(fullMessageHistory, CHOICES_PRESENCE_TURNS - 1),
      ]);
      const sceneEntities = allEntities.filter((e) => presentNames.has(e.name));
      const sceneLoc = withDiscovered(currentLocation);
      const response = await requestChoices(
        buildContextValues(),
        sceneEntityOverride(sceneLoc, sceneEntities),
        action,
        prev.narration ?? "",
        signal,
      );
      if (signal.aborted) return;
      const choices = parseChoices(response);
      setChoices(choices);
      patchLatestTurn({ choices });
      armTurnSnapshot();
    });
  };

  // Re-roll only the stat changes for the latest turn. Deltas are applied onto the pre-turn baseline
  // (not the current, already-changed stats), so repeated re-rolls don't stack.
  const handleRegenerateStats = () => {
    const target = partialRegenTarget();
    if (!target || !statUpdatesEnabled || playerStats.length === 0) return;
    const baseline = regenerateState(gameStates, initialStateRef.current, currentPage)?.playerStats;
    if (!baseline) return;
    const { prev, action } = target;
    void runPartialRegen(async (signal) => {
      const response = await requestStats(buildContextValues(), action, prev.narration ?? "", signal);
      if (signal.aborted) return;
      const { values, maxes } = parseStatUpdates(response);
      const statChanges = Object.entries(values).map(([k, v]) => ({ [k]: v }));
      // Mirror the live turn's stat commit: reset the per-turn bar deltas, apply max-cap + value deltas onto
      // the pre-turn baseline, then re-run the regen/starvation tick (thresholded on that baseline) WITHOUT
      // re-advancing game time. Not awaited, so regen stacks before stat code — the same order the live turn
      // uses. Without this the re-roll dropped the turn's regen and left stale held deltas on the bar.
      setHeldStatChanges({});
      // The turn's own measured duration, so a re-roll reproduces the regen and stat code the turn actually
      // charged rather than a flat hour (unmeasured turns store nothing and fall back to that hour anyway).
      // `gameTime` already includes this turn — only the latest turn is ever re-rolled — so it is the
      // end-of-turn elapsed the live pass used, and code re-derives the same value instead of drifting.
      const turnHours = prev.timeDelta ?? FLAT_HOURS_PER_TURN;
      applyStatChanges(statChanges, null, applyAiMaxChanges(baseline, maxes), {
        deltaHours: turnHours,
        elapsedHours: gameTime,
        calendar,
      });
      applyRegenTick(turnHours, baseline);
      patchLatestTurn({ stat_changes: statChanges });
      armTurnSnapshot();
    });
  };

  const addMessageToHistory = useCallback((role: ChatRole, content: string) => {
    setFullMessageHistory((prev) => [...prev, { role, content }]);
  }, [setFullMessageHistory]);

  // Assemble the history sent to the model. Banding (memoryDigests) keeps a recent
  // verbatim floor, folds older turns into a "story so far" digest band, and rehydrates a few older turns
  // the action lexically touches; otherwise the legacy verbatim-newest-first trim. Keywords come from the
  // player's `action` only — seeding from full narration over-matches and rehydrates everything. The
  // meter passes no action, so it shows the steady-state band cost with no rehydration.
  const lastBandCountsRef = useRef<BandCounts | null>(null);
  // Last live turn's band membership, fed back as ranking hysteresis. Only the live narration call
  // updates it, so the planner and the context meter rank against the same incumbents the real turn
  // did instead of chasing their own intermediate bands.
  const lastBandIdsRef = useRef<Set<string>>(new Set());

  // The milestone turn ids removed from every stage's history: the selector's verdict (only over turns
  // it actually saw; unseen turns always survive) with the player's pins applied on top. Recomputed
  // cheaply — the AI call itself lives in the selection drainer below. Only AGED candidates filter
  // context; a fresh turn's verdict is display-only until it leaves the narration verbatim floor.
  // The player's memory override layer, applied at the single point every memory consumer reads through:
  // rewrites replace the digest text, tombstoned turns lose their summary (so they leave the band, the
  // selector's input and semantic retrieval while their narration still rides the floor), and hand-written
  // notes ride the recap at their anchor. Nothing here mutates the stored history — clearing an override
  // restores the AI's original.
  const memoryOverrides = useMemo(
    () => ({ edits: memoryEdits, deleted: memoryDeleted, notes: memoryNotes }),
    [memoryEdits, memoryDeleted, memoryNotes],
  );
  const effectiveNotes = useMemo(() => activeNotes(memoryOverrides), [memoryOverrides]);
  const parseEffectiveTurns = useCallback(
    (history: ChatMessage[]) => applyMemoryOverrides(parseTurns(history), memoryOverrides),
    [memoryOverrides],
  );

  const getMilestoneDrop = useCallback((turns: ReturnType<typeof parseTurns>) => {
    const candidates = agedMilestoneCandidates(turns, narrationVerbatimTurns);
    if (candidates.length === 0) return null;
    const selection = milestoneSelection
      ? {
          seen: new Set(milestoneSelection.seen),
          selected: milestoneSelection.selected === null ? null : new Set(milestoneSelection.selected),
        }
      : null;
    return resolveMilestoneDrop(candidates, selection, memoryPins);
  }, [milestoneSelection, memoryPins, narrationVerbatimTurns]);

  // `liveRecall` marks the real turn's call: it evaluates the cooldown at the current turn and
  // records what fired. The meter leaves it false and replays the live call's window.
  // buildContextValues is declared further down (it depends on callbacks defined below), so the history
  // builder reaches it through a ref rather than the closure — same dodge as makeAIRequestRef.
  const buildContextValuesRef = useRef<(loc?: GameLocation | null) => Record<string, string>>(() => ({}));

  const getTrimmedMessageHistory = useCallback((promptTokens = 0, action = "", relevanceScores: Map<string, number> | null = null, actionVec: Float32Array | null = null, liveRecall = false) => {
    const turns = parseEffectiveTurns(fullMessageHistory);
    if (memoryDigests) {
      const keywords = extractKeywords(action, dictionary);
      // Entities the action references (case-insensitive — actions are lowercase) drive participation rehydration.
      const actionEntities = findEntityNames(action, allEntities, { requireCapital: false });
      const rehydrateCap = Math.round(Math.max(0, contextWindow - promptTokens - maxTokens) * 0.25);
      // Semantic rehydration: rank the old scenes this action returns to (threshold + near-duplicate
      // guard in lib/semanticRehydration). Floor/band split here is the budget-free approximation of
      // buildBandedHistory's; it re-validates band membership before spending tokens.
      let semanticRehydrate: string[] | null = null;
      if (semanticRehydration && semanticMemory && actionVec) {
        const floorCount = Math.min(narrationVerbatimTurns, turns.length);
        const floorTurns = turns.slice(turns.length - floorCount);
        const drop = getMilestoneDrop(turns);
        const band = turns.slice(0, turns.length - floorCount).filter(
          (t) => t.summary?.trim() && !(drop && t.turnId && drop.has(t.turnId)),
        );
        const recallTurn = liveRecall ? turns.length : lastRecallTurnRef.current ?? turns.length;
        const blocked = rehydrationCooldownBlocked(rehydrateLastFiredRef.current, recallTurn);
        semanticRehydrate = selectSemanticRehydrations(band, floorTurns, actionVec, embedVectorsRef.current, blocked);
        if (liveRecall) {
          lastRecallTurnRef.current = recallTurn;
          for (const id of semanticRehydrate) rehydrateLastFiredRef.current.set(id, recallTurn);
        }
      }
      // The recap's "where things stand" closer: mid-scene anchor (location + recent participants) plus
      // the player's standing notes. Probed on real failure turns (now-line-probe.mjs): removed the
      // scene-reset / roleplay-identity-inversion class entirely; without it the recap reads as backstory.
      // In-world time (experimental): each remembered moment is stamped with when it happened — the recap
      // otherwise reads as an undated chronicle (docs-internal/time-system-design.md).
      const stamp = timeContext ? buildStamper({ nowHours: gameTime, hoursAt: hoursByPosition(turns), calendar }) : undefined;
      // Assembled from the same context values every other prompt uses: each chip carries its own wording
      // in its affixes and disappears with its value, so any combination still reads as a sentence.
      const nowLine = currentLocation ? renderPromptTemplate(nowLinePrompt, buildContextValuesRef.current()) : undefined;
      const { messages, counts, bandTurnIds, rehydratedTurnIds } = buildBandedHistory({
        turns,
        contextWindow,
        promptTokens,
        maxTokens,
        verbatimFloor: narrationVerbatimTurns,
        keywords,
        actionEntities,
        rehydrateCap,
        maxRehydrations: DIGEST_MAX_REHYDRATIONS,
        milestoneDrop: getMilestoneDrop(turns),
        recapPrompt: recapUserPrompt,
        nowLine,
        relevanceScores,
        bandCap: semanticMemory ? semanticBandCap : 0,
        stickyIds: lastBandIdsRef.current,
        semanticRehydrate,
        rehydratePrompt: rehydrateUserPrompt,
        notes: effectiveNotes,
        stamp,
      });
      lastBandCountsRef.current = counts;
      // `liveRecall` is the real turn's call — the AI-context preview builds the same band with it off, so
      // gating here keeps the Memory panel reporting what was actually sent rather than what a preview drew.
      if (liveRecall) {
        lastBandIdsRef.current = new Set(bandTurnIds);
        setContextMemoryIds(bandTurnIds);
        setRehydratedMemoryIds(rehydratedTurnIds);
      }
      return messages;
    }
    lastBandCountsRef.current = null;
    // Digests off: no band to anchor into, so the player's own memories lead as a standing block.
    return buildVerbatimHistory(turns, contextWindow, promptTokens, maxTokens, effectiveNotes, recapUserPrompt);
  }, [fullMessageHistory, contextWindow, maxTokens, memoryDigests, semanticMemory, semanticRehydration, semanticBandCap, dictionary, allEntities, narrationVerbatimTurns, getMilestoneDrop, recapUserPrompt, rehydrateUserPrompt, currentLocation, parseEffectiveTurns, effectiveNotes, timeContext, gameTime, calendar, nowLinePrompt, setContextMemoryIds, setRehydratedMemoryIds]);

  // The action's embedding, shared by every semantic consumer this turn (band relevance + lore
  // activation) so the action is embedded once. Null when no semantic feature is on, the model is
  // cold, the action is empty, or the worker stalls (the 2s race bounds a wedged worker, not normal
  // inference (~ms)) — consumers then fail open. Query is the BARE action: appending location or
  // participants measurably poisons ranking — location terms dominate MiniLM similarity, so every
  // digest mentioning the current place outscores the memory the action is actually about
  // (semantic-band-probe trim stage: the letter target ranked 15/28 with the location clause, 5/28
  // without; all four planted targets survive action-only).
  const embedActionVec = useCallback(async (action: string): Promise<Float32Array | null> => {
    const anySemantic = semanticLore || (semanticMemory && (memoryDigests || (semanticDiaries && characterDiaries)));
    if (!anySemantic || !isEmbeddingModelReady() || !action.trim()) return null;
    try {
      const vecs = await Promise.race([
        embedTexts([action]),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), 2000)),
      ]);
      return vecs && vecs.length > 0 ? vecs[0] : null;
    } catch {
      return null;
    }
  }, [semanticMemory, memoryDigests, semanticLore, semanticDiaries, characterDiaries]);

  // Semantic memory: score every digest against the current action so band trimming can drop the least
  // relevant memory instead of the oldest. Null on ANY miss (feature off, no action vector, a digest
  // not yet embedded) — banding then falls back to oldest-first; a degraded score set must never
  // silently change which memories ride.
  const computeRelevanceScores = useCallback((actionVec: Float32Array | null): Map<string, number> | null => {
    if (!actionVec || !semanticMemory || !memoryDigests) return null;
    return buildRelevanceScores(parseEffectiveTurns(fullMessageHistory), actionVec, embedVectorsRef.current);
  }, [semanticMemory, memoryDigests, fullMessageHistory, parseEffectiveTurns]);

  // Drive body morphs from the viewed stats (live on the latest page, the paged turn's when viewing the
  // past): each stat's bound sliders track its value (min→max → 0→1 influence), so the avatar re-morphs to
  // match whatever turn is on screen.
  useEffect(() => {
    setBodyMorphValues(statMorphMap(viewStats));
  }, [viewStats, setBodyMorphValues]);

  // Ambient audio follows the viewed location (the paged turn's when browsing history, the live one
  // otherwise). Centralizing it here also fixes the load/rollback gap where `loadGameState` set the
  // location without its ambient sound (only `changeLocation` did).
  useEffect(() => {
    const loc = locations.find((l) => l.id === viewLocationId);
    setAmbientSound(loc?.ambientSound ?? null);
  }, [viewLocationId, locations]);

  // Regen + starvation for `hours`, WITHOUT advancing game time. Split out from handleTimePassed so a stat
  // re-roll can re-apply the same tick (a re-roll must not lose the turn's regen, but must not re-advance
  // time either). `thresholdStats` is the pre-turn stats the starvation check reads, so a re-roll thresholds
  // on the same pre-turn Hunger the original turn did rather than the re-rolled value.
  const applyRegenTick = useCallback(
    (hours: number, thresholdStats: PlayerStat[]) => {
      // New turn's changes are landing — make sure any pending text fade-out flag is cleared so this
      // turn's delta text shows normally (covers a response that beat the submit-time fade timer).
      setRecentStatFading(false);

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

      // Update recent (fading text) and held (persistent bar) stat changes with regen changes.
      const mergeRegen = (prev: Record<string, number>) => {
        const newChanges = { ...prev };
        Object.entries(regenChanges).forEach(([key, value]) => {
          newChanges[key] = (newChanges[key] || 0) + value;
        });
        return newChanges;
      };
      setRecentStatChanges(mergeRegen);
      setHeldStatChanges(mergeRegen);

      const health = thresholdStats.find((s) => s.name === "Health");
      const hunger = thresholdStats.find((s) => s.name === "Hunger");
      if (health && hunger) {
        // This turn's AI changes and the regen above are both still queued, so the penalty subtracts via an
        // updater, which lands on the regenerated Health rather than overwriting it. The threshold reads the
        // pre-turn Hunger (thresholdStats), which the caller passes explicitly.
        if (hunger.value <= 20) {
          const healthLoss = 5 * hours;
          adjustStatByName("Health", -healthLoss);
          // The loss scales by the turn's measured hours, so it's usually fractional — the log reads to a
          // tenth rather than printing the raw float. The stat still takes the exact amount.
          addLogEntry(`You're starving! Lost ${Math.round(healthLoss * 10) / 10} health.`);
          // Add health loss to recent changes
          const applyLoss = (prev: Record<string, number>) => ({
            ...prev,
            health: (prev.health || 0) - healthLoss,
          });
          setRecentStatChanges(applyLoss);
          setHeldStatChanges(applyLoss);
        }
      }
    },
    [adjustStatByName, addLogEntry, setPlayerStats, setRecentStatChanges, setHeldStatChanges, setRecentStatFading],
  );

  const handleTimePassed = useCallback(
    (hours: number) => {
      setGameTime((prevTime) => prevTime + hours);
      // Threshold on the pre-turn stats (playerStats here is still this render's pre-commit snapshot).
      applyRegenTick(hours, playerStats);
    },
    [applyRegenTick, setGameTime, playerStats],
  );

  const getEndpointUrl = () => endpointUrl;

  const generateTraitDescriptions = useCallback((format: 'simple' | 'markdown' | 'xml' = 'simple') => {
    if (!playerTraits.length) {
      return NONE_PLACEHOLDER;
    }
    // Group-aware: each selected trait's group emits its AI header above its traits (blank → omitted).
    return buildTraitContext(playerTraits.map((t) => t.id), playerTraits, traitGroups, format);
  }, [playerTraits, traitGroups]);


  // The six shared context chips every system prompt can reference, resolved from current state. Each
  // request spreads these as its base, then layers on its own tokens (length/markdown, scene entities, etc.).
  // Replace placeholder chips in authored text with their frozen per-playthrough values (pure lookup — rolls
  // are primed below, so no side effects). Applied at every boundary that emits authored text to the AI.
  const resolvePH = useCallback(
    (text: string) => resolvePlaceholders(text, { placeholders, rolls: placeholderRolls }),
    [placeholders, placeholderRolls],
  );

  // Scene-roster override for the entity chips. Choices/re-roll prompts must see only who is actually in the
  // scene, not the whole location roster — so replace EVERY unscoped <ENTITIES> variant (full/summary × the
  // three formats). Missing one (the xml pair was the bug) lets an edited prompt using that chip slip the
  // full roster past the presence filter. Mirrors the variant set addScoped() emits for the "" entity scope.
  const sceneEntityOverride = useCallback(
    (sceneLoc: GameLocation | null, sceneEntities: Entity[]): Record<string, string> => {
      const build = (opts: { preferSummary?: boolean; format?: "markdown" | "xml" }) =>
        resolvePH(buildEntityContext(sceneLoc, sceneEntities, opts));
      return {
        "<ENTITIES>": build({}),
        "<ENTITIES|markdown>": build({ format: "markdown" }),
        "<ENTITIES|xml>": build({ format: "xml" }),
        "<ENTITIES|summary>": build({ preferSummary: true }),
        "<ENTITIES|summary.markdown>": build({ preferSummary: true, format: "markdown" }),
        "<ENTITIES|summary.xml>": build({ preferSummary: true, format: "xml" }),
      };
    },
    [resolvePH],
  );

  // The README is authored text shown to the player, so its chips resolve like any other.
  const readmeResolved = useMemo(() => resolvePH(readmeText), [resolvePH, readmeText]);

  // Eager priming: once a save is active, roll every Wildcard placement across the world's authored text and
  // freeze it into the save (a loaded save's existing rolls are kept). Resolution then stays a pure lookup.
  useEffect(() => {
    if (!isGameStarted || placeholders.length === 0) return;
    const texts = [
      worldOverview.systemPrompt || "",
      worldOverview.readme || "",
      ...entities.flatMap((e) => [e.playerDescription, e.aiDescription, e.aiSummary]),
      ...locations.flatMap((l) => [l.playerDescription, l.aiDescription, l.aiSummary, l.description]),
      ...dictionaries.flatMap((b) => b.entries.map((en) => en.value)),
    ].filter((t): t is string => !!t);
    setPlaceholderRolls((prev) => primeRolls(placeholders, texts, prev));
  }, [isGameStarted, placeholders, entities, locations, dictionaries, worldOverview, setPlaceholderRolls]);

  // True while the story's opening hour is still unmeasured and about to be asked for — i.e. the clock is on
  // and the opening turn hasn't committed. A game that started with the clock off keeps `startHour` null
  // forever, but `isGameStarted` is true by then, so it is never treated as pending.
  const openingHourPending = aiClock && startHour === null && !isGameStarted;

  const buildContextValues = useCallback((locationOverride?: GameLocation | null): Record<string, string> => {
    // The location this turn is scoped to — an override (e.g. a move auto-applied before the narration)
    // or the live current location.
    const loc = locationOverride ?? currentLocation;
    // Who's present at the location (authored + any discovered/visiting), used to keep the
    // reachable-entities roster from re-listing someone who has already come over.
    const presentIds = withDiscovered(loc)?.entities ?? [];
    const here = withDiscovered(loc);
    type CtxOpts = { preferSummary?: boolean; nameOnly?: boolean; format?: "simple" | "markdown" | "xml" };

    // Entity roster precedence: here > sub-location > reachable. A character shows only in the highest scope
    // it belongs to — sub-location drops anyone present here; reachable drops present + sub-location ids.
    const subEntityIds = sublocationEntityIds(loc, locations);
    const reachableExclude = [...presentIds, ...subEntityIds];

    // The <LOCATION> and <ENTITIES> chips each carry a `scope` axis; each scope maps to its builder.
    const locationScopes: Record<string, (opts: CtxOpts) => string> = {
      "": (opts) => buildLocationContext(loc, opts),
      sublocations: (opts) => buildSublocationsContext(loc, locations, opts),
      parent: (opts) => buildParentLocationContext(loc, locations, opts),
      reachable: (opts) => buildReachableLocationsContext(loc, locations, opts),
      destinations: (opts) => buildDestinationsContext(loc, locations, opts),
    };
    const entityScopes: Record<string, (opts: CtxOpts) => string> = {
      "": (opts) => buildEntityContext(here, allEntities, opts),
      sublocations: (opts) => buildSublocationEntitiesContext(loc, locations, allEntities, { ...opts, excludeIds: presentIds }),
      reachable: (opts) => buildReachableEntitiesContext(loc, locations, allEntities, { ...opts, excludeIds: reachableExclude }),
      // Who has actually taken part lately, minus anyone the dialogue merely kept naming: an authored
      // entity who lives elsewhere is dropped, while ad-hoc and just-arrived characters stay (visitors
      // reach `presentIds` through the discovered-entity path).
      inscene: (opts) => buildSceneEntitiesContext(
        scenePresentHere(recentParticipants(fullMessageHistory, CHOICES_PRESENCE_TURNS), allEntities, presentIds),
        allEntities,
        opts,
      ),
    };

    // Render each Stats token from its decoded pieces (Values/Status/Meaning) + format.
    const statsValues = Object.fromEntries(
      STATS_TOKENS.map((tok) => {
        const sel = decodeVariant(STATS_VARIABLE, tokenVariant(tok));
        return [tok, buildStatContext(
          playerStats,
          { values: sel.numbers != null, status: sel.descriptions != null, meaning: sel.meaning != null },
          sel.format === 'markdown' ? 'markdown' : sel.format === 'xml' ? 'xml' : 'simple',
        )];
      }),
    );
    const values: Record<string, string> = {
      "<WORLD DESCRIPTION>": worldOverview.systemPrompt || "",
      ...statsValues,
      "<TRAITS DESCRIPTION>": generateTraitDescriptions('simple'),
      "<TRAITS DESCRIPTION|markdown>": generateTraitDescriptions('markdown'),
      "<TRAITS DESCRIPTION|xml>": generateTraitDescriptions('xml'),
      "<NOTES>": playerNotes || NONE_PLACEHOLDER,
      // The story clock as a plain inline value. Off ⇒ the uniform placeholder, so an affixed placement
      // (the now-line's) simply vanishes and the setting needs no special case anywhere else.
      // Also withheld until the opening hour is known: on the opening turn the clock would read the
      // untested 08:00 default, and the opening-time pass is about to ask the model what time it is from
      // that very narration. Telling it first would make the answer a restatement of the guess.
      "<TIME>": timeContext && !openingHourPending ? formatAbsolute(gameTime, calendar) : NONE_PLACEHOLDER,
    };

    // Generate every scope × content (full/summary/name) × format (simple/markdown/xml) variant token. The id order
    // (scope.content.format) mirrors the chip's axis order, so tokens match what encodeVariant produces.
    const formats: { id: string; format: CtxOpts["format"] }[] = [
      { id: "", format: "simple" },
      { id: "markdown", format: "markdown" },
      { id: "xml", format: "xml" },
    ];
    // The content axis is three-way: full detail, the short AI summary, or bare names for use mid-sentence.
    const contents: { id: string; opts: CtxOpts }[] = [
      { id: "", opts: {} },
      { id: "summary", opts: { preferSummary: true } },
      { id: "name", opts: { nameOnly: true } },
    ];
    const addScoped = (base: string, scopes: Record<string, (opts: CtxOpts) => string>) => {
      for (const [scope, build] of Object.entries(scopes)) {
        for (const { id: contentId, opts: contentOpts } of contents) {
          for (const { id: fmtId, format } of formats) {
            const id = [scope, contentId, fmtId].filter(Boolean).join(".");
            const token = id ? `${base.slice(0, -1)}|${id}>` : base;
            values[token] = build({ ...contentOpts, format });
          }
        }
      }
    };
    addScoped("<LOCATION>", locationScopes);
    addScoped("<ENTITIES>", entityScopes);

    // Resolve placeholder chips in every assembled value before it's folded into a prompt.
    for (const k in values) values[k] = resolvePH(values[k]);
    return values;
  }, [
    worldOverview, playerStats, generateTraitDescriptions,
    currentLocation, locations, withDiscovered, allEntities, playerNotes, resolvePH,
    fullMessageHistory, timeContext, gameTime, calendar, openingHourPending,
  ]);
  buildContextValuesRef.current = buildContextValues;

  // Live variable values for the Settings prompt-editor Preview tab (full-description variant, like the
  // game-text request). Only meaningful in-game, which is the only place this modal receives them.
  const promptPreviewValues = useMemo<Record<string, string>>(() => ({
    ...buildContextValues(),
    "<LENGTH GUIDANCE>": lengthGuidance(paragraphLimit, maxTokens),
    "<MARKDOWN GUIDANCE>": restyle(markdownGuidance(markdownOutput), activeSectionStyle),
    "<ACTIVE CHARACTER GUIDANCE>": activeCharacterGuidance(limitActiveCharacters, activeCharacterLimit),
    "<DICTIONARY>": "keyword-triggered lore active this turn (or N/A)",
    "<DICTIONARY|before>": "background lore active this turn (or N/A)",
    // Illustrative placeholders for the aux user-message templates (real values are per-turn at runtime).
    "<PLAYER ACTION>": "the player's latest action",
    "<NARRATION>": "the most recent narration",
    "<CHARACTER NAME>": "the speaking character",
  }), [buildContextValues, paragraphLimit, maxTokens, markdownOutput, activeSectionStyle, limitActiveCharacters, activeCharacterLimit]);

  const sendGameAction = async (action: string) => {
    // The opening turn is simply any action taken before the game has started (the player submits the
    // pre-filled, editable opening cue). It sends its text verbatim and flips isGameStarted on success.
    const isOpeningTurn = !isGameStarted;
    // Only narration sees the real opening text; every other consumer (stats, planner, choices, dictionary
    // triggers, stored history) sees the terse "START GAME" proxy, exactly as before the opening became
    // editable — the full cue is a narrator directive that derails those prompts. Zero behavior change vs.
    // the old flow when the box is left at its default; edits flow to narration only.
    const effectiveAction = isOpeningTurn ? "START GAME" : action;
    if (isOpeningTurn) openingActionRef.current = action;
    setUserPage(null); // taking an action resumes following, so the player sees their new turn land
    stopCommandPreview(); // a real turn supersedes any command preview
    // On the opening turn, snapshot the pre-game state so page 1 can be re-generated later.
    if (fullMessageHistory.length === 0) initialStateRef.current = saveCurrentGameState();

    // One AbortController for the whole turn, so Stop aborts every sub-request — not just the active one.
    const controller = new AbortController();
    abortControllerRef.current = controller;
    const { signal } = controller;
    setIsWaitingForAI(true);
    // Not revealing yet — the narration stream (below) flips this on. Until then the reveal view shows
    // the committed narration, never the stale last-turn text (which would otherwise animate all at once
    // during setup, most visibly on re-generate).
    setIsRevealingNarration(false);

    try {
      // Drain last turn's stat-bar colors and fade any lingering delta text now (they clear during the AI
      // wait), so this turn's changes animate onto clean bars.
      drainStatFeedback();
      // Clear the box now (the action is captured in `action`), so anything the player types
      // after choices unlock the box isn't wiped when the turn finishes.
      setPlayerInput("");
      setChoices([]);
      setChoicesReady(false);
      setSuggestedLocation(null);
      // Stamp a stable id for this turn, written into its assistant JSON (powers the digest apply-guard).
      currentTurnIdRef.current = randomUUID();
      // This turn hasn't entered history yet; an abort before the user message is added (the up-front
      // location request) must not be mistaken for "narration came through" (see abortGeneration).
      userTurnAddedRef.current = false;
      // Start a new turn in the AI-context history (cap to the last 50 turns).
      pendingDictionaryDebugRef.current = null;
      setDebugTurns((prev) => [...prev, { action: effectiveAction, requests: [], turnId: currentTurnIdRef.current }].slice(-50));

      // With auto-apply on, resolve the location change up front — from the action alone, before any
      // context is built — so the whole turn (narration, lore, staged planning) runs in the new location.
      // Fed only the action here (no narration exists yet); the trailing suggest request is skipped, and
      // the move itself is applied once the narration commits (below), so an abort leaves it unchanged.
      let turnLocation = currentLocation;
      // Nowhere to go means nothing to route: the reply is matched against this exact list, so with it
      // empty the call cannot produce a move however the model answers. The old guard asked whether the
      // WORLD had more than one location, which is a different question — a world of unconnected
      // top-level locations passed it and then burned a request every turn that could only ever be
      // discarded (measured: 50/50 turns of a real session, destinations rendered "N/A" throughout).
      const destinations = currentLocation ? navigableDestinations(currentLocation, locations) : [];
      if (!isOpeningTurn && locationAutoApply && locationChangeEnabled && destinations.length > 0 && locationChangePromptText && currentLocation) {
        const preMoveCtx = buildContextValues();
        const locationResponse = await makeAIRequest(
          renderPromptTemplate(locationChangePromptText, preMoveCtx),
          [{ role: "user", content: renderPromptTemplate(locationChangeUserPrompt, { "<PLAYER ACTION>": action }) }],
          "locationChange",
          null,
          signal,
        );
        if (signal.aborted) return;
        const matchedName = matchLocationResponse(locationResponse, destinations.map((loc) => loc.name));
        const target = matchedName ? destinations.find((loc) => loc.name === matchedName) : undefined;
        if (target && target.id !== currentLocation.id) turnLocation = target;
      }

      // The shared context base (incl. all three Stats-chip variants), scoped to this turn's location;
      // every system-prompt render below spreads it and adds its own tokens.
      const ctx = buildContextValues(turnLocation);

      // Dictionary/lorebook entries active this turn. The scan corpus is exactly the context the AI is given —
      // whichever location/entity blocks this prompt renders, in their rendered form — so anything the model
      // can read can fire a trigger, and nothing it can't. Always-present scaffolding (world description,
      // stats/traits, guidance) is excluded; see `buildScanCorpus`. History honors each entry's `scanDepth`.
      const dictCorpus = buildScanCorpus({
        template: systemPrompt,
        ctx,
        action: effectiveAction,
        // The prompt shows the resolved <NOTES> chip, or the raw fallback section when it has no chip.
        notes: systemPrompt.includes("<NOTES>") ? ctx["<NOTES>"] : playerNotes,
        history: fullMessageHistory,
      });
      // One action embedding for every semantic consumer this turn (lore activation here, band
      // relevance below). Null = all semantic features quietly off for this turn.
      const actionVec = await embedActionVec(effectiveAction);
      const activationReport = explainActivation(dictionary, dictCorpus.scene, { history: dictCorpus.history });
      if (semanticLore && actionVec) {
        // Additive meaning-based activations; a keyword reason always wins (see lib/semanticDictionary).
        applySemanticLore(activationReport, selectSemanticLore(dictionary, actionVec, embedVectorsRef.current));
      }
      const activatedEntries = dictionary.filter(
        (e) => e.enabled !== false && activationReport.byId.get(e.id)?.activated,
      );
      // Split by position into the two lorebook blocks. When the active prompt has no "before" chip, those entries
      // fall back into the single "after" block so no lore is lost; a prompt with no dictionary chip at all gets a
      // code append below (as before the chips existed).
      const hasBeforeChip = systemPrompt.includes("<DICTIONARY|before>");
      const hasAfterChip = systemPrompt.includes("<DICTIONARY>");
      const beforeEntries = hasBeforeChip ? activatedEntries.filter((e) => e.position === "before") : [];
      const afterEntries = activatedEntries.filter((e) => !beforeEntries.includes(e));

      // Code-generated blocks (markdown guidance, notes fallback, dictionary) are authored in markdown, so
      // restyle them to the active preset's section style to match the authored prompt's headers.
      let updatedPrompt = renderPromptTemplate(systemPrompt, {
        ...ctx,
        "<LENGTH GUIDANCE>": lengthGuidance(paragraphLimit, maxTokens),
        "<MARKDOWN GUIDANCE>": restyle(markdownGuidance(markdownOutput), activeSectionStyle),
        "<DICTIONARY>": resolvePH(buildDictionaryContext(afterEntries, false)) || NONE_PLACEHOLDER,
        "<DICTIONARY|before>": resolvePH(buildDictionaryContext(beforeEntries, false)) || NONE_PLACEHOLDER,
      });

      // If the prompt has no <NOTES> chip, fall back to a notes section before the location data.
      if (!systemPrompt.includes("<NOTES>")) {
        const notesSection = restyle(`
## Player Notes
${playerNotes || NONE_PLACEHOLDER}

`, activeSectionStyle);
        // Locate the location header in whichever style the active prompt uses.
        const locationIndex = updatedPrompt.search(/^#{0,6}[ \t]*Current Location:?/mi);
        if (locationIndex !== -1) {
          updatedPrompt =
            updatedPrompt.slice(0, locationIndex) +
            notesSection +
            updatedPrompt.slice(locationIndex);
        }
      }

      if (language.toLowerCase() != "english")
        updatedPrompt += `\n Narration language: ` + language;

      // Backward-compat: a prompt with no "after" dictionary chip still gets its lore appended (with heading), as
      // it was before the chip existed. (A missing "before" chip already routed those entries into `afterEntries`.)
      if (!hasAfterChip) {
        const dictionaryContext = resolvePH(buildDictionaryContext(afterEntries));
        if (dictionaryContext) {
          updatedPrompt += `\n\n${restyle(dictionaryContext, activeSectionStyle)}`;
        }
      }

      // Get trimmed history before adding new action (history fills the window left by the prompt).
      // Pass the action so banding can rehydrate older turns it references. Relevance scores are
      // computed once here and shared with the planner rebuild below so both stages trim identically.
      const relevanceScores = computeRelevanceScores(actionVec);
      // The context meter re-trims with the same scores + action vector so its counts mirror this turn.
      lastRelevanceScoresRef.current = relevanceScores;
      lastActionVecRef.current = actionVec;
      const trimmedHistory = getTrimmedMessageHistory(estimateTokens(updatedPrompt.length), effectiveAction, relevanceScores, actionVec, true);

      // Create message array for game text request
      const narrationMessages: ChatMessage[] = [
        ...trimmedHistory,
        // Opening turn sends the player's (editable) cue text verbatim; the legacy "START GAME" sentinel
        // (baseline harness / fixtures) still maps to the default cue. Later turns send the bare action —
        // no "Player action:" wrapper — matching the stored history shape (format-arms probe: bare beats
        // wrapped on quoted-dialogue rate with no guardrail cost). The user template defaults to exactly
        // <PLAYER ACTION> (byte-identical to bare) and applies ONLY with thinking off — the template is
        // a non-thinking experimentation surface; plan/inline modes always send the bare action so their
        // appended directives (plan notes, <think>) never sandwich against custom text. History stays bare.
        {
          role: "user",
          content: (() => {
            const actionText = isOpeningTurn ? (action === "START GAME" ? OPENING_SCENE_CUE : action) : action;
            // OOC channel: bracket turns get the rider appended in the high-recency slot (thinking-off
            // lane only — plan/inline modes append their own directives and send the bare action).
            const oocRider = hasOocDirective(actionText) && oocDirectivePrompt.trim() ? `\n\n${oocDirectivePrompt}` : "";
            return thinkingMode === "off"
              ? renderPromptTemplate(narrationUserPrompt, { "<PLAYER ACTION>": actionText }) + oocRider
              : actionText;
          })(),
        },
      ];

      // AI-context capture. Every scanned source is a string the prompt genuinely contains, so the viewer can
      // locate each match directly — no re-derivation, and the highlights cannot drift from what activated.
      // Recursion hits point at an active entry's value, which the injected lore block shows verbatim.
      {
        const report = activationReport.entries;
        const recursionSources: ScanSource[] = activatedEntries
          .filter((e) => e.value)
          .map((e) => ({ region: `recursion:${e.id}`, text: e.value }));
        // Keep only the scanned strings a hit actually landed in, so the debug/export JSON stays lean.
        const hitRegions = new Set(report.flatMap((e) => e.hits.map((h) => h.region)));
        const sources = [...dictCorpus.scene, ...dictCorpus.history, ...recursionSources]
          .filter((s) => hitRegions.has(s.region));
        pendingDictionaryDebugRef.current = { report, sources };
      }

      // Add user message to history after getting trimmed history. Stores the proxy on the opening turn so
      // later turns' context is byte-identical to the old flow (the real opening text lives in openingActionRef).
      addMessageToHistory("user", effectiveAction);
      userTurnAddedRef.current = true;

      // Optional thinking step (runs exactly once). 'precall' and 'staged' produce a hidden plan
      // (captured in turnPlan and attached to the final user turn below); 'inline' appends a <think>
      // directive to the game-text request (the reasoning is stripped before the player sees it).
      let turnPlan = "";
      // Staged-only candidates the narration confirms later: ad-hoc = director-invented (no entity
      // record, strict match); director = defined entities the director cast (loose match, since the
      // director already vouched they're present — "the tank" can confirm a "Battle Tank").
      const adHocCandidates: string[] = [];
      const directorCandidates: string[] = [];
      // The turn's planner cast (present beings, with aliases) — the live scene list is sourced from this,
      // not from narration name-matching, so a merely-mentioned character never appears. Null when no
      // planner ran (Off/Inline), where the scene list falls back to the narration parse.
      let sceneCast: DirectorCastMember[] | null = null;
      // All past narration the player has read — the corpus for "has this name been revealed yet?" (drives
      // both the plan sanitizer and each scene-list row's reveal state).
      const priorNarration = fullMessageHistory
        .filter((m) => m.role === "assistant")
        .map((m) => parseNarration(m.content))
        .join("\n");
      if (thinkingMode === "precall") {
        const thinkPrompt = renderPromptTemplate(thinkingPrompt, ctx);
        // Frame the planning task as a single instruction. Reusing the narration message history
        // (turns of action -> story) primes the model to just continue the story instead of planning.
        // The last assistant message is the recent floor turn's real narration, so pull it straight
        // from history.
        let lastStory =
          [...trimmedHistory].reverse().find((m) => m.role === "assistant")?.content || "";
        // Planning needs the least context: the immediate turn verbatim, everything older summarized.
        // When banding is on, rebuild with a floor of 1 (no rehydration) so prior turns are all digests.
        let digestBand = "";
        if (memoryDigests) {
          const plannerTurns = parseEffectiveTurns(fullMessageHistory);
          const planner = buildBandedHistory({
            turns: plannerTurns,
            contextWindow,
            promptTokens: estimateTokens(thinkPrompt.length),
            maxTokens: 256,
            verbatimFloor: thinkingVerbatimTurns,
            keywords: [],
            actionEntities: [],
            rehydrateCap: 0,
            maxRehydrations: 0,
            // Same filtered memory as narration: the drop set is window-exact regardless of this
            // stage's narrower floor.
            milestoneDrop: getMilestoneDrop(plannerTurns),
            recapPrompt: recapUserPrompt,
            relevanceScores,
            bandCap: semanticMemory ? semanticBandCap : 0,
            // Read-only: the planner ranks against the same incumbents as narration but never
            // becomes them — only the live narration call advances the sticky set.
            stickyIds: lastBandIdsRef.current,
            notes: effectiveNotes,
          });
          digestBand = planner.recap;
          lastStory =
            [...planner.messages].reverse().find((m) => m.role === "assistant")?.content || lastStory;
        }
        const thinkMessages: ChatMessage[] = [
          {
            role: "user",
            content: `${digestBand ? `${digestBand}\n\n` : ""}${lastStory ? `What just happened:\n${lastStory}\n\n` : ""}The player's next action: ${effectiveAction}\n\nList the cast and lay out the beats now. Do not narrate.`,
          },
        ];
        const plan = await makeAIRequest(thinkPrompt, thinkMessages, "thinking", 256, signal);
        if (plan) {
          // Parse the planner's cast so it drives participation exactly like the staged director does:
          // defined entities confirm loosely, invented names strictly, both gated by the narration below.
          const { cast } = parseDirectorCast(plan);
          const classified = classifyCast(cast, allEntities, playerTraits.map((t) => t.name));
          directorCandidates.push(...classified.directorCandidates);
          adHocCandidates.push(...classified.adHocCandidates);
          sceneCast = classified.npcCast;
          // Keep a name the player has not yet heard out of the plan the narrator reads (code backstop for
          // the prompt's alias rule). A name is "revealed" once it appears in any past narration.
          turnPlan = sanitizePlanForReveal(plan, (name) => matchNames(priorNarration, [name]).length > 0);
        }
      } else if (thinkingMode === "inline") {
        // Ride the <think> directive on the final user turn (adjacent to where the model writes), like the
        // plan below — recency is what makes small models actually open the block. Buried in the system
        // prompt it was mostly ignored (probe: Silver-Siren 2/18 & MeroMero 5/18 -> both 18/18 here).
        narrationMessages[narrationMessages.length - 1].content += INLINE_THINKING_DIRECTIVE;
      } else if (thinkingMode === "staged") {
        // Staged planning: director (cast + continuation) -> one motivation pass per character
        // (capped by the Limit Active Characters setting) -> storyboarder. Storyboard is injected like precall.
        const stageValues = {
          ...ctx,
          "<ACTIVE CHARACTER GUIDANCE>": activeCharacterGuidance(limitActiveCharacters, activeCharacterLimit),
        };
        // Banded turns ride as condensed pairs, so the last assistant message is the real last narration.
        const lastStory =
          [...trimmedHistory].reverse().find((m) => m.role === "assistant")?.content || "";
        const staged = await runStagedPlanning({
          action: effectiveAction,
          stageValues,
          lastStory,
          entities: allEntities,
          presentEntityIds: withDiscovered(turnLocation)?.entities || [],
          playerNames: playerTraits.map((t) => t.name),
          characterDiaries,
          concurrentCharacters: concurrentTurnRequests,
          fullMessageHistory,
          diaryMemoryEntries: DIARY_MEMORY_ENTRIES,
          // Diary retrieval: relevant older entries join the recent tail (lib/semanticDiary). Null =
          // pure recency, the pre-feature path.
          diaryRetrieval: semanticDiaries && characterDiaries && actionVec
            ? { queryVec: actionVec, vectorsByKey: embedVectorsRef.current }
            : null,
          caps: { director: DIRECTOR_MAX_TOKENS, character: CHARACTER_MAX_TOKENS, storyboard: STORYBOARD_MAX_TOKENS },
          activeCharacterCap: limitActiveCharacters ? activeCharacterLimit : Infinity,
          directorPrompt,
          directorUserPrompt,
          characterPrompt,
          storyboardPrompt,
          request: makeAIRequest,
          signal,
        });
        if (signal.aborted) return;
        turnPlan = staged.turnPlan;
        directorCandidates.push(...staged.directorCandidates);
        adHocCandidates.push(...staged.adHocCandidates);
        sceneCast = staged.cast;
      }

      // Attach the plan to the final user turn (adjacent to where the model writes) instead of the
      // system prompt — keeps it salient and leaves the authored system prompt untouched. It rides as
      // narrator stage-directions (see planDirective), kept distinct from the player's action above it.
      if (turnPlan) {
        narrationMessages[narrationMessages.length - 1].content += planDirective(turnPlan);
      }

      // Track the assembled system-prompt size for the memory-usage breakdown
      setLastPromptChars(updatedPrompt.length);

      // Hand the streaming narration (inside makeAIRequest) this turn's scene-list inputs so it can keep the
      // Entities tab live per sentence.
      sceneListCtxRef.current = { cast: sceneCast, prior: priorNarration };

      // Get game text first since choices and stat updates depend on it
      const narrationResponse = await makeAIRequest(
        updatedPrompt,
        narrationMessages,
        "narration",
        null,
        signal,
      );

      // The user stopping is an expected, silent exit (the `finally` resets waiting state).
      if (signal.aborted) return;
      // An empty narration is not. The model either returned nothing or spent the whole response on
      // reasoning, so there's no story text to play and the turn can't advance. Say so — silence here is
      // indistinguishable from a dead submit button. Downstream calls (choices/stats) are skipped either
      // way: they take the narration as input.
      if (!narrationResponse) {
        // No assistant message was persisted (streaming only appends one once text arrives), so drop this
        // turn's dangling user message before returning — otherwise history pairing is corrupted.
        discardUnpairedUserTurn();
        addSystemLogEntry("The AI returned an empty narration — the turn was not advanced.");
        toast.error("The AI returned an empty response. Try again, or switch models if it keeps happening.", {
          position: "top-right",
          autoClose: 5000,
        });
        return;
      }

      // Commit the auto-resolved move now that the narration — already written for the new location —
      // succeeded, so an aborted/empty turn leaves the location unchanged.
      if (turnLocation && currentLocation && turnLocation.id !== currentLocation.id) {
        changeLocation(turnLocation);
        addLogEntry(`Moved to location: ${turnLocation.name}`);
      }

      // Who took part this turn: defined entities named in the narration, plus any staged ad-hoc
      // characters the narration confirms (planning only suggests; the narration is the gate). Drives the
      // entity tab, the choices filter, and stored participation.
      // The fourth source is the narration-only extractor: on pure narration the three above are all
      // blind to a character the narrator has just invented (the first matches known entities only,
      // the other two are populated by staged planning), so without it discovery required already
      // having been discovered. Always on and never gated: it costs no request, and presence, the
      // choices filter and participation recall shouldn't depend on a toggle. Only the DESCRIPTION
      // that turns a name into a full entity costs anything, and that is what the setting governs.
      // Presence comes from what the narration shows happening, not from who the dialogue talks about —
      // a character named only inside quotes ("for Professor Serana's review") was mentioned, not present.
      // The planner-confirmation sources below read the full text: a cast is an authoritative presence
      // signal, not an inference from the page.
      const narrationProse = stripQuotedSpeech(narrationResponse);
      const narratedNames = extractCharacterCandidates(
        narrationProse,
        { ...characterExclusions, suppressed: suppressedCharacterNames },
        collectCandidateEvidence(priorNarration),
      );
      const turnParticipants = [
        ...new Set([
          ...findEntityNames(narrationProse, allEntities),
          ...matchNamesLoose(narrationResponse, directorCandidates),
          ...matchNames(narrationResponse, adHocCandidates),
          ...narratedNames,
        ]),
      ];
      // Apply the authoritative scene list now (narration is done). Presence is the planner's cast (so a
      // merely-mentioned character never shows); a name reveals once it has appeared in the narration. With
      // no planner (Off/Inline) it falls back to the narration parse. Independent of turnParticipants above,
      // which still feeds stored participation and choices from the narration.
      // Narration-only names join the scene list too. buildSceneList resolves against KNOWN entities, so
      // a character being discovered this very turn would otherwise be missing from the panel until the
      // next turn — the describe request lands moments later and the row goes live in place.
      const sceneList = buildSceneList({ cast: sceneCast, entities: allEntities, narrationSoFar: narrationResponse, priorNarration });
      const sceneNames = new Set(sceneList.map((se) => se.name.toLowerCase()));
      setVisibleEntities([
        ...sceneList,
        ...narratedNames
          .filter((name) => !sceneNames.has(name.toLowerCase()))
          .map((name) => ({ name, revealed: true })),
      ]);
      // Bring-them-over: an authored character living in a reachable sibling that the narration named joins
      // the current location as a visitor — anchored via the discovered-entity path, so it persists and
      // rolls back with the turn. Affects the next turn's context (this turn's ctx already ran).
      // Fed by a stricter parse than `turnParticipants`: this path physically relocates an authored NPC, so
      // it takes full-name hits only — a loose single-word match must not teleport someone into the scene.
      // Prose-only for the same reason presence is: `partial: false` bounds how loosely a name may match,
      // not whether it was merely spoken about, and a full name inside dialogue still hits. Once someone is
      // anchored here they count as present, so a dialogue-only mention would otherwise walk them into the
      // scene permanently and past the now-line's location filter.
      if (turnLocation) {
        const visitorParticipants = findEntityNames(narrationProse, allEntities, { partial: false });
        const visitors = selectReachableVisitors(
          visitorParticipants, turnLocation, locations, entities,
          withDiscovered(turnLocation)?.entities ?? [],
        );
        if (visitors.length) {
          const locId = turnLocation.id;
          const turnId = currentTurnIdRef.current;
          setDiscoveredEntities((prev) => {
            const additions = visitors.filter(
              (v) => !prev.some((d) => d.locationId === locId && sameCharacterName(d.entity.name, v.name)),
            );
            return additions.length
              ? [...prev, ...additions.map((entity) => ({ entity, locationId: locId, sourceTurnId: turnId }))]
              : prev;
          });
        }
      }
      // Choices should only see who's in the scene now — this turn's participants plus those from the
      // prior turns in the rolling window — scoped to entities that exist at the location. Empty → the
      // choices request gets no entity section (can't spoil/act for anyone not present).
      const presentNames = new Set([
        ...turnParticipants,
        ...recentParticipants(fullMessageHistory, CHOICES_PRESENCE_TURNS - 1),
      ]);
      const sceneEntities = allEntities.filter((e) => presentNames.has(e.name));
      const sceneLoc = withDiscovered(turnLocation);
      const sceneEntityTokens = sceneEntityOverride(sceneLoc, sceneEntities);

      // Auto-narrate the new game text if a TTS model is loaded. When streaming is off, block the trailing
      // choices/stat/location requests until the audio has finished generating (avoids GPU contention). When
      // streaming is on, narration was already synthesized sentence-by-sentence during the request above.
      if (ttsLoaded && !streamNarrationAudio) {
        await generateTTS(narrationResponse);
        if (signal.aborted) return; // player stopped during TTS generation
      }

      // Choices, stat updates, and location-change all depend only on the narration text, not on each other.
      // Each is a thunk so the mode below decides whether they run concurrently or one at a time (the thunk
      // isn't invoked — and the request isn't sent — until called). The `quiet` flag suppresses each request's
      // own status label so the concurrent batch can set one stable label instead of three racing writes.
      // Choices see only who is actually in the scene (sceneEntityTokens), not the whole location roster.
      const runChoices = (quiet: boolean): Promise<string> =>
        choicesEnabled
          ? requestChoices(ctx, sceneEntityTokens, effectiveAction, narrationResponse, signal, quiet)
          : Promise.resolve("");

      // Only make stat updates request if enabled and the world actually defines stats (otherwise the model
      // hallucinates stat names that match nothing).
      const statsActive = statUpdatesEnabled && playerStats.length > 0;
      const runStats = (quiet: boolean): Promise<string> =>
        statsActive
          ? requestStats(ctx, effectiveAction, narrationResponse, signal, quiet)
          : Promise.resolve("");

      // Suggest mode only — with auto-apply the move was resolved up front (before the narration). After the
      // narration, ask whether the player should move (fed the action + narration) and offer it.
      // locations.length > 1: a single-location world has nowhere to move, so don't run it even when enabled.
      const locationActive = !isOpeningTurn && !locationAutoApply && locationChangeEnabled && locations.length > 1 && !!locationChangePromptText;
      const runLocation = (quiet: boolean): Promise<string> => {
        if (!locationActive) return Promise.resolve("");
        return makeAIRequest(
          renderPromptTemplate(locationChangePromptText, ctx),
          [{ role: "user", content: renderPromptTemplate(locationChangeUserPrompt, { "<PLAYER ACTION>": action, "<NARRATION>": narrationResponse }) }],
          "locationChange",
          null,
          signal,
          false,
          undefined,
          quiet,
        );
      };

      // The clock pass: how much in-world time this turn consumed. Depends only on action + narration, so it
      // joins the post-narration batch. Silent and attached to this turn for the AI-context viewer.
      const runTimePassed = (): Promise<string> =>
        aiClock
          ? makeAIRequest(
              renderPromptTemplate(timePassedPrompt, ctx),
              [{ role: "user", content: renderPromptTemplate(timePassedUserPrompt, { "<PLAYER ACTION>": stripOocDirectives(effectiveAction), "<NARRATION>": narrationResponse }) }],
              "timePassed",
              TIME_PASSED_MAX_TOKENS,
              signal,
              true,
              currentTurnIdRef.current,
            )
          : Promise.resolve("");

      // The opening-time pass: what time of day does the story START at? Runs once, on the opening turn
      // only, because it reads the scene the world was written to open on. Deliberately NOT run when the
      // clock is switched on mid-story: a retroactive answer would re-date every memory stamp already
      // written, and the opening narration it would need is long gone. A turn-1 re-generate does re-run it
      // (isOpeningTurn is true again once the history rewinds), so a rerolled opening can't contradict its
      // own clock — the same rule the delta pass follows.
      const runOpeningTime = (): Promise<string> =>
        aiClock && isOpeningTurn
          ? makeAIRequest(
              renderPromptTemplate(openingTimePrompt, ctx),
              [{ role: "user", content: renderPromptTemplate(openingTimeUserPrompt, { "<NARRATION>": narrationResponse }) }],
              "openingTime",
              OPENING_TIME_MAX_TOKENS,
              signal,
              true,
              currentTurnIdRef.current,
            )
          : Promise.resolve("");

      // Memory digest + character diaries for THIS turn also depend only on the narration (+ participants),
      // so in concurrent mode they join the batch and their results are folded into the turn at commit
      // (below) instead of being patched in afterward by the idle drainers. The drainers stay for backfill
      // (turns that come due when a feature is enabled mid-game). In sequential mode these are left to the
      // drainers as before. Both are silent + attached to this turn for the AI-context viewer.
      const runSummary = (): Promise<string> =>
        memoryDigests
          ? makeAIRequest(
              renderPromptTemplate(summaryPrompt, buildContextValues()),
              [{ role: "user", content: renderPromptTemplate(summaryUserPrompt, { "<PLAYER ACTION>": stripOocDirectives(effectiveAction), "<NARRATION>": narrationResponse }) }],
              "summary",
              DIGEST_MAX_TOKENS,
              signal,
              true,
              currentTurnIdRef.current,
            )
          : Promise.resolve("");
      const isKnownEntity = (name: string) => allEntities.some((e) => sameCharacterName(e.name, name));
      // Diaries are read only by the staged character pass, so only write them in that mode. A participant the
      // narration introduced but no entity matches yet gets discovered first (below); its diary needs that
      // generated description, so it's left to the drainer to write post-discovery — only KNOWN participants
      // run their diary in this batch.
      const diaryNames = characterDiaries && thinkingMode === "staged" ? turnParticipants.filter(isKnownEntity) : [];
      const runDiary = (name: string): Promise<string> => {
        const entity = allEntities.find((e) => sameCharacterName(e.name, name));
        return makeAIRequest(
          renderPromptTemplate(diaryPrompt, buildContextValues()),
          [{ role: "user", content: buildDiaryUserMessage({ name, entity, narration: narrationResponse }) }],
          "diary",
          DIARY_MAX_TOKENS,
          signal,
          true,
          currentTurnIdRef.current,
        );
      };
      // Runtime characters: a narration-confirmed participant matching no known entity is described (3rd-person,
      // from this turn's narration) and materialized into `discoveredEntities`, mirroring the idle drainer but
      // folded into the turn's batch. Gated on Character Diaries (same as the drainer); only staged planning
      // produces ad-hoc candidates, so this is empty otherwise.
      const discoverNames = describeCharacters
        ? turnParticipants.filter((name) => !isKnownEntity(name) && !suppressedCharacterNames.some((blocked) => sameCharacterName(name, blocked)))
        : [];
      const runDiscover = (name: string): Promise<string> =>
        makeAIRequest(
          defaultDiscoverEntityPrompt,
          [{ role: "user", content: `${DISCOVER_NAME_LABEL} ${name}\n\n${DISCOVER_PASSAGE_LABEL}\n${narrationResponse}` }],
          "discoverEntity",
          DISCOVER_MAX_TOKENS,
          signal,
          true,
          currentTurnIdRef.current,
        );

      let choicesResponse = "";
      let statUpdatesResponse = "";
      let locationResponse = "";
      let turnSummary = "";
      let turnTimeResponse = "";
      let openingTimeResponse = "";
      const turnDiaries: Record<string, string> = {};
      const discoveredThisTurn: { name: string; description: string }[] = [];

      if (concurrentTurnRequests) {
        // Fire all three at once. On a parallel-capable endpoint (LM Studio "Parallel" ≥2, Ollama) they overlap
        // and cut the post-narration wait ~30%; serial endpoints just queue the HTTP requests, so this is safe
        // everywhere. makeAIRequest is concurrency-safe for these non-narration types: its shared writes are
        // narration-gated (reveal/TTS/reasoning) or keyed by distinct requestType (debug capture). One stable
        // label for the batch (the three requests run quiet); "Choices" since that's what the player waits on.
        setAiRequestType("choices");
        const choicesP = runChoices(true);
        const statsP = runStats(true);
        const locationP = runLocation(true);
        const summaryP = runSummary();
        const timeP = runTimePassed();
        const openP = runOpeningTime();
        const diaryPs = diaryNames.map((name) => runDiary(name));
        const discoverPs = discoverNames.map((name) => runDiscover(name));
        // Choices (the interactive part) unblock the input as soon as *choices* resolves — don't wait on the
        // others. No-op catch so this side-chain never raises an unhandled rejection (the real error surfaces
        // via allSettled below).
        choicesP.then(
          () => { if (!signal.aborted) setChoicesReady(true); },
          () => {},
        );
        // allSettled so one aux failure doesn't discard the others' results or abort the turn — each rejection
        // just falls back to "" / no entry (the drainers backfill a failed digest/diary/discovery on a later tick).
        const [cR, sR, lR, sumR, timeR, openR, ...rest] = await Promise.allSettled([choicesP, statsP, locationP, summaryP, timeP, openP, ...diaryPs, ...discoverPs]);
        const diaryRs = rest.slice(0, diaryNames.length);
        const discoverRs = rest.slice(diaryNames.length);
        choicesResponse = cR.status === "fulfilled" ? cR.value : "";
        statUpdatesResponse = sR.status === "fulfilled" ? sR.value : "";
        locationResponse = lR.status === "fulfilled" ? lR.value : "";
        if (memoryDigests && sumR.status === "fulfilled") turnSummary = (sumR.value ?? "").trim();
        if (timeR.status === "fulfilled") turnTimeResponse = (timeR.value ?? "").trim();
        if (openR.status === "fulfilled") openingTimeResponse = (openR.value ?? "").trim();
        diaryNames.forEach((name, i) => {
          const r = diaryRs[i];
          // Store even an empty reply (as "") so the participant isn't retried forever; a rejected request is
          // left unset so the drainer backfills it later.
          if (r && r.status === "fulfilled") turnDiaries[name] = (r.value ?? "").trim();
        });
        // Materialize each discovered character (skipping unusable/blank descriptions — those stay due for the
        // drainer). Added to discoveredEntities below at commit, so it rolls back with the turn.
        discoverNames.forEach((name, i) => {
          const r = discoverRs[i];
          if (!r || r.status !== "fulfilled") return;
          const cleaned = cleanDiscoveredDescription(r.value ?? "", name);
          if (cleaned) discoveredThisTurn.push({ name, description: cleaned });
        });
      } else {
        // Sequential: one request at a time, each showing its own status label. Choices first so the player can
        // start composing while stats/location finish.
        choicesResponse = await runChoices(false);
        if (signal.aborted) return;
        setChoicesReady(true);
        statUpdatesResponse = await runStats(false);
        if (signal.aborted) return;
        locationResponse = await runLocation(false);
        if (signal.aborted) return;
        turnTimeResponse = await runTimePassed();
        if (signal.aborted) return;
        openingTimeResponse = await runOpeningTime();
      }

      if (signal.aborted) return; // stopped during one of the aux requests

      if (locationActive && locationResponse) {
        // Scope the router to the local navigable graph: match only against places reachable from here.
        const destinations = navigableDestinations(currentLocation, locations);
        const matchedName = matchLocationResponse(
          locationResponse,
          destinations.map((loc) => loc.name),
        );
        if (matchedName) {
          const target = destinations.find((loc) => loc.name === matchedName);
          if (target && target.id !== currentLocation?.id) setSuggestedLocation(target);
        }
      }

      // Fade path: let the paced reveal finish playing out before the turn's results appear, so choices
      // and stat changes don't pop in over a still-fading narration. The smooth crawl self-catches-up,
      // so it needs no hold. (The reveal has been running in parallel with the aux requests above.)
      if (fadeRevealActive) await fadeReveal.drained();
      // Stop pressed while the reveal was still draining — bail before committing choices/stats/snapshot,
      // exactly as the aux-request abort checks above do. abortGeneration already kept the narration.
      if (signal.aborted) return;

      // Parse choices (line-separated), hard-capped to 6 to stop the AI over-producing
      const choicesList = !choicesEnabled ? [] : parseChoices(choicesResponse);
      setChoices(choicesList);

      // Parse stat updates into current-value deltas and max-cap deltas (see lib/statChanges).
      let statChanges: Record<string, number>[] = [];
      if (statUpdatesEnabled && statUpdatesResponse) {
        const { values, maxes } = parseStatUpdates(statUpdatesResponse);
        statChanges = Object.entries(values).map(([k, v]) => ({ [k]: v }));
        if (Object.keys(maxes).length > 0) {
          // Max changes re-clamp the current value into the new range (lib handles the guards).
          setPlayerStats((prevStats) => applyAiMaxChanges(prevStats, maxes));
        }
      }

      // This turn's measured duration. An unparseable, out-of-range, or absent reply resolves to the flat
      // hour the game has always charged — never to zero, so a bad reply cannot freeze the clock.
      const turnHours = (aiClock ? parseTimeDelta(turnTimeResponse) : null) ?? FLAT_HOURS_PER_TURN;

      // Seed the story's opening hour. Only ever written on the opening turn, and only when the reply names
      // a daypart in the closed set — an unreadable answer leaves it null, which reads downstream as the
      // shipped DEFAULT_START_HOUR and so plays exactly like the game did before this pass existed.
      let openingHour: number | null = null;
      if (isOpeningTurn) {
        openingHour = openingTimeResponse ? parseOpeningDaypart(openingTimeResponse) : null;
        setStartHour(openingHour);
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
              narration: narrationResponse,
              choices: choicesList,
              stat_changes: statChanges,
              turnId: currentTurnIdRef.current,
              entities: turnParticipants,
              locationId: turnLocation?.id,
              // Freeze this turn's player notes (additive save-shape). Omitted when empty — the view falls
              // back to the snapshot's global notes, so a blank turn doesn't bloat the JSON.
              ...(playerNotes ? { notes: playerNotes } : {}),
              // Per-turn reasoning (additive save-shape). Absent when the model didn't reason.
              ...(turnReasoningRef.current.text ? { reasoning: turnReasoningRef.current } : {}),
              // Digest + diaries computed in this turn's concurrent batch (see above), written here so the
              // idle drainers skip the current turn and only backfill older ones. Omitted when not produced
              // (feature off, sequential mode, or the request failed) — the drainer fills those in later.
              ...(turnSummary ? { summary: turnSummary } : {}),
              // Measured turn duration (additive save-shape). Written only when the clock pass actually
              // measured something; absent reads as the flat hour, so old saves are unchanged.
              ...(aiClock && parseTimeDelta(turnTimeResponse) !== null ? { timeDelta: turnHours } : {}),
              ...(Object.keys(turnDiaries).length ? { diaries: turnDiaries } : {}),
            }),
          };
        }
        return updatedHistory;
      });

      //setGameplayText(aiResponse.narration);
      //setChoices(aiResponse.choices || []);

      // Persist any characters discovered in this turn's batch (see runDiscover above), anchored to this
      // location + turn so they roll back with it. Guarded against a double-add (variant-aware name match).
      if (discoveredThisTurn.length > 0) {
        const locationId = turnLocation?.id ?? currentLocation?.id;
        const turnId = currentTurnIdRef.current;
        setDiscoveredEntities((prev) => {
          const additions = discoveredThisTurn
            .filter((d) => !prev.some((p) => sameCharacterName(p.entity.name, d.name)))
            .map((d) => ({ entity: materializeDiscoveredEntity(d.name, d.description), locationId, sourceTurnId: turnId }));
          return additions.length ? [...prev, ...additions] : prev;
        });
      }

      // Reset the persistent bar deltas for this turn, then let stat changes + regen below re-fill them.
      setHeldStatChanges({});

      // Where the story clock stands for this turn's stat code. `elapsedHours` is the END of the turn, so a
      // long sleep that began in daylight reports `daypart: 'night'` — what the player just read. Computed
      // rather than read back from state: setGameTime below is async and wouldn't land in time.
      const turnClock: StatClock = {
        deltaHours: turnHours,
        elapsedHours: gameTime + turnHours,
        // `setStartHour` above hasn't committed, so the closure's `calendar` still predates this turn —
        // build the opening turn's own from the hour just measured. Without this the opening turn's stat
        // code reads the default start hour, and an accumulating stat banks that wrong value for good.
        calendar: openingHour !== null ? { startHour: openingHour } : calendar,
      };

      // Apply stat changes
      if (statChanges.length > 0) {
        applyStatChanges(statChanges, null, null, turnClock);
      } else if (anyStatUsesClock) {
        // Nothing moved, but time still passed — clock-reading code runs on its own so a time-based stat
        // ticks every turn instead of only on turns the AI happened to report a stat change.
        void runStatCode(playerStatsRef.current, turnClock);
      }

      // Advance the clock by what this turn actually took (the flat hour when unmeasured).
      handleTimePassed(turnHours);

      // Snapshot this turn once the updates above commit (deferred so the snapshot captures the finalized
      // message, applied stat changes, and advanced time rather than a stale mid-batch read).
      armTurnSnapshot();

      // Only set game as started after a successful opening turn
      if (isOpeningTurn) {
        setIsGameStarted(true);
      }

      // Scene image (auto): drawn last, once every language-model request for this turn has finished, and
      // awaited inside the turn on purpose — the input stays blocked until the picture is done, because a
      // diffusion pass running against the model on one graphics card spills both to system memory.
      if (sceneImageAuto && !imageGenDisabled) {
        // Own controller, chained to the turn's signal: the panel's Stop aborts through
        // `sceneImageAbortRef` while the main turn Stop still reaches the render via the chain.
        const controller = new AbortController();
        const onAbort = () => controller.abort();
        if (signal.aborted) onAbort(); else signal.addEventListener('abort', onAbort, { once: true });
        sceneImageAbortRef.current = controller;
        try {
          await runSceneImageRef.current({
            turnId: currentTurnIdRef.current,
            narration: narrationResponse,
            participants: turnParticipants,
            locationId: turnLocation?.id,
            signal: controller.signal,
          });
        } finally {
          signal.removeEventListener('abort', onAbort);
        }
      }
    } catch (error) {
      const err = error as { response?: { status?: number }; message?: string; connectionHandled?: boolean };
      // Drop this turn's dangling user message on any error exit (both the early connection-failure return
      // and the fall-through below), unless narration had already streamed a partial assistant reply — the
      // guard inside leaves a valid [user, assistant] pair intact.
      discardUnpairedUserTurn();
      // Reset game started state if the opening turn fails
      if (isOpeningTurn) {
        setIsGameStarted(false);
      }

      // A connection failure already surfaced its own guide toast in makeAIRequest — don't stack a second.
      if (err.connectionHandled) {
        addSystemLogEntry("Couldn't reach the AI server — see the connection guide.");
        return;
      }

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
      addSystemLogEntry(errorMessage);
    } finally {
      setIsWaitingForAI(false);
      setIsRevealingNarration(false);
      setAiRequestType(null);
      // Release the turn's controller (unless a newer turn already replaced it).
      if (abortControllerRef.current === controller) abortControllerRef.current = null;
    }
  };

  useEffect(() => {
    const startIndex = (currentPage - 1) * messagesPerPage;
    const endIndex = startIndex + messagesPerPage;
    setDisplayedMessages(fullMessageHistory.slice(startIndex, endIndex));
  }, [fullMessageHistory, currentPage, setDisplayedMessages]);

  // Fires the re-send half of a re-generate, once the restored pre-turn state has committed.
  useEffect(() => {
    if (regenerateNonce === 0) return;
    const action = pendingRegenerateRef.current;
    pendingRegenerateRef.current = null;
    if (action !== null) sendGameAction(action);
    // sendGameAction is deliberately not a dependency — we want this render's (post-restore) closure.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [regenerateNonce]);

  const handlePageChange = (page: number) => {
    // Paging to the latest page resumes following (null); paging back pins that page.
    setUserPage(page >= totalPages ? null : page);
  };

  // Latest committed stats, so off-render derivations (below) don't rely on a stale closure.
  const playerStatsRef = useRef(playerStats);
  playerStatsRef.current = playerStats;
  // Pending "clear recent changes" timer, tracked so a new turn or unmount can cancel it.
  const recentStatTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const drainStatTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (recentStatTimerRef.current) clearTimeout(recentStatTimerRef.current);
      if (drainStatTimerRef.current) clearTimeout(drainStatTimerRef.current);
    },
    [],
  );

  // Clear last turn's stat feedback for a fresh turn. Bars: snapshot the held deltas so they collapse-
  // animate away (matching .stat-delta-drain), clearing the live map immediately so this turn starts clean.
  // Text: if any +/- delta text is still up, fade it out now instead of waiting out its ~10s timer. The
  // text clear reuses recentStatTimerRef, so a fast response's applyStatChanges cancels it before it wipes
  // the new turn's text.
  const drainStatFeedback = useCallback(() => {
    if (Object.keys(heldStatChanges).length > 0) {
      setDrainingStatChanges(heldStatChanges);
      setHeldStatChanges({});
      if (drainStatTimerRef.current) clearTimeout(drainStatTimerRef.current);
      drainStatTimerRef.current = setTimeout(() => setDrainingStatChanges({}), 550);
    }
    if (Object.keys(recentStatChanges).length > 0) {
      setRecentStatFading(true);
      if (recentStatTimerRef.current) clearTimeout(recentStatTimerRef.current);
      recentStatTimerRef.current = setTimeout(() => {
        setRecentStatChanges({});
        setRecentStatFading(false);
      }, 350);
    }
  }, [heldStatChanges, recentStatChanges, setHeldStatChanges, setDrainingStatChanges, setRecentStatChanges, setRecentStatFading]);

  // Re-derive every code-driven stat from `base` and this turn's `clock`, folding whatever moved into the
  // live delta feedback. Split out of applyStatChanges because clock-reading code has to run once per turn
  // even when the AI moved no stat at all — time passes regardless of what the narration said.
  const runStatCode = useCallback(
    async (base: typeof playerStats, clock: StatClock) => {
      try {
        // processStatCode is typed over Stat[]; playerStats is the narrower PlayerStat[] (value: number).
        const coded = (await processStatCode(base, clock)) as typeof playerStats;
        const codeChanges = appliedStatDeltas(base, coded);
        if (Object.keys(codeChanges).length === 0) return;
        // Override only the stats the code actually moved, onto the LATEST stats — not a blanket
        // `setPlayerStats(coded)`, whose `coded` is computed from the pre-`await` baseline and would clobber
        // anything applied in the meantime (this turn's regen, or a re-generate that landed during the await).
        const codedById = new Map(coded.map((s) => [s.id, s.value]));
        setPlayerStats((prev) =>
          prev.map((s) =>
            codeChanges[s.name.toLowerCase()] !== undefined && codedById.has(s.id)
              ? { ...s, value: codedById.get(s.id) as number }
              : s,
          ),
        );
        // Fold the code-derived movement into the live delta feedback, so a code stat's bar/text animates
        // live — matching the history view (pageStatDeltas diffs the final, post-code snapshot).
        setRecentStatChanges((prev) => normalizeStatChanges([prev, codeChanges]));
        setHeldStatChanges((prev) => normalizeStatChanges([prev, codeChanges]));
      } catch (error) {
        console.error("Error processing stat code:", error);
      }
    },
    [setPlayerStats, setRecentStatChanges, setHeldStatChanges],
  );

  // Whether any stat's code reads the clock, and so needs a per-turn run of its own on turns the AI
  // changed nothing. False for every world authored before these variables existed, which keeps those
  // worlds on exactly the run schedule they have always had.
  const anyStatUsesClock = useMemo(() => playerStats.some((s) => usesStatClock(s.code)), [playerStats]);

  // Update the applyStatChanges function to handle specific stat updates
  const applyStatChanges = useCallback(
    // `base` overrides the starting stats (defaults to the live ref) — a stat re-generation applies the
    // fresh deltas onto the pre-turn baseline so repeated re-rolls don't stack on already-applied changes.
    async (
      changes: Record<string, number>[],
      affectedStats: string[] | null = null,
      base: typeof playerStats | null = null,
      clock: StatClock = {},
    ) => {
      // Merge the AI's change objects into one normalized (name→delta) map.
      const normalizedChanges = normalizeStatChanges(changes);

      // Apply the AI's direct changes, then derive any code-based stats from that result. Both run
      // outside the state updater (updaters must stay pure), reading the latest stats via the ref.
      const baseStats = base ?? playerStatsRef.current;
      const directApplied = applyAiStatChanges(baseStats, normalizedChanges, affectedStats);

      // Show the *actual* applied change (clamped to min/max and honoring noIncrease/noDecrease), not the
      // raw request — so a stat pinned at its cap shows no delta, and the live bar/text match the history
      // view's value-diff deltas (`pageStatDeltas`) instead of diverging from them.
      const actualChanges = appliedStatDeltas(baseStats, directApplied);

      // Surface the changes, then clear the highlight after 10s. Cancel any prior timer first so a
      // stale clear can't wipe a newer turn's changes.
      setRecentStatChanges(actualChanges);
      if (recentStatTimerRef.current) clearTimeout(recentStatTimerRef.current);
      recentStatTimerRef.current = setTimeout(() => setRecentStatChanges({}), 10000);
      // Held changes drive the persistent bar coloring (no fade). Merge this call's deltas over the
      // per-turn reset done by the caller, so AI changes and regen combine into one turn delta.
      setHeldStatChanges((prev) => ({ ...prev, ...actualChanges }));

      setPlayerStats(directApplied);
      await runStatCode(directApplied, clock);
    },
    [runStatCode, setPlayerStats, setRecentStatChanges, setHeldStatChanges],
  );

  // Discard a turn's dangling, unpaired user message. The failure exits (empty narration, request error)
  // and user-initiated Stop can all leave the user message with no assistant reply; left in place it
  // corrupts history pairing — page math and parseTurns both walk strict index pairs — and silently drops
  // every later turn from the model's context. Guarded on the tail actually being a lone user message, so a
  // partially-streamed assistant turn is kept intact. Also restores the choices cleared at turn start.
  const discardUnpairedUserTurn = () => {
    setFullMessageHistory((prev) =>
      prev[prev.length - 1]?.role === "user" ? prev.slice(0, -1) : prev,
    );
    // This turn never made it into the context; flag it so the AI-context viewer can hide it.
    setDebugTurns((prev) => {
      if (!prev.length) return prev;
      const next = prev.slice();
      next[next.length - 1] = { ...next[next.length - 1], aborted: true };
      return next;
    });
    // Restore the previous turn's choices from the last committed assistant turn. Reverse-find is
    // closure-agnostic: it lands on the prior assistant whether or not this turn's user message is in the
    // current render's history snapshot (it is in abortGeneration, isn't yet inside sendGameAction).
    const lastAssistant = [...fullMessageHistory].reverse().find((m) => m.role === "assistant");
    let restored: string[] = [];
    if (lastAssistant) {
      try {
        const parsed = JSON.parse(lastAssistant.content);
        if (Array.isArray(parsed.choices)) restored = parsed.choices;
      } catch {
        restored = [];
      }
    }
    setChoices(restored);
  };

  // Function to abort ongoing AI generation
  const abortGeneration = () => {
    if (!abortControllerRef.current) return;
    abortControllerRef.current.abort();
    abortControllerRef.current = null;
    // A scene-image click queued behind this turn dies with it — Stop means stop, not "draw later".
    pendingSceneImageRef.current = null;

    setIsWaitingForAI(false);
    setAiRequestType(null);
    setChoicesReady(false);

    const last = fullMessageHistory[fullMessageHistory.length - 1];
    if (userTurnAddedRef.current && last?.role === "assistant") {
      // Narration came through — keep this turn so the player can stop here and edit it manually. A kept
      // narration means the game is underway (covers aborting the opening turn). Save a snapshot so
      // gameStates stays aligned with history (rollback / re-generate key off the page count). The
      // userTurnAdded guard matters: without it, aborting during the up-front location request (before this
      // turn's user message is added, so the tail is still the *previous* turn's assistant) would land here
      // and overwrite that previous turn's snapshot with the current, choices-cleared state.
      setIsGameStarted(true);
      // Event-handler context: saveCurrentGameState reads the latest committed state, and the kept
      // narration already landed during streaming — so a synchronous snapshot here is fresh. Index it by
      // its own history length to keep gameStates aligned (same rule as the normal post-turn save).
      const snapshot = { ...saveCurrentGameState(), isGameStarted: true };
      const pageIndex = snapshotPageIndex(snapshot.fullMessageHistory?.length ?? 0, messagesPerPage);
      setGameStates((prev) => placeSnapshot(prev, pageIndex, snapshot));
    } else {
      // Either this turn's user message is the unpaired tail (nothing came back), or we aborted before it
      // was added at all (the up-front location request). discardUnpairedUserTurn handles both via its
      // guards: it drops only a lone user tail, flags this turn's debug entry, and restores the prior turn's
      // choices — without re-snapshotting anything.
      discardUnpairedUserTurn();
    }

    addSystemLogEntry("AI generation aborted");
  };

  // Abort any in-flight AI request when GameViewer unmounts (e.g. exiting to the menu mid-turn), so the SSE
  // stream stops instead of a local model generating a whole narration into a torn-down provider. The
  // turn's own `signal.aborted` checks then short-circuit its continuations. A manual scene render runs on
  // its own controller, so it gets the same treatment — otherwise it keeps the image server busy after exit.
  useEffect(() => () => { abortControllerRef.current?.abort(); sceneImageAbortRef.current?.abort(); }, []);

  const makeAIRequest = async (
    systemPrompt: string,
    messages: ChatMessage[],
    requestType: AIRequestType = "narration",
    maxTokensOverride: number | null = null,
    signal?: AbortSignal,
    // Silent requests (the memory digest) run without UI noise: no "Generating…" label, and they
    // surface in the status bar / AI-context viewer only when the "Show Silent Requests" setting is on.
    // When captured, they attach to the turn named by `attachTurnId` (the turn the digest summarizes —
    // usually the one just committed, or an older turn when backfilling), so the viewer shows the
    // request under the right turn rather than whatever turn happens to be current.
    silent = false,
    attachTurnId?: string,
    // Skip setting the "Generating…" status label. The concurrent aux batch fires choices/stats/location at
    // once; each would otherwise stomp the shared label, so the batch sets one stable label itself instead.
    quietLabel = false,
  ) => {
    // Disable a reasoning model's scratchpad when requested — the `/no_think` soft switch (Qwen-style),
    // appended to the system prompt so it applies to every request type (and shows in the AI-context viewer).
    if (disableThinking) systemPrompt = `${systemPrompt}\n\n/no_think`;

    // Silent requests are only captured into the AI-context viewer when the inspection toggle is on.
    const captureSilent = silent && showSilentRequests && attachTurnId !== undefined;
    // Unique id tying this call's captured request to its response (concurrent same-type calls otherwise
    // overwrite each other by matching on type + empty-response).
    const captureId = randomUUID();
    // Append a captured request payload onto the matching debug turn (the current turn for foreground
    // requests, or the `attachTurnId` turn for a silent digest). No-op if that turn isn't found.
    const captureRequest = () => setDebugTurns((prev) => {
      if (!prev.length) return prev;
      const idx = silent ? prev.findIndex((t) => t.turnId === attachTurnId) : prev.length - 1;
      if (idx === -1) return prev;
      const next = prev.slice();
      // Attach the dictionary activation to the narration request only (the sole request that injects lore).
      const dictionary = requestType === "narration" ? pendingDictionaryDebugRef.current ?? undefined : undefined;
      next[idx] = {
        ...next[idx],
        requests: [
          ...next[idx].requests,
          { type: requestType, messages: [{ role: "system", content: systemPrompt }, ...messages], id: captureId, dictionary },
        ],
      };
      return next;
    });

    try {
      // Surface which request is currently running (silent requests use the digest status indicator instead).
      if (!silent && !quietLabel) setAiRequestType(requestType);

      // Capture the exact payload into the AI-context viewer.
      if (!silent || captureSilent) captureRequest();

      const resolvedTemperature = resolvePromptSampler(requestType, "temperature", promptSamplers, genTemperature, localModelActive);
      const resolvedRepPenalty = resolvePromptSampler(requestType, "repetitionPenalty", promptSamplers, genRepetitionPenalty, localModelActive);

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
          // top_p/top_k/min_p apply to the built-in engine only (a custom endpoint keeps its own).
          ...(localModelActive && {
            top_p: genTopP,
            top_k: genTopK,
            min_p: genMinP,
          }),
          // Temperature and repetition penalty are resolved per prompt: a pinned/custom value goes to every
          // endpoint; an unpinned prompt sends the global value on the built-in engine but omits on a custom
          // endpoint (undefined → no field, so the endpoint's own value applies).
          // The penalty ships under both spellings: `repetition_penalty` for vLLM-family servers and the
          // built-in engine, `repeat_penalty` for LM Studio (which silently ignores the other). Both targets
          // accept unknown body fields — measured, including a param nobody defines. A strict server would 400.
          ...(resolvedTemperature !== undefined && { temperature: resolvedTemperature }),
          ...(resolvedRepPenalty !== undefined && { repetition_penalty: resolvedRepPenalty, repeat_penalty: resolvedRepPenalty }),
          // Reasoning is engine-split: the local engine caps the thought segment by a token budget
          // (thinking_budget_tokens, from the per-prompt %); external endpoints take the coarse reasoning_effort
          // hint. Guided modes / uncontrolled prompts resolve to 0 / none on each path.
          ...(localModelActive
            ? reasoningBudgetBody(thinkingMode, requestType, promptReasoningBudget, maxTokensOverride ?? maxTokens)
            // Only send `reasoning_effort` to an external endpoint when reasoning is actually engaged; otherwise
            // omit it entirely so a plain endpoint (e.g. LM Studio) isn't sent fields it rejects.
            : reasoningEngaged
              ? reasoningEffortBody(thinkingMode, resolvePromptReasoning(requestType, promptReasoning, reasoningEffort), supportedReasoningEfforts)
              : {}),
          // Single-paragraph stop, but not in inline-thinking mode — the <think> block needs newlines.
          ...(requestType === "narration" && paragraphLimit === "single" && thinkingMode !== "inline" && { stop: ["\n"] }),
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
      // Unblock a pending read the instant the turn is aborted, so we stop consuming immediately even if
      // the server keeps streaming after we disconnect. `once` lets it clean itself up.
      signal?.addEventListener("abort", () => { reader.cancel().catch(() => {}); }, { once: true });
      const decoder = new TextDecoder();
      let buffer = "";
      let content = "";
      let finishReason = null;
      // Reasoning capture (narration only): native `reasoning`/`reasoning_content` stream field, plus timing so
      // the block can show "Thought for Ns" — `firstTokenAt` is the first token of any kind, `narrationAt` the
      // first visible narration token, so their gap is the think time for both native and inline-<think> paths.
      let reasoningText = "";
      let firstTokenAt = 0;
      let narrationAt = 0;
      let lastLiveReasoningTick = 0;
      // Clear the narration for this turn's fresh reveal (reset re-seeds the reveal's base timing) and
      // mark the reveal live — from here the reveal view shows the streaming gameplayText, not committed.
      if (requestType === "narration") { fadeReveal.reset(); smoothReveal.reset(); setIsRevealingNarration(true); entitySentenceCursorRef.current = 0; assistantAddedRef.current = false; turnReasoningRef.current = { text: "", ms: 0 }; setLiveReasoning({ text: "", ms: 0, active: false }); }
      // Opt-in streaming TTS: synthesize narration sentence-by-sentence as it arrives (needs a model).
      const ttsStreaming = streamNarrationAudio && ttsLoaded && requestType === "narration";
      if (ttsStreaming) { ttsModalRef.current?.streamStart(); ttsSentenceCursorRef.current = 0; }

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
          // A native reasoning model streams its scratchpad in a separate `reasoning` field (some backends
          // name it `reasoning_content`); accumulate it for the block. Inline <think> stays in `content`.
          const reasoningDelta = parsed.choices[0]?.delta?.reasoning ?? parsed.choices[0]?.delta?.reasoning_content ?? "";
          if (requestType === "narration") {
            if (reasoningDelta) reasoningText += reasoningDelta;
            if (!firstTokenAt && (delta || reasoningDelta)) firstTokenAt = performance.now();
            // Stream the scratchpad into the live block while still thinking (before narration), throttled so a
            // token-rate reasoning stream doesn't re-render the block per token.
            if (!narrationAt) {
              const nowTick = performance.now();
              if (nowTick - lastLiveReasoningTick > 80) {
                lastLiveReasoningTick = nowTick;
                const liveText = [reasoningText.trim(), extractReasoningLive(content)].filter(Boolean).join("\n\n").trim();
                if (liveText) setLiveReasoning({ text: liveText, ms: 0, active: true });
              }
            }
          }
          if (parsed.choices[0]?.finish_reason) {
            finishReason = parsed.choices[0].finish_reason;
          }

          // Handle different request types
          if (requestType === "narration") {
            // Trim leading whitespace so the streamed text matches the final `.trim()`'d commit — after a
            // reasoning model's <think> block is stripped it leaves leading blank lines, and that shift
            // otherwise makes the reveal re-animate every paragraph at the end.
            const display = stripReasoningLive(content).replace(/^\s+/, '');
            if (!narrationAt && display.length > 0) narrationAt = performance.now();
            // Narration has begun: collapse the reasoning block, stamping the think duration.
            if (narrationAt && getLiveReasoning().active) {
              const lr = getLiveReasoning();
              setLiveReasoning({ text: lr.text, ms: Math.max(0, Math.round(narrationAt - firstTokenAt)), active: false });
            }
            // Split once per token; streaming TTS, the entity tab, and the reveal all read these.
            const segments = splitSentenceSegments(display);
            if (fadeRevealActive) {
              // Fade path: reveal only complete sentences (hold the in-progress trailing one). The pacer
              // times each sentence's arrival and paces the cascade from that measured rate — no
              // tokens/sec estimate needed here; a burst of sentences just fills its backlog buffer.
              fadeReveal.push(
                segments.length > 1
                  ? display.slice(0, display.length - segments[segments.length - 1].length).replace(/\s+$/, '')
                  : '',
              );
            } else {
              // Classic path: trail the full stream, smoothing it out character-by-character.
              smoothReveal.push(display);
            }

            // Feed newly-completed sentences to streaming TTS, holding back the last (in-progress) one.
            if (ttsStreaming) {
              const completeCount = segments.length - 1;
              for (let i = ttsSentenceCursorRef.current; i < completeCount; i++) {
                ttsModalRef.current?.streamSentence(segments[i]);
              }
              if (completeCount > ttsSentenceCursorRef.current) ttsSentenceCursorRef.current = completeCount;
            }

            // Keep the scene list live as each sentence completes: the planner cast is present from the
            // start, and a name flips from its alias to the real name the moment the narration says it
            // (with no planner, this falls back to the narration parse). Reapplied authoritatively at the end.
            const completeSentences = segments.length - 1;
            const newSentence = completeSentences > entitySentenceCursorRef.current;
            if (newSentence) {
              entitySentenceCursorRef.current = completeSentences;
              const { cast: turnCast, prior } = sceneListCtxRef.current;
              setVisibleEntities(buildSceneList({ cast: turnCast, entities: allEntities, narrationSoFar: display, priorNarration: prior }));
            }

            // Persist the in-progress assistant message: add it once (as soon as narration content
            // arrives — so an abort before any text still drops the lone user turn), then refresh it only
            // on sentence boundaries. Writing it every token re-renders the whole app and copies the
            // history array per token, which compounds as history grows and starves the streaming reveal.
            // The visible narration comes from the sentence-buffered reveal (gameplayText), not this
            // message, and the final text is committed once the turn finishes.
            const shouldPersist = assistantAddedRef.current ? newSentence : display.length > 0;
            if (shouldPersist) {
              assistantAddedRef.current = true;
              const message = {
                role: "assistant" as const,
                content: JSON.stringify({
                  narration: display,
                  choices: [],
                  stat_changes: [],
                  turnId: currentTurnIdRef.current,
                }),
              };
              setFullMessageHistory((prev) => {
                if (prev.length > 0 && prev[prev.length - 1].role === "assistant") {
                  const updatedHistory = [...prev];
                  updatedHistory[updatedHistory.length - 1] = message;
                  return updatedHistory;
                }
                return [...prev, message];
              });
            }
          } else if (requestType === "choices") {
            // Update choices in real-time, ensuring we handle partial content correctly
            const choicesList = parseChoices(stripReasoningLive(content));
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
        if (signal?.aborted) break; // user pressed Stop — quit consuming, even with chunks still buffered
        const { done, value } = await reader.read();
        if (done) break;
        // Accumulate decoded text and dispatch only complete lines; the trailing partial line (and
        // any partial multi-byte char, via { stream: true }) is carried into the next read.
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split(/\r?\n/);
        buffer = lines.pop() ?? "";
        for (const line of lines) processLine(line);
      }
      // Aborted mid-stream: drop everything received this turn and don't commit it.
      if (signal?.aborted) {
        if (requestType === "narration") { fadeReveal.reset(); smoothReveal.reset(); }
        if (ttsStreaming) ttsModalRef.current?.streamCancel();
        return "";
      }
      // Flush the decoder and process a final line that arrived without a trailing newline.
      buffer += decoder.decode();
      if (buffer.trim()) processLine(buffer.trim());

      // Show the raw output (including any <think> block) in the AI-context viewer, but return the
      // cleaned text so reasoning never reaches the narration, TTS, choices/stats/location, or history.
      const rawContent = content.trim();
      let finalContent = stripReasoning(content).trim();
      // On a mid-sentence truncation (hit the token cap), trim back to the last complete sentence.
      if (requestType === "narration") {
        // Capture this turn's reasoning: the native `reasoning` stream field plus any inline <think> body
        // (the two are mutually exclusive in practice). `ms` is the gap from the first token to the first
        // narration token — the think time. Stored for the block + the committed turn (empty ⇒ no block).
        const inlineReasoning = extractReasoning(content);
        const reasoning = [reasoningText.trim(), inlineReasoning].filter(Boolean).join("\n\n").trim();
        const ms = reasoning ? Math.max(0, Math.round((narrationAt || performance.now()) - (firstTokenAt || narrationAt || performance.now()))) : 0;
        turnReasoningRef.current = { text: reasoning, ms };
        setLiveReasoning({ text: reasoning, ms, active: false });
        if (finishReason === "length") finalContent = trimToLastSentence(finalContent);
        // Hand the authoritative final text (incl. any held last sentence) to the active reveal. The
        // pacer drains any remaining backlog at its measured rate (capped to not dawdle on the tail).
        if (fadeRevealActive) fadeReveal.finish(finalContent);
        else smoothReveal.finish(finalContent);
        // Flush any sentence(s) still unsent (incl. a final one with no trailing terminator), then end.
        if (ttsStreaming) {
          const segments = splitSentenceSegments(finalContent);
          for (let i = ttsSentenceCursorRef.current; i < segments.length; i++) {
            ttsModalRef.current?.streamSentence(segments[i]);
          }
          ttsModalRef.current?.streamEnd();
        }
      }
      // Record the raw output on this turn's matching request so the AI-context viewer can show it
      // (silent digests record onto the turn they summarize, mirroring captureRequest above).
      if (!silent || captureSilent) setDebugTurns((prev) => {
        if (!prev.length) return prev;
        const idx = silent ? prev.findIndex((t) => t.turnId === attachTurnId) : prev.length - 1;
        if (idx === -1) return prev;
        const next = prev.slice();
        const turn = { ...next[idx] };
        turn.requests = turn.requests.map((r) =>
          r.id === captureId ? { ...r, response: rawContent } : r,
        );
        next[idx] = turn;
        return next;
      });
      return finalContent;
    } catch (error) {
      // Check if this is an abort error (user canceled the request)
      if ((error as Error).name === "AbortError") {
        if (requestType === "narration") { fadeReveal.reset(); smoothReveal.reset(); }
        if (streamNarrationAudio && ttsLoaded && requestType === "narration") ttsModalRef.current?.streamCancel();
        // Return empty content for aborted requests instead of throwing
        return "";
      }

      console.error("Error in makeAIRequest:", error);
      // A failed silent request (the digest) is non-fatal — let the drainer swallow it without a toast.
      if (silent) throw error;
      // A browser-build network failure (server off / wrong URL / CORS disabled) is opaque and unactionable
      // from the generic toast — offer the connection guide instead, and tag the error so the outer handler
      // in sendGameAction doesn't stack its own toast on top.
      if (isLikelyConnectionError(error)) {
        (error as { connectionHandled?: boolean }).connectionHandled = true;
        toast.error(
          <div className="flex flex-col items-start gap-1">
            <span>Couldn&apos;t reach your AI server.</span>
            <button type="button" className="text-xs underline" onClick={() => setConnectionGuideOpen(true)}>
              Fix connection →
            </button>
          </div>,
          { position: "top-right", autoClose: 8000, closeOnClick: false, pauseOnHover: true, draggable: true },
        );
      } else {
        toast.error("Failed to process AI request");
      }
      throw error;
    }
  };

  // --- Scene images ---------------------------------------------------------------------------------
  // A picture of one turn, assembled from three sources that each own a different part of it: the tag pass
  // writes what is happening, the present characters' authored image tags describe who is in frame, and the
  // location's describe where it is (see lib/sceneTags). Nothing here ever runs alongside a language-model
  // request: a diffusion pass and the model on one graphics card spill each other to system memory, so the
  // auto path is awaited inside the turn and a manual click waits for the turn to finish.
  // Which half of the pipeline is running: the tag pass, the render, or nothing. Both hold the turn.
  const [sceneImageJob, setSceneImageJob] = useState<'tags' | 'image' | null>(null);
  const [sceneImageProgress, setSceneImageProgress] = useState<number | null>(null);
  // The provider's live in-progress frame (A1111/ComfyUI/InvokeAI stream one); cleared with every job.
  const [sceneImagePreview, setSceneImagePreview] = useState<string | null>(null);
  const sceneImageAbortRef = useRef<AbortController | null>(null);
  // A manual click made while the turn's requests are still running, replayed once they finish.
  const pendingSceneImageRef = useRef<{ turnId: string; tags?: string; tagsOnly?: boolean } | null>(null);
  // Image tags derived on the fly for a subject the author never tagged, keyed by entity/location id.
  // Session-only by design: the authored world is immutable during play, and a derived tag line is a guess
  // that shouldn't outlive the session it was made in.
  const derivedTagsRef = useRef(new Map<string, string>());
  // The shipped tag vocabulary, loaded once per session: it decides which of the world's own place names
  // are real tags (a location called Kitchen) and so must survive the scrub below.
  const knownTagsRef = useRef<ReadonlySet<string> | null>(null);
  const loadKnownTags = async (): Promise<ReadonlySet<string>> => {
    if (!knownTagsRef.current) {
      try {
        knownTagsRef.current = new Set((await loadDanbooruTags()).map((t) => t.toLowerCase()));
      } catch {
        knownTagsRef.current = new Set(); // SFW/offline build ships none — then every place name is stripped
      }
    }
    return knownTagsRef.current;
  };

  /** Authored image tags for a subject, else a one-off derived line from its description (cached for the
   *  session). Returns '' when there's nothing to work from, which simply leaves that layer out. */
  const resolveSubjectTags = async (
    subject: { id: string; name: string; imageTags?: string; aiDescription?: string; playerDescription?: string; description?: string },
    kind: "character" | "location",
    signal: AbortSignal,
    /** Applied to a DERIVED line only — a description usually says the place's name in its first sentence,
     *  and a derived line stands in for authored tags, so it would otherwise smuggle the name past the scrub. */
    scrub?: (line: string) => string,
    /** Ignore the session cache and derive again. A cached line is a guess, and an explicit re-roll is the
     *  player asking for a different one — without this, only the action layer could ever change. */
    fresh = false,
  ): Promise<string> => {
    const authored = (subject.imageTags ?? "").trim();
    if (authored) return authored;
    const cached = derivedTagsRef.current.get(subject.id);
    if (cached !== undefined && !fresh) return cached;
    const description = (subject.aiDescription || subject.playerDescription || subject.description || "").trim();
    if (!description) return "";
    try {
      // Uses the editor's own description-to-tags helper, minus the name: sent one, the model answers with
      // it ("dean wolfram"), and a person's name is not a tag any image model knows. Only the description
      // describes what a character looks like, which is all this layer wants.
      const tags = await buildImagePrompt(
        { description, kind },
        { endpointUrl: getEndpointUrl(), apiToken, modelName, tagPrompt: imageTagPrompt, signal },
      );
      const cleaned = scrub ? scrub(tags) : tags;
      derivedTagsRef.current.set(subject.id, cleaned);
      return cleaned;
    } catch {
      return ""; // a failed derivation just leaves the subject untagged for this turn
    }
  };

  /** The cast in frame: this turn's participants, resolved to entities, capped at what a booru model can
   *  hold apart. Order is the narration's, so the two the turn actually turned on are the two drawn. */
  const resolveSceneCast = async (participants: string[], signal: AbortSignal, scrub?: (line: string) => string, fresh = false): Promise<SceneCharacter[]> => {
    const named = participants
      .map((name) => allEntities.find((e) => sameCharacterName(e.name, name)))
      .filter((e): e is NonNullable<typeof e> => !!e)
      .slice(0, MAX_SCENE_CHARACTERS);
    const cast: SceneCharacter[] = [];
    for (const entity of named) {
      cast.push({
        name: entity.name,
        aliases: entity.aliases,
        tags: await resolveSubjectTags(entity, "character", signal, scrub, fresh),
      });
    }
    return cast;
  };

  /** Run the tag pass for a turn and store the composed line. Returns it, or '' if the run was aborted. */
  const runSceneTags = async (args: {
    turnId: string;
    narration: string;
    participants: string[];
    locationId?: string;
    /** Re-derive the untagged subjects rather than reusing this session's guesses. */
    fresh?: boolean;
    signal: AbortSignal;
  }): Promise<string> => {
    const { turnId, narration, participants, locationId, fresh, signal } = args;
    setSceneImageJob("tags");
    // Every place the world knows, not just this one: the narration routinely names somewhere the player
    // is not, and an invented place name is no more useful as a tag for being off-screen.
    const knownTags = await loadKnownTags();
    const places = locations.map((l) => l.name);
    const scrubPlaces = (line: string) =>
      splitTags(line).map((t) => stripPlaces(t, places, knownTags)).filter(Boolean).join(", ");
    const cast = await resolveSceneCast(participants, signal, scrubPlaces, fresh);
    const location = locations.find((l) => l.id === locationId) ?? currentLocation;
    const locationTags = location ? await resolveSubjectTags(location, "location", signal, scrubPlaces, fresh) : "";
    if (signal.aborted) return "";
    // The tag pass is silent and attached to this turn, so it shows in the AI-context viewer under the
    // scene it describes (with Show Silent Requests on) rather than under whatever turn is current.
    const actionTags = await makeAIRequest(
      renderPromptTemplate(sceneTagsPrompt, buildContextValues()),
      [{
        role: "user",
        content: renderPromptTemplate(sceneTagsUserPrompt, {
          "<NARRATION>": narration,
          "<IN FRAME>": cast.length ? cast.map((c) => c.name).join(", ") : "nobody - an empty scene",
        }),
      }],
      "sceneTags",
      SCENE_TAGS_MAX_TOKENS,
      signal,
      true,
      turnId,
    );
    if (signal.aborted) return "";
    const line = composeSceneTags({ characters: cast, locationTags, actionTags, places, knownTags });
    // Stored whether or not an image follows, so the player can read and edit what would be sent.
    if (line) setFullMessageHistory((prev) => patchSceneTags(prev, turnId, line) ?? prev);
    return line;
  };

  /**
   * Draw one turn. `tags` skips the tag pass and renders that line verbatim — the path the editable tag
   * field under an image uses. Tag writes go through the turn-id apply-guard; the image write is guarded
   * by the run's abort signal, which rollback / re-generate / load fire before discarding the turn.
   */
  const runSceneImage = async (args: {
    turnId: string;
    narration: string;
    participants: string[];
    locationId?: string;
    tags?: string;
    /** Re-write the tag line and stop there — no image. The cheap loop for judging the tags themselves.
     *  Always re-derives: a re-roll that reused the cached guesses could only ever change the action layer,
     *  which on an untagged world is the minority of the line. Drawing keeps the cache, so a picture stays
     *  cheap and the place looks the same from turn to turn. */
    tagsOnly?: boolean;
    signal: AbortSignal;
  }): Promise<void> => {
    const { turnId, signal } = args;
    setSceneImageProgress(null);
    setSceneImagePreview(null);
    try {
      const line = (args.tags ?? "").trim() || await runSceneTags({ ...args, fresh: args.tagsOnly });
      if (signal.aborted) return;
      if (!line) throw new Error("Nothing to draw for this scene.");
      if (args.tagsOnly) return;
      if (args.tags) setFullMessageHistory((prev) => patchSceneTags(prev, turnId, line) ?? prev);

      setSceneImageJob("image");
      // A scene is landscape by definition; everything else about the request is the user's image preset,
      // shared with the editor's Generate dialog.
      const { provider, params, opts } = buildImageRequest(settings, {
        prompt: line,
        width: imageLandscapeWidth,
        height: imageLandscapeHeight,
      });
      const dataUrl = await generateImage(provider, params, {
        ...opts,
        signal,
        onProgress: (p) => {
          setSceneImageProgress(p.progress);
          // The live frame the local providers stream, so the picture is visibly forming.
          if (p.preview) setSceneImagePreview(p.preview);
        },
      });
      if (signal.aborted) return;
      setSceneImages((prev) => addSceneImage(prev, turnId, dataUrl));
    } catch (error) {
      if ((error as Error).name === "AbortError") return;
      toast.error((error as Error).message || (args.tagsOnly ? "Couldn't write tags for this scene." : "Couldn't draw this scene."));
      addSystemLogEntry(args.tagsOnly ? "Scene tags failed" : "Scene image failed");
    } finally {
      setSceneImageJob(null);
      setSceneImageProgress(null);
      setSceneImagePreview(null);
    }
  };

  // Hold the latest runner so the queued-click effect and the turn's auto path call a fresh closure.
  const runSceneImageRef = useRef(runSceneImage);
  runSceneImageRef.current = runSceneImage;

  /** Run the pipeline against the turn the player is looking at. `tagsOnly` stops after the tag line, which
   *  is the cheap loop for judging the tags. Queues behind an in-flight turn rather than competing with it. */
  const startSceneJob = (opts?: { tags?: string; tagsOnly?: boolean }) => {
    if (imageGenDisabled || sceneImageJob) return;
    const index = pageAssistantIndex(currentPage, messagesPerPage);
    const turn = parseTurnContent(fullMessageHistory[index]?.content ?? "");
    if (!turn?.turnId) {
      toast.info("There's no scene here yet.");
      return;
    }
    if (isWaitingForAI) {
      pendingSceneImageRef.current = { turnId: turn.turnId, ...opts };
      toast.info(opts?.tagsOnly ? "Writing tags once the turn finishes." : "Drawing this scene once the turn finishes.");
      return;
    }
    const controller = new AbortController();
    sceneImageAbortRef.current = controller;
    void runSceneImage({
      turnId: turn.turnId,
      narration: turn.narration ?? "",
      participants: turn.entities ?? [],
      locationId: turn.locationId,
      ...opts,
      signal: controller.signal,
    });
  };
  const handleSceneImage = (tags?: string) => startSceneJob({ tags });
  const handleSceneTags = () => startSceneJob({ tagsOnly: true });

  /** Stop the render in flight; the provider interrupts its server where it can. */
  const cancelSceneImage = () => {
    pendingSceneImageRef.current = null;
    sceneImageAbortRef.current?.abort();
  };

  const handleDeleteSceneImage = (index: number) => {
    const turnId = parseTurnContent(fullMessageHistory[pageAssistantIndex(currentPage, messagesPerPage)]?.content ?? "")?.turnId;
    if (!turnId) return;
    setSceneImages((prev) => removeSceneImage(prev, turnId, index));
  };

  // Replay a click that landed mid-turn, once the turn's requests are done (the VRAM rule).
  useEffect(() => {
    if (isWaitingForAI || sceneImageJob) return;
    const queued = pendingSceneImageRef.current;
    if (!queued) return;
    pendingSceneImageRef.current = null;
    const turn = fullMessageHistory.find(
      (m) => m.role === "assistant" && parseTurnContent(m.content)?.turnId === queued.turnId,
    );
    const parsed = turn ? parseTurnContent(turn.content) : null;
    if (!parsed) return; // the turn was rolled back while queued
    const controller = new AbortController();
    sceneImageAbortRef.current = controller;
    void runSceneImageRef.current({
      turnId: queued.turnId,
      narration: parsed.narration ?? "",
      participants: parsed.entities ?? [],
      locationId: parsed.locationId,
      tags: queued.tags,
      tagsOnly: queued.tagsOnly,
      signal: controller.signal,
    });
  }, [isWaitingForAI, sceneImageJob, fullMessageHistory]);

  // Hold the latest makeAIRequest so the digest drainer always calls a fresh closure without
  // re-running its effect every render (makeAIRequest is rebuilt each render by design).
  const makeAIRequestRef = useRef(makeAIRequest);
  makeAIRequestRef.current = makeAIRequest;

  // Build + issue the choices/stats aux requests. Shared verbatim by the live turn (the concurrent/sequential
  // batch in sendGameAction) and the standalone re-rolls (handleRegenerateChoices/Stats), so the prompt
  // assembly and request shape can't drift between them. Callers own the enable-guard and result handling;
  // `quiet` suppresses the status label (the concurrent batch sets one stable label for all three).
  const requestChoices = (
    ctx: Record<string, string>,
    sceneEntityTokens: Record<string, string>,
    action: string,
    narration: string,
    signal: AbortSignal,
    quiet = false,
  ): Promise<string> => {
    let prompt = renderPromptTemplate(choicesPrompt, { ...ctx, ...sceneEntityTokens });
    if (language.toLowerCase() != "english") prompt += `\n Choice language: ` + language;
    return makeAIRequest(
      prompt,
      [{ role: "user", content: renderPromptTemplate(choicesUserPrompt, { "<PLAYER ACTION>": action, "<NARRATION>": narration }) }],
      "choices",
      null,
      signal,
      false,
      undefined,
      quiet,
    );
  };
  const requestStats = (
    ctx: Record<string, string>,
    action: string,
    narration: string,
    signal: AbortSignal,
    quiet = false,
  ): Promise<string> => {
    let prompt = renderPromptTemplate(statUpdatesPrompt, ctx);
    if (language.toLowerCase() != "english") prompt += "\n Please write in english";
    return makeAIRequest(
      prompt,
      [{ role: "user", content: renderPromptTemplate(statUpdatesUserPrompt, { "<PLAYER ACTION>": action, "<NARRATION>": narration }) }],
      "statUpdates",
      null,
      signal,
      false,
      undefined,
      quiet,
    );
  };

  // DEV-only: expose window.__baseline for the fork-local test harness (no-op in production builds).
  const debugTurnsRef = useRef(debugTurns);
  debugTurnsRef.current = debugTurns;
  const sendGameActionRef = useRef(sendGameAction);
  sendGameActionRef.current = sendGameAction;
  useBaselineTestHook(debugTurnsRef, sendGameActionRef);

  // Memory-digest drainer: summarize each completed turn silently (serialized, one at a time) and
  // patch the digest back onto that turn. Only runs while idle (just after a turn commits) so it never
  // contends with the active turn's requests. Patching the history re-runs this effect, which picks up
  // the next due turn until none remain (also backfills older turns when first enabled mid-game).
  useEffect(() => {
    if (!memoryDigests || isWaitingForAI || diaryActive || discoverActive || digestDrainingRef.current || diaryDrainingRef.current || discoverDrainingRef.current) return;
    const due = selectDueDigests(fullMessageHistory);
    if (due.length === 0) return;
    // Oldest due turn first — it's closest to leaving the context window (matters when backfilling).
    const turnId = due[due.length - 1];
    const idx = fullMessageHistory.findIndex(
      (m) => m.role === "assistant" && parseTurnContent(m.content)?.turnId === turnId,
    );
    const narrationText = idx >= 0 ? parseTurnContent(fullMessageHistory[idx].content)?.narration ?? "" : "";
    if (!narrationText.trim()) return;
    // The digest runs on an aged-out turn, so its action is the paired user message (as parseTurns pairs them).
    const playerAction = idx > 0 && fullMessageHistory[idx - 1].role === "user" ? fullMessageHistory[idx - 1].content : "";

    digestDrainingRef.current = true;
    setDigestActive(true);
    (async () => {
      try {
        const digest = await makeAIRequestRef.current(
          renderPromptTemplate(summaryPrompt, buildContextValues()),
          [{ role: "user", content: renderPromptTemplate(summaryUserPrompt, { "<PLAYER ACTION>": stripOocDirectives(playerAction), "<NARRATION>": narrationText }) }],
          "summary",
          DIGEST_MAX_TOKENS,
          undefined,
          true, // silent: no "Generating…" label; surfaces only when "Show Silent Requests" is on
          turnId, // attach the request to the turn it summarizes in the AI-context viewer
        );
        const trimmed = (digest ?? "").trim();
        if (trimmed) setFullMessageHistory((prev) => applyDigest(prev, turnId, trimmed) ?? prev);
      } catch {
        // Non-fatal: the turn stays due and is retried on a later idle tick.
      } finally {
        digestDrainingRef.current = false;
        setDigestActive(false);
      }
    })();
  }, [memoryDigests, isWaitingForAI, diaryActive, discoverActive, fullMessageHistory, summaryPrompt, summaryUserPrompt, buildContextValues, setFullMessageHistory]);

  // Milestone-selection drainer (incremental, T4): once every due digest is written, silently judge
  // only the NEWLY-ARRIVED digests against the already-kept list (see lib/milestoneMemory). Old
  // verdicts persist — an old memory changes state only via an explicit Forget (supersession) or a
  // player pin — so the whole-list flip-flop is dead by construction. A malformed reply keeps every
  // new entry and touches nothing old: fail-safe, never fail-drop. Selection entries whose turns
  // left the candidate set (rollback) are pruned so a re-aging turn is judged fresh.
  useEffect(() => {
    if (!memoryDigests || isWaitingForAI || diaryActive || discoverActive || digestDrainingRef.current || diaryDrainingRef.current || discoverDrainingRef.current || milestoneDrainingRef.current) return;
    if (selectDueDigests(fullMessageHistory).length > 0) return; // digests first — the selector reads them
    // Overridden turns: the selector judges the text that actually rides, and never sees a memory the
    // player deleted (a tombstone strips the summary, so it isn't a candidate at all).
    const turns = parseEffectiveTurns(fullMessageHistory);
    const candidates = milestoneCandidates(turns);
    if (candidates.length === 0) return;
    const candSet = new Set(candidates.map((t) => t.turnId ?? ""));
    let selection = milestoneSelection;
    if (selection && selection.seen.some((id) => !candSet.has(id))) {
      selection = {
        seen: selection.seen.filter((id) => candSet.has(id)),
        selected: selection.selected === null ? null : selection.selected.filter((id) => candSet.has(id)),
      };
    }
    const seenSet = new Set(selection?.seen ?? []);
    const freshCands = candidates.filter((t) => t.turnId && !seenSet.has(t.turnId));
    if (freshCands.length === 0) {
      if (selection !== milestoneSelection) setMilestoneSelection(selection); // commit the prune
      return;
    }
    // The kept-old context mirrors what actually rides: the selector's surviving verdicts with the
    // player's pins applied (a pin-dropped memory is gone and can't be "forgotten" again).
    const oldCands = candidates.filter((t) => t.turnId && seenSet.has(t.turnId));
    const selObj = selection
      ? { seen: seenSet, selected: selection.selected === null ? null : new Set(selection.selected) }
      : null;
    const keptIds = resolveMilestoneKeep(oldCands, selObj, memoryPins);
    const shownOld = oldCands.filter((t) => keptIds.has(t.turnId!));
    const attachTurnId = turns[turns.length - 1]?.turnId;
    const stableSelection = selection;

    milestoneDrainingRef.current = true;
    setMilestoneActive(true);
    (async () => {
      try {
        const reply = await makeAIRequestRef.current(
          defaultMilestoneIncrementalPrompt,
          [{
            role: "user",
            content: buildIncrementalMilestoneUserMessage(
              shownOld.map((t) => (t.summary ?? "").trim()),
              freshCands.map((t) => (t.summary ?? "").trim()),
            ),
          }],
          "milestoneSelect",
          MILESTONE_SELECT_MAX_TOKENS,
          undefined,
          true, // silent: surfaces only when "Show Silent Requests" is on
          attachTurnId,
        );
        const verdict = parseIncrementalMilestoneReply((reply ?? "").trim(), shownOld.length, freshCands.length);
        // Write-time importance: the selector rates a moment once, as it ages in, and the rating rides
        // the turn from then on. Unrated keeps stay unrated (neutral), never zero.
        if (verdict && verdict.weights.size > 0) {
          const byTurnId = new Map<string, number>();
          verdict.weights.forEach((w, i) => {
            const id = freshCands[i]?.turnId;
            if (id) byTurnId.set(id, w);
          });
          setFullMessageHistory((prev) => applyImportance(prev, byTurnId));
        }
        setMilestoneSelection(applyIncrementalVerdict(
          stableSelection,
          shownOld.map((t) => t.turnId!),
          freshCands.map((t) => t.turnId!),
          verdict,
        ));
      } catch {
        // Non-fatal: the selection stays stale and is retried on a later idle tick; until then the
        // previous selection (or keep-everything-unseen) applies.
      } finally {
        milestoneDrainingRef.current = false;
        setMilestoneActive(false);
      }
    })();
  }, [memoryDigests, isWaitingForAI, diaryActive, discoverActive, fullMessageHistory, narrationVerbatimTurns, milestoneSelection, setMilestoneSelection, setFullMessageHistory, memoryPins, parseEffectiveTurns]);

  // Regenerate one memory on demand (Memory Manager): re-run the digest prompt on that turn and land the
  // result in the override layer as AI text — no pin and no importance bump, because the player authored
  // nothing here; the selector's verdict still governs it. Silent, like every other digest request.
  // Returns false when the turn has nothing to summarize or the call fails, so the caller can toast.
  const regenerateMemory = useCallback(async (turnId: string): Promise<boolean> => {
    const idx = fullMessageHistory.findIndex(
      (m) => m.role === "assistant" && parseTurnContent(m.content)?.turnId === turnId,
    );
    if (idx < 0) return false;
    const narrationText = parseTurnContent(fullMessageHistory[idx].content)?.narration ?? "";
    if (!narrationText.trim()) return false;
    const playerAction = idx > 0 && fullMessageHistory[idx - 1].role === "user" ? fullMessageHistory[idx - 1].content : "";
    try {
      const digest = await makeAIRequestRef.current(
        renderPromptTemplate(summaryPrompt, buildContextValues()),
        [{ role: "user", content: renderPromptTemplate(summaryUserPrompt, { "<PLAYER ACTION>": stripOocDirectives(playerAction), "<NARRATION>": narrationText }) }],
        "summary",
        DIGEST_MAX_TOKENS,
        undefined,
        true, // silent: surfaces only when "Show Silent Requests" is on
        turnId,
      );
      const trimmed = (digest ?? "").trim();
      if (!trimmed) return false;
      setMemoryEdits((prev) => ({ ...prev, [turnId]: { text: trimmed, source: 'ai' } }));
      return true;
    } catch {
      return false;
    }
  }, [fullMessageHistory, summaryPrompt, summaryUserPrompt, buildContextValues, setMemoryEdits]);

  // Embedding drainer: keep a vector on hand for everything the semantic features score at turn time —
  // turn digests (semanticMemory) and dictionary entries (semanticLore) — so scoring is a sync lookup.
  // Cache-first (IndexedDB, hash-keyed so save/world switches just repopulate), then batch-embeds the
  // rest in the worker. Runs off the LLM path entirely — it only serializes against itself. Until an
  // item is covered it simply can't score (band: fail open to oldest-first; lore: entry can't fire).
  useEffect(() => {
    const wantDigests = semanticMemory && memoryDigests;
    const wantDiaries = semanticMemory && semanticDiaries && characterDiaries;
    if ((!wantDigests && !semanticLore && !wantDiaries) || embedDrainingRef.current) return;
    if (!isEmbeddingModelReady()) {
      // A session that starts with a toggle already on re-opens the model from the browser cache
      // (or retries a failed first download) in the background, once.
      if (!embedModelKickedRef.current) {
        embedModelKickedRef.current = true;
        loadEmbeddingModel().catch(() => {}); // failure keeps everything fail-open; Settings offers Retry
      }
      return;
    }
    const wanted = new Map<string, string>(); // vector key → text to embed
    if (wantDigests || wantDiaries) {
      for (const m of fullMessageHistory) {
        if (m.role !== "assistant") continue;
        const parsed = parseTurnContent(m.content);
        if (!parsed) continue;
        const d = wantDigests ? parsed.summary?.trim() : undefined;
        if (d) wanted.set(vectorKey(d), d);
        if (wantDiaries && parsed.diaries) {
          for (const text of Object.values(parsed.diaries)) {
            const t = text?.trim();
            if (t && t.toLowerCase() !== "nothing notable") wanted.set(vectorKey(t), t);
          }
        }
      }
    }
    if (semanticLore) {
      for (const entry of dictionary) {
        if (entry.enabled === false || entry.constant) continue;
        wanted.set(entryVectorKey(entry), entryEmbedText(entry));
      }
    }
    const missing = [...wanted.keys()].filter((k) => !embedVectorsRef.current.has(k));
    if (missing.length === 0) return;

    embedDrainingRef.current = true;
    (async () => {
      try {
        const cached = await getVectors(missing);
        cached.forEach((vec, key) => embedVectorsRef.current.set(key, vec));
        // Embed the rest in bounded batches, looping to completion — nothing re-triggers this effect
        // when a batch lands (unlike the digest drainer, it never touches history), so a first-enable
        // backfill must finish in one pass.
        const toEmbed = missing.filter((k) => !cached.has(k));
        for (let start = 0; start < toEmbed.length; start += 8) {
          const batch = toEmbed.slice(start, start + 8);
          const vecs = await embedTexts(batch.map((k) => wanted.get(k)!));
          await Promise.all(vecs.map((vec, i) => {
            embedVectorsRef.current.set(batch[i], vec);
            return putVector(batch[i], vec).catch(() => {}); // cache write is best-effort
          }));
        }
      } catch {
        // Non-fatal: uncovered items stay fail-open; retried on a later history/dictionary change.
      } finally {
        embedDrainingRef.current = false;
      }
    })();
  }, [semanticMemory, memoryDigests, semanticLore, semanticDiaries, characterDiaries, fullMessageHistory, dictionary]);

  // Character-diary drainer (write side): for each completed turn with participants, silently write a
  // first-person diary entry per participant as an idle-time job, patched back onto that turn's `diaries`
  // map. Mirrors the digest drainer, and serializes against it (only one silent job runs at a time) so a
  // local endpoint isn't hit twice. Runs one participant per tick; patching re-runs the effect until the
  // due turn is fully covered, then the next due turn. Gated on Staged thinking — the entries are only
  // read by the staged character pass, so writing them in any other mode would just waste requests.
  useEffect(() => {
    if (!characterDiaries || thinkingMode !== "staged" || isWaitingForAI || digestActive || discoverActive || digestDrainingRef.current || diaryDrainingRef.current || discoverDrainingRef.current) return;
    const due = selectDueDiaries(fullMessageHistory);
    if (due.length === 0) return;
    // Oldest due turn first — closest to leaving the context window.
    const turnId = due[due.length - 1];
    const dueTurn = fullMessageHistory
      .map((m) => (m.role === "assistant" ? parseTurnContent(m.content) : null))
      .find((c) => c?.turnId === turnId);
    const narrationText = dueTurn?.narration ?? "";
    const name = pendingDiaryNames(fullMessageHistory, turnId)[0];
    if (!narrationText.trim() || !name) return;
    const entity = allEntities.find((e) => e.name.trim().toLowerCase() === name.trim().toLowerCase());

    diaryDrainingRef.current = true;
    setDiaryActive(true);
    (async () => {
      try {
        const entry = await makeAIRequestRef.current(
          renderPromptTemplate(diaryPrompt, buildContextValues()),
          [{ role: "user", content: buildDiaryUserMessage({ name, entity, narration: narrationText }) }],
          "diary",
          DIARY_MAX_TOKENS,
          undefined,
          true, // silent: surfaces only when "Show Silent Requests" is on
          turnId, // attach the request to the turn it records in the AI-context viewer
        );
        const trimmed = (entry ?? "").trim();
        // Store even an empty result (as "") so the participant isn't retried forever on a blank reply.
        setFullMessageHistory((prev) => applyDiary(prev, turnId, name, trimmed) ?? prev);
      } catch {
        // Non-fatal: the participant stays due and is retried on a later idle tick.
      } finally {
        diaryDrainingRef.current = false;
        setDiaryActive(false);
      }
    })();
  }, [characterDiaries, thinkingMode, isWaitingForAI, digestActive, discoverActive, fullMessageHistory, allEntities, diaryPrompt, buildContextValues, setFullMessageHistory]);

  // Runtime characters (Slice 2): promote a narration-confirmed character into a persisted entity.
  // Idle-gated and serialized like the diary drainer; runs before the diary pass so a new character is
  // described first. A confirmed participant whose name matches no known entity is silently described
  // (3rd-person, from the turn's narration) and materialized into `discoveredEntities`, after which it
  // flows through the authored-entity path. Gated on Describe New Characters — the request is the only
  // part that costs anything; finding the name happened for free during the turn.
  useEffect(() => {
    if (!describeCharacters || isWaitingForAI || digestActive || diaryActive || digestDrainingRef.current || diaryDrainingRef.current || discoverDrainingRef.current) return;
    // Suppressed names ride in as "known" so a deleted character is never re-proposed, whichever path
    // named it — the heuristic or staged planning.
    const knownNames = [...allEntities.map((e) => e.name), ...suppressedCharacterNames];
    const due = selectDueDiscovery(fullMessageHistory, knownNames);
    if (!due) return;
    const locationId = due.locationId ?? currentLocation?.id;

    discoverDrainingRef.current = true;
    setDiscoverActive(true);
    (async () => {
      try {
        const description = await makeAIRequestRef.current(
          defaultDiscoverEntityPrompt,
          [{ role: "user", content: `${DISCOVER_NAME_LABEL} ${due.name}\n\n${DISCOVER_PASSAGE_LABEL}\n${due.narration}` }],
          "discoverEntity",
          DISCOVER_MAX_TOKENS,
          undefined,
          true, // silent: surfaces only when "Show Silent Requests" is on
          due.turnId, // attach the request to the turn that introduced the character
        );
        // Small models parrot the prompt labels and get token-capped mid-word — sanitize before storing.
        const cleaned = cleanDiscoveredDescription(description ?? "", due.name);
        if (!cleaned) return; // no usable description — leave it due, retry on a later idle tick
        const entity = materializeDiscoveredEntity(due.name, cleaned);
        setDiscoveredEntities((prev) =>
          // Guard against a double-add if the effect re-ran before state committed (variant-aware).
          prev.some((d) => sameCharacterName(d.entity.name, due.name))
            ? prev
            : [...prev, { entity, locationId, sourceTurnId: due.turnId }],
        );
      } catch {
        // Non-fatal: the character stays due and is retried on a later idle tick.
      } finally {
        discoverDrainingRef.current = false;
        setDiscoverActive(false);
      }
    })();
  }, [describeCharacters, isWaitingForAI, digestActive, diaryActive, fullMessageHistory, allEntities, suppressedCharacterNames, currentLocation, setDiscoveredEntities]);

  const handleSendAction = () => {
    const input = playerInput.trim();
    // A scene render holds the turn as well as the input: the model and the image server share one card.
    if (!input || isWaitingForAI || sceneImageJob) return;
    if (input.startsWith("/")) {
      runSlashCommand(input);
      setPlayerInput("");
      return;
    }
    sendGameAction(input);
  };

  // Enter submits; Shift+Enter inserts a newline (the action box is a multi-line textarea).
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey && !isWaitingForAI && !sceneImageJob) {
      e.preventDefault();
      handleSendAction();
    }
  };

  const handleStatChanges = useCallback(
    (statChanges: StatChange[]) => {
      // Runtime-only: apply to playerStats. The authored world (GameData.stats) is never mutated by play.
      setPlayerStats((prevStats) => applyTraitStatChanges(prevStats, statChanges).stats);
    },
    [setPlayerStats],
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

  const isInitialized = useRef(false);

  useEffect(() => {
    // Gate on the world being loaded, NOT on `locations.length` — a world with no locations authored yet
    // (every freshly created one) would otherwise never initialize, silently skipping the stat baselines,
    // traits, dictionaries and the opening-cue pre-fill below. `worldId` is set in the same batch as the
    // rest of the world data by loadWorldData, so it's non-null exactly when that data has landed.
    if (!isInitialized.current && worldId !== null) {
      isInitialized.current = true;

      // Cold-load from the main menu: restore the save instead of starting a fresh game. Its world is
      // already in GameData (loaded before this view mounted), so `locations` here are the right ones.
      if (initialSaveId) {
        void loadGame(initialSaveId, locations, stats);
        return;
      }

      // New game: seed the live stats from the world defaults, recording each stat's game-start baseline
      // (`starting`) so the opening turn's deltas read from the world value, not 0/min. Seeding lives here —
      // not in a reactive effect on `stats` — so it runs exactly once for a fresh game and can never race
      // with / clobber a loaded save (which returns above).
      setPlayerStats(
        stats.map((stat) => {
          const value = (stat.value as number) || stat.min || 0;
          return { ...stat, value, starting: stat.starting ?? value };
        }),
      );

      initialTraits.forEach((traitId) => {
        const trait = traits.find((t) => t.id === traitId);
        if (trait) {
          applyTrait(trait);
        }
      });

      // Use the player's chosen starting location, else a random starting point (fallback: any location).
      const location = resolveStartingLocation(locations, initialLocationId);
      if (location) {
        changeLocation(location);
        addLogEntry(`Starting in location: ${location.name}`);
      }

      // Seed the per-playthrough dictionary set: the entry-step selection, or the world's authored books
      // when the step was skipped. A loaded save overrides this later via loadGame.
      setRuntimeDictionaries(initialDictionaries ?? dictionaries);

      // Fresh playthrough: no memory pins, selection or player overrides yet. loadGame overrides.
      setMemoryPins({});
      setMilestoneSelection(null);
      setMemoryEdits({});
      setMemoryDeleted([]);
      setMemoryNotes([]);

      // Seed the entry-step characters into the starting location as runtime-only entities (never written
      // to the authored world). They flow through the existing discovered-entity path; loadGame overrides.
      if (location && initialCharacters && initialCharacters.length > 0) {
        setDiscoveredEntities(
          initialCharacters.map((entity) => ({ entity, locationId: location.id, sourceTurnId: 'initial' })),
        );
      }

      // Pre-fill the editable opening cue so the player can shape the first turn before submitting it.
      setPlayerInput(OPENING_SCENE_CUE);
    }
  }, [
    initialSaveId,
    loadGame,
    initialTraits,
    initialLocationId,
    initialDictionaries,
    initialCharacters,
    dictionaries,
    traits,
    locations,
    worldId,
    stats,
    setPlayerStats,
    applyTrait,
    changeLocation,
    addLogEntry,
    setRuntimeDictionaries,
    setDiscoveredEntities,
    setPlayerInput,
    setMemoryPins,
    setMilestoneSelection,
    setMemoryEdits,
    setMemoryDeleted,
    setMemoryNotes,
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

  // Extract the displayed narration from an assistant message (see lib/aiResponse).
  const parseAssistantMessage = parseNarration;

  // Status line shown above the input while a turn is being generated, naming the current AI
  // request (Narration / Choices / Stat Updates / Location) so the player knows what's processing.
  const progressBar = (() => {
    // The active turn's request takes the status row; a silent memory digest (which runs between turns)
    // shows here too when no turn is in flight, but only when "Show Silent Requests" is enabled.
    if (isWaitingForAI) {
      const labels = {
        thinking: "Plan",
        director: "Cast",
        character: "Motivation",
        storyboard: "Storyboard",
        narration: "Narration",
        choices: "Choices",
        statUpdates: "Stat Updates",
        locationChange: "Location",
        summary: "Memory",
        milestoneSelect: "Memory Select",
        diary: "Diary",
        discoverEntity: "Character",
        timePassed: "Clock",
        openingTime: "Opening",
        sceneTags: "Scene Tags",
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
    }
    if (digestActive && showSilentRequests) {
      return (
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs text-muted-foreground whitespace-nowrap">
            Summarizing turn…
          </span>
          <div className="flex-grow">
            <IndeterminateProgress />
          </div>
        </div>
      );
    }
    if (milestoneActive && showSilentRequests) {
      return (
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs text-muted-foreground whitespace-nowrap">
            Selecting memories…
          </span>
          <div className="flex-grow">
            <IndeterminateProgress />
          </div>
        </div>
      );
    }
    if (diaryActive && showSilentRequests) {
      return (
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs text-muted-foreground whitespace-nowrap">
            Writing diary…
          </span>
          <div className="flex-grow">
            <IndeterminateProgress />
          </div>
        </div>
      );
    }
    return null;
  })();

  // The context meter's history math is O(turns) (parseTurns + banding), so memoize it: this recomputes
  // only when the history/settings that feed getTrimmedMessageHistory change (a few times per turn),
  // not on every render.
  const memoryStats = useMemo(() => {
    const promptTokens = estimateTokens(lastPromptChars);
    const trimmed = getTrimmedMessageHistory(promptTokens, "", lastRelevanceScoresRef.current, lastActionVecRef.current);
    return {
      promptTokens,
      trimmed,
      bandCounts: lastBandCountsRef.current, // set as a side effect of the call above
      historyTokens: estimateTokens(estimateHistoryChars(trimmed)),
    };
  }, [getTrimmedMessageHistory, lastPromptChars]);

  const memoryBar = (() => {
    // Token breakdown of the model's context window: prompt + history + reserved output vs the window.
    const windowTokens = contextWindow || 1;
    const { promptTokens, trimmed, bandCounts, historyTokens } = memoryStats;
    const outputTokens = maxTokens;
    const usedTokens = promptTokens + historyTokens + outputTokens;
    const pct = (n: number) => (n / windowTokens) * 100;
    const usedPct = pct(usedTokens);
    const availableTokens = Math.max(0, windowTokens - usedTokens);
    const fillPct = Math.min(100, usedPct);
    const barColor =
      usedPct >= 90
        ? "bg-destructive"
        : usedPct >= 70
          ? "bg-warning"
          : "bg-success";
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
            {bandCounts && (
              <div className="pl-3 text-muted-foreground space-y-0.5">
                {row("Summary band", bandCounts.bandTokens)}
                {/* TODO(rehydration): restore when rehydration is re-enabled — it is disabled in
                    turnBanding.ts (drove the charged-scene freeze), so this row is always 0. */}
                {/* {row("Rehydrated", bandCounts.rehydratedTokens)} */}
              </div>
            )}
            {row("Reserved output", outputTokens)}
            <div className="flex justify-between font-medium"><span>Available:</span><span>{availableTokens.toLocaleString()} tok ({Math.max(0, 100 - usedPct).toFixed(0)}%)</span></div>
            {bandCounts ? (
              // Banding keeps every turn — verbatim or folded into the digest band — so frame it as
              // "full vs digested", not "kept vs lost". Dropped only shows if a turn truly fell off.
              <div className="flex justify-between">
                <span>Turns:</span>
                <span>
                  {bandCounts.turnsTotal} ({bandCounts.turnsVerbatim} full, {bandCounts.turnsBanded} summarized
                  {bandCounts.turnsTotal - bandCounts.turnsVerbatim - bandCounts.turnsBanded > 0
                    ? `, ${bandCounts.turnsTotal - bandCounts.turnsVerbatim - bandCounts.turnsBanded} dropped`
                    : ""}
                  {bandCounts.turnsRelevanceDropped > 0 ? `, ${bandCounts.turnsRelevanceDropped} by relevance` : ""}
                  {bandCounts.turnsRehydrated > 0 ? `, ${bandCounts.turnsRehydrated} recalled` : ""})
                </span>
              </div>
            ) : (
              <div className="flex justify-between"><span>Turns kept:</span><span>{Math.floor(trimmed.length / 2)} / {Math.floor(fullMessageHistory.length / 2)}</span></div>
            )}
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
      // Runtime-discovered characters must be in this list or they render as disabled, portrait-less
      // rows the player can't open — and the Discovered badge/remove control never resolves them.
      entities={allEntities}
      onEntityClick={(entityId) => {
        setSelectedEntity(entityId);
        setIsEntityModalOpen(true);
      }}
      onRegenerateMemory={regenerateMemory}
    />
  );

  // The scene images belonging to the page being viewed (one turn per page).
  const viewedTurn = parseTurnContent(fullMessageHistory[pageAssistantIndex(currentPage, messagesPerPage)]?.content ?? "");

  const middlePanel = (
    <MiddlePanel
      parseAssistantMessage={parseAssistantMessage}
      totalPages={totalPages}
      handlePageChange={handlePageChange}
      handleSendAction={handleSendAction}
      handleKeyPress={handleKeyPress}
      handleRollback={handleRollback}
      handleRegenerate={handleRegenerate}
      handleRegenerateChoices={handleRegenerateChoices}
      handleRegenerateStats={handleRegenerateStats}
      abortGeneration={abortGeneration}
      // A scene render holds the next action too: the image has the graphics card until it's done.
      disabled={(isWaitingForAI && !choicesReady) || sceneImageJob !== null}
      sceneImages={(viewedTurn?.turnId && sceneImages[viewedTurn.turnId]) || EMPTY_IMAGES}
      sceneTags={viewedTurn?.sceneTags ?? ""}
      sceneTurnId={viewedTurn?.turnId}
      sceneImageJob={sceneImageJob}
      sceneImageProgress={sceneImageProgress}
      sceneImagePreview={sceneImagePreview}
      sceneImagesAvailable={!imageGenDisabled}
      onSceneImage={handleSceneImage}
      onSceneTags={handleSceneTags}
      onCancelSceneImage={cancelSceneImage}
      onDeleteSceneImage={handleDeleteSceneImage}
      onTTSClick={() => setIsTTSModalOpen(true)}
      onExportStory={() => setIsExportModalOpen(true)}
      onRegenerateTTS={handleRegenerateTTS}
      ttsLoaded={ttsLoaded}
      ttsGenerating={ttsGenerating}
      ttsProgress={ttsProgress}
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

  // The location whose background the scene shows — the paged turn's when browsing history, else live.
  const viewLocation = isViewingPast
    ? (locations.find((l) => l.id === viewLocationId) ?? currentLocation)
    : currentLocation;

  // Menu save/load handlers, extracted so the desktop (header) and mobile (tab-row) MenuModal instances share them.
  const handleMenuSave = (name: string, opts?: { overwriteId?: string; includeSceneImages?: boolean }) =>
    saveGame(name, worldOverview.name, worldId ? String(worldId) : undefined, opts?.overwriteId, {
      includeSceneImages: opts?.includeSceneImages,
    });
  const handleMenuLoad = async (id: string, targetWorldId?: string) => {
    // A render from the outgoing session must not finish into the loaded one under a dead turn id.
    cancelSceneImage();
    // A save from another (installed) world: swap GameData to that world first, then restore the save against
    // its locations — otherwise the save would run inside the current world's shell.
    if (targetWorldId && targetWorldId !== (worldId ? String(worldId) : undefined)) {
      try {
        const world = await WorldStorageService.getWorldData(targetWorldId) as World;
        // Use the migrated world for the save restore — the raw one may be a legacy shape whose locations/
        // stats lack the migration fixes (morph bindings, renamed keys) that loadWorldData just applied.
        const { world: migrated } = loadWorldData(world);
        return await loadGame(id, Array.isArray(migrated.locations) ? migrated.locations : [], Array.isArray(migrated.stats) ? migrated.stats : []);
      } catch (error) {
        console.error('Cross-world load failed:', error);
        toast.error("Couldn't load that save's world.");
        return false;
      }
    }
    return loadGame(id, locations, stats);
  };
  const menuModal = (extra?: { onEditWorld?: () => void; onShowAiContext?: () => void }) => (
    <MenuModal
      onSettingsClick={() => setIsSettingsOpen(true)}
      onReportBug={canReportBug ? () => setShowBugReport(true) : undefined}
      onSave={handleMenuSave}
      onLoad={handleMenuLoad}
      worldOverview={worldOverview}
      worldId={worldId ? String(worldId) : undefined}
      onExitToMenu={onExitToMenu}
      {...extra}
    />
  );

  return (
    <div
      className={`flex ${isMobile ? "flex-col" : "p-4"} h-[100dvh] text-sm md:text-base bg-background bg-cover bg-center overflow-hidden`}
      style={{
        // A background-colored overlay composited over the image fades it toward the theme background.
        // Dropped while the UI is hidden, so the eye toggle reveals the raw image.
        backgroundImage: locationBackground
          ? `${
              !uiHidden && backgroundOverlay > 0
                ? `linear-gradient(hsl(var(--background) / ${backgroundOverlay}), hsl(var(--background) / ${backgroundOverlay})), `
                : ""
            }${viewLocation ? `url(${viewLocation.backgroundImage})` : "url(./default-background.jpg)"}`
          : undefined,
      }}
    >
      <ThemedToastContainer />

      {isMobile && !uiHidden && (
        <div className="flex shrink-0 items-center gap-1 mb-1">
          {[
            { key: "character", label: "Character" },
            { key: "game", label: "Game" },
            { key: "status", label: "Status" },
          ].map((t) => (
            <button
              key={t.key}
              onClick={() => setMobilePanel(t.key)}
              className={`flex-1 min-w-0 rounded py-2 text-sm ${
                mobilePanel === t.key
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {t.label}
            </button>
          ))}
          {/* Menu joins the tab row on mobile; Edit World + AI Context fold into it (their header buttons hide). */}
          {menuModal({ onEditWorld: () => setIsEditingWorld(true), onShowAiContext: () => setIsDebugOpen(true) })}
        </div>
      )}

      {!uiHidden && (isMobile ? (
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
      ))}

      {/* Hide-UI toggle: reveals the background image. While the UI is hidden the button fades out completely
          until hovered. Hidden on mobile — the panels already fill the screen there, so it isn't needed. */}
      {!isMobile && (
      <Button
        onClick={() => setUiHidden((h) => !h)}
        title={uiHidden ? "Show UI" : "Hide UI"}
        className={`absolute bottom-2 left-2 z-30 flex items-center justify-center rounded-full w-10 h-10 p-0 transition-opacity ${
          uiHidden ? "opacity-0 hover:opacity-100" : "opacity-100"
        }`}
      >
        {uiHidden ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
      </Button>
      )}

      {/* BGM + AI-context buttons — desktop only. On mobile the music toggle is dropped and AI context moves
          into the tab-row menu. */}
      {!uiHidden && !isMobile && (
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
      )}

      {/* Edit-world + Menu buttons — desktop only. On mobile both fold into the tab-row menu. */}
      {!uiHidden && !isMobile && (
      <div className="absolute top-16 right-2 md:top-2 flex gap-2">
        <Button
          onClick={() => setIsEditingWorld(true)}
          className="flex items-center justify-center rounded-full w-10 h-10 p-0"
          title="Edit World"
        >
          <SquarePen className="h-5 w-5" />
        </Button>
        {menuModal()}
      </div>
      )}

      {/* Modals */}
      {readmeText && (
        <ReadmeModal
          readme={readmeResolved}
          open={showReadmeModal}
          onOpenChange={setShowReadmeModal}
          show={showReadme(worldId)}
          onShowChange={(s) => setShowReadme(worldId, s)}
        />
      )}

      {selectedEntity && (
        <EntityModal
          // A runtime-discovered character only ever gets the one generated description, stored as the
          // AI-facing field, so show that as its player description or the modal reads "No description
          // provided". Scoped to discovered characters: an authored entity's aiDescription is author-only
          // notes and must never surface to the player.
          entity={(() => {
            const found = allEntities.find((f) => f.name === selectedEntity);
            if (!found) return null;
            const isDiscovered = discoveredEntities.some((d) => d.entity.name === found.name);
            return isDiscovered && !found.playerDescription?.trim()
              ? { ...found, playerDescription: found.aiDescription }
              : found;
          })()}
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
        <DialogContent className="max-w-[95vw] w-[95vw] h-[90dvh] p-0 overflow-hidden">
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
        <DialogContent className="max-w-[90vw] w-[90vw] h-[85dvh] flex flex-col overflow-hidden">
          {(() => {
            const palette = HIGHLIGHT_PALETTE;
            // Stable per-entry color + name lookups (by the live dictionary's order), shared by the legend,
            // the inline match-chips, and the reason popovers so one accent always means one entry.
            const colorMap: Record<string, string> = {};
            const nameById = new Map<string, string>();
            dictionary.forEach((entry, i) => {
              colorMap[entry.id] = palette[i % palette.length];
              nameById.set(entry.id, entry.name || parseKeywords(entry)[0] || "unnamed");
            });
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
            // One inline match-chip: the entry it belongs to plus the exact hit behind it (drives the popover).
            interface DictChip { entryId: string; color: string; activation: EntryActivation; hit: MatchHit; }
            // A rendered run of text — plain, a legacy flat color mark (hydrations), or a dictionary match-chip.
            interface Seg { text: string; color?: string; chip?: DictChip; }
            // Dictionary highlighter — the truthful path. Marks ONLY the real activation hits, located inside
            // the exact scanned strings (`dict.sources`) captured for this turn, so a highlight means the text
            // genuinely drove an entry to activate. `dict` is undefined for non-narration requests and raw
            // output (never scanned) — those render plain. Honors the search filter and the legend toggles.
            const buildDictSegments = (text: string, dict?: DictionaryDebug): Seg[] => {
              const shown = searchActive ? filterLines(text) : text;
              if (searchActive && !shown) return [];
              if (!dict) return shown ? [{ text: shown }] : [];
              // Locate real activation hits (lib does the offset math + overlap resolution); paint on the color.
              return locateMatches(
                shown,
                dict.report,
                dict.sources,
                (entryId) => disabledHighlights[entryId] || !colorMap[entryId],
              ).map((seg) =>
                seg.chip
                  ? { text: seg.text, color: colorMap[seg.chip.entryId], chip: { entryId: seg.chip.entryId, color: colorMap[seg.chip.entryId], activation: seg.chip.activation, hit: seg.chip.hit } }
                  : { text: seg.text },
              );
            };
            // Hydration highlighter: no section/declaration logic — just mark the (active) hydration terms,
            // honoring the search filter and returning [] when search hides everything.
            const buildHydrationSegments = (text: string, rules: HighlightRule[]): HighlightSegment[] => {
              const t = searchActive ? filterLines(text) : text;
              if (searchActive && !t) return [];
              return highlightSegments(t, rules);
            };
            // Human labels for a scanned region + an entry's match rule, shown in the reason popover.
            // Scene regions are the prompt token that produced the block, so the label names the scope the
            // player actually sees in the prompt (here / sub-locations / nearby).
            const regionLabel = (region: string): string => {
              if (region === "action") return "the player action";
              if (region === "notes") return "player notes";
              if (region.startsWith("history:")) return "an earlier message";
              if (region.startsWith("recursion:")) {
                const src = nameById.get(region.slice("recursion:".length));
                return src ? `the lore of "${src}"` : "another entry's lore";
              }
              if (region.startsWith("<LOCATION") || region.startsWith("<ENTITIES")) {
                const what = region.startsWith("<LOCATION") ? "location" : "characters & things";
                const variant = tokenVariant(region) ?? "";
                const scope = variant.includes("sublocations") ? "in the sub-locations"
                  : variant.includes("reachable") ? "nearby"
                  : variant.includes("destinations") ? "where you can go"
                  : "here";
                return `${what} ${scope}${variant.includes("summary") ? " (summary)" : ""}`;
              }
              return region;
            };
            const ruleLabel = (rule: MatchRule): string => {
              const how = rule.regex ? "regex" : rule.wholeWord ? "whole word" : "substring";
              return rule.caseSensitive ? `${how}, case-sensitive` : how;
            };
            const reasonBadge = (reason: EntryActivation["reason"]): string =>
              reason === "constant" ? "always on"
              : reason === "recursive" ? "recursively activated"
              : reason === "semantic" ? "meaning match"
              : "keyword match";
            // The "why it fired" popover for one match-chip.
            const renderReason = (chip: DictChip) => {
              const { activation: act, hit } = chip;
              const sec = act.secondary;
              return (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold">{nameById.get(chip.entryId) ?? "unnamed"}</span>
                    <span className="rounded px-1 py-0.5 text-[10px]" style={{ backgroundColor: chip.color, color: "#000" }}>
                      {reasonBadge(act.reason)}
                    </span>
                  </div>
                  <div>
                    Matched <span className="font-medium">“{hit.matchedText}”</span> in {regionLabel(hit.region)}
                    {hit.keyword !== hit.matchedText ? <> (keyword <code>{hit.keyword}</code>)</> : null}.
                  </div>
                  <div className="text-muted-foreground">Match rule: {ruleLabel(act.rule)}.</div>
                  {sec ? (
                    <div className="text-muted-foreground">
                      Secondary ({sec.requireAll ? "all" : "any"} of {sec.keywords.map((k) => `“${k}”`).join(", ")}):{" "}
                      {sec.present ? "present" : "absent"}{sec.exclude ? " — inverted, fires when absent" : ""}.
                    </div>
                  ) : null}
                </div>
              );
            };
            const renderSegs = (segs: Seg[]) =>
              segs.map((seg, k) => {
                if (seg.chip) {
                  return (
                    <Popover key={k}>
                      <PopoverTrigger asChild>
                        <mark
                          style={{ backgroundColor: seg.color, color: "#000" }}
                          className="rounded px-0.5 cursor-pointer hover:ring-2 hover:ring-ring"
                        >
                          {seg.text}
                        </mark>
                      </PopoverTrigger>
                      <PopoverContent align="start" className="w-72 text-xs">
                        {renderReason(seg.chip)}
                      </PopoverContent>
                    </Popover>
                  );
                }
                return seg.color ? (
                  <mark
                    key={k}
                    style={{ backgroundColor: seg.color, color: "#000" }}
                    className="rounded px-0.5"
                  >
                    {seg.text}
                  </mark>
                ) : (
                  <span key={k}>{seg.text}</span>
                );
              });
            // Page = turn; show the requests captured for the currently selected (visible) turn.
            const totalDebugPages = visibleDebugTurns.length;
            const pageIndex = Math.min(Math.max(debugPage, 1), Math.max(totalDebugPages, 1)) - 1;
            const currentTurn = visibleDebugTurns[pageIndex];
            const currentRequests = currentTurn?.requests ?? [];
            // This turn's narration activation report drives the legend's activated/dimmed state.
            const activationById = new Map(
              (currentRequests.find((r) => r.type === "narration")?.dictionary?.report ?? []).map((a) => [a.entryId, a]),
            );
            // The hydration signal for this turn: the action's keywords (matched vs summaries) + the action's
            // entities (matched vs participation) — exactly what selectRehydrations sees. Deduped, colored.
            const hydrationTerms: string[] = [];
            const hydrationColorMap: Record<string, string> = {};
            {
              const seen = new Set<string>();
              const action = currentTurn?.action || "";
              const raw = [
                ...extractKeywords(action, dictionary),
                ...findEntityNames(action, allEntities, { requireCapital: false }),
              ];
              for (const term of raw) {
                const key = term.toLowerCase();
                if (term && !seen.has(key)) {
                  seen.add(key);
                  hydrationColorMap[key] = palette[hydrationTerms.length % palette.length];
                  hydrationTerms.push(term);
                }
              }
            }
            const activeHydrationRules: HighlightRule[] = hydrationTerms
              .filter((term) => !disabledHydrations[term])
              .map((term) => ({ term, color: hydrationColorMap[term.toLowerCase()] }));
            // Per-block segmenter honoring the mode. Hydrations mark only inside the narration request;
            // dictionary marks come from that request's captured activation and never touch the raw output.
            const segmentsFor = (text: string, req: DebugRequest, isOutput: boolean): Seg[] =>
              debugHighlightMode === "hydrations"
                ? buildHydrationSegments(text, req.type === "narration" ? activeHydrationRules : [])
                : buildDictSegments(text, isOutput ? undefined : req.dictionary);
            // The memory digest for this turn (stored on its assistant message), if one has been generated.
            const currentSummary = currentTurn?.turnId
              ? fullMessageHistory
                  .map((m) => (m.role === "assistant" ? parseTurnContent(m.content) : null))
                  .find((c) => c?.turnId === currentTurn.turnId)?.summary
              : undefined;
            // Collapse keys: one per request group ("group-<i>"), one per request body, plus one per
            // captured raw output ("out-<i>"). Collapse/expand all toggles every level.
            const collapseKeys: (string | number)[] = [];
            currentRequests.forEach((req, i) => {
              collapseKeys.push(`group-${i}`);
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
            return (
              <>
                <DialogHeader className="flex-shrink-0">
                  <div className="flex items-center justify-between gap-2 pr-8">
                    <DialogTitle className="flex items-center gap-2"><Braces className="h-4 w-4" /> AI context</DialogTitle>
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5"
                      onClick={handleExportDebugContext}
                      disabled={debugTurns.length === 0}
                      title="Download the full turn history as JSON"
                    >
                      <Download className="h-4 w-4" />
                      Export
                    </Button>
                  </div>
                </DialogHeader>
                <div className="flex flex-wrap items-center gap-2 flex-shrink-0 text-xs">
                  {/* Highlight-mode toggle: dictionary entries vs the per-turn rehydration signal. */}
                  <div className="inline-flex flex-shrink-0 overflow-hidden rounded border border-border">
                    {(["dictionary", "hydrations"] as const).map((m) => (
                      <button
                        key={m}
                        onClick={() => setDebugHighlightMode(m)}
                        className={`px-2 py-0.5 ${
                          debugHighlightMode === m ? "bg-muted font-medium" : "text-muted-foreground"
                        }`}
                      >
                        {m === "dictionary" ? "Dictionary" : "Hydrations"}
                      </button>
                    ))}
                  </div>
                  {debugHighlightMode === "dictionary" ? (
                    dictionary.length > 0 ? (
                      dictionary.map((entry) => {
                        // Only entries that actually activated this turn are togglable; the rest read as
                        // dimmed, non-interactive tags so the full set stays visible.
                        const activation = activationById.get(entry.id);
                        const activated = !!activation?.activated;
                        // Semantic activations have no text span to highlight, so the legend chip is
                        // their visible evidence: ≈ plus the similarity in the tooltip.
                        const semantic = activation?.reason === "semantic";
                        const label = (semantic ? "≈ " : "") + (entry.name || parseKeywords(entry)[0] || "unnamed");
                        if (!activated) {
                          return (
                            <span
                              key={entry.id}
                              className="rounded border border-border px-1.5 py-0.5 opacity-40 text-muted-foreground"
                              title="Did not activate this turn"
                            >
                              {label}
                            </span>
                          );
                        }
                        const disabled = disabledHighlights[entry.id];
                        return (
                          <button
                            key={entry.id}
                            onClick={() =>
                              setDisabledHighlights((prev) => ({ ...prev, [entry.id]: !prev[entry.id] }))
                            }
                            className="rounded border px-1.5 py-0.5"
                            style={
                              disabled
                                ? { borderColor: colorMap[entry.id], opacity: 0.5 }
                                : { backgroundColor: colorMap[entry.id], borderColor: colorMap[entry.id], color: "#000" }
                            }
                            title={
                              semantic
                                ? `Activated by meaning (similarity ${activation?.semanticSimilarity?.toFixed(2) ?? "?"}) — no keyword hit to highlight`
                                : disabled ? "Click to show highlights" : "Click to hide highlights"
                            }
                          >
                            {label}
                          </button>
                        );
                      })
                    ) : (
                      <span className="text-muted-foreground">No dictionary entries.</span>
                    )
                  ) : hydrationTerms.length > 0 ? (
                    hydrationTerms.map((term) => {
                      const disabled = disabledHydrations[term];
                      const color = hydrationColorMap[term.toLowerCase()];
                      return (
                        <button
                          key={term}
                          onClick={() =>
                            setDisabledHydrations((prev) => ({ ...prev, [term]: !prev[term] }))
                          }
                          className="rounded border px-1.5 py-0.5"
                          style={
                            disabled
                              ? { borderColor: color, opacity: 0.5 }
                              : { backgroundColor: color, borderColor: color, color: "#000" }
                          }
                          title={disabled ? "Click to enable highlight" : "Click to disable highlight"}
                        >
                          {term}
                        </button>
                      );
                    })
                  ) : (
                    <span className="text-muted-foreground">No hydration terms for this turn.</span>
                  )}
                </div>
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
                  <label className="flex flex-shrink-0 items-center gap-1.5 text-xs text-muted-foreground cursor-pointer select-none">
                    <Checkbox
                      checked={debugCurrentContextOnly}
                      onCheckedChange={(checked) => setDebugCurrentContextOnly(checked === true)}
                    />
                    Current context only
                  </label>
                </div>
                {currentTurn && (
                  <div className="flex-shrink-0 text-xs text-muted-foreground truncate">
                    <span className={currentTurn.regenerated || currentTurn.pruned ? "line-through" : ""}>
                      Turn {pageIndex + 1} of {totalDebugPages}
                      {currentTurn.action ? ` — "${currentTurn.action}"` : ""}
                    </span>
                    {currentTurn.regenerated ? (
                      <span className="ml-2 font-medium text-warning">Re-generated</span>
                    ) : currentTurn.pruned ? (
                      <span className="ml-2 font-medium text-warning">Pruned</span>
                    ) : null}
                  </div>
                )}
                {showSilentRequests && currentSummary && (
                  <div className="flex-shrink-0 rounded-md border border-border bg-muted/40 p-2 text-xs">
                    <div className="mb-1 font-semibold text-muted-foreground">Memory summary</div>
                    <pre className="whitespace-pre-wrap break-words">{currentSummary}</pre>
                  </div>
                )}
                <div className="flex-grow min-h-0">
                  <ScrollArea className="h-full">
                    <div className="space-y-4 text-xs">
                      {totalDebugPages === 0 ? (
                        <p className="text-muted-foreground">
                          {debugCurrentContextOnly && debugTurns.length > 0
                            ? "Only re-generated, rolled-back, or aborted turns exist. Uncheck “Current context only” to see them."
                            : "No AI context captured yet. Take an action first, then reopen this."}
                        </p>
                      ) : (
                        currentRequests.map((req, i) => {
                          const msgSegs = req.messages.map((m) => ({
                            role: m.role,
                            segs: segmentsFor(m.content, req, false),
                          }));
                          const hasReqMatch = msgSegs.some((ms) => ms.segs.length > 0);
                          // Raw, unmodified AI output for this request (captured in makeAIRequest).
                          const outSegs =
                            typeof req.response === "string" ? segmentsFor(req.response, req, true) : null;
                          const hasOutMatch = outSegs !== null && outSegs.length > 0;
                          // While searching, drop the whole block only if neither the request nor its output matches.
                          if (searchActive && !hasReqMatch && !hasOutMatch) return null;
                          const groupOpen = searchActive ? true : !collapsedDebug[`group-${i}`];
                          const reqOpen = searchActive ? true : !collapsedDebug[i];
                          const outOpen = searchActive ? true : !collapsedDebug[`out-${i}`];
                          return (
                            <Collapsible
                              key={i}
                              open={groupOpen}
                              onOpenChange={(o) =>
                                setCollapsedDebug((prev) => ({ ...prev, [`group-${i}`]: !o }))
                              }
                              className="border border-border rounded-md"
                            >
                              <CollapsibleTrigger asChild>
                                <button className="flex w-full items-center justify-between gap-2 p-2 text-left font-semibold">
                                  <span>Request {i + 1}: {req.type}</span>
                                  {groupOpen ? (
                                    <ChevronDown className="h-4 w-4 flex-shrink-0" />
                                  ) : (
                                    <ChevronRight className="h-4 w-4 flex-shrink-0" />
                                  )}
                                </button>
                              </CollapsibleTrigger>
                              <CollapsibleContent className="space-y-2 p-2 pt-0">
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
                                        <span>Prompt</span>
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
                                        <span>Raw Output</span>
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
                              </CollapsibleContent>
                            </Collapsible>
                          );
                        })
                      )}
                    </div>
                  </ScrollArea>
                </div>
                {totalDebugPages > 1 && (
                  <div className="flex-shrink-0 flex justify-center pt-2">
                    <Pager page={debugPage} pageCount={totalDebugPages} onPageChange={setDebugPage} />
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
        onLoadedChange={setTtsLoaded}
      />

      <BugReportDialog open={showBugReport} onOpenChange={setShowBugReport} />

      <SettingsModal
        isOpen={isSettingsOpen}
        onOpenChange={(v) => { setIsSettingsOpen(v); if (!v) { setSettingsTab(undefined); setSettingsEndpointTab(undefined); } }}
        previewValues={promptPreviewValues}
        initialTab={settingsTab ?? devRoute?.tab}
        initialEndpointTab={settingsEndpointTab}
        initialPromptTab={devRoute?.subtab}
      />

      <AiSetupGate
        open={aiGateOpen}
        reason="play"
        mode={aiMode}
        blocker={aiBlocker}
        reachable={aiReachable}
        recheck={aiRecheck}
        onOpenChange={(v) => { if (!v) setAiGateOpen(false); }}
        onOpenSettings={() => { setAiGateOpen(false); setIsSettingsOpen(true); }}
        onReady={handleAiGateReady}
      />

      <LlmSetupGuide
        open={connectionGuideOpen}
        onOpenChange={setConnectionGuideOpen}
        endpointUrl={getEndpointUrl()}
      />

      <AlertDialog open={isExportModalOpen} onOpenChange={setIsExportModalOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Export story</AlertDialogTitle>
            <AlertDialogDescription>
              Download every turn&apos;s narration as a single file. Markdown keeps the formatting
              (<strong>bold</strong>, headings, lists); plain text is unformatted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => exportStory('txt')}>Plain text (.txt)</AlertDialogAction>
            <AlertDialogAction onClick={() => exportStory('md')}>Markdown (.md)</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default GameViewer;
