import { randomUUID } from "@/lib/uuid";
import React, { useState, useEffect, useLayoutEffect, useCallback, useRef, useMemo } from "react";
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
import { Music, SquarePen, Database, ScrollText, ChevronDown, ChevronRight, ChevronUp, ChevronsDownUp, ChevronsUpDown, Search, Eye, EyeOff } from "lucide-react";
import { ActionIcon } from '@/lib/actionIcons';
import IndeterminateProgress from "../components/ui/indeterminate-progress";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "react-toastify";
import { ThemedToastContainer } from "@/components/ThemedToastContainer";
import "react-toastify/dist/ReactToastify.css";
import TTSModal, { type TTSModalHandle, type TTSProgress } from "../components/game/TTSModal";
import ReadmeModal from "../components/game/ReadmeModal";
import { useReadmeVisibility } from "@/lib/useReadmeVisibility";
import { resolveOpeningCue } from "@/lib/openingCue";
import { resolveWorldPrompt, useWorldPromptOptOut } from "@/lib/worldPrompt";
import { useWorldPromptPresets } from "@/lib/worldPromptPreset";
import { EntityModal } from "../components/modals/EntityModal";
import { LocationModal } from "../components/modals/LocationModal";
import { SettingsModal } from "../components/modals/SettingsModal";
import { asSettingsTab, type SettingsTabId } from "../components/modals/settingsTabs";
import { FeedbackDialog } from "@/components/menu/FeedbackDialog";
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
import type { CharacterData, ChatMessage, ChatRole, AIRequestType, AITurnResult, GameLocation, MediaAsset, Dictionary, Entity, SaveRecord, World, PlayerStat } from "@/types";
import { UnsavedChangesDialog } from "../components/UnsavedChangesDialog";
import { estimateHistoryChars, estimateTokens } from "../lib/memoryUtils";
import { parseNarration, stripReasoning, stripReasoningLive, extractReasoning, extractReasoningLive } from "../lib/aiResponse";
import { setLiveReasoning, getLiveReasoning } from "../lib/reasoningStreamStore";
import {
  activeCharacterGuidance,
  defaultDiscoverEntityPrompt,
  defaultRegenEntityPrompt,
  defaultMilestoneIncrementalPrompt,
} from "../components/game/GamePrompts";
import {
  buildDiaryUserMessage,
  buildStagedPlan,
  matchCastToEntities,
  classifyCast,
  sanitizePlanForReveal,
  buildSceneList,
  type DirectorCastMember,
  type ParsedDirector,
} from "../lib/stagedPlanning";
import { selectRelevantDiary } from "../lib/semanticDiary";
import { selectDueDiscovery, materializeDiscoveredEntity, discoveredAsEntities, cleanDiscoveredDescription, pruneDiscoveredToHistory, INITIAL_SOURCE_TURN_ID } from "../lib/runtimeCharacters";
import { entityIdsAt } from "../lib/entityPresence";
import { selectRegenSource, buildRegenContext, buildRegenUserMessage, REGEN_LABELS } from "../lib/discoveredRegen";
import { trimToLastSentence } from "../lib/outputLength";
import { buildAiRequestSpec, type AiSettingsSnapshot } from "../lib/aiRequest/aiRequestSpec";
import { streamAiRequest, ABORTED_FINISH_REASON, DEFAULT_REASONING_THROTTLE_MS } from "../lib/aiRequest/aiStream";
import { splitSentenceSegments } from "../lib/ttsChunks";
import { selectDueDigests, applyDigest, applyImportance, parseTurnContent, recentParticipants, selectDueDiaries, pendingDiaryNames, applyDiary, collectCharacterDiary } from "../lib/turnDigest";
import { buildTraitContext } from "../lib/traitTree";
import { buildLocationContext, buildEntityContext, buildSublocationsContext, buildSublocationEntitiesContext, buildReachableLocationsContext, buildReachableEntitiesContext, buildDestinationsContext, buildParentLocationContext, buildSceneEntitiesContext, scenePresentHere, navigableDestinations, sublocationEntityIds, expandScopedTokens } from "../lib/locationContext";
import { useResolvedWorld } from "@/lib/useResolvedWorld";
import { resolveStartingLocation } from "../lib/startingLocation";
import { NONE_PLACEHOLDER } from "../lib/promptFallbacks";
import { buildStatContext } from "../lib/statContext";
import { variableForToken, variableVariantIds, decodeVariant, tokenVariant, withVariant } from "../lib/promptVariables";
import { renderPromptTemplate } from "../lib/promptTemplate";
import { useBaselineTestHook } from "../lib/baselineTestHook";
import { recordParityRequest, recordParityResponse, recordParityTurn } from "../lib/turnPipeline/parityRecorder";
import {
  TURN_PASS_CAPS,
  choicesSystemPrompt,
  statUpdatesSystemPrompt,
  summaryUserMessage,
  discoverUserMessage,
  sceneTagsPass,
} from "../lib/turnPipeline/turnPasses";
import { buildNarrationPrompt, type DictionaryDebug } from "../lib/turnPipeline/narrationPrompt";
import { buildPlannerBand } from "../lib/turnPipeline/plannerBand";
import { readNarration, selectVisitorAdditions, presentSceneEntities, splitParticipants } from "../lib/turnPipeline/narrationReading";
import { planTurn, planHasPass } from "../lib/turnPipeline/planTurn";
import { runTurn, type TurnAdvance, type TurnRequestAdapter } from "../lib/turnPipeline/turnRunner";
import { computeTurnCommit, type TurnCommit } from "../lib/turnPipeline/computeTurnCommit";
import { classifyTurnError, type TurnErrorKind } from "../lib/turnPipeline/turnErrors";
import { emptyTurnMaterial, type TurnMaterial, type TurnPlanInput, type TurnPrompts, type TurnSettings } from "../lib/turnPipeline/turnPlan";
import { parseTurns, buildVerbatimHistory, buildBandedHistory, extractKeywords, type BandCounts } from "../lib/turnBanding";
import { anatomyRegions, toAnatomyBlocks, type RequestAnatomy } from "../lib/requestAnatomy";
import type { PromptJumpTarget } from "../lib/promptJump";
import { RequestAnatomyView } from "../components/game/RequestAnatomyView";
import {
  markFindHits, markFraction, parseFindTerms, planFindHits, type FindMarked,
} from "@/lib/findMarks";
import { buildStamper, formatAbsolute, hoursByPosition, FLAT_HOURS_PER_TURN } from "../lib/gameClock";
import { milestoneCandidates, agedMilestoneCandidates, resolveMilestoneDrop, resolveMilestoneKeep, buildIncrementalMilestoneUserMessage, parseIncrementalMilestoneReply, applyIncrementalVerdict } from "../lib/milestoneMemory";
import { applyMemoryOverrides, activeNotes } from "../lib/memoryOverrides";
import { buildRelevanceScores, vectorKey } from "../lib/memoryRelevance";
import { entryVectorKey, entryEmbedText } from "../lib/semanticDictionary";
import { selectSemanticRehydrations, rehydrationCooldownBlocked } from "../lib/semanticRehydration";
import { embedTexts, isEmbeddingModelReady, loadEmbeddingModel } from "../lib/embeddingWorkerClient";
import { getVectors, putVector } from "../lib/embeddingCache";
import { findEntityNames, matchNames, sameCharacterName } from "../lib/entityMatch";
import { parseChoices } from "../lib/choices";
import { setGameplayText } from "../lib/gameplayTextStore";
import { useSentenceReveal } from "../lib/useSentenceReveal";
import { useSmoothedReveal } from "../lib/useSmoothedReveal";
import { revealActive } from "../lib/narrationRevealConfig";
import { REVEAL_TEST_NARRATION, REVEAL_TEST_PROFILES } from "../lib/revealTestScripts";
import { MARKDOWN_SAMPLE } from "../lib/markdownSample";
import { parseSlashCommand } from "../lib/slashCommands";
import { normalizeStatChanges, applyAiStatChanges, parseStatUpdates, applyAiMaxChanges, appliedStatDeltas } from "../lib/statChanges";
import { toDebugEndpoint, type DebugEndpointInfo } from "../lib/promptEndpoints";
import { composeSceneTags, stripPlaces, splitTags, MAX_SCENE_CHARACTERS, type SceneCharacter } from "../lib/sceneTags";
import { loadDanbooruTags } from "../lib/danbooruTags";
import { addSceneImage, removeSceneImage, pruneSceneImages, setSceneTags as patchSceneTags } from "../lib/sceneImages";
import { generateImage, buildImageRequest } from "../lib/imageGen";
import { buildImagePrompt } from "../lib/imagePrompt";
import { downloadBlob } from "../lib/downloadBlob";
import { rollbackState, regenerateState, canRegenerate, lastTurnAction, markRegeneratedTurn, markPrunedTurns, snapshotPageIndex, placeSnapshot, sliceHistoryToPage, pageAssistantIndex } from "../lib/turnHistory";
import { useDeferredSnapshot } from "../lib/useDeferredSnapshot";
import { statMorphMap } from "../lib/bodyMorphs";
import {
  inAuthoredOrder, refreshChosenTraits, activeStatEnabled, enabledStats,
  activePlaceholderPins,
} from "../lib/traitEffects";
import {
  acquireTrait, seedStatBases, setTraitEnabled, type TraitRuntimeState,
} from "../lib/traitRuntime";
import { parseKeywords, locateMatches, type EntryActivation, type MatchHit, type MatchRule } from "../lib/dictionaryUtils";
import { highlightSegments, HIGHLIGHT_PALETTE, type HighlightRule, type HighlightSegment } from "../lib/highlightUtils";
import { useIsMobile } from "../lib/useIsMobile";
import {
  LeftPanel,
  MiddlePanel,
  RightPanel,
} from "../components/game/GamePanels";
import { LocationBackdrop } from "../components/game/LocationBackdrop";
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
// The dictionary activation captured for a turn's narration request (see lib/turnPipeline/narrationPrompt)
// lets the AI-context viewer mark real matches — and only real matches — even on historical turns whose live
// state has moved on.
interface DebugRequest {
  type: string;
  messages: ChatMessage[];
  response?: string;
  /** Which endpoint served this request — absent on turns captured before routing existed. */
  endpoint?: DebugEndpointInfo;
  // Correlates a captured request to its own response, so concurrent same-type calls (the staged character
  // pass, parallel diaries) each land on the right entry instead of overwriting by (type + empty-response).
  id?: string;
  // Narration only: the dictionary activation behind this turn's injected lore.
  dictionary?: DictionaryDebug;
  // Narration only: which runs of the sent messages are authored prompt text and which are assembled
  // context (see lib/requestAnatomy). Absent on turns captured before the anatomy existed — those render
  // unlabeled, exactly as they did.
  anatomy?: RequestAnatomy;
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
// the next turn's context assembly. Per-pass caps and their sizing live with the pass records.
const DIGEST_MAX_TOKENS = TURN_PASS_CAPS.summary;
// The milestone selector replies with a comma-separated index list; sized for long histories.
const MILESTONE_SELECT_MAX_TOKENS = 300;

// Every Stats chip token (base + all piece/format combos), so buildContextValues can render each. The pieces
// (Values/Status/Meaning) are decoded per token and handed to buildStatContext; ids mirror encodeVariant.
const STATS_VARIABLE = variableForToken('<STATS DESCRIPTION>')!;
const STATS_TOKENS = ['<STATS DESCRIPTION>', ...variableVariantIds(STATS_VARIABLE).map((id) => withVariant('<STATS DESCRIPTION>', id))];

const DIARY_MAX_TOKENS = TURN_PASS_CAPS.diary;
const DISCOVER_MAX_TOKENS = TURN_PASS_CAPS.discoverEntity;

/**
 * One AI call's arguments. A turn pass's own `TurnPassRequest` already has this shape, so the pipeline's
 * request adapter hands its request straight through with only the turn's signal added.
 */
interface AiCallArgs {
  systemPrompt: string;
  messages: ChatMessage[];
  type: AIRequestType;
  /** Absent (or null) leaves the request type's own default cap to apply downstream. */
  maxTokens?: number | null;
  signal?: AbortSignal;
  /**
   * Inspection sidecar for the AI-context viewer (see lib/requestAnatomy). Captured with the request and
   * dropped here — the request spec is built from `systemPrompt` and `messages` alone, so it never reaches
   * the network.
   */
  anatomy?: RequestAnatomy;
  /**
   * Silent requests (the memory digest) run without UI noise: no "Generating…" label, and they surface in
   * the status bar / AI-context viewer only when the "Show Silent Requests" setting is on. When captured,
   * they attach to the turn named by `attachTurnId` (the turn the digest summarizes — usually the one just
   * committed, or an older turn when backfilling), so the viewer shows the request under the right turn
   * rather than whatever turn happens to be current.
   */
  silent?: boolean;
  attachTurnId?: string;
  /**
   * Skip setting the "Generating…" status label. The concurrent batch fires its passes at once; each would
   * otherwise stomp the shared label, so the batch sets one stable label itself instead.
   */
  quiet?: boolean;
}

// A stable empty array for turns with no scene image, so the panel's prop identity doesn't churn.
const EMPTY_IMAGES: string[] = [];

// How many of a character's own recent diary entries to feed into its motivation pass (its memory).
const DIARY_MEMORY_ENTRIES = 5;

// What each named turn failure tells the player. `connection` and `emptyNarration` speak for themselves at
// the call site, so they get their own text there rather than a row here.
const TURN_ERROR_MESSAGES: Partial<Record<TurnErrorKind, string>> = {
  notFound: "Request failed (404) Invalid endpoint URL or model name. Please check your settings.",
  badRequest: "Request failed (400). Either model name is wrong or memory limit exceeded model limit.",
  parse: "The AI model was unable to produce the correct JSON format. Try a different model.",
};
const turnErrorMessage = (kind: TurnErrorKind): string =>
  TURN_ERROR_MESSAGES[kind] ?? "Failed to complete action. Please try again.";

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
  // Names are read through `useResolvedWorld()` below — that is what keeps one name from resolving
  // differently per use site. The two `authored*` collections are the exception, and only for *seeding
  // state*: a resolved name stored in state stops being resolvable, so it would freeze the pins that
  // happened to be active when the game started.
  const {
    stats: authoredStats,
    traits: authoredTraits,
    locations: authoredLocations,
    connections,
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

  // A world may supply its own narration system prompt; the player can decline it per world from the
  // main-menu details popup. Resolved below, after the preset's own prompt is destructured.
  const { applyWorldPrompt } = useWorldPromptOptOut();

  // The whole settings bag is kept as well as the destructured fields: buildImageRequest reads the image
  // preset off it, so the scene path and the editor's dialog cannot drift apart on request shape.
  const settings = useSettings();

  // A world may also be pinned to a prompt preset. Held for as long as this view is mounted — covering a
  // new game and a loaded save alike — so every prompt resolves against it without touching the player's
  // global selection. Re-pinning from Settings writes back through `setWorldPreset`.
  const { worldPreset, setWorldPreset } = useWorldPromptPresets();
  const { beginSessionPreset, endSessionPreset } = settings;
  useEffect(() => {
    beginSessionPreset(worldPreset(worldId) ?? null, (id) => setWorldPreset(worldId, id));
    return () => endSessionPreset();
    // Re-runs only when the world changes; `worldPreset`/`setWorldPreset` are recreated every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [worldId, beginSessionPreset, endSessionPreset]);
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
    // Per-prompt endpoint routing: every AI call resolves its own target, so a prompt pinned to another
    // preset sends there. An unpinned prompt resolves to the active endpoint, i.e. the values above.
    resolveEndpointForKind,
    disableThinking,
    genTemperature,
    genTopP,
    genRepetitionPenalty,
    genTopK,
    genMinP,
    promptSamplers,
    systemPrompt: presetSystemPrompt,
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

  // The prompts this world actually runs on. Every reference below is a resolved value, so the opening
  // scene, the turn pipeline, and the standalone re-rolls all agree; passes the world can't override keep
  // reading their preset fields directly. One opt-out declines all three at once.
  const declinedWorldPrompts = !applyWorldPrompt(worldId);
  const systemPrompt = resolveWorldPrompt(worldOverview, 'narration', presetSystemPrompt, declinedWorldPrompts);
  const resolvedChoicesPrompt = resolveWorldPrompt(worldOverview, 'choices', choicesPrompt, declinedWorldPrompts);
  const resolvedStatUpdatesPrompt =
    resolveWorldPrompt(worldOverview, 'statUpdates', statUpdatesPrompt, declinedWorldPrompts);

  const {
    setCharacterData,
    setVisibleEntities,
    setCurrentLocation,
    setPlayerStats,
    playerTraits,
    setPlayerTraits,
    disabledTraitIds,
    setDisabledTraitIds,
    appliedTraitValues,
    setAppliedTraitValues,
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
    viewTraits,
    viewDisabledTraitIds,
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
    setRuntimeDictionaries,
    memoryPins,
    setMemoryPins,
    setEntityVisualPreference,
    setEntityImageIndex,
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

  // --- Placeholder resolution, before anything reads a name ---------------------------------------------
  // One hook, shared with the gameplay panels, so the two cannot resolve a name differently. Below this line
  // an entity/location/stat/trait/dictionary name is a plain string with no chips left in it. The `raw*`
  // values above stay untouched for roll priming, which has to see the chips it is rolling for.
  const {
    entities, locations, stats, traits, traitGroups, dictionary, playerStats, viewStats,
    currentLocation, traitOrder, resolvePH, resolveWith, resolveTraitText,
  } = useResolvedWorld();

  // --- Active traits and what they switch on ------------------------------------------------------------
  // A chosen trait the player has switched off contributes nothing: no AI text, no stat toggle, no pin. Its
  // stat *changes* were reversed at the moment it was switched off (see toggleTrait), so they aren't
  // recomputed here. Authored order decides precedence when two active traits target the same thing.
  // The save froze each chosen trait as the world stood on turn 1; the world owns its authoring, so read it
  // back before anything derives from it.
  const chosenTraits = useMemo(() => refreshChosenTraits(playerTraits, traits), [playerTraits, traits]);
  const activeTraits = useMemo(() => {
    const off = new Set(disabledTraitIds);
    return inAuthoredOrder(chosenTraits.filter((t) => !off.has(t.id)), traitOrder);
  }, [chosenTraits, disabledTraitIds, traitOrder]);

  // Runtime characters (Slice 2): director-invented characters promoted to persisted entities this
  // playthrough behave like authored ones — union them into the AI-pipeline roster, each carrying the
  // location it was invented at, so the location-scoped context rosters it like anyone else.
  // Discovered entities are minted at runtime from AI prose, so their names never carry chips.
  const allEntities = useMemo(
    () => [...entities, ...discoveredAsEntities(discoveredEntities)],
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

  /** Who belongs at `loc` — authored cast plus any discovered/visiting character anchored there. */
  const presentIdsAt = useCallback(
    (loc: GameLocation | null | undefined): string[] => entityIdsAt(loc?.id, allEntities),
    [allEntities],
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
  const [settingsTab, setSettingsTab] = useState<SettingsTabId | undefined>(undefined);
  const [settingsEndpointTab, setSettingsEndpointTab] = useState<string | undefined>(undefined);
  // Where a click on a highlighted run in the AI-context viewer sends Settings: the prompt that owns the
  // text, its editor, and — for the stacked narration lines — which field.
  const [settingsPrompt, setSettingsPrompt] = useState<PromptJumpTarget | undefined>(undefined);
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
  // The player took the gate's Continue action once setup finished — nothing is queued behind it, so
  // just dismiss.
  const handleAiGateReady = useCallback(() => setAiGateOpen(false), []);

  // DEV dev-router: open an in-game modal when the hash asks for it (Menu routes via MenuModal's own
  // devOpenLoad prop below). Tree-shaken in prod.
  const devRoute = useDevRoute();
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    switch (devRoute?.modal) {
      case 'settings': setIsSettingsOpen(true); break;
      case 'export': setIsExportModalOpen(true); break;
      case 'location': setIsLocationModalOpen(true); break;
      case 'aiContext': setIsDebugOpen(true); break;
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
  const debugFindTerms = useMemo(() => parseFindTerms(debugSearch), [debugSearch]);
  // Which hit the find bar is on, counted in the current turn's document order. The ref shadows it so a
  // second step taken before React re-renders still moves on from the first, rather than repeating it.
  const [debugHitIndex, setDebugHitIndex] = useState(0);
  const debugHitRef = useRef(0);
  // Requests a search folded shut for having no hits, that the reader opened anyway. Separate from
  // `collapsedDebug` so the fold never touches the arrangement they made for themselves.
  const [debugUnfolded, setDebugUnfolded] = useState<Record<string, boolean>>({});
  // The overview ruler: one tick per hit currently on screen, as a fraction of the scrollable height.
  const [debugTicks, setDebugTicks] = useState<{ index: number; fraction: number }[]>([]);
  const debugViewportRef = useRef<HTMLDivElement>(null);
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
  // A new query, or a new turn, starts at the first hit again and drops the folds opened by hand.
  useEffect(() => {
    debugHitRef.current = 0;
    setDebugHitIndex(0);
    setDebugUnfolded({});
  }, [debugSearch, debugPage]);
  /**
   * Redraw the overview ruler from what is on screen: one tick per mounted hit, at its share of the
   * scrollable height. Hits inside a collapsed section aren't mounted, so they simply get no tick — the
   * counter still counts them, since it reads the turn's text rather than the viewport.
   */
  const syncDebugTicks = useCallback(() => {
    const viewport = debugViewportRef.current;
    const marks = viewport ? [...viewport.querySelectorAll<HTMLElement>("[data-find-hit]")] : [];
    const top = viewport?.getBoundingClientRect().top ?? 0;
    const next = viewport
      ? marks.map((el) => ({
          index: Number(el.dataset.findHit),
          fraction: markFraction(
            el.getBoundingClientRect().top - top + viewport.scrollTop,
            viewport.scrollHeight,
          ),
        }))
      : [];
    setDebugTicks((prev) =>
      prev.length === next.length && prev.every((t, i) => t.index === next[i].index && t.fraction === next[i].fraction)
        ? prev
        : next,
    );
  }, []);
  // Scroll the hit being read to the middle of the view. Instant, never smooth: a jump between mentions
  // is navigation, and animating it is motion the reader never asked for.
  useLayoutEffect(() => {
    if (!isDebugOpen) return;
    const target = debugViewportRef.current?.querySelector<HTMLElement>(`[data-find-hit="${debugHitIndex}"]`);
    target?.scrollIntoView({ block: "center", behavior: "instant" });
  }, [isDebugOpen, debugHitIndex, debugSearch, debugPage]);
  // The ruler follows the document: a new hit set, a section opened or closed, or content that resized.
  useLayoutEffect(() => {
    syncDebugTicks();
  }, [syncDebugTicks, isDebugOpen, debugHitIndex, debugSearch, debugPage, collapsedDebug, debugUnfolded, debugHighlightMode]);
  useEffect(() => {
    const viewport = isDebugOpen && debugFindTerms.length > 0 ? debugViewportRef.current : null;
    if (!viewport) return;
    const resize = new ResizeObserver(() => syncDebugTicks());
    if (viewport.firstElementChild) resize.observe(viewport.firstElementChild);
    // A section opens and closes by mounting and unmounting its content, and Radix does that in a pass of
    // its own — after this render's effects have already measured. Watching the tree catches it; the
    // resize observer above catches everything that changes height without changing the tree.
    const mutations = new MutationObserver(() => syncDebugTicks());
    mutations.observe(viewport, { childList: true, subtree: true });
    return () => { resize.disconnect(); mutations.disconnect(); };
  }, [isDebugOpen, debugFindTerms, syncDebugTicks]);
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

  // Shared rewind sweep: cut the flat history at `page` and prune everything keyed by turn id to the
  // surviving turns — the (player-edited) discovered cast drops only characters whose introducing turn
  // was discarded (named again by a fresh roll, they are discovered anew), and scene images go with
  // their turns. Suppressed names stay whole; a deletion has no turn anchor to prune by.
  const rewindHistoryToPage = (page: number) => {
    const rewound = sliceHistoryToPage(fullMessageHistory, page, messagesPerPage);
    setFullMessageHistory(rewound);
    setDiscoveredEntities((prev) => pruneDiscoveredToHistory(prev, rewound));
    setSceneImages((prev) => pruneSceneImages(prev, rewound));
  };

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
    rewindHistoryToPage(currentPage);
    setUserPage(null); // the rolled-back turn is now the latest — resume following it
    // Seed the live notes scratchpad from the rolled-back turn's own notes (per-turn notes live on the
    // message, and keepLiveHistory skips the snapshot's notes) so a later re-generate/action uses them.
    // A turn that froze no notes (empty at finalize, or a stopped turn) falls back to the snapshot's
    // scratchpad — same resolution the paged view uses (viewNotes).
    setPlayerNotes(parseTurnContent(fullMessageHistory[pageAssistantIndex(currentPage, messagesPerPage)]?.content ?? '')?.notes ?? targetState.playerNotes ?? '');
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
    if (!loadGameState(previousState, locations, { keepLiveHistory: true })) return;
    // Stop a render aimed at the turn being re-rolled: left running, it would finish into a dead turn id
    // AND overlap the re-roll's language-model request on the one GPU.
    cancelSceneImage();
    rewindHistoryToPage(currentPage - 1);
    // The notes scratchpad is left alone: regen only targets the latest page, where the live scratchpad is
    // always at least as fresh as the message's frozen notes (a stopped turn freezes none at all —
    // re-seeding from the message here wiped the player's notes).
    // Mark the current turn's AI-context entry as superseded; sendGameAction appends a fresh one.
    setDebugTurns((prev) => markRegeneratedTurn(prev));
    // Re-generating the opening (page 1) returns to the not-started state and re-fills the box with the
    // prior opening action, so the player can edit their starting action before re-submitting it.
    if (currentPage === 1) {
      setIsGameStarted(false);
      // History holds the "START GAME" proxy, so recover the player's real opening text from the ref (falling
      // back to this world's cue for a loaded save, where it was never captured this session).
      setPlayerInput(
        openingActionRef.current || (action === "START GAME" ? resolvePH(resolveOpeningCue(worldOverview)) : action),
      );
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
      const response = await requestChoices(
        buildContextValues(),
        sceneEntityOverride(currentLocation, sceneEntities),
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
    if (!target || !statUpdatesEnabled || activeStats.length === 0) return;
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
      applyStatChanges(statChanges, null, applyAiMaxChanges(baseline, liveStatChanges(baseline, maxes)), {
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

  // Narration's resolved target backs every budget the story history is trimmed against — the window and the
  // reserved output belong to whichever endpoint narration actually sends to, not the globally-selected one.
  // The planner resolves its own below, since routing may point the two at very differently-sized models.
  const narrationEndpoint = useMemo(() => resolveEndpointForKind('narration'), [resolveEndpointForKind]);
  const contextWindow = narrationEndpoint.contextWindow;
  const maxTokens = narrationEndpoint.maxTokens;

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
      const { messages, runs, counts, bandTurnIds, rehydratedTurnIds } = buildBandedHistory({
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
      return { messages, runs };
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
  // The live stat-enabled map, read by the turn callbacks below. A ref because they are memoized against
  // their own inputs and must not re-create every time a trait switches something on or off.
  const statEnabledRef = useRef<Record<string, boolean>>({});

  // Drop AI deltas (keyed by lowercased name) aimed at stats that aren't live.
  const liveStatChanges = useCallback((base: PlayerStat[], deltas: Record<string, number>) => {
    const live = new Set(enabledStats(base, statEnabledRef.current).map((st) => st.name.toLowerCase()));
    return Object.fromEntries(Object.entries(deltas).filter(([name]) => live.has(name)));
  }, []);

  // A stat is live unless its author started it off or an active trait switched it off. Disabled stats keep
  // their value in `playerStats` — they are filtered out of everything that reads or moves them instead, so
  // switching the trait back on resumes exactly where the stat left off.
  const statEnabled = useMemo(() => activeStatEnabled(playerStats, activeTraits), [playerStats, activeTraits]);
  const activeStats = useMemo(() => enabledStats(playerStats, statEnabled), [playerStats, statEnabled]);
  statEnabledRef.current = statEnabled;

  // The same derivation for a paged-back turn, so history shows the stats that were live on that turn.
  const viewActiveStats = useMemo(() => {
    const off = new Set(viewDisabledTraitIds);
    const active = inAuthoredOrder(refreshChosenTraits(viewTraits, traits).filter((t) => !off.has(t.id)), traitOrder);
    return enabledStats(viewStats, activeStatEnabled(viewStats, active));
  }, [viewStats, viewTraits, viewDisabledTraitIds, traitOrder, traits]);

  useEffect(() => {
    // Authored stats anchor the morph scale, so a max the AI raised grows the shape key rather than
    // shrinking every point below it.
    setBodyMorphValues(statMorphMap(viewActiveStats, stats));
  }, [viewActiveStats, stats, setBodyMorphValues]);

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
          if (stat.regen && statEnabledRef.current[stat.id] !== false) {
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
      // Both stats must be live: a disabled Hunger frozen at a low value must not silently drain a Health
      // the player can see — or a hidden Health at all.
      const starvationOn = (s?: PlayerStat) => !!s && statEnabledRef.current[s.id] !== false;
      if (starvationOn(health) && starvationOn(hunger) && health && hunger) {
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
    if (!activeTraits.length) {
      return NONE_PLACEHOLDER;
    }
    // Group-aware: each selected trait's group emits its AI header above its traits (blank → omitted).
    // A trait's own description resolves with its own pins (names already did, via the collection), so the
    // AI reads the same words the player's card shows. The outer pass resolves the group headers; trait
    // text is token-free by then, so it passes through untouched.
    const selfResolved = activeTraits.map((t) =>
      t.aiDescription ? { ...t, aiDescription: resolveTraitText(t, t.aiDescription) } : t,
    );
    return resolvePH(buildTraitContext(selfResolved.map((t) => t.id), selfResolved, traitGroups, format));
  }, [activeTraits, traitGroups, resolvePH, resolveTraitText]);


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
    const presentIds = presentIdsAt(loc);
    type CtxOpts = { preferSummary?: boolean; nameOnly?: boolean; format?: "simple" | "markdown" | "xml" };

    // Entity roster precedence: here > sub-location > reachable. A character shows only in the highest scope
    // it belongs to — sub-location drops anyone present here; reachable drops present + sub-location ids.
    // Gathered from the authored cast only: a discovered or visiting character belongs to the location it
    // was invented at, and the scopes beyond here have never listed them.
    const subEntityIds = sublocationEntityIds(loc, locations, entities);
    const reachableExclude = [...presentIds, ...subEntityIds];

    // The <LOCATION> and <ENTITIES> chips each carry a `scope` axis; each scope maps to its builder.
    const locationScopes: Record<string, (opts: CtxOpts) => string> = {
      "": (opts) => buildLocationContext(loc, opts),
      sublocations: (opts) => buildSublocationsContext(loc, locations, opts),
      parent: (opts) => buildParentLocationContext(loc, locations, opts),
      reachable: (opts) => buildReachableLocationsContext(loc, locations, opts),
      destinations: (opts) => buildDestinationsContext(loc, locations, connections, opts),
    };
    const entityScopes: Record<string, (opts: CtxOpts) => string> = {
      "": (opts) => buildEntityContext(loc, allEntities, opts),
      sublocations: (opts) => buildSublocationEntitiesContext(loc, locations, entities, { ...opts, excludeIds: presentIds }),
      reachable: (opts) => buildReachableEntitiesContext(loc, locations, entities, { ...opts, excludeIds: reachableExclude }),
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
          activeStats,
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

    // Every scope × content × format variant, enumerated by the shared expander so the editor's preview
    // covers exactly the same token set.
    Object.assign(values, expandScopedTokens("<LOCATION>", locationScopes));
    Object.assign(values, expandScopedTokens("<ENTITIES>", entityScopes));

    // Resolve placeholder chips in every assembled value before it's folded into a prompt.
    for (const k in values) values[k] = resolvePH(values[k]);
    return values;
  }, [
    worldOverview, activeStats, generateTraitDescriptions,
    currentLocation, locations, connections, presentIdsAt, entities, allEntities, playerNotes, resolvePH,
    fullMessageHistory, timeContext, gameTime, calendar, openingHourPending,
  ]);
  buildContextValuesRef.current = buildContextValues;

  // Live variable values for the Settings prompt-editor Preview tab (full-description variant, like the
  // game-text request). Only meaningful in-game, which is the only place this modal receives them.
  // What this playthrough can actually answer for. The lore blocks and the per-turn value tokens
  // (action / narration / speaking character) are assembled fresh per request, so there is nothing live to
  // show between turns — those fall through to the shared pool's samples rather than to a second set of
  // placeholder strings kept here, which is how the two copies used to drift.
  const promptPreviewValues = useMemo<Record<string, string>>(() => buildContextValues(), [buildContextValues]);

  /** The prompt texts this turn's passes render from — the active preset's fields, as authored. */
  const turnPrompts = (): TurnPrompts => ({
    locationChange: locationChangePromptText || "",
    locationChangeUser: locationChangeUserPrompt,
    thinking: thinkingPrompt,
    director: directorPrompt,
    directorUser: directorUserPrompt,
    character: characterPrompt,
    storyboard: storyboardPrompt,
    narrationUser: narrationUserPrompt,
    oocDirective: oocDirectivePrompt,
    // A world's own cue, resolved: an old save's history holds the sentinel rather than the text.
    openingCue: resolvePH(resolveOpeningCue(worldOverview)),
    choices: resolvedChoicesPrompt,
    choicesUser: choicesUserPrompt,
    statUpdates: resolvedStatUpdatesPrompt,
    statUpdatesUser: statUpdatesUserPrompt,
    summary: summaryPrompt,
    summaryUser: summaryUserPrompt,
    timePassed: timePassedPrompt,
    timePassedUser: timePassedUserPrompt,
    openingTime: openingTimePrompt,
    openingTimeUser: openingTimeUserPrompt,
    diary: diaryPrompt,
    // Not a preset surface, so the pass sends it as authored.
    discoverEntity: defaultDiscoverEntityPrompt,
    sceneTags: sceneTagsPrompt,
    sceneTagsUser: sceneTagsUserPrompt,
  });

  /** The plan input a pass dispatched outside a turn builds its request from — the scene-tag pass, which
   *  the scene-image flow drives on a turn already stored. */
  const standalonePassInput = (): TurnPlanInput => ({
    action: "",
    isGameStarted: true,
    destinationCount: 0,
    locationCount: locations.length,
    hasCurrentLocation: !!currentLocation,
    settings: turnSettings(),
    prompts: turnPrompts(),
  });

  /** The settings-derived booleans this turn's shape depends on. */
  const turnSettings = (): TurnSettings => ({
    thinkingMode,
    concurrentTurnRequests,
    choicesEnabled,
    statUpdatesEnabled,
    statCount: activeStats.length,
    locationChangeEnabled,
    locationAutoApply,
    aiClock,
    memoryDigests,
    characterDiaries,
    describeCharacters,
    language,
  });

  /**
   * What one failure tells the player. Recovery guidance is the toast's own text. `spokeForItself` is the
   * failed request when makeAIRequest already surfaced its own toast — it does that for foreground
   * requests only, so a silent pass that can't reach the server still needs the generic one.
   */
  const reportTurnFailure = (kind: TurnErrorKind, spokeForItself: boolean, isOpeningTurn: boolean) => {
    // An empty narration is its own exit: nothing was thrown, so the opening turn's started flag was
    // never set and is left alone. Silence here would be indistinguishable from a dead submit button.
    if (kind === "emptyNarration") {
      discardUnpairedUserTurn();
      addSystemLogEntry("The AI returned an empty narration — the turn was not advanced.");
      toast.error("The AI returned an empty response. Try again, or switch models if it keeps happening.", {
        position: "top-right",
        autoClose: 5000,
      });
      return;
    }
    // Drop this turn's dangling user message, unless narration had already streamed a partial assistant
    // reply — the guard inside leaves a valid [user, assistant] pair intact.
    discardUnpairedUserTurn();
    // Reset game started state if the opening turn fails
    if (isOpeningTurn) setIsGameStarted(false);
    // A foreground request's connection failure already surfaced its own guide toast — don't stack a
    // second on top of it.
    if (kind === "connection" && spokeForItself) {
      addSystemLogEntry("Couldn't reach the AI server — see the connection guide.");
      return;
    }
    const errorMessage = turnErrorMessage(kind);
    toast.error(errorMessage, {
      position: "top-right",
      autoClose: 3000,
      hideProgressBar: false,
      closeOnClick: true,
      pauseOnHover: true,
      draggable: true,
    });
    addSystemLogEntry(errorMessage);
  };

  /**
   * Apply one Turn Commit: thin setters, in the order the turn's presentation depends on. The turn's own
   * locals ride in `turn` — everything else here is component state.
   */
  const applyTurnCommit = async (
    commit: TurnCommit,
    turn: { signal: AbortSignal; location: GameLocation | null; participants: string[]; destinations: GameLocation[] },
  ) => {
    const { signal } = turn;
    // The move offer lands before the reveal is held below — it is the one result that has always
    // appeared while the narration was still fading. Scoped to the local navigable graph: the router's
    // reply named one of these or nothing.
    if (commit.suggestedLocation) {
      const target = turn.destinations.find((loc) => loc.name === commit.suggestedLocation);
      if (target) setSuggestedLocation(target);
    }

    // Fade path: let the paced reveal finish playing out before the turn's results appear, so choices
    // and stat changes don't pop in over a still-fading narration. The smooth crawl self-catches-up,
    // so it needs no hold. (The reveal has been running in parallel with the post-narration passes.)
    if (fadeRevealActive) await fadeReveal.drained();
    // Stop pressed while the reveal was still draining — bail before committing choices/stats/snapshot.
    // abortGeneration already kept the narration.
    if (signal.aborted) return;

    setChoices(commit.turn.choices);

    // Max changes re-clamp the current value into the new range (lib handles the guards). Restricted
    // to live stats like the value deltas — a disabled stat's cap must not move off a name collision.
    if (Object.keys(commit.statMaxChanges).length > 0) {
      setPlayerStats((prevStats) => applyAiMaxChanges(prevStats, liveStatChanges(prevStats, commit.statMaxChanges)));
    }

    // Seed the story's opening hour. Only ever written on the opening turn; null reads downstream as the
    // shipped DEFAULT_START_HOUR, so an unreadable answer plays exactly as before this pass existed.
    if (commit.isOpeningTurn) setStartHour(commit.openingHour);

    // Update final assistant message with complete data
    setFullMessageHistory((prev) => {
      const updatedHistory = [...prev];
      if (
        updatedHistory.length > 0 &&
        updatedHistory[updatedHistory.length - 1].role === "assistant"
      ) {
        updatedHistory[updatedHistory.length - 1] = {
          role: "assistant",
          content: JSON.stringify(commit.turn),
        };
      }
      return updatedHistory;
    });

    // Persist any characters this turn discovered, anchored to its location + turn so they roll back with
    // it. Guarded against a double-add (variant-aware name match) by a visitor added moments ago.
    if (commit.discoveries.length > 0) {
      setDiscoveredEntities((prev) => {
        const additions = commit.discoveries.filter(
          (d) => !prev.some((p) => sameCharacterName(p.entity.name, d.entity.name)),
        );
        return additions.length ? [...prev, ...additions] : prev;
      });
    }

    // Reset the persistent bar deltas for this turn, then let stat changes + regen below re-fill them.
    setHeldStatChanges({});

    // Apply stat changes
    if (commit.statChanges.length > 0) {
      applyStatChanges(commit.statChanges, null, null, commit.clock);
    } else if (anyStatUsesClock) {
      // Nothing moved, but time still passed — clock-reading code runs on its own so a time-based stat
      // ticks every turn instead of only on turns the AI happened to report a stat change.
      void runStatCode(playerStatsRef.current, commit.clock);
    }

    // Advance the clock by what this turn actually took (the flat hour when unmeasured).
    handleTimePassed(commit.turnHours);

    // Snapshot this turn once the updates above commit (deferred so the snapshot captures the finalized
    // message, applied stat changes, and advanced time rather than a stale mid-batch read).
    armTurnSnapshot();

    // Only set game as started after a successful opening turn
    if (commit.isOpeningTurn) {
      setIsGameStarted(true);
    }

    // Scene image (auto): drawn last, once every language-model request for this turn has finished, and
    // awaited inside the turn on purpose — the input stays blocked until the picture is done, because a
    // diffusion pass running against the model on one graphics card spills both to system memory.
    if (sceneImageAuto && !imageGenDisabled) {
      // Own controller, chained to the turn's signal: the panel's Stop aborts through
      // `sceneImageAbortRef` while the main turn Stop still reaches the render via the chain.
      const imageController = new AbortController();
      const onAbort = () => imageController.abort();
      if (signal.aborted) onAbort(); else signal.addEventListener('abort', onAbort, { once: true });
      sceneImageAbortRef.current = imageController;
      try {
        await runSceneImageRef.current({
          turnId: currentTurnIdRef.current,
          narration: commit.turn.narration,
          participants: turn.participants,
          locationId: turn.location?.id,
          signal: imageController.signal,
        });
      } finally {
        signal.removeEventListener('abort', onAbort);
      }
    }
  };

  /**
   * Run one turn: plan it, execute the plan through the Turn Pipeline, and apply what it produced. The
   * pipeline owns the turn's control flow — which passes run, in what order, and how failures are named;
   * everything here is React state either feeding it (the `advance` derivations below) or receiving it
   * (the Turn Commit at the end).
   */
  const sendGameAction = async (action: string) => {
    setUserPage(null); // taking an action resumes following, so the player sees their new turn land
    stopCommandPreview(); // a real turn supersedes any command preview
    // On the opening turn, snapshot the pre-game state so page 1 can be re-generated later.
    if (fullMessageHistory.length === 0) initialStateRef.current = saveCurrentGameState();

    // Places navigable from here. Nowhere to go means nothing to route: the router's reply is matched
    // against this exact list, so with it empty the call cannot produce a move however the model answers.
    const destinations = currentLocation ? navigableDestinations(currentLocation, locations, connections) : [];
    const plan = planTurn({
      action,
      isGameStarted,
      destinationCount: destinations.length,
      locationCount: locations.length,
      hasCurrentLocation: !!currentLocation,
      settings: turnSettings(),
      prompts: turnPrompts(),
    });
    // Only narration sees the real opening text; every other consumer (stats, planner, choices, dictionary
    // triggers, stored history) sees the terse "START GAME" proxy — the full cue is a narrator directive
    // that derails those prompts. The player's own text lives on in openingActionRef.
    const { isOpeningTurn, effectiveAction } = plan;
    if (isOpeningTurn) openingActionRef.current = action;

    // One AbortController for the whole turn, so Stop aborts every sub-request — not just the active one.
    const controller = new AbortController();
    abortControllerRef.current = controller;
    const { signal } = controller;
    setIsWaitingForAI(true);
    // Not revealing yet — the narration stream flips this on. Until then the reveal view shows the
    // committed narration, never the stale last-turn text (which would otherwise animate all at once
    // during setup, most visibly on re-generate).
    setIsRevealingNarration(false);

    // What the turn's own derivations carry between passes. The pipeline's material holds everything the
    // requests render from; these are the view-side reads that outlive a single pass.
    let turnLocation = currentLocation;
    let actionVec: Float32Array | null = null;
    let priorNarration = "";
    // Staged/precall candidates the narration confirms afterward: ad-hoc = planner-invented (no entity
    // record, strict match); director = defined entities the planner cast (loose match, since it already
    // vouched they're present — "the tank" can confirm a "Battle Tank").
    let directorCandidates: string[] = [];
    let adHocCandidates: string[] = [];
    // The turn's planner cast, which the live scene list is sourced from — so a merely-mentioned character
    // never appears. Null when no planner ran (Off/Inline), where the list falls back to the narration parse.
    let sceneCast: DirectorCastMember[] | null = null;
    // The same cast with the player flagged: the staged plan's grounding block lists everyone, not just NPCs.
    let flaggedCast: DirectorCastMember[] = [];
    let turnParticipants: string[] = [];

    const reportFailure = (kind: TurnErrorKind, spokeForItself = false) =>
      reportTurnFailure(kind, spokeForItself, isOpeningTurn);

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
      // Open this turn in the Turn Pipeline parity recording (inert unless the harness armed it).
      recordParityTurn(effectiveAction, currentTurnIdRef.current);

      /**
       * Everything the narration rides on, assembled once the up-front router has settled where the turn
       * takes place: the context values, the dictionary scan, the system prompt, and the trimmed history
       * this turn's user message is appended to.
       */
      const assembleNarration = async (): Promise<Partial<TurnMaterial>> => {
        // The shared context base (incl. all three Stats-chip variants), scoped to this turn's location;
        // every system-prompt render below spreads it and adds its own tokens.
        const ctx = buildContextValues(turnLocation);
        // One action embedding for every semantic consumer this turn (lore activation, band relevance,
        // diary retrieval). Null = all semantic features quietly off for this turn.
        actionVec = await embedActionVec(effectiveAction);

        const { prompt, runs, dictionaryDebug } = buildNarrationPrompt({
          template: systemPrompt,
          ctx,
          action: effectiveAction,
          history: fullMessageHistory,
          dictionary,
          actionVec,
          semanticLore,
          embedVectors: embedVectorsRef.current,
          language,
          paragraphLimit,
          maxTokens,
          markdownOutput,
          sectionStyle: activeSectionStyle,
          resolvePH,
        });
        pendingDictionaryDebugRef.current = dictionaryDebug;

        // Get trimmed history before adding new action (history fills the window left by the prompt).
        // Pass the action so banding can rehydrate older turns it references. Relevance scores are
        // computed once here and shared with the planner rebuild below so both stages trim identically.
        const relevanceScores = computeRelevanceScores(actionVec);
        // The context meter re-trims with the same scores + action vector so its counts mirror this turn.
        lastRelevanceScoresRef.current = relevanceScores;
        lastActionVecRef.current = actionVec;
        const { messages: trimmedHistory, runs: historyRuns } = getTrimmedMessageHistory(estimateTokens(prompt.length), effectiveAction, relevanceScores, actionVec, true);

        // Add user message to history after getting trimmed history. Stores the proxy on the opening turn so
        // later turns' context is byte-identical to the old flow (the real opening text lives in openingActionRef).
        addMessageToHistory("user", effectiveAction);
        userTurnAddedRef.current = true;

        // All past narration the player has read — the corpus for "has this name been revealed yet?" (drives
        // both the plan sanitizer and each scene-list row's reveal state).
        priorNarration = fullMessageHistory
          .filter((m) => m.role === "assistant")
          .map((m) => parseNarration(m.content))
          .join("\n");

        // Track the assembled system-prompt size for the memory-usage breakdown
        setLastPromptChars(prompt.length);

        // Banded turns ride as condensed pairs, so the last assistant message is the real last narration.
        const lastStory = [...trimmedHistory].reverse().find((m) => m.role === "assistant")?.content || "";
        const plannerTurns = thinkingMode === "precall" && memoryDigests ? parseEffectiveTurns(fullMessageHistory) : null;
        const band = plannerTurns
          ? buildPlannerBand({
              turns: plannerTurns,
              template: thinkingPrompt,
              ctx,
              contextWindow: resolveEndpointForKind('thinking').contextWindow,
              verbatimFloor: thinkingVerbatimTurns,
              milestoneDrop: getMilestoneDrop(plannerTurns),
              recapPrompt: recapUserPrompt,
              relevanceScores,
              bandCap: semanticMemory ? semanticBandCap : 0,
              stickyIds: lastBandIdsRef.current,
              notes: effectiveNotes,
              fallbackLastStory: lastStory,
            })
          : null;

        return {
          ctx,
          narrationSystemPrompt: prompt,
          narrationSystemPromptRuns: runs,
          trimmedHistory,
          historyRuns,
          lastStory: band?.lastStory ?? lastStory,
          plannerRecap: band?.recap ?? "",
          activeCharacterGuidance: activeCharacterGuidance(limitActiveCharacters, activeCharacterLimit),
        };
      };

      /** One character's own diary, as their motivation pass is fed it. */
      const diaryFor = (name: string): string[] => {
        // With retrieval, the whole diary is collected and lib/semanticDiary keeps the recent tail plus the
        // relevant older entries (chronological either way, so the block's "oldest first" stays true).
        const retrieval = semanticDiaries && characterDiaries && actionVec
          ? { queryVec: actionVec, vectorsByKey: embedVectorsRef.current }
          : null;
        const all = characterDiaries
          ? collectCharacterDiary(fullMessageHistory, name, retrieval ? Number.MAX_SAFE_INTEGER : DIARY_MEMORY_ENTRIES)
          : [];
        return retrieval ? selectRelevantDiary(all, retrieval.queryVec, retrieval.vectorsByKey) : all;
      };

      /** Fold one planner answer's cast into the turn's candidate sets and live scene cast. */
      const classifyPlannerCast = (cast: DirectorCastMember[]) => {
        const classified = classifyCast(cast, allEntities, activeTraits.map((t) => t.name));
        flaggedCast = classified.flaggedCast;
        directorCandidates = classified.directorCandidates;
        adHocCandidates = classified.adHocCandidates;
        sceneCast = classified.npcCast;
        return classified;
      };

      /** What the narration confirms: who took part, who is on screen, and who just walked in. */
      const applyNarrationReading = (narration: string): Partial<TurnMaterial> => {
        // Commit the auto-resolved move now that the narration — already written for the new location —
        // succeeded, so an aborted/empty turn leaves the location unchanged.
        if (turnLocation && currentLocation && turnLocation.id !== currentLocation.id) {
          changeLocation(turnLocation);
          addLogEntry(`Moved to location: ${turnLocation.name}`);
        }

        const reading = readNarration({
          narration,
          priorNarration,
          entities: allEntities,
          directorCandidates,
          adHocCandidates,
          exclusions: { ...characterExclusions, suppressed: suppressedCharacterNames },
          sceneCast,
        });
        turnParticipants = reading.participants;
        // Apply the authoritative scene list now (narration is done). Independent of turnParticipants, which
        // still feeds stored participation and choices.
        setVisibleEntities(reading.visibleEntities);
        // Visitors affect the next turn's context (this turn's ctx already ran).
        const visitorLocation = turnLocation;
        if (visitorLocation) {
          const turnId = currentTurnIdRef.current;
          setDiscoveredEntities((prev) => {
            const additions = selectVisitorAdditions({
              prose: reading.prose,
              entities,
              allEntities,
              location: visitorLocation,
              locations,
              presentIds: presentIdsAt(visitorLocation),
              discovered: prev,
              turnId,
            });
            return additions.length ? [...prev, ...additions] : prev;
          });
        }
        const sceneEntities = presentSceneEntities(
          allEntities,
          turnParticipants,
          recentParticipants(fullMessageHistory, CHOICES_PRESENCE_TURNS - 1),
        );
        return { sceneEntityTokens: sceneEntityOverride(turnLocation, sceneEntities) };
      };

      /**
       * The turn's derivation step: where this view's knowledge (the world, the history, the context
       * values) enters the pipeline's material. Never where a request enters — the adapter below is the
       * only seam for those.
       */
      const advance: TurnAdvance = async (event, material) => {
        if (event.at === "stage") {
          // Assembled once the up-front router has settled the location, and before the planner reads it.
          if (event.stage === "planning") return assembleNarration();
          if (event.stage === "narration") {
            // Hand the streaming narration (inside makeAIRequest) this turn's scene-list inputs so it can
            // keep the Entities tab live per sentence.
            sceneListCtxRef.current = { cast: sceneCast, prior: priorNarration };
            return;
          }
          if (event.stage === "postNarration") {
            // The batch shows one stable label instead of a race between its own requests; "Choices" since
            // that's what the player waits on.
            if (plan.concurrency === "parallel") setAiRequestType("choices");
            // With no choices pass there is nothing to wait on, so the input unblocks right away.
            if (!planHasPass(plan, "choices")) setChoicesReady(true);
            const fanOut = splitParticipants(turnParticipants, allEntities, suppressedCharacterNames);
            return { subjects: { ...material.subjects, ...fanOut } };
          }
          return;
        }

        const [first] = event.outcomes;
        switch (first.id) {
          case "locationAuto": {
            const matchedName = first.parsed as string | null;
            const target = matchedName ? destinations.find((loc) => loc.name === matchedName) : undefined;
            if (target && currentLocation && target.id !== currentLocation.id) turnLocation = target;
            return;
          }
          case "thinking": {
            if (!first.raw) return;
            classifyPlannerCast((first.parsed as ParsedDirector).cast);
            // Keep a name the player has not yet heard out of the plan the narrator reads (code backstop for
            // the prompt's alias rule). A name is "revealed" once it appears in any past narration.
            return { turnPlan: sanitizePlanForReveal(first.raw, (name) => matchNames(priorNarration, [name]).length > 0) };
          }
          case "director": {
            const { scene, cast } = first.parsed as ParsedDirector;
            const { npcCast } = classifyPlannerCast(cast);
            // With nobody in the cast there is nothing to reconcile: the storyboard skips itself, and the
            // plan is the director's staging alone.
            if (npcCast.length === 0) {
              return { directorScene: scene, npcCastSize: 0, turnPlan: buildStagedPlan({ scene, stances: flaggedCast, beats: "" }) };
            }
            const presentIds = presentIdsAt(turnLocation);
            const { chosen, overflow } = matchCastToEntities(
              npcCast,
              allEntities.filter((e) => presentIds.includes(e.id)),
              limitActiveCharacters ? activeCharacterLimit : Infinity,
            );
            return {
              directorScene: scene,
              npcCastSize: npcCast.length,
              overflow,
              subjects: {
                ...material.subjects,
                character: chosen.map((member) => ({
                  name: member.name,
                  stance: member.stance,
                  entity: member.entity,
                  diary: diaryFor(member.name),
                })),
              },
            };
          }
          case "character":
            // Intents keep cast order, which the storyboard message relies on.
            return {
              intents: event.outcomes.flatMap((outcome) =>
                outcome.subject && outcome.raw ? [{ name: outcome.subject.name, text: outcome.raw }] : [],
              ),
            };
          case "storyboard":
            // Ground the narration in the director's scene + cast stances alongside the storyboard beats.
            return { turnPlan: buildStagedPlan({ scene: material.directorScene, stances: flaggedCast, beats: first.raw }) };
          case "narration": {
            const patch = applyNarrationReading(first.raw);
            // Auto-narrate the new game text if a TTS model is loaded. When streaming is off, hold the
            // post-narration passes until the audio has finished generating (avoids GPU contention). When
            // streaming is on, narration was already synthesized sentence-by-sentence during the request.
            if (ttsLoaded && !streamNarrationAudio) await generateTTS(first.raw);
            return patch;
          }
          default:
            return;
        }
      };

      /** The pipeline's one seam. Production sends the real AI call; nothing else is injected. */
      const request: TurnRequestAdapter = (spec, context) => makeAIRequest({ ...spec, signal: context.signal });

      const result = await runTurn({
        plan,
        material: emptyTurnMaterial({
          action,
          effectiveAction,
          turnId: currentTurnIdRef.current,
          // The location the turn began in: what the up-front router routes from, and what the digest and
          // diary passes record against.
          baseCtx: buildContextValues(),
          destinations: destinations.map((loc) => loc.name),
        }),
        request,
        signal,
        advance,
        // Choices are the interactive part: unblock the input the moment they land rather than when the
        // rest of their batch settles.
        onPassSettled: (id, outcome) => {
          if (id === "choices" && outcome.ok && !signal.aborted) setChoicesReady(true);
        },
      });

      // The user stopping is an expected, silent exit (the `finally` resets waiting state).
      if (result.status === "aborted") return;
      if (result.status === "failed") {
        reportFailure(result.kind, result.request ? !result.request.silent : false);
        return;
      }

      const commit = computeTurnCommit({
        result,
        plan,
        context: {
          participants: turnParticipants,
          locationId: turnLocation?.id,
          currentLocationName: currentLocation?.name,
          discoveryLocationId: turnLocation?.id ?? currentLocation?.id,
          knownDiscoveredNames: discoveredEntities.map((d) => d.entity.name),
          // Freeze this turn's player notes and reasoning (both additive save-shape fields).
          notes: playerNotes,
          reasoning: turnReasoningRef.current,
          gameTime,
          calendar,
        },
      });
      if (!commit) return;
      await applyTurnCommit(commit, {
        signal,
        location: turnLocation,
        participants: turnParticipants,
        destinations,
      });
    } catch (error) {
      // The pipeline's own failures come back as a typed result above; what lands here is a derivation
      // throwing — context assembly, the read-aloud pass, or applying the commit.
      reportFailure(classifyTurnError(error));
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
        // Disabled stats are inert: their own code never runs, and they aren't exposed to anyone else's.
        const live = enabledStats(base, statEnabledRef.current);
        const coded = (await processStatCode(live, clock)) as typeof playerStats;
        const codeChanges = appliedStatDeltas(live, coded);
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
  const anyStatUsesClock = useMemo(() => activeStats.some((s) => usesStatClock(s.code)), [activeStats]);

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
      // A disabled stat isn't in the prompt, but a name collision could still land on it — restrict the
      // apply to the live set rather than trusting that.
      const live = enabledStats(baseStats, statEnabledRef.current).map((s) => s.name);
      const directApplied = applyAiStatChanges(
        baseStats,
        normalizedChanges,
        affectedStats ? affectedStats.filter((n) => live.includes(n)) : live,
      );

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

  const makeAIRequest = async ({
    systemPrompt,
    messages,
    type: requestType,
    maxTokens: maxTokensOverride = null,
    signal,
    silent = false,
    attachTurnId,
    quiet: quietLabel = false,
    anatomy,
  }: AiCallArgs) => {
    // The parity recording observes the seam itself: exactly the arguments this call received, in
    // dispatch order, before anything downstream shapes them. Inert unless the harness armed it.
    const paritySeq = recordParityRequest({ systemPrompt, messages, type: requestType, maxTokens: maxTokensOverride, silent, attachTurnId });

    // Where this prompt sends: its pinned preset, or the active endpoint when it follows the selection.
    // Resolved once here and handed to the spec layer, so the capture below and the request body can never
    // disagree about which target answered.
    const target = resolveEndpointForKind(requestType);

    // The per-call settings snapshot the AI Request Spec layer reads. Every engine-shaped decision
    // (sampler resolution, the reasoning budget/effort split, the `/no_think` switch, penalty spellings)
    // lives behind that seam; this component only states the values.
    const snapshot: AiSettingsSnapshot = {
      // Already resolved above, so the spec layer and the capture can't disagree about the target.
      resolveTarget: () => target,
      thinkingMode,
      reasoningEffort,
      reasoningEngaged,
      promptReasoning,
      promptReasoningBudget,
      promptSamplers,
      genTemperature,
      genRepetitionPenalty,
      genTopP,
      genTopK,
      genMinP,
      paragraphLimit,
      disableThinking,
    };
    const spec = buildAiRequestSpec(snapshot, { systemPrompt, messages, requestType, maxTokensOverride });

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
          {
            type: requestType,
            // The wire messages, so the viewer shows exactly what was sent (the `/no_think` switch included).
            messages: spec.body.messages,
            id: captureId,
            dictionary,
            // The sidecar indexes the messages the caller stated; the wire list prepends the system
            // message, which `toAnatomyBlocks` accounts for when the viewer lines the two up.
            anatomy,
            endpoint: toDebugEndpoint(target),
          },
        ],
      };
      return next;
    });

    try {
      // Surface which request is currently running (silent requests use the digest status indicator instead).
      if (!silent && !quietLabel) setAiRequestType(requestType);

      // Capture the exact payload into the AI-context viewer.
      if (!silent || captureSilent) captureRequest();

      let content = "";
      let finishReason: string | null = null;
      // Reasoning capture (narration only): native `reasoning`/`reasoning_content` stream field, plus timing so
      // the block can show "Thought for Ns" — `firstTokenAt` is the first token of any kind, `narrationAt` the
      // first visible narration token, so their gap is the think time for both native and inline-<think> paths.
      // The stream's own `firstContentAt` can't stand in for `narrationAt`: inline reasoning arrives as
      // content, so it would stamp the think time at zero on that path.
      let reasoningText = "";
      let firstTokenAt = 0;
      let narrationAt = 0;
      let lastLiveReasoningTick = 0;
      // Opt-in streaming TTS: synthesize narration sentence-by-sentence as it arrives (needs a model).
      const ttsStreaming = streamNarrationAudio && ttsLoaded && requestType === "narration";

      // Clear the narration for this turn's fresh reveal (reset re-seeds the reveal's base timing) and
      // mark the reveal live — from here the reveal view shows the streaming gameplayText, not committed.
      // Runs on the stream's `response` debug, i.e. once the endpoint has accepted the request and has a
      // body: a dead endpoint throws before that and must leave the previous turn's narration on screen.
      let streamOpened = false;
      const openStream = () => {
        streamOpened = true;
        if (requestType === "narration") { fadeReveal.reset(); smoothReveal.reset(); setIsRevealingNarration(true); entitySentenceCursorRef.current = 0; assistantAddedRef.current = false; turnReasoningRef.current = { text: "", ms: 0 }; setLiveReasoning({ text: "", ms: 0, active: false }); }
        if (ttsStreaming) { ttsModalRef.current?.streamStart(); ttsSentenceCursorRef.current = 0; }
      };

      // Stream the scratchpad into the live block while still thinking (before narration). Two sources feed
      // it: the native `reasoning` field the stream accumulates, and an inline <think> body still open
      // inside `content`.
      const renderLiveReasoning = () => {
        lastLiveReasoningTick = performance.now();
        const liveText = [reasoningText.trim(), extractReasoningLive(content)].filter(Boolean).join("\n\n").trim();
        if (liveText) setLiveReasoning({ text: liveText, ms: 0, active: true });
      };
      // The content path needs its own cadence: reasoning events arrive already throttled by the stream,
      // but inline <think> rides content, which is unthrottled and would re-render the block per token.
      const pushLiveReasoningThrottled = () => {
        if (performance.now() - lastLiveReasoningTick <= DEFAULT_REASONING_THROTTLE_MS) return;
        renderLiveReasoning();
      };

      // One narration content delta. Everything downstream reads the accumulated `content`.
      const onNarrationDelta = () => {
        if (!narrationAt) pushLiveReasoningThrottled();
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
      };

      for await (const event of streamAiRequest(spec, { signal })) {
        if (event.type === "debug") {
          // The endpoint answered: commit to this turn's reveal. The `request` debug is already captured
          // above, and a malformed frame is logged rather than failing the turn.
          if (event.debug.kind === "response") openStream();
          if (event.debug.kind === "parse") console.error("Error parsing streaming response:", event.debug.error);
          continue;
        }
        if (event.type === "done") {
          // `done` replaces the running values with the stream's own finals.
          content = event.result.content;
          reasoningText = event.result.reasoningText;
          finishReason = event.result.finishReason;
          break;
        }
        if (!firstTokenAt) firstTokenAt = performance.now();
        if (event.type === "reasoning") reasoningText = event.text;
        else content = event.content;
        // Per-token rendering must not take the turn down with it: one bad sentence split or scene-list
        // build logs and the stream carries on, the way the SSE loop's own catch does.
        try {
          if (event.type === "reasoning") {
            if (requestType === "narration" && !narrationAt) renderLiveReasoning();
          } else if (requestType === "narration") {
            onNarrationDelta();
          } else if (requestType === "choices") {
            // Update choices in real-time, ensuring we handle partial content correctly
            const choicesList = parseChoices(stripReasoningLive(content));
            if (choicesList.length > 0) setChoices(choicesList);
          }
          // For statUpdates type, we do nothing during streaming
        } catch (e) {
          console.error("Error parsing streaming response:", e);
        }
      }

      // Aborted mid-stream: the stream ends gracefully carrying its partial content, but this turn still
      // drops everything and commits nothing — the narration the player keeps is the assistant message
      // already persisted during streaming, which the abort handler snapshots.
      if (signal?.aborted || finishReason === ABORTED_FINISH_REASON) {
        if (streamOpened) {
          if (requestType === "narration") { fadeReveal.reset(); smoothReveal.reset(); }
          if (ttsStreaming) ttsModalRef.current?.streamCancel();
        }
        return "";
      }

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
      // Pair the answer with its request in the parity recording, so a replay can feed the same material
      // back and reach the same next-turn prompts.
      recordParityResponse(paritySeq, rawContent);

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
      // No AbortError case: the stream turns both the fetch rejection and the read rejection into a
      // graceful `done`, so a user stop lands on the aborted branch above and never reaches here.
      console.error("Error in makeAIRequest:", error);
      // A failed silent request (the digest) is non-fatal — let the drainer swallow it without a toast.
      if (silent) throw error;
      // A network failure (server off / wrong URL / CORS disabled) is opaque and unactionable from the
      // generic toast — offer the connection guide instead. The turn knows this already showed, because it
      // knows the failed request wasn't silent.
      if (isLikelyConnectionError(error)) {
        toast.error(
          <div className="flex flex-col items-start gap-1">
            <span>Couldn&apos;t reach your AI server.</span>
            <button type="button" className="text-meta underline" onClick={() => setConnectionGuideOpen(true)}>
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
    // Authored tags are world text like any other: a chip here is how an author randomizes what the
    // generator draws, so it resolves against the same frozen rolls the narration uses.
    const authored = resolvePH(subject.imageTags ?? "").trim();
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
    const request = sceneTagsPass.buildRequest(standalonePassInput(), {
      ...emptyTurnMaterial({ action: "", effectiveAction: "", turnId, baseCtx: {}, destinations: [] }),
      ctx: buildContextValues(),
      narration,
      sceneCast: cast.map((c) => c.name),
    });
    const actionTags = await makeAIRequest({ ...request, signal });
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

  // Build + issue the choices/stats requests for the standalone re-rolls (handleRegenerateChoices/Stats),
  // which ask outside a turn and so have no Turn Plan to run — a live turn's copies are the pass records'
  // (lib/turnPipeline/turnPasses). Callers own the enable-guard and result handling; `quiet` suppresses the
  // status label.
  const requestChoices = (
    ctx: Record<string, string>,
    sceneEntityTokens: Record<string, string>,
    action: string,
    narration: string,
    signal: AbortSignal,
    quiet = false,
  ): Promise<string> =>
    makeAIRequest({
      systemPrompt: choicesSystemPrompt(resolvedChoicesPrompt, language, { ...ctx, ...sceneEntityTokens }),
      messages: [{ role: "user", content: renderPromptTemplate(choicesUserPrompt, { "<PLAYER ACTION>": action, "<NARRATION>": narration }) }],
      type: "choices",
      signal,
      quiet,
    });
  const requestStats = (
    ctx: Record<string, string>,
    action: string,
    narration: string,
    signal: AbortSignal,
    quiet = false,
  ): Promise<string> =>
    makeAIRequest({
      systemPrompt: statUpdatesSystemPrompt(resolvedStatUpdatesPrompt, ctx),
      messages: [{ role: "user", content: renderPromptTemplate(statUpdatesUserPrompt, { "<PLAYER ACTION>": action, "<NARRATION>": narration }) }],
      type: "statUpdates",
      signal,
      quiet,
    });

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
        const digest = await makeAIRequestRef.current({
          systemPrompt: renderPromptTemplate(summaryPrompt, buildContextValues()),
          messages: [{ role: "user", content: summaryUserMessage(summaryUserPrompt, playerAction, narrationText) }],
          type: "summary",
          maxTokens: DIGEST_MAX_TOKENS,
          silent: true,
          attachTurnId: turnId, // so the viewer shows it under the turn it summarizes
        });
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
        const reply = await makeAIRequestRef.current({
          systemPrompt: defaultMilestoneIncrementalPrompt,
          messages: [{
            role: "user",
            content: buildIncrementalMilestoneUserMessage(
              shownOld.map((t) => (t.summary ?? "").trim()),
              freshCands.map((t) => (t.summary ?? "").trim()),
            ),
          }],
          type: "milestoneSelect",
          maxTokens: MILESTONE_SELECT_MAX_TOKENS,
          silent: true,
          attachTurnId,
        });
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
      const digest = await makeAIRequestRef.current({
        systemPrompt: renderPromptTemplate(summaryPrompt, buildContextValues()),
        messages: [{ role: "user", content: summaryUserMessage(summaryUserPrompt, playerAction, narrationText) }],
        type: "summary",
        maxTokens: DIGEST_MAX_TOKENS,
        silent: true,
        attachTurnId: turnId,
      });
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
        const entry = await makeAIRequestRef.current({
          systemPrompt: renderPromptTemplate(diaryPrompt, buildContextValues()),
          messages: [{ role: "user", content: buildDiaryUserMessage({ name, entity, narration: narrationText }) }],
          type: "diary",
          maxTokens: DIARY_MAX_TOKENS,
          silent: true,
          attachTurnId: turnId, // so the viewer shows it under the turn it records
        });
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
        const description = await makeAIRequestRef.current({
          systemPrompt: defaultDiscoverEntityPrompt,
          messages: [{ role: "user", content: discoverUserMessage(due.name, due.narration) }],
          type: "discoverEntity",
          maxTokens: DISCOVER_MAX_TOKENS,
          silent: true,
          attachTurnId: due.turnId, // so the viewer shows it under the turn that introduced the character
        });
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

  // --- Discovered-character description: player edit + regenerate -----------------------------------
  // A discovered character's description is minted from the single passage that introduced them, so it
  // ages badly (and a bad first roll has no recovery). These two write through to `discoveredEntities`,
  // which is per-save state — the authored world is never touched.

  /** Overwrite a discovered character's stored description. */
  const updateDiscoveredDescription = useCallback((entityId: string, text: string) => {
    const next = text.trim();
    if (!next) return;
    setDiscoveredEntities((prev) => prev.map((d) =>
      d.entity.id === entityId ? { ...d, entity: { ...d.entity, aiDescription: next } } : d,
    ));
  }, [setDiscoveredEntities]);

  /** Any AI work that a regeneration must wait behind — the same gates the discover drainer respects,
   *  so a manual regen never contends with narration for a single local GPU. */
  const regenBusy = isWaitingForAI || digestActive || diaryActive || discoverActive || sceneImageJob !== null;

  /**
   * Rewrite a discovered character's description from everything the story has shown of them since.
   * The supplemental context comes from exactly one source, picked by the memory settings; see
   * lib/discoveredRegen. Resolves to the new text, or null when nothing usable came back.
   */
  const regenerateDiscoveredDescription = useCallback(async (entity: Entity, signal: AbortSignal): Promise<string | null> => {
    const record = discoveredEntities.find((d) => d.entity.id === entity.id);
    const name = entity.name;
    const source = selectRegenSource({ semanticMemory, characterDiaries, memoryDigests });

    // The semantic tier ranks this character's digests against who they are now. Bounded like every
    // other embedding call here (a wedged worker must not hang the button), and null on any miss so
    // buildRegenContext falls to the next source.
    let semantic: { queryVec: Float32Array; vectorsByKey: Map<string, Float32Array> } | null = null;
    if (source === 'semantic' && isEmbeddingModelReady()) {
      try {
        const query = `${name}. ${entity.aiDescription ?? ''}`.trim();
        const vecs = await Promise.race([
          embedTexts([query]),
          new Promise<null>((resolve) => setTimeout(() => resolve(null), 2000)),
        ]);
        if (vecs && vecs.length > 0) semantic = { queryVec: vecs[0], vectorsByKey: embedVectorsRef.current };
      } catch {
        semantic = null;
      }
    }
    if (signal.aborted) return null;

    const context = buildRegenContext({
      history: fullMessageHistory,
      name,
      sourceTurnId: record?.sourceTurnId,
      source,
      diaryEntries: source === 'diary' ? collectCharacterDiary(fullMessageHistory, name, -1) : undefined,
      semantic,
    });

    const response = await makeAIRequestRef.current({
      systemPrompt: defaultRegenEntityPrompt,
      messages: [{ role: "user", content: buildRegenUserMessage(name, context) }],
      type: "discoverEntity",
      maxTokens: DISCOVER_MAX_TOKENS,
      signal,
      silent: true,
      attachTurnId: record?.sourceTurnId,
    });
    if (signal.aborted) return null;
    return cleanDiscoveredDescription(response ?? "", name, REGEN_LABELS) || null;
  }, [discoveredEntities, semanticMemory, characterDiaries, memoryDigests, fullMessageHistory]);

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

  /** The gameplay slice the trait runtime reads and rewrites, and the setters that put a result back. */
  const traitState = useMemo<TraitRuntimeState>(
    () => ({ stats: playerStats, traits: chosenTraits, disabledTraitIds, appliedValues: appliedTraitValues }),
    [playerStats, chosenTraits, disabledTraitIds, appliedTraitValues],
  );
  const commitTraitState = useCallback(
    (next: TraitRuntimeState) => {
      // Runtime-only: the authored world (GameData.stats) is never mutated by play.
      setPlayerStats(next.stats);
      setPlayerTraits(next.traits);
      setDisabledTraitIds(next.disabledTraitIds);
      setAppliedTraitValues(next.appliedValues);
    },
    [setPlayerStats, setPlayerTraits, setDisabledTraitIds, setAppliedTraitValues],
  );

  /**
   * Switch a trait on or off mid-play, acquiring it first if the player doesn't hold it yet. Every trait the
   * author marked switchable is available at any time; everything the trait does beyond its stat changes (AI
   * text, stat availability, placeholder pins) is derived from the active set and simply follows.
   */
  const toggleTrait = useCallback(
    (traitId: string, enabled: boolean) => {
      const world = { traits: authoredTraits, groups: traitGroups };
      const held = chosenTraits.find((t) => t.id === traitId);
      if (held) {
        const { state: next, retired } = setTraitEnabled(traitState, traitId, enabled, world);
        commitTraitState(next);
        for (const sibling of retired) addLogEntry(`Trait switched off: ${sibling.name}`);
        addLogEntry(`Trait switched ${enabled ? 'on' : 'off'}: ${held.name}`);
        return;
      }
      // Not held: only a switch-on of a trait the author marked switchable acquires one. It freezes the
      // world's stat changes as they stand right now, exactly as a trait chosen at creation freezes them at
      // game start. Authored, chips intact, for the same reason seeding uses them: a resolved name written
      // into state stops being resolvable.
      const authored = authoredTraits.find((t) => t.id === traitId);
      if (!enabled || !authored?.playerToggle) return;
      const { state: next, retired } = acquireTrait(traitState, authored, world);
      commitTraitState(next);
      for (const sibling of retired) addLogEntry(`Trait switched off: ${sibling.name}`);
      addLogEntry(`Acquired trait: ${resolveTraitText(authored, authored.name)}`);
    },
    [chosenTraits, authoredTraits, traitGroups, traitState, commitTraitState, addLogEntry, resolveTraitText],
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
        void loadGame(initialSaveId, locations, authoredStats);
        return;
      }

      // New game: seed the live stats from the world defaults, recording each stat's game-start baseline
      // (`starting`) so the opening turn's deltas read from the world value, not 0/min. Seeding lives here —
      // not in a reactive effect on `stats` — so it runs exactly once for a fresh game and can never race
      // with / clobber a loaded save (which returns above).
      // Seeded from the AUTHORED stats, chips and all: names resolve on the way out of state, never in, so
      // a resolved name written in here would freeze whatever pins happened to be active at game start and
      // no later pin could ever move it.
      const seeded = seedStatBases(
        authoredStats.map((stat) => {
          const value = stat.value || stat.min || 0;
          return { ...stat, value, starting: stat.starting ?? value };
        }),
      );

      // Authored order, not click order: stat changes apply in sequence, so a deterministic order is what
      // makes two players who picked the same traits end up with the same stats. Authored traits for the
      // same reason as the stats above.
      const chosen = new Set(initialTraits);
      const chosenList = inAuthoredOrder(authoredTraits.filter((t) => chosen.has(t.id)), traitOrder);
      // Folded rather than set one trait at a time: each acquisition reads the whole slice, so the batch has
      // to thread through in one pass instead of racing several queued state updates.
      let seedState: TraitRuntimeState = {
        stats: seeded,
        traits: [],
        disabledTraitIds: [],
        appliedValues: {},
      };
      for (const trait of chosenList) {
        seedState = acquireTrait(seedState, trait, { traits: authoredTraits, groups: traitGroups }).state;
        // Logs are write-time strings shown raw, and `trait` here is authored (chips intact) — resolve now,
        // with the trait's own pins so the entry names what the player picked.
        addLogEntry(`Applied trait: ${resolveTraitText(trait, trait.name)}`);
      }
      commitTraitState(seedState);

      // Use the player's chosen starting location, else a random starting point (fallback: any location).
      const location = resolveStartingLocation(locations, initialLocationId);
      if (location) {
        changeLocation(location);
        // A log line is frozen the moment it is written, and the traits just applied are not in state yet —
        // so resolve against the pins they are about to impose rather than the (empty) ones still in force.
        const authored = authoredLocations.find((l) => l.id === location.id) ?? location;
        addLogEntry(`Starting in location: ${resolveWith(activePlaceholderPins(chosenList), authored.name)}`);
      }

      // Seed the per-playthrough dictionary set: the entry-step selection, or the world's authored books
      // when the step was skipped. A loaded save overrides this later via loadGame.
      setRuntimeDictionaries(initialDictionaries ?? dictionaries);

      // Fresh playthrough: no memory pins, selection or player overrides yet. loadGame overrides.
      setMemoryPins({});
      setEntityVisualPreference({});
      setEntityImageIndex({});
      setMilestoneSelection(null);
      setMemoryEdits({});
      setMemoryDeleted([]);
      setMemoryNotes([]);

      // Seed the entry-step characters into the starting location as runtime-only entities (never written
      // to the authored world). They flow through the existing discovered-entity path; loadGame overrides.
      if (location && initialCharacters && initialCharacters.length > 0) {
        setDiscoveredEntities(
          initialCharacters.map((entity) => ({ entity, locationId: location.id, sourceTurnId: INITIAL_SOURCE_TURN_ID })),
        );
      }

      // Pre-fill the editable opening cue so the player can shape the first turn before submitting it. The
      // world's own cue when it has one, resolved here (against the pins the traits above are about to
      // impose) so the player reads and edits plain prose, never raw chips.
      setPlayerInput(resolveWith(activePlaceholderPins(chosenList), resolveOpeningCue(worldOverview)));
    }
  }, [
    initialSaveId,
    loadGame,
    initialTraits,
    initialLocationId,
    initialDictionaries,
    initialCharacters,
    dictionaries,
    authoredTraits,
    authoredLocations,
    traitGroups,
    traitOrder,
    locations,
    worldId,
    worldOverview,
    authoredStats,
    resolveWith,
    commitTraitState,
    resolveTraitText,
    changeLocation,
    addLogEntry,
    setRuntimeDictionaries,
    setDiscoveredEntities,
    setPlayerInput,
    setMemoryPins,
    setEntityVisualPreference,
    setEntityImageIndex,
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
          <span className="text-meta text-muted-foreground whitespace-nowrap">
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
          <span className="text-meta text-muted-foreground whitespace-nowrap">
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
          <span className="text-meta text-muted-foreground whitespace-nowrap">
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
          <span className="text-meta text-muted-foreground whitespace-nowrap">
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
    const { messages: trimmed } = getTrimmedMessageHistory(promptTokens, "", lastRelevanceScoresRef.current, lastActionVecRef.current);
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
          <PopoverContent align="start" className="w-64 text-meta space-y-1">
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
    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-30 flex items-center justify-center gap-2 whitespace-nowrap rounded-md border bg-background px-3 py-2 text-label shadow-lg">
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
      onToggleTrait={toggleTrait}
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
      className={`flex ${isMobile ? "flex-col" : "p-4"} app-viewport isolate text-label md:text-body bg-background overflow-hidden`}
    >
      {locationBackground && (
        <LocationBackdrop
          image={viewLocation ? viewLocation.backgroundImage : "./default-background.jpg"}
          overlay={backgroundOverlay}
          overlayHidden={uiHidden}
        />
      )}
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
              className={`flex-1 min-w-0 rounded py-2 text-helper ${
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

      {selectedEntity && (() => {
        // A runtime-discovered character only ever gets the one generated description, stored as the
        // AI-facing field, so show that as its player description or the modal reads "No description
        // provided". Scoped to discovered characters: an authored entity's aiDescription is author-only
        // notes and must never surface to the player.
        const found = allEntities.find((f) => f.name === selectedEntity) ?? null;
        const isDiscovered = !!found && discoveredEntities.some((d) => d.entity.name === found.name);
        const shown = found && isDiscovered && !found.playerDescription?.trim()
          ? { ...found, playerDescription: found.aiDescription }
          : found;
        return (
          <EntityModal
            entity={shown}
            isOpen={isEntityModalOpen}
            onOpenChange={setIsEntityModalOpen}
            // Edit + regenerate are offered for discovered characters only; an authored entity belongs to
            // the world, which play never writes.
            editing={found && isDiscovered ? {
              busy: regenBusy,
              onSave: (text) => updateDiscoveredDescription(found.id, text),
              onRegenerate: (signal) => regenerateDiscoveredDescription(found, signal),
            } : undefined}
          />
        );
      })()}

      <LocationModal
        isOpen={isLocationModalOpen}
        onOpenChange={setIsLocationModalOpen}
        locations={locations}
        connections={connections}
        currentLocationId={currentLocation?.id ?? null}
        changeLocation={changeLocation}
        resolveText={resolvePH}
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
        <DialogContent aria-describedby={undefined} className="max-w-[95vw] w-[95vw] h-[90dvh] p-0 overflow-hidden">
          <DialogTitle className="sr-only">World Editor</DialogTitle>
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
        <DialogContent aria-describedby={undefined} className="max-w-[95vw] w-[95vw] h-[90dvh] flex flex-col overflow-hidden">
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
            // Search marks the text where it stands and steps between the marks. It never rewrites what
            // is on screen, so the regions, the chat stagger, and the dictionary highlights all survive it.
            const findTerms = debugFindTerms;
            const searchActive = findTerms.length > 0;
            // Page = turn; show the requests captured for the currently selected (visible) turn.
            const totalDebugPages = visibleDebugTurns.length;
            const pageIndex = Math.min(Math.max(debugPage, 1), Math.max(totalDebugPages, 1)) - 1;
            const currentTurn = visibleDebugTurns[pageIndex];
            const currentRequests = currentTurn?.requests ?? [];
            /* Every block of this turn, in the order the viewer draws them: each request's input blocks
               (System Prompt region before Messages, as the anatomy lays them out), then its raw output.
               Numbering the hits over that sequence is what makes "3 of 11" mean the third mention of the
               turn, whatever the reader has collapsed. */
            const findChunks = currentRequests.flatMap((req, i) => {
              const anatomy = req.anatomy ? toAnatomyBlocks(req.messages, req.anatomy) : null;
              const regions = anatomy ? anatomyRegions(anatomy) : null;
              const inputs = regions
                ? [...regions.system, ...regions.messages].map(([block, bi]) => ({ blockIndex: bi, text: block.content }))
                : req.messages.map((m, bi) => ({ blockIndex: bi, text: m.content }));
              const chunks = inputs.map(({ blockIndex, text }) => ({
                key: `${i}:in:${blockIndex}`, group: `group-${i}`, section: i as string | number, request: i, text,
              }));
              if (typeof req.response === "string") {
                chunks.push({ key: `${i}:out`, group: `group-${i}`, section: `out-${i}`, request: i, text: req.response });
              }
              return chunks;
            });
            const findPlan = planFindHits(findChunks.map((c) => c.text), findTerms);
            const findByKey = new Map(findChunks.map((c, k) => [c.key, findPlan.blocks[k]]));
            // Which request and section owns each hit, so navigating to one opens whatever hides it, and
            // how many hits each request holds, which is what decides the fold.
            const hitOwners: { group: string; section: string | number }[] = [];
            const hitsPerRequest = currentRequests.map(() => 0);
            findChunks.forEach((chunk, k) => {
              hitsPerRequest[chunk.request] += findPlan.blocks[k].hits.length;
              findPlan.blocks[k].hits.forEach(() => hitOwners.push({ group: chunk.group, section: chunk.section }));
            });
            const hitTotal = findPlan.total;
            const currentHit = hitTotal > 0 ? Math.min(debugHitIndex, hitTotal - 1) : 0;
            const goToHit = (next: number) => {
              if (hitTotal === 0) return;
              const wrapped = ((next % hitTotal) + hitTotal) % hitTotal;
              const owner = hitOwners[wrapped];
              // A hit inside something collapsed is still a hit; opening it is part of going there.
              if (owner) setCollapsedDebug((prev) => ({ ...prev, [owner.group]: false, [owner.section]: false }));
              debugHitRef.current = wrapped;
              setDebugHitIndex(wrapped);
            };
            const stepHit = (delta: number) => goToHit(debugHitRef.current + delta);
            // One inline match-chip: the entry it belongs to plus the exact hit behind it (drives the popover).
            interface DictChip { entryId: string; color: string; activation: EntryActivation; hit: MatchHit; }
            // A rendered run of text — plain, a legacy flat color mark (hydrations), or a dictionary match-chip.
            interface Seg { text: string; color?: string; chip?: DictChip; }
            // Dictionary highlighter — the truthful path. Marks ONLY the real activation hits, located inside
            // the exact scanned strings (`dict.sources`) captured for this turn, so a highlight means the text
            // genuinely drove an entry to activate. `dict` is undefined for non-narration requests and raw
            // output (never scanned) — those render plain. Honors the legend toggles.
            const buildDictSegments = (text: string, dict?: DictionaryDebug): Seg[] => {
              if (!dict) return text ? [{ text }] : [];
              // Locate real activation hits (lib does the offset math + overlap resolution); paint on the color.
              return locateMatches(
                text,
                dict.report,
                dict.sources,
                (entryId) => disabledHighlights[entryId] || !colorMap[entryId],
              ).map((seg) =>
                seg.chip
                  ? { text: seg.text, color: colorMap[seg.chip.entryId], chip: { entryId: seg.chip.entryId, color: colorMap[seg.chip.entryId], activation: seg.chip.activation, hit: seg.chip.hit } }
                  : { text: seg.text },
              );
            };
            // Hydration highlighter: no section/declaration logic — just mark the (active) hydration terms.
            const buildHydrationSegments = (text: string, rules: HighlightRule[]): HighlightSegment[] =>
              highlightSegments(text, rules);
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
            /* A search hit's face: one amber accent over whatever the highlighters already drew, with a
               stronger fill for the hit being read. On a dictionary chip the accent is a ring, so the
               entry keeps its own color and its popover keeps answering — a find mark opens nothing. */
            const findFill = (find: FindMarked<Seg>["find"], onChip: boolean) => {
              if (!find) return "";
              const current = find.index === currentHit;
              if (onChip) return current ? "ring-2 ring-amber-600" : "ring-1 ring-amber-500";
              return current
                ? "bg-amber-400 text-black ring-2 ring-amber-600"
                : "bg-amber-200 text-black ring-1 ring-amber-500";
            };
            // Only the run holding a hit's first character is addressable, so a hit split across runs is
            // still one place to scroll to and one tick on the ruler.
            const findAttrs = (find: FindMarked<Seg>["find"]) =>
              find?.head ? { "data-find-hit": String(find.index) } : {};
            const renderSegs = (segs: FindMarked<Seg>[]) =>
              segs.map((seg, k) => {
                if (seg.chip) {
                  return (
                    <Popover key={k}>
                      <PopoverTrigger asChild>
                        <mark
                          {...findAttrs(seg.find)}
                          style={{ backgroundColor: seg.color, color: "#000" }}
                          className={`rounded px-0.5 cursor-pointer hover:ring-2 hover:ring-ring ${findFill(seg.find, true)}`}
                        >
                          {seg.text}
                        </mark>
                      </PopoverTrigger>
                      <PopoverContent align="start" className="w-72 text-meta">
                        {renderReason(seg.chip)}
                      </PopoverContent>
                    </Popover>
                  );
                }
                if (seg.color) {
                  return (
                    <mark
                      key={k}
                      {...findAttrs(seg.find)}
                      style={{ backgroundColor: seg.color, color: "#000" }}
                      className={`rounded px-0.5 ${findFill(seg.find, true)}`}
                    >
                      {seg.text}
                    </mark>
                  );
                }
                return seg.find ? (
                  <mark key={k} {...findAttrs(seg.find)} className={`rounded px-0.5 ${findFill(seg.find, false)}`}>
                    {seg.text}
                  </mark>
                ) : (
                  <span key={k}>{seg.text}</span>
                );
              });
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
            /* One slice of one block, marked by the highlighters and then by the search. `key` names the
               block in this turn's hit plan and `start` is where the slice begins inside it, so a block
               drawn in pieces still marks the same hits under the same numbers. */
            const renderBlock = (text: string, req: DebugRequest, isOutput: boolean, key: string, start = 0) => {
              const segs = segmentsFor(text, req, isOutput);
              const plan = searchActive ? findByKey.get(key) : undefined;
              return renderSegs(plan ? markFindHits(segs, plan.hits, start, plan.base) : segs);
            };
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
                <div className="flex flex-wrap items-center gap-2 flex-shrink-0 pr-8 text-meta">
                  {/* The title rides the legend row rather than a row of its own. Below md the row is
                      tight enough that it reads as a label, so it goes back to being screen-reader-only. */}
                  <DialogTitle className="sr-only md:not-sr-only md:flex md:flex-shrink-0 md:items-center md:gap-1.5 md:text-label">
                    <ScrollText className="h-4 w-4" />
                    AI Context
                  </DialogTitle>
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
                  {/* The find controls share the search field's frame, so the toolbar keeps its one row. */}
                  <div className="relative flex-grow">
                    <Search className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      value={debugSearch}
                      onChange={(e) => setDebugSearch(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key !== "Enter") return;
                        e.preventDefault();
                        stepHit(e.shiftKey ? -1 : 1);
                      }}
                      placeholder="Search (space-separated terms)…"
                      className={`pl-8 h-8 text-meta ${searchActive ? "pr-28" : ""}`}
                    />
                    {searchActive && (
                      <div className="absolute right-1 top-1/2 flex -translate-y-1/2 items-center gap-0.5">
                        <span className="px-1 text-meta tabular-nums text-muted-foreground">
                          {hitTotal > 0 ? `${currentHit + 1} of ${hitTotal}` : "0 of 0"}
                        </span>
                        <button
                          type="button"
                          onClick={() => stepHit(-1)}
                          disabled={hitTotal === 0}
                          aria-label="Previous match"
                          title="Previous match (Shift+Enter)"
                          className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-40"
                        >
                          <ChevronUp className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => stepHit(1)}
                          disabled={hitTotal === 0}
                          aria-label="Next match"
                          title="Next match (Enter)"
                          className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-40"
                        >
                          <ChevronDown className="h-4 w-4" />
                        </button>
                      </div>
                    )}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={toggleAll}
                    disabled={currentRequests.length === 0}
                    className="h-8 flex-shrink-0 gap-1"
                  >
                    {allCollapsed ? (
                      <ChevronsUpDown className="h-4 w-4" />
                    ) : (
                      <ChevronsDownUp className="h-4 w-4" />
                    )}
                    {allCollapsed ? "Expand all" : "Collapse all"}
                  </Button>
                  <label className="flex flex-shrink-0 items-center gap-1.5 text-meta text-muted-foreground cursor-pointer select-none">
                    <Checkbox
                      checked={debugCurrentContextOnly}
                      onCheckedChange={(checked) => setDebugCurrentContextOnly(checked === true)}
                    />
                    Current context only
                  </label>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 flex-shrink-0 gap-1.5"
                    onClick={handleExportDebugContext}
                    disabled={debugTurns.length === 0}
                    title="Download the full turn history as JSON"
                  >
                    <ActionIcon.export className="h-4 w-4" />
                    Export
                  </Button>
                </div>
                {currentTurn && (
                  <div className="flex-shrink-0 text-meta text-muted-foreground truncate">
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
                  <div className="flex-shrink-0 rounded-md border border-border bg-muted/40 p-2 text-meta">
                    <div className="mb-1 font-semibold text-muted-foreground">Memory summary</div>
                    <pre className="whitespace-pre-wrap break-words">{currentSummary}</pre>
                  </div>
                )}
                <div className="flex-grow min-h-0">
                  {/* While searching, the bar stays out so its ticks do — an overview that hides when the
                      pointer leaves is no overview. */}
                  <ScrollArea
                    className="h-full"
                    viewportRef={debugViewportRef}
                    type={searchActive ? "always" : undefined}
                    marks={searchActive
                      ? debugTicks.map((tick) => ({
                          fraction: tick.fraction,
                          current: tick.index === currentHit,
                          label: `Match ${tick.index + 1} of ${hitTotal}`,
                        }))
                      : undefined}
                    onMarkSelect={(k) => goToHit(debugTicks[k].index)}
                  >
                    <div className="space-y-4 text-meta">
                      {totalDebugPages === 0 ? (
                        <p className="text-muted-foreground">
                          {debugCurrentContextOnly && debugTurns.length > 0
                            ? "Only re-generated, rolled-back, or aborted turns exist. Uncheck “Current context only” to see them."
                            : "No AI context captured yet. Take an action first, then reopen this."}
                        </p>
                      ) : (
                        currentRequests.map((req, i) => {
                          /* A search folds a request with no hits shut and says so, so the turn keeps its
                             shape without the noise. The fold is derived, never stored: it neither reads
                             nor writes the reader's own collapse map, so clearing the search restores
                             exactly the arrangement they made. Opening a folded request by hand still works. */
                          const folded = searchActive && hitsPerRequest[i] === 0;
                          const groupOpen = folded ? !!debugUnfolded[`group-${i}`] : !collapsedDebug[`group-${i}`];
                          const reqOpen = !collapsedDebug[i];
                          const outOpen = !collapsedDebug[`out-${i}`];
                          return (
                            <Collapsible
                              key={i}
                              open={groupOpen}
                              onOpenChange={(o) => (folded
                                ? setDebugUnfolded((prev) => ({ ...prev, [`group-${i}`]: o }))
                                : setCollapsedDebug((prev) => ({ ...prev, [`group-${i}`]: !o })))}
                              className="border border-border rounded-md"
                            >
                              <CollapsibleTrigger asChild>
                                <button className="flex w-full items-center justify-between gap-2 p-2 text-left font-semibold">
                                  <span className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                                    <span>
                                      Request {i + 1}: {req.type}
                                      {folded && <span className="font-normal text-muted-foreground"> · no matches</span>}
                                    </span>
                                    {/* Which endpoint served it. A routed prompt is called out; one following
                                        the active preset is shown quietly, since that is the norm. */}
                                    {req.endpoint && (
                                      <span
                                        // The routed chip is marked by a tinted border + the arrow, not by
                                        // colored text: `primary` is a pale accent that all but vanishes as
                                        // text on a light surface (measured 1.24:1).
                                        className={`rounded px-1.5 py-0.5 text-meta font-normal ${
                                          req.endpoint.routed
                                            ? "border border-primary/60 bg-primary/15 text-foreground"
                                            : "bg-muted text-muted-foreground"
                                        }`}
                                        title={`${req.endpoint.model} · ${req.endpoint.url}`}
                                      >
                                        {req.endpoint.routed ? "→ " : ""}{req.endpoint.preset} · {req.endpoint.model}
                                      </span>
                                    )}
                                  </span>
                                  {groupOpen ? (
                                    <ChevronDown className="h-4 w-4 flex-shrink-0" />
                                  ) : (
                                    <ChevronRight className="h-4 w-4 flex-shrink-0" />
                                  )}
                                </button>
                              </CollapsibleTrigger>
                              <CollapsibleContent className="space-y-2 p-2 pt-0">
                                <Collapsible
                                  open={reqOpen}
                                  onOpenChange={(o) =>
                                    setCollapsedDebug((prev) => ({ ...prev, [i]: !o }))
                                  }
                                  className="border border-border rounded-md"
                                >
                                  <CollapsibleTrigger asChild>
                                    <button className="flex w-full items-center justify-between gap-2 p-2 text-left font-semibold">
                                      <span>Raw Input</span>
                                      {reqOpen ? (
                                        <ChevronDown className="h-4 w-4 flex-shrink-0" />
                                      ) : (
                                        <ChevronRight className="h-4 w-4 flex-shrink-0" />
                                      )}
                                    </button>
                                  </CollapsibleTrigger>
                                  <CollapsibleContent className="p-2 pt-0">
                                    {/* Region/chat shape when this request carried a Request Anatomy.
                                        `plain` keeps the bytes verbatim; provenance reading lives in the
                                        Settings anatomy hub. */}
                                    {req.anatomy ? (
                                      <RequestAnatomyView
                                        blocks={toAnatomyBlocks(req.messages, req.anatomy)}
                                        mode="resolved"
                                        plain
                                        renderText={(text, _block, blockIndex, start) =>
                                          renderBlock(text, req, false, `${i}:in:${blockIndex}`, start)}
                                      />
                                    ) : (
                                      req.messages.map((message, j) => (
                                        <div key={j} className="mb-2">
                                          <div className="font-medium text-muted-foreground uppercase">
                                            {message.role}
                                          </div>
                                          <p className="whitespace-pre-wrap break-words text-label bg-muted/50 p-2 rounded">
                                            {renderBlock(message.content, req, false, `${i}:in:${j}`)}
                                          </p>
                                        </div>
                                      ))
                                    )}
                                  </CollapsibleContent>
                                </Collapsible>
                                {typeof req.response === "string" && (
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
                                      {/* Same face as the Raw Input blocks: this is the same conversation,
                                          read top to bottom. */}
                                      <p className="whitespace-pre-wrap break-words text-label rounded-lg border border-border p-3">
                                        {req.response ? (
                                          renderBlock(req.response, req, true, `${i}:out`)
                                        ) : (
                                          <span className="text-muted-foreground">(empty output)</span>
                                        )}
                                      </p>
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

      <FeedbackDialog open={showBugReport} onOpenChange={setShowBugReport} />

      <SettingsModal
        isOpen={isSettingsOpen}
        onOpenChange={(v) => { setIsSettingsOpen(v); if (!v) { setSettingsTab(undefined); setSettingsEndpointTab(undefined); setSettingsPrompt(undefined); } }}
        previewValues={promptPreviewValues}
        initialTab={settingsTab ?? asSettingsTab(devRoute?.tab)}
        initialEndpointTab={settingsEndpointTab}
        initialPromptTab={settingsPrompt?.tab ?? devRoute?.subtab}
        initialPromptSurface={settingsPrompt?.surface ?? devRoute?.surface}
        initialPromptField={settingsPrompt?.field}
      />

      <AiSetupGate
        open={aiGateOpen}
        reason="play"
        mode={aiMode}
        blocker={aiBlocker}
        reachable={aiReachable}
        recheck={aiRecheck}
        onOpenChange={(v) => { if (!v) setAiGateOpen(false); }}
        onOpenSettings={() => { setAiGateOpen(false); setSettingsTab('endpoints'); setIsSettingsOpen(true); }}
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
