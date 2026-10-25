import { randomUUID } from "@/lib/uuid";
import { openingFold, openingStateOf } from '@/lib/openingState';
import { ownerPins, inPlayOwners, laterDiscovered, libraryUnder } from '@/lib/ownedTraitsInPlay';
import { samePersonaRef } from '@/lib/personaPick';
import { metFromScene, metRosterByLocation, runtimeCharacterPositions } from '@/lib/metEntities';
import { libraryBooksInPlay } from '@/lib/dictionarySelection';
import React, { useState, useEffect, useLayoutEffect, useCallback, useRef, useMemo, useSyncExternalStore, lazy, Suspense } from "react";
import { useGameData } from "../contexts/GameDataContext";
import { useSettings } from "@/contexts/SettingsContext";
import { useSettingsOpenRequest } from "@/lib/useSettingsOpenRequest";
import { landsOnPage, settingsLanding, useSurfaceNav, useSurfaceOpenRequest } from "@/lib/surface/useSurfaceOpenRequest";
import { stepTab, targetRoute, type SurfaceSteps } from "@/lib/surface/surfaceRoute";
import { targetAttribute } from "@/lib/surface/surfaceTargets";
import { EXIT_TO_MENU_PROMPT } from "@/lib/leavePrompts";
import { useGameplay } from "@/contexts/GameplayContext";
import { useAccountDeletion } from "@/contexts/AccountDeletionContext";
import { type SandboxMemory, type SandboxTurn, type StatClock, type WorldWrites } from "@/lib/statCodeExecutor";
import { advancedClock, mergeWorldWrites } from "@/lib/worldWrites";
import { addScriptPins, pruneScriptPins, withScriptPins } from "@/lib/scriptPins";
import { deletedAfter, editsAfter, notesAfter, pinsAfter } from "@/lib/memoryWrites";
import {
  overlayStatCodeResult, playthroughPlaceholderSet, runStatCodeTurn, runSwitchScripts, splitOwnerTurns, withPinWrites, type SandboxState, type ScriptTrigger,
  type StatCodeTurn, type StatCodeTurnResult,
} from "@/lib/statCodeTurn";
import { landSwitchRun } from "@/lib/switchRunLanding";
import { openOutputRun, type OutputRun } from "@/lib/outputRun";
import {
  applyEntityStatResponse, entityCodeTurns, entityStatOwners, personaEntities, personaStatOwners, statOwnerEntities,
  statRequestOwners, withEntityRegen, withOwnerCodeResults,
} from "@/lib/entityStats";
import { readsTurnStart, type RunTiming } from "@/lib/statCodeTiming";
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
import { ClearSearchButton } from "@/components/ui/search-field";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Pager } from "@/components/ui/pagination";
import { Music, SquarePen, Database, ScrollText, ChevronDown, ChevronUp, ChevronsDownUp, ChevronsUpDown, Search, Eye, EyeOff, DoorOpen } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tip } from "@/components/ui/tooltip";
import { toast } from "react-toastify";
import { toastError } from "@/lib/linkToast";
import { cancelOpenPrompts, noticeHost, scriptPrompts, type ScriptPromptHost } from "@/lib/scriptPrompts";
import { isScriptPromptSample, SCRIPT_PROMPT_SAMPLES } from "@/lib/devScriptPromptSamples";
import { addTell, latestTurnId, pruneTells, REROLLED_TIMINGS, setTurnTells, turnTells, withoutTimings } from "@/lib/scriptTells";
import { useScriptPromptListener } from "@/lib/useScriptPromptListener";
import { ThemedToastContainer } from "@/components/ThemedToastContainer";
import "react-toastify/dist/ReactToastify.css";
import type { TTSModalHandle, TTSProgress } from "../components/game/TTSModal";
// Loaded on first TTS open: kokoro-js initializes espeak at module evaluation, so it stays out of startup.
const TTSModal = lazy(() => import("../components/game/TTSModal"));
import ReadmeModal from "../components/game/ReadmeModal";
import { useReadmeVisibility } from "@/lib/useReadmeVisibility";
import { drawPoolEntry, drawUnseenOpening, openingOwner, openingPool, type DrawnOpening } from "@/lib/openings";
import { drawNewGameOpening } from "@/lib/newGameOpening";
import { customPersonaEntity } from "@/lib/blueprints";
import { worldEntitiesOf, type PersonaPick } from "@/lib/persona";
import { resolveWorldPrompt, appliedWorldPrompt, worldPromptChipValues, useWorldPromptOptOut } from "@/lib/worldPrompt";
import { statTextFor } from "@/lib/statTextPrompts";
import { useWorldPromptPresets, resolveEffectivePreset } from "@/lib/worldPromptPreset";
import { groupPromptPreset, loadTabOrganization } from "@/lib/libraryOrganization";
import { EntityModal } from "../components/modals/EntityModal";
import { LocationModal } from "../components/modals/LocationModal";
import { SettingsModal } from "../components/modals/SettingsModal";
import { asSettingsTab, type SettingsTabId } from "../components/modals/settingsTabs";
import { FeedbackDialog } from "@/components/menu/FeedbackDialog";
import { COMMUNITY_ENABLED } from "@/lib/featureFlags";
import AuthService from "@/services/AuthService";
import { useDevRoute } from "../lib/devRouter";
import { DEV_ATTACH_SAMPLE } from "../lib/devRoutes";
import { loadDevFixture } from "../lib/devFixtures";
import { putSaveRecord } from "../components/modals/dbUtils";
import WorldStorageService from "../services/WorldStorageService";
import { MenuModal } from "../components/modals/MenuModal";
import LlmSetupGuide from "../components/modals/LlmSetupGuide";
import WorldEditor, { type EditorExit } from "./WorldEditor";
import type { CharacterData, ChatMessage, ChatRole, ImageAttachment, AIRequestType, AITurnResult, GameLocation, MediaAsset, Dictionary, Entity, EntityStatValues, SaveRecord, World, PlayerStat, Trait, PersonaRef, OwnedTraitPicks, OwnedTraitStates } from "@/types";
import { UnsavedChangesDialog } from "../components/UnsavedChangesDialog";
import { estimateHistoryChars, estimateTokens } from "../lib/memoryUtils";
import { narrationOf, storyText, stripReasoningLive, extractReasoning, extractReasoningLive } from "../lib/aiResponse";
import { setLiveReasoning, getLiveReasoning } from "../lib/reasoningStreamStore";
import { activeCharacterGuidance } from "../components/game/GamePrompts";
import {
  buildStagedPlan,
  matchCastToEntities,
  classifyCast,
  sanitizePlanForReveal,
  buildSceneList,
  type DirectorCastMember,
  type ParsedDirector,
} from "../lib/stagedPlanning";
import { selectRelevantDiary } from "../lib/semanticDiary";
import { findEntityByCharacterName, materializeDiscoveredEntity, discoveredAsEntities, cleanDiscoveredDescription, pruneDiscoveredToHistory, pickedAtStart, INITIAL_SOURCE_TURN_ID } from "../lib/runtimeCharacters";
import { entitiesInPlay, entityIdsAt, positionedCast, startingPositions } from "../lib/entityPresence";
import { selectRegenSource, buildRegenContext } from "../lib/discoveredRegen";
import { outputReserve } from "../lib/outputLength";
import { outputCaps, type AiEndpointTarget, type AiSettingsSnapshot } from "../lib/aiRequest/aiRequestSpec";
import { DEFAULT_REASONING_THROTTLE_MS } from "../lib/aiRequest/aiStream";
import { useAiSettingsSnapshot } from "../lib/aiRequest/useAiSettingsSnapshot";
import { surfaceRejectedEndpointOverride } from "../lib/aiRequest/rejectedOverrideNotice";
import { transportRequest, type TransportContext, type TransportRequest, type TransportSink } from "../lib/aiRequest/requestTransport";
import { toastAiRequestFailure } from "../lib/aiRequest/aiRequestFailureToast";
import { schemaAccepted, toolsSupported } from "../lib/reasoningEffort";
import { completeSentenceCount, completeSentencePrefix, narrationStream, type NarrationListener } from "../lib/aiRequest/narrationStream";
import { narrationRevealListener } from "../lib/narrationRevealListener";
import { getRevealReleased } from "../lib/revealTimingStore";
import { fanOut } from "../lib/aiRequest/fanOut";
import { rewriteSentences } from "../lib/aiRequest/narrationRewrite";
import { parseTurnContent, recentParticipants, collectCharacterDiary, parsedTurnById, turnDiaries, turnMemory } from "../lib/turnDigest";
import { navigableDestinations } from "../lib/locationContext";
import { chipValues, entityStatsField, sceneEntityChipValues } from "../lib/chipValues/chipValues";
import { useLiveChipScene, type SceneWrites } from "../lib/chipValues/liveScene";
import { buildToolSnapshot, type ToolScriptSource, type ToolMemorySource } from "../lib/tools/toolSnapshot";
import { toolCallStatus } from "../lib/tools/toolCallStatus";
import { snapshotToolExecutor, toolsOfferedTo } from "../lib/tools/toolOffer";
import { openWorldToolTurn, replayedToolEffects, type WorldToolTurn } from "../lib/tools/worldToolTurn";
import { onCallRunner } from "../lib/tools/onCallRunner";
import { useHelpWorldSource } from "../lib/formaquestion/helpWorld";
import type { ChipSceneTime } from "../lib/chipValues/chipScene";
import { useResolvedWorld } from "@/lib/useResolvedWorld";
import { useLocationBackdrop, useMapBackdrop } from "@/lib/useLocationBackdrop";
import { useSeedAvatarOnSaveLoad } from "@/lib/useLibraryAvatars";
import { usePersonaNotice } from "@/lib/usePersonaNotice";
import { resolveStartingLocation } from "../lib/startingLocation";
import { variableForToken, tokenVariant } from "../lib/promptVariables";
import { renderPromptTemplate } from "../lib/promptTemplate";
import { layerValues, omitValues, type TokenValues } from "../lib/promptValues";
import { useBaselineTestHook } from "../lib/baselineTestHook";
import { recordParityTurn } from "../lib/turnPipeline/parityRecorder";
import {
  statRequestReady,
  choicesPass,
  statUpdatesPass,
  diaryPass,
  discoverEntityPass,
  milestoneSelectPass,
  sceneTagsPass,
  summaryPass,
  scriptActionFor,
} from "../lib/turnPipeline/turnPasses";
import {
  createBackgroundPassQueue, digestTarget,
  type BackgroundPassKind, type BackgroundPassQueue, type DiaryTarget, type DigestTarget,
} from "../lib/backgroundPassQueue/backgroundPassQueue";
import { BackgroundPassStatus } from "../components/game/BackgroundPassStatus";
import { RequestStatusRow } from "../components/game/RequestStatusRow";
import { TOOL_GLYPH, requestLabel, requestStatus } from "../components/game/statusGlyphs/glyphMap";
import { buildNarrationPrompt, type DictionaryDebug } from "../lib/turnPipeline/narrationPrompt";
import { buildPlannerBand } from "../lib/turnPipeline/plannerBand";
import { readNarration, selectVisitorAdditions, presentSceneEntities, splitParticipants } from "../lib/turnPipeline/narrationReading";
import { planTurn, planHasPass } from "../lib/turnPipeline/planTurn";
import { runTurn, type TurnAdvance, type TurnRequestAdapter } from "../lib/turnPipeline/turnRunner";
import { createPendingRequests } from "../lib/turnPipeline/pendingRequests";
import {
  commitEntityMoves, computeTurnCommit, entityMovesOf, withCodeLines, withCodeWrites, type TurnCommit, type TurnCommitContext,
} from "../lib/turnPipeline/computeTurnCommit";
import {
  entityMoveOffers, entityMoveSubjects, hasEntityOffer, joinEntityMoves, movedPositions, moveWithPlayer,
  NO_ENTITY_MOVES, NO_ENTITY_OFFER, peelIntents, peeledCharacters, runtimePositions, turnPeelOff,
  type EntityMoveOffer, type FollowerState, type PeelOff,
} from "../lib/entityFollowing";
import { classifyTurnError, type TurnErrorKind } from "../lib/turnPipeline/turnErrors";
import { emptyTurnMaterial, type TurnMaterial, type TurnPassSubject, type TurnPlan, type TurnPlanInput, type TurnPrompts, type TurnSettings } from "../lib/turnPipeline/turnPlan";
import { parseTurns, buildVerbatimHistory, buildBandedHistory, extractKeywords, type BandCounts } from "../lib/turnBanding";
import { anatomyRegions, toAnatomyBlocks, type AnatomyRun } from "../lib/requestAnatomy";
import type { PromptJumpTarget } from "../lib/promptJump";
import {
  markFindHits, markFraction, parseFindTerms, planFindHits, type FindMarked,
} from "@/lib/findMarks";
import { buildStamper, daypartAt, hoursByPosition, FLAT_HOURS_PER_TURN } from "../lib/gameClock";
import { agedMilestoneCandidates, resolveMilestoneDrop } from "../lib/milestoneMemory";
import { applyMemoryOverrides, activeNotes } from "../lib/memoryOverrides";
import { buildMemoryLedger, closedTurns, scriptMemories } from "../lib/memoryView";
import { buildRelevanceScores, EMBED_BATCH_BOUND_MS, EMBED_BOUND_MS, vectorKey } from "../lib/memoryRelevance";
import { entryVectorKey, entryEmbedText } from "../lib/semanticDictionary";
import { selectSemanticRehydrations } from "../lib/semanticRehydration";
import { pickHistoryRecall, type HistoryPicks } from "../lib/historyRecall";
import { embedTexts, isEmbeddingModelReady, loadEmbeddingModel } from "../lib/embeddingWorkerClient";
import { getVectors, putVector } from "../lib/embeddingCache";
import { findEntityNames, matchNames, sameCharacterName } from "../lib/entityMatch";
import { keepSameRows, parseChoices, parseStreamingChoices } from "../lib/choices";
import { setGameplayText } from "../lib/gameplayTextStore";
import { useSentenceReveal } from "../lib/useSentenceReveal";
import { useSmoothedReveal } from "../lib/useSmoothedReveal";
import { revealActive } from "../lib/narrationRevealConfig";
import { CHOICES_TEST_ACTION, CHOICES_TEST_CHOICES, CHOICES_TEST_NARRATION, REVEAL_TEST_NARRATION, REVEAL_TEST_PROFILES, TURN_TEST_ACTION, TURN_TEST_CHOICES, TURN_TEST_NARRATION, type RevealArrivalEvent } from "../lib/revealTestScripts";
import { scriptedFetch } from "../lib/scriptedFetch";
import { TURN_CHROME_ENTER_MS } from "../lib/turnChrome";
import { MARKDOWN_SAMPLE } from "../lib/markdownSample";
import { parseSlashCommand } from "../lib/slashCommands";
import { appliedStatDeltas, applyRegen, sumDeltas } from "../lib/statChanges";
import type { OwnerId } from "../lib/scope";

import { applyStatResponse, createStatRequest, keyedScene, readStatResponse, statResponseChanges, type StatRequestSnapshot, type StatResponse } from "../lib/statRequest";
import { resolveEntityTexts, resolveStatGroupTexts, resolveStatNames, resolveStatText } from "../lib/resolveWorldNames";
import { AiContextRequestCard, type AiContextCardSection, type AiContextTextSlot } from "@/components/aiContext/AiContextRequestCard";
import { AiContextExportButton } from "@/components/aiContext/AiContextExportButton";
import type { AiRequestRecord } from "@/lib/aiContext/requestRecord";
import { composeSceneTags, pickSceneCast, stripPlaces, splitTags, type SceneCharacter } from "../lib/sceneTags";
import { loadDanbooruTags } from "../lib/danbooruTags";
import { addSceneImage, removeSceneImage, pruneSceneImages, setSceneTags as patchSceneTags, sceneDrawTags } from "../lib/sceneImages";
import { addToPending, setTurnAttachments, latestTurnAttachments, pruneAttachments } from "../lib/actionAttachments";
import { useImageAttachments } from "../lib/useImageAttachments";
import { useMountedRef } from "../lib/useMountedRef";
import { generateImage, buildImageRequest, takesCharacterPrompts } from "../lib/imageGen";
import { toastImageFailure } from "../lib/imageGen/failureToast";
import { buildImagePrompt } from "../lib/imagePrompt";
import { downloadBlob } from "../lib/downloadBlob";
import { rollbackState, regenerateState, canRegenerate, lastTurnAction, markRegeneratedTurn, markPrunedTurns, snapshotPageIndex, placeSnapshot, sliceHistoryToPage, pageAssistantIndex } from "../lib/turnHistory";
import { useDeferredSnapshot } from "../lib/useDeferredSnapshot";
import { statMorphMap } from "../lib/bodyMorphs";
import {
  inAuthoredOrder, refreshChosenTraits, refreshSavedStats, activeStatEnabled, enabledStats,
} from "../lib/traitEffects";
import { usePlaceholderSession } from "../contexts/PlaceholderSessionContext";
import {
  activeTraits as traitsInForce, entityStatTraitsInForce, heldGlobalTraits, globalRowTraits, startingTraitLog,
  gateStatsOf, settleTraits, statTraitsInForce, switchPersonaStats, switchPlayerTrait, traitNameIn, traitSwitchEvents,
  type GatedTraitResult, type TraitRuntimeState, type TraitWorld,
} from "../lib/traitRuntime";
import type { GateStats } from "../lib/traitGates";
import { starvationLoss } from "../lib/starvation";
import { useSettleOnSaveLoad } from "../lib/useSettleOnSaveLoad";
import { useTurnSettle } from "../lib/useTurnSettle";
import type { TraitCascade } from "../components/game/SetupTraitList";
import { savedTraits } from "../lib/statCodeTraits";
import { liveSnapshotOf, type LiveSnapshot } from "../lib/globalSaveFields";
import { parseKeywords, locateMatches, type EntryActivation, type MatchHit, type MatchRule } from "../lib/dictionaryUtils";
import { highlightSegments, HIGHLIGHT_PALETTE, type HighlightRule, type HighlightSegment } from "../lib/highlightUtils";
import { useIsMobile } from "../lib/useIsMobile";
import {
  LeftPanel,
  MiddlePanel,
  RightPanel,
  type CommandChoices,
} from "../components/game/GamePanels";
import { LocationBackdrop } from "../components/game/LocationBackdrop";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { AiSetupGate } from "../components/AiSetupGate";
import { DemoAIBadge, DemoAINotice, type DemoAINoticeHandle } from "../components/game/DemoAINotice";
import { useDemoAIDialogPending } from "../components/game/demoAISeen";
import { LikePrompt } from "../components/game/LikePrompt";
import { useLikePrompt } from "../components/game/useLikePrompt";
import { useNarrationRescan } from "../components/game/useNarrationRescan";
import { nextEntryDialog } from "@/lib/entryDialogOrder";
import { useAiReachable } from "../lib/useAiReachable";
import { useLoopingAudio } from "@/hooks/useLoopingAudio";

/** Where this entry is with the Demo AI dialog. */
type DemoAIEntryState = 'waiting' | 'open' | 'done';

interface GameViewerProps {
  initialTraits?: string[];
  /** Entity id → the owned traits picked at the entry step. */
  initialOwnedTraits?: OwnedTraitPicks;
  initialCharacterData: CharacterData | null;
  initialLocationId?: string | null;
  /** Per-playthrough dictionary set chosen at the entry step; null when the step was skipped (falls back
   *  to the world's authored books). */
  initialDictionaries?: Dictionary[] | null;
  /** Library characters chosen at the entry step to place in the starting location this playthrough (runtime
   *  only — seeded as `discoveredEntities`, never written to the authored world). */
  initialCharacters?: Entity[] | null;
  /** The persona chosen at the entry step. Absent means None. */
  initialPersona?: PersonaPick | null;
  /** Cold-load: a save id to restore on mount (main-menu Load Game) instead of starting a fresh game. The
   *  world it belongs to is loaded into GameData before this mounts. */
  initialSaveId?: string | null;
  onExitToMenu: () => void;
}

// One turn of the AI-context viewer: the action and every request captured for it (lib/aiContext/requestRecord).
// A narration request carries its dictionary activation, so the viewer marks real matches, and only real
// matches, even on historical turns whose live state has moved on.
interface DebugTurn {
  action: string;
  requests: AiRequestRecord[];
  turnId?: string; // ties this turn to its assistant message, so the viewer can show its memory digest
  regenerated?: boolean; // this turn was superseded by a re-generate of the same action
  pruned?: boolean; // this turn was discarded by a rollback to an earlier page
  aborted?: boolean; // this turn was stopped before any narration landed (its user message was dropped)
}

/** A turn waiting for restored or seeded state to commit before it is sent. */
interface PendingTurn {
  action: string;
  /** An Opening Narration's resolved text; the turn plays it as page one. */
  writtenNarration?: string;
  /** A regenerate's images, read before the rewind lets the prune drop them. */
  resentAttachments?: ImageAttachment[];
}

/** What one playthrough remembers about its openings. Session state only, so a save never carries it. */
interface OpeningSession {
  /** The row drawn last, its text unresolved. */
  drawn: DrawnOpening | null;
  /** Shown-list keys, newest last, so a page-one regenerate draws an opening not yet seen. */
  shown: string[];
  /** The Opening Action the legacy "START GAME" sentinel stands for when the draw was a narration. */
  cue: DrawnOpening | null;
  /** Where a new game started. Null on a loaded save, which reads it off the stored page one. */
  startLocationId: string | null;
}
const newOpeningSession = (): OpeningSession => ({
  drawn: null, shown: [], cue: null, startLocationId: null,
});

/** `history` with `patch` laid over its latest assistant turn; unchanged when the tail is no assistant turn. */
const withLatestTurnPatched = (history: readonly ChatMessage[], patch: Partial<AITurnResult>): ChatMessage[] => {
  const updated = [...history];
  const i = updated.length - 1;
  const cur = i >= 0 && updated[i].role === "assistant" ? parseTurnContent(updated[i].content) : null;
  if (cur) updated[i] = { role: "assistant", content: JSON.stringify({ ...cur, ...patch }) };
  return updated;
};

/** Page one as stored. */
const pageOneTurn = (history: readonly ChatMessage[]): AITurnResult | null => {
  const pageOne = history.find((m) => m.role === "assistant");
  return pageOne ? parseTurnContent(pageOne.content) : null;
};
/** Where page one took place. */
const pageOneLocationId = (history: readonly ChatMessage[]) => pageOneTurn(history)?.locationId;
const pageOneNarration = (history: readonly ChatMessage[]) => pageOneTurn(history)?.narration;

/** The pre-turn state a stat re-roll hands stat code, so code reads and switches as the turn it replaces did. */
type PreTurnCodeState = Pick<
  LiveSnapshot, 'codePins' | 'globalTraits' | 'disabledTraitIds' | 'appliedTraitValues' | 'cascadeOffTraitIds' | 'ownedTraits' | 'entityStats'
>;

/** What one stat-code run left, in the shapes state holds. The before box hands this to the turn's own
 *  passes, which run before React re-renders with it. */
type TurnCodeState = Pick<LiveSnapshot, 'globalStats'> & PreTurnCodeState;

/** A running turn's view of the history. Each absent field reads live state. */
interface HistoryTurnView {
  /** Story hours the recap's stamps and now-line read. */
  nowHours?: number;
  /** The context values the now-line renders from. */
  values?: TokenValues;
  /** The first trim's picks, on a re-render. */
  picks?: HistoryPicks;
}

/** A stat-code run set up but not yet executed: its turn, and the step that lays the result onto live state. */
interface PreparedStatCode {
  turn: StatCodeTurn;
  finish: (result: StatCodeTurnResult) => { written: TurnCodeState | null; gateStats: GateStats; world?: WorldWrites };
}

/** The traits in force on one slice of saved trait state, and the stats live under them. The live pair is
 *  derived in two steps because `statEnabled` is read on its own; a paged-back turn and a turn's own
 *  before-box pass both want the pair in one go. */
const activeUnderTraits = (
  stats: PlayerStat[],
  acquired: readonly Trait[],
  disabledTraitIds: readonly string[],
  traitOrder: Parameters<typeof inAuthoredOrder>[1],
  /** The entities' global-row traits in force on that slice, which switch stats with the rest. */
  globalRows: readonly Trait[] = [],
): Required<Pick<SceneWrites, 'activeStats' | 'activeTraits'>> => {
  const inForce = inAuthoredOrder(traitsInForce(acquired, disabledTraitIds), traitOrder);
  return { activeTraits: inForce, activeStats: enabledStats(stats, activeStatEnabled(stats, [...inForce, ...globalRows])) };
};

// The lore chip, whose blocks play fills per turn instead of from the scene.
const DICTIONARY_VARIABLE = variableForToken('<DICTIONARY>')!;

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

const NO_OWNED_TRAITS: OwnedTraitPicks = {};
const NO_PASSES: ReadonlySet<BackgroundPassKind> = new Set();

/** A transport request plus the view's own status-label switch. */
interface ViewRequest extends TransportRequest {
  /** Skips the status label; a concurrent batch sets one label itself. */
  quiet?: boolean;
  /** Answers the request in place of the network, for a scripted turn. */
  fetchImpl?: typeof fetch;
}

/** A scripted turn's stand-in replies: its narration and choices streams. */
interface TurnScript {
  narration: typeof fetch;
  choices: typeof fetch;
}

/** The passes a scripted turn runs; every other one would ask a real endpoint. */
const SCRIPTED_PASSES = new Set(['narration', 'choices']);

/** Calls `render` only while mounted, so a closed dialog's body costs the parent's render nothing. */
function RenderMounted({ render }: { render: () => React.ReactNode }) {
  return <>{render()}</>;
}

const GameViewer = ({
  initialTraits = [],
  initialOwnedTraits = NO_OWNED_TRAITS,
  initialCharacterData,
  initialLocationId = null,
  initialDictionaries = null,
  initialCharacters = null,
  initialPersona = null,
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
    playStats: authoredStats,
    statGroups: authoredStatGroups,
    traits: authoredTraits,
    locations: authoredLocations,
    dictionaries,
    placeholders: worldPlaceholders,
    placeholderOwners,
    worldScripts,
    worldTools,
    worldOverview,
    worldId,
    worldLoaded,
    isWorldDirty,
    worldChangedElsewhere,
    loadWorldData,
    getWorldData,
  } = useGameData();

  // World README popup — shown once on entry (new game or save load) when the world has README text and
  // its per-world "show readme" flag is on. The flag is shared with the main-menu "Show Readme" toggle.
  const { showReadme, setShowReadme } = useReadmeVisibility();
  const readmeText = worldOverview?.readme?.trim() ?? "";
  const [showReadmeModal, setShowReadmeModal] = useState(false);
  const [readmePending, setReadmePending] = useState(() => !!readmeText && showReadme(worldId));

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
  const { beginSessionPreset, endSessionPreset, promptAttachments } = settings;
  // A library folder can carry a preset for every world inside it. The world's own pin still wins, and a
  // level naming a deleted preset drops silently to the next — the arrangement is read straight from
  // device-local storage, since it is a library preference the game never writes back to.
  const groupPreset = useMemo(
    () => (worldId ? groupPromptPreset(loadTabOrganization('worlds'), worldId) : undefined),
    [worldId],
  );
  useEffect(() => {
    const effective = resolveEffectivePreset(worldPreset(worldId), groupPreset, {
      presets: settings.promptPresets,
    });
    beginSessionPreset(effective.presetId, (id) => setWorldPreset(worldId, id));
    return () => endSessionPreset();
    // Re-runs only when the world or its folder's preset changes; `worldPreset`/`setWorldPreset` and the
    // preset list are recreated every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [worldId, groupPreset, beginSessionPreset, endSessionPreset]);
  const {
    bgmEnabled,
    setBgmEnabled,
    language,
    setLanguage,
    paragraphLimit,
    markdownOutput,
    // Applied at every seam that sends narration history.
    stripLinksAndImages: stripMedia,
    streamNarrationAudio,
    // Active endpoint settings: the user's values when "Use Custom Endpoint" is on, built-in defaults otherwise.
    activeEndpointUrl: endpointUrl,
    // Per-prompt endpoint routing: every AI call resolves its own target, so a prompt pinned to another
    // preset sends there. An unpinned prompt resolves to the active endpoint, i.e. the values above.
    resolveEndpointForKind,
    disableEndpointOverride,
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
    entityMovement,
    narrationVerbatimTurns,
    thinkingVerbatimTurns,
    thinkingMode,
    noteReasoningReply,
    noteSchemaRejected,
    thinkingPrompt,
    memoryDigests,
    semanticMemory,
    semanticLore,
    semanticRehydration,
    semanticDiaries,
    semanticBandCap,
    timeContext,
    aiClock,
    fixedTurnHours,
    nowLinePrompt,
    timePassedPrompt,
    openingTimePrompt,
    openingTimeUserPrompt,
    timePassedUserPrompt,
    concurrentTurnRequests,
    toolsEnabled,
    autosaveEnabled,
    autosaveSlots,
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
    entityLocationPrompt,
    entityLocationUserPrompt,
    summaryUserPrompt,
    milestoneSelectPrompt,
    milestoneSelectUserPrompt,
    // Scene images: the tag pass's prompts and the toggles. buildImageRequest reads the rest of the
    // provider config off `settings`; provider and model pick the scene line's form.
    sceneTagsPrompt,
    sceneTagsUserPrompt,
    discoverEntityPrompt,
    discoverEntityUserPrompt,
    sceneImageAuto,
    imageTagPrompt,
    imageCleanTags,
    imageProvider,
    imageModel,
    imageGenDisabled,
    imageLandscapeWidth,
    imageLandscapeHeight,
    showSilentRequests,
    activeSectionStyle,
    statTextPrompts,
    locationBackground,
    backgroundOverlay,
    allTools,
    enabledTools,
  } = settings;

  // The prompts this world actually runs on. Every reference below is a resolved value, so the opening
  // scene, the turn pipeline, and the standalone re-rolls all agree; passes the world can't override keep
  // reading their preset fields directly. One opt-out declines all three at once.
  const declinedWorldPrompts = !applyWorldPrompt(worldId);
  const systemPrompt = resolveWorldPrompt(worldOverview, 'narration', presetSystemPrompt, declinedWorldPrompts);
  const resolvedChoicesPrompt = resolveWorldPrompt(worldOverview, 'choices', choicesPrompt, declinedWorldPrompts);
  const resolvedStatUpdatesPrompt =
    resolveWorldPrompt(worldOverview, 'statUpdates', statUpdatesPrompt, declinedWorldPrompts);
  const worldStatPromptApplies = appliedWorldPrompt(worldOverview, 'statUpdates', declinedWorldPrompts) !== null;

  const {
    setCharacterData,
    visibleEntities,
    setVisibleEntities,
    setCurrentLocation,
    setGlobalStats,
    globalStats: rawGlobalStats,
    globalTraits,
    setGlobalTraits,
    disabledTraitIds,
    setDisabledTraitIds,
    appliedTraitValues,
    setAppliedTraitValues,
    cascadeOffTraitIds,
    setCascadeOffTraitIds,
    ownedTraits,
    setOwnedTraits,
    entityStats,
    setEntityStats,
    setEntityStatBaseline,
    resetEntityStats,
    entityPositions,
    setEntityPositions,
    entityFollowers,
    setEntityFollowers,
    carryFollowersTo,
    applyFollowerState,
    metEntities,
    setMetEntities,
    setSelectedEntityId,
    codePins,
    setCodePins,
    statDeltas,
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
    isRevealingNarration,
    setIsRevealingNarration,
    setNarrationSettled,
    fullMessageHistory,
    setFullMessageHistory,
    setDisplayedMessages,
    currentPage,
    setUserPage,
    totalPages,
    isViewingPast,
    viewTraits,
    viewDisabledTraitIds,
    viewOwnedTraits,
    viewEntityStats,
    viewLocationId,
    gameStates,
    setGameStates,
    setBodyMorphValues,
    playerNotes,
    setPlayerNotes,
    saveGame,
    autosaveGame,
    loadGame,
    saveLoads,
    personaPending,
    saveCurrentGameState,
    loadGameState,
    discoveredEntities,
    setDiscoveredEntities,
    suppressedCharacterNames,
    setRuntimeDictionaries,
    runtimeDictionaries,
    libraryDictionaries,
    memoryPins,
    setMemoryPins,
    setEntityVisualPreference,
    setEntityImageIndex,
    personaRef,
    setPersonaRef,
    milestoneSelection,
    setMilestoneSelection,
    memoryEdits,
    setMemoryEdits,
    memoryDeleted,
    setMemoryDeleted,
    memoryNotes,
    setMemoryNotes,
    contextMemoryIds,
    rehydratedMemoryIds,
    sceneImages,
    setSceneImages,
    actionAttachments,
    setActionAttachments,
    pendingAttachments,
    setPendingAttachments,
    scriptTells,
    setScriptTells,
    openingCue: openingTurnAction,
    setOpeningCue: setOpeningTurnAction,
  } = useGameplay();
  const {
    show: showStatDeltas, add: addStatDeltas, hold: holdStatDeltas, settle: settleStatDeltas,
    drain: drainStatDeltas, drop: dropStatDeltas,
  } = statDeltas;

  // --- Placeholder resolution, before anything reads a name ---------------------------------------------
  // One hook, shared with the gameplay panels, so the two cannot resolve a name differently. Below this line
  // an entity/location/stat/trait/dictionary name is a plain string with no chips left in it. The `raw*`
  // values above stay untouched for roll priming, which has to see the chips it is rolling for.
  const {
    entities, locations, connections, stats, traits, traitGroups, dictionary, globalStats, viewStats,
    currentLocation, traitOrder, pins, pinsFor, resolvePH, resolveFor, resolveWith, resolveOpening, resolveTraitText,
    resolveTraitFor, resolveEntityText, resolveEntityFor, playerNames, persona, traitEntities, traitLibrary, codeEntities,
    presentEntitiesUnder,
  } = useResolvedWorld();
  usePersonaNotice();
  // The session's rolls for the init effect's pins, and its Placeholder Set with the library's lists.
  const {
    rolls: sessionRolls, placeholders, setPersona: setSessionPersona, setLibraryAdditions: setSessionLibraryAdditions,
  } = usePlaceholderSession();

  // --- Active traits and what they switch on ------------------------------------------------------------
  // A chosen trait the player has switched off contributes nothing: no AI text, no stat toggle, no pin. Its
  // stat *changes* were reversed at the moment it was switched off (see toggleTrait), so they aren't
  // recomputed here. Authored order decides precedence when two active traits target the same thing.
  // The save froze each chosen trait as the world stood on turn 1; the world owns its authoring, so read it
  // back before anything derives from it.
  const chosenTraits = useMemo(() => refreshChosenTraits(globalTraits, traits), [globalTraits, traits]);
  /** What the owner resolver reads: the authored world. */
  const ownerWorld = useMemo(
    () => ({ traits: authoredTraits, traitGroups, entities: traitEntities }),
    [authoredTraits, traitGroups, traitEntities],
  );
  // The per-turn settle reads this at the render that holds the turn's advanced clock.
  const daypart = daypartAt(gameTime, calendar);
  /** The authored world every owner's trait gates read: the traits, the groups, who the player is, each
   *  present owner's tree under that persona, and the story clock's daypart. */
  const gatedWorld = useCallback(
    (ref: PersonaRef | undefined = personaRef): TraitWorld => ({
      traits: authoredTraits, groups: traitGroups, persona: ref ?? { source: 'none' }, daypart,
      // A persona change reads this before its render, so its entities and library are the ones under `ref`.
      entities: ref === personaRef ? worldEntitiesOf(entities, persona) : presentEntitiesUnder(ref),
      ...inPlayOwners(ownerWorld, ref, libraryUnder(traitLibrary, personaRef, ref)),
    }),
    [authoredTraits, traitGroups, daypart, entities, persona, personaRef, ownerWorld, traitLibrary, presentEntitiesUnder],
  );
  // A Custom Persona pick lies dormant under a world persona, so only the held picks are active.
  const activeTraits = useMemo(() => {
    const off = new Set(disabledTraitIds);
    return inAuthoredOrder(heldGlobalTraits(chosenTraits, gatedWorld()).filter((t) => !off.has(t.id)), traitOrder);
  }, [chosenTraits, disabledTraitIds, traitOrder, gatedWorld]);
  // The traits whose stat effects are in force: the active world traits, then every entity's global
  // rows. Bounds, stat toggles and stat code all read this set; the AI text reads `activeTraits`.
  const statTraits = useMemo(
    () => statTraitsInForce({ traits: chosenTraits, disabledTraitIds, ownedTraits, entityStats }, gatedWorld()),
    [chosenTraits, disabledTraitIds, ownedTraits, entityStats, gatedWorld],
  );
  /** The stat traits in force on a saved slice, under the current persona. */
  const inForceOn = useCallback(
    (held: Pick<TraitRuntimeState, 'ownedTraits'> & { acquired: readonly Trait[]; disabledTraitIds: readonly string[] }, entityStats?: EntityStatValues) =>
      statTraitsInForce({ traits: held.acquired, disabledTraitIds: held.disabledTraitIds, ownedTraits: held.ownedTraits, entityStats }, gatedWorld()),
    [gatedWorld],
  );

  // Runtime characters (Slice 2): director-invented characters promoted to persisted entities this
  // playthrough behave like authored ones — union them into the AI-pipeline roster, each carrying the
  // location it was invented at, so the location-scoped context rosters it like anyone else.
  // Discovered entities are minted at runtime from AI prose, so their names never carry chips.
  const allEntities = useMemo(
    () => [...entities, ...discoveredAsEntities(discoveredEntities)],
    [entities, discoveredEntities],
  );
  // The names a script's diary lines land under, by entity id.
  const diaryNames = useMemo(
    () => Object.fromEntries([...traitLibrary, ...allEntities].map((entity) => [entity.id, entity.name])),
    [traitLibrary, allEntities],
  );
  // An entity is met once the scene lists it by its revealed name.
  useEffect(() => {
    setMetEntities((met) => metFromScene(met, visibleEntities, allEntities));
  }, [visibleEntities, allEntities, setMetEntities]);
  // The Map's live roster: where each met entity with a position stands. A runtime character stands where
  // it was met.
  const metRoster = useMemo(() => metRosterByLocation({
    entities: allEntities,
    positions: { ...runtimeCharacterPositions(discoveredEntities), ...entityPositions },
    met: metEntities,
  }), [allEntities, discoveredEntities, entityPositions, metEntities]);
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
      // The persona is a person the narration names, so it takes the surname rule too.
      characters: clean([...allEntities.map((e) => e.name), ...playerNames]),
      terms: clean([
        ...locations.map((l) => l.name),
        ...stats.map((s) => s.name),
        ...traits.map((t) => t.name),
        ...dictionary.flatMap((entry) => [entry.name ?? '', ...parseKeywords(entry)]),
        ...placeholders.flatMap((p) => [p.name, ...p.values.map((v) => v.text)]),
        // The player's name lives in free-text notes, so every capitalized run there is off-limits.
        ...(playerNotes.match(/\b[A-Z][A-Za-z'’-]+/g) ?? []),
      ]),
    };
  }, [allEntities, playerNames, locations, stats, traits, dictionary, placeholders, playerNotes]);

  const rescanExclusions = useMemo(
    () => ({ ...characterExclusions, suppressed: suppressedCharacterNames }),
    [characterExclusions, suppressedCharacterNames],
  );
  const rescanNarration = useNarrationRescan({ entities: allEntities, exclusions: rescanExclusions });

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
  // A past page shows: release narration as it arrives, so the return shows it all and paces what follows.
  const setFadeRevealSkipping = fadeReveal.setSkipping;
  useEffect(() => {
    setFadeRevealSkipping(isViewingPast && isRevealingNarration);
  }, [isViewingPast, isRevealingNarration, setFadeRevealSkipping]);

  // Slash-command preview (e.g. `/markdown test`): drives the narration reveal with local text, off the AI path.
  const [commandPreview, setCommandPreview] = useState(false);
  // The `/choices test` choices; null for a narration-only preview.
  const [commandChoices, setCommandChoices] = useState<CommandChoices | null>(null);
  const [connectionGuideOpen, setConnectionGuideOpen] = useState(false); // AI-server connection guide (web-only)
  const commandTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Bumped per run, so a stopped run's pending drain can't commit into the next one.
  const commandRun = useRef(0);
  const [commandRunId, setCommandRunId] = useState(0);

  const stopCommandPreview = useCallback(() => {
    commandRun.current++;
    if (commandTimer.current !== null) {
      clearTimeout(commandTimer.current);
      commandTimer.current = null;
    }
    setCommandPreview(false);
    setCommandChoices(null);
  }, []);

  // Replays `text` at `schedule`'s wall-clock times through `onArrive`, then calls `onEnd`.
  const replaySchedule = useCallback((
    text: string, schedule: RevealArrivalEvent[], onArrive: (slice: string) => void, onEnd: () => void,
  ) => {
    const run = commandRun.current;
    const startedAt = performance.now();
    let i = 0;
    const step = () => {
      if (run !== commandRun.current) return;
      // Fire every arrival event that's due, then reschedule for the next.
      while (i < schedule.length && performance.now() - startedAt >= schedule[i].atMs) {
        onArrive(text.slice(0, schedule[i].chars));
        i++;
      }
      if (i >= schedule.length) {
        commandTimer.current = null;
        onEnd();
        return;
      }
      commandTimer.current = setTimeout(step, Math.max(0, schedule[i].atMs - (performance.now() - startedAt)));
    };
    step();
  }, []);

  const pushPreviewNarration = useCallback((slice: string) => {
    // Whole sentences only, so the fade never shows a late trim of the unfinished tail.
    if (fadeRevealActive) fadeReveal.push(completeSentencePrefix(slice), completeSentenceCount(slice));
    else smoothReveal.push(slice);
  }, [fadeReveal, smoothReveal, fadeRevealActive]);

  const finishPreviewNarration = useCallback((text: string) => {
    if (fadeRevealActive) fadeReveal.finish(text);
    else smoothReveal.finish(text);
  }, [fadeReveal, smoothReveal, fadeRevealActive]);

  const startCommandPreview = useCallback((choices: CommandChoices | null) => {
    stopCommandPreview();
    setCommandRunId(commandRun.current);
    setCommandPreview(true);
    setCommandChoices(choices);
    fadeReveal.reset();
    smoothReveal.reset();
  }, [stopCommandPreview, fadeReveal, smoothReveal]);

  // Replay a fixed narration through the REAL reveal path (pacer → renderer) at a scripted arrival
  // timing, so the reveal can be eyeballed/recorded reproducibly without the AI. The profile (see
  // revealTestScripts) picks the arrival pattern — default `burst` reproduces the LM Studio signature.
  // The pacer measures arrival timing itself (via Date.now on each push), so replaying the schedule at
  // real wall-clock times reproduces production pacing exactly, with no estimator to mirror here.
  const runMarkdownTest = useCallback((profileName?: string) => {
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
    startCommandPreview(null);
    replaySchedule(text, profile.schedule(text.length), pushPreviewNarration, () => finishPreviewNarration(text));
  }, [startCommandPreview, replaySchedule, pushPreviewNarration, finishPreviewNarration]);

  // A scripted turn: one paragraph, then a choices reply streamed through the live turn's rules. Live
  // updates wait out a still-fading narration, and the full list commits once the reveal drains.
  const runChoicesTest = useCallback((profileName = 'steady') => {
    const profile = REVEAL_TEST_PROFILES[profileName];
    if (!profile) {
      toast.info(`Unknown profile. Try: ${Object.keys(REVEAL_TEST_PROFILES).join(', ')}`);
      return;
    }
    startCommandPreview({ list: [], settled: false });
    const run = commandRun.current;
    const narration = CHOICES_TEST_NARRATION;
    const streamChoices = () => replaySchedule(
      CHOICES_TEST_CHOICES,
      REVEAL_TEST_PROFILES.steady.schedule(CHOICES_TEST_CHOICES.length),
      (slice) => {
        const list = parseStreamingChoices(slice);
        if (list.length > 0 && !(fadeRevealActive && !fadeReveal.isDrained())) {
          setCommandChoices((prev) => (prev && !prev.settled && keepSameRows(prev.list, list) === prev.list ? prev : { list, settled: false }));
        }
      },
      () => {
        void (fadeRevealActive ? fadeReveal.drained() : Promise.resolve()).then(() => {
          if (run === commandRun.current) setCommandChoices({ list: parseChoices(CHOICES_TEST_CHOICES), settled: true });
        });
      },
    );
    replaySchedule(narration, profile.schedule(narration.length), pushPreviewNarration, () => {
      finishPreviewNarration(narration);
      streamChoices();
    });
  }, [startCommandPreview, replaySchedule, pushPreviewNarration, finishPreviewNarration, fadeReveal, fadeRevealActive]);

  // Set once the turn function exists, below.
  const runTurnTestRef = useRef<(profileName?: string) => void>(() => {});

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
    if (parsed.command === "choices" && parsed.args[0] === "test") {
      // /choices test [burst|steady|slow|fast|erratic] — the profile paces the narration.
      runChoicesTest(parsed.args[1]);
      return true;
    }
    if (parsed.command === "turn" && parsed.args[0] === "test") {
      // /turn test [burst|steady|slow|fast|erratic] — a real turn on canned replies; the profile paces the narration.
      runTurnTestRef.current(parsed.args[1]);
      return true;
    }
    toast.info(`Unknown command: /${parsed.command}`);
    return true;
  }, [runMarkdownTest, runChoicesTest]);

  // Clear any running command preview when this view unmounts.
  useEffect(() => () => {
    if (commandTimer.current !== null) clearInterval(commandTimer.current);
  }, []);

  useEffect(() => {
    setCharacterData(initialCharacterData);
  }, [initialCharacterData, setCharacterData]);

  const [isTTSModalOpen, setIsTTSModalOpen] = useState(false);
  // Latches on the first open and stays set: the loaded model lives in the modal's state.
  const [ttsRequested, setTtsRequested] = useState(false);
  useEffect(() => {
    if (isTTSModalOpen) setTtsRequested(true);
  }, [isTTSModalOpen]);
  const [ttsLoaded, setTtsLoaded] = useState(false);
  const [ttsGenerating, setTtsGenerating] = useState(false);
  const [ttsProgress, setTtsProgress] = useState<TTSProgress | null>(null);
  const ttsModalRef = useRef<TTSModalHandle>(null);
  // This turn's scene-list inputs, read by the narration's scene-list listener (which lives at component
  // scope, not inside the turn function): the planner cast (null in Off/Inline) and the prior-narration
  // reveal corpus. Set just before the narration request each turn.
  const sceneListCtxRef = useRef<{ cast: DirectorCastMember[] | null; prior: string }>({ cast: null, prior: "" });
  const userTurnAddedRef = useRef(false); // whether this turn's user message has been appended to history yet
  const currentTurnIdRef = useRef(""); // stable id for the in-progress turn, stamped into its assistant JSON
  // The turn a `player.tell` belongs to while a sent turn runs; between turns a tell joins the latest one (Q53).
  const tellTurnRef = useRef<string | null>(null);
  // The prompt host of one run: its tells keep the run's timing (Q54), a toast shows at once, asks go to the line.
  const playPrompts = useCallback((timing: RunTiming): ScriptPromptHost => noticeHost(scriptPrompts, {
    onTell: (text) => {
      const turnId = tellTurnRef.current ?? latestTurnId(fullMessageHistoryRef.current);
      if (turnId) setScriptTells((prev) => addTell(prev, turnId, { text, timing }));
    },
    onToast: (text) => { toast.info(text); },
  }), [setScriptTells]);
  // This turn's dictionary activation, computed at narration-assembly time and consumed by the narration
  // request's AI-context capture (reset per turn so a turn without one never reuses a stale report).
  const pendingDictionaryDebugRef = useRef<DictionaryDebug | null>(null);
  // This turn's captured reasoning (native `reasoning` stream field + inline <think>) + think duration (ms),
  // set by the narration request's stream and read into the committed turn JSON. Also drives the live block.
  const turnReasoningRef = useRef<{ text: string; ms: number }>({ text: "", ms: 0 });
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

  // Refresh button: regenerate for `text` (default: the current text); if no model is loaded, open the modal.
  const handleRegenerateTTS = async (text?: string) => {
    const ok = await generateTTS(text);
    if (!ok) setIsTTSModalOpen(true);
  };
  const [selectedEntity, setSelectedEntity] = useState<string | null>(null);
  const [isEntityModalOpen, setIsEntityModalOpen] = useState(false);
  const [ambientSound, setAmbientSound] = useState<MediaAsset | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  // Filing needs an account, so the in-game entry point is only offered to someone signed in.
  const [showBugReport, setShowBugReport] = useState(false);
  const canReportBug = COMMUNITY_ENABLED && Boolean(AuthService.token);

  // Lend that composer to the account-deletion flow, which stands above this screen and tells a
  // suspended account to ask the team here. The Privacy Policy prompt can raise the flow mid-game, so
  // without this the step names Feedback on a screen with no way to reach it.
  const { setFeedbackOpener } = useAccountDeletion();
  useEffect(() => {
    setFeedbackOpener(() => setShowBugReport(true));

    return () => setFeedbackOpener(null);
  }, [setFeedbackOpener]);
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
  const [aiGateShown, setAiGateShown] = useState(false);
  // The gate's Continue action after setup finished.
  const handleAiGateReady = useCallback(() => setAiGateOpen(false), []);

  // --- Entry dialogs ---------------------------------------------------------------------------------
  // nextEntryDialog picks one at a time; a lower one waits until the one above it closes.
  const demoAINoticeRef = useRef<DemoAINoticeHandle>(null);
  const openDemoAIDialog = useCallback(() => demoAINoticeRef.current?.open(), []);
  const demoAIDue = useDemoAIDialogPending();
  // 'waiting' until this entry settles the Demo AI dialog, so a later switch to the Demo AI shows nothing.
  const [demoAIEntry, setDemoAIEntry] = useState<DemoAIEntryState>('waiting');
  const settleDemoAIEntry = useCallback(() => setDemoAIEntry((s) => (s === 'waiting' ? 'done' : s)), []);
  const handleDemoAIEntryDone = useCallback(() => setDemoAIEntry('done'), []);
  const settingsRequestPending = settings.settingsRequest !== null;
  const nextEntry = nextEntryDialog({
    aiGateDue: aiReachable === null ? null : aiReachable === false && !aiGateShown,
    demoAIPending: demoAIEntry === 'waiting' && demoAIDue,
    readmePending,
  });
  useEffect(() => {
    if (nextEntry === 'aiGate') {
      setAiGateShown(true);
      setAiGateOpen(true);
      // The gate takes this entry's turn; the seen-key stays unset, so the Demo AI dialog shows next entry.
      settleDemoAIEntry();
    } else if (nextEntry === 'demoAI') {
      setDemoAIEntry('open');
    } else if (nextEntry === 'readme') {
      // Connect an AI opens Settings, so the readme waits for it too, from the request on.
      if (aiGateOpen || demoAIEntry === 'open' || isSettingsOpen || settingsRequestPending) return;
      setReadmePending(false);
      setShowReadmeModal(true);
    } else if (aiReachable !== null) {
      settleDemoAIEntry();
    }
  }, [nextEntry, aiGateOpen, demoAIEntry, isSettingsOpen, settingsRequestPending, aiReachable, settleDemoAIEntry]);

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
      case 'demoAI': demoAINoticeRef.current?.open(); break;
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
      if (!fx?.save) return;
      // Seed the fixture as an id-keyed record and load it by that id.
      const id = randomUUID();
      await putSaveRecord({ ...(fx.save as unknown as Record<string, unknown>), id, name: fx.saveName } as unknown as SaveRecord);
      await loadGame(id, locations, stats, codeEntities.world, worldOverview.vrmStore);
    })();
  }, [devRoute?.fixture, locations, stats, codeEntities, loadGame, worldOverview.vrmStore]);
  const imageAttachments = useImageAttachments();
  const mounted = useMountedRef();
  // DEV dev-router: `attach=sample` stages attached images once the game has a committed turn, through the
  // real attach path. Tree-shaken in prod.
  const devAttachLoadedRef = useRef(false);
  useEffect(() => {
    if (!import.meta.env.DEV || devRoute?.attach !== DEV_ATTACH_SAMPLE || devAttachLoadedRef.current) return;
    const lastTurn = fullMessageHistory.findLast((m) => m.role === "assistant");
    const turnId = lastTurn && parseTurnContent(lastTurn.content)?.turnId;
    if (!turnId) return;
    devAttachLoadedRef.current = true;
    void (async () => {
      const files = await Promise.all(["1", "2", "3", "4"].map(async (n) =>
        new File([await (await fetch(`/thumbnails/${n}.jpg`)).blob()], `sample-${n}.jpg`, { type: "image/jpeg" })));
      const { pending } = await addToPending([], files);
      if (!mounted.current) return;
      setPendingAttachments(pending.slice(0, 2));
      setActionAttachments((prev) => setTurnAttachments(prev, turnId, pending.slice(2)));
    })();
  }, [devRoute?.attach, fullMessageHistory, mounted, setPendingAttachments, setActionAttachments]);
  // Images, tells and script pins belong to turns in the history. Between turns, drop the ones whose turn failed, rolled back or
  // was re-generated. The controller marks a running turn at once: a regenerate starts inside an effect, and
  // its user message can commit before `isWaitingForAI` does.
  useEffect(() => {
    if (isWaitingForAI || abortControllerRef.current) return;
    setActionAttachments((prev) => pruneAttachments(prev, fullMessageHistory));
    setScriptTells((prev) => pruneTells(prev, fullMessageHistory));
    setMemoryNotes((prev) => pruneScriptPins(prev, fullMessageHistory));
  }, [isWaitingForAI, fullMessageHistory, setActionAttachments, setScriptTells, setMemoryNotes]);
  const [isEditingWorld, setIsEditingWorld] = useState(false);
  const [uiHidden, setUiHidden] = useState(false); // hide all panels/buttons to reveal the background image
  const [showEditorExitPrompt, setShowEditorExitPrompt] = useState(false);
  const [lastPromptChars, setLastPromptChars] = useState(0);
  const [suggestedLocation, setSuggestedLocation] = useState<GameLocation | null>(null);
  // The entities whose "come along" waits on the offered move: Go brings them, Dismiss drops them.
  const entityOfferRef = useRef<EntityMoveOffer>(NO_ENTITY_OFFER);
  // The peel-off of the turn that made the offer, so Go creates the follower it promised.
  const followerPeelRef = useRef<{ peelOff: PeelOff; turnId: string } | undefined>(undefined);
  /** Where tracked entities and runtime characters stand, and who follows the player. */
  const liveFollowerState = (): FollowerState => ({
    positions: { ...runtimePositions(discoveredEntities), ...entityPositions }, followers: entityFollowers,
  });
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
  const debugSearchInputRef = useRef<HTMLInputElement>(null);
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
    setGlobalStats((prevStats) =>
      prevStats.map((stat) =>
        stat.name === name
          ? { ...stat, value: Math.max(stat.min, Math.min(stat.max, stat.value + delta)) }
          : stat,
      ),
    );
  }, [setGlobalStats]);
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
    // The live thought belongs to a discarded turn; the now-latest turn shows its own saved one.
    setLiveReasoning({ text: "", ms: 0, active: false });
  };

  /** Roll back to `page` (a Chat bubble's own turn), or to the viewed page. */
  const handleRollback = (page = currentPage) => {
    if (page >= totalPages) return;
    const targetState = rollbackState(gameStates, page);
    if (!targetState) return;
    // Restore the target turn's mechanical state, but keep the live narration + notes: the snapshot's frozen
    // history/notes predate any edit the player made after the turn, so re-injecting them would revert those
    // edits. Narration is rewound by slicing the live flat history to the rolled-back page instead.
    const success = loadGameState(targetState, locations, { keepLiveHistory: true });
    if (!success) return;
    // A render still in flight targets a turn this rollback discards — stop it, or its finished image
    // would land back under the dead turn id (and ride into any opted-in save, invisible and unprunable).
    cancelSceneImage();
    rewindHistoryToPage(page);
    setUserPage(null); // the rolled-back turn is now the latest — resume following it
    // Seed the live notes scratchpad from the rolled-back turn's own notes (per-turn notes live on the
    // message, and keepLiveHistory skips the snapshot's notes) so a later re-generate/action uses them.
    // A turn that froze no notes (empty at finalize, or a stopped turn) falls back to the snapshot's
    // scratchpad — same resolution the paged view uses (viewNotes).
    setPlayerNotes(parseTurnContent(fullMessageHistory[pageAssistantIndex(page, messagesPerPage)]?.content ?? '')?.notes ?? targetState.playerNotes ?? '');
    addSystemLogEntry("Rolled back to previous game state");
    // Mark the AI-context entries for the turns this rollback discarded (those after the page we
    // rolled back to). States after the current page are kept, allowing future "redo" functionality.
    setDebugTurns((prev) => markPrunedTurns(prev, page));
  };

  // Export the whole playthrough's narration as a plain-text or Markdown file (user picks the format
  // via the export dialog). Same sanitized text either way — format only sets the extension + MIME.
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);

  // --- Surface requests ------------------------------------------------------------------------------
  const surfaceNav = useSurfaceNav();
  // What follows the in-game editor's unsaved prompt: the rest of the request, or its refusal.
  const editorLeave = useRef<{ then: () => void; cancel: () => void } | null>(null);
  // The open editor's save and discard, which run through its autosave.
  const editorExit = useRef<EditorExit | null>(null);
  // Taken as the prompt opens: an autosave wrote the world during this visit.
  const [editorPromptAutoSaved, setEditorPromptAutoSaved] = useState(false);
  // A request for the main menu, waiting on the leave prompt. Leaving keeps it pending for the menu.
  const [leaveForSurface, setLeaveForSurface] = useState<{ clear: () => void } | null>(null);
  // Set by the leave prompt's Confirm, so the close that follows it is not read as a refusal.
  const leavingForSurface = useRef(false);
  /** Closes the in-game editor, after its unsaved prompt when it holds edits, then runs `then`. */
  const askEditorLeave = (then: () => void, cancel: () => void) => {
    if (!isEditingWorld) { then(); return; }
    if (!isWorldDirty) { setIsEditingWorld(false); then(); return; }
    editorLeave.current = { then, cancel };
    setEditorPromptAutoSaved(editorExit.current?.autoSaved ?? false);
    setShowEditorExitPrompt(true);
  };
  const askEditorLeaveRef = useRef(askEditorLeave);
  askEditorLeaveRef.current = askEditorLeave;
  // A clean world waits for a running save, so the store matches disk when the editor closes. The save can
  // leave the world dirty, so the render after it decides.
  const leaveEditorThen = (then: () => void, cancel: () => void) => {
    const exit = editorExit.current;
    if (isEditingWorld && !isWorldDirty && exit) exit.afterSavesRender(() => askEditorLeaveRef.current(then, cancel));
    else askEditorLeave(then, cancel);
  };
  /** Takes what waits on the editor prompt, so its answer runs it once. */
  const takeEditorLeave = () => {
    const pending = editorLeave.current;
    editorLeave.current = null;
    return pending;
  };
  // The two-tab dialog replaces the prompt, and refuses what waited on it: after its answer, the question is stale.
  useEffect(() => {
    if (!worldChangedElsewhere || !showEditorExitPrompt) return;
    setShowEditorExitPrompt(false);
    const pending = editorLeave.current;
    editorLeave.current = null;
    pending?.cancel();
  }, [worldChangedElsewhere, showEditorExitPrompt]);
  const openSurfaceHere = (steps: SurfaceSteps) => {
    surfaceNav.land(steps);
    switch (steps.dialog) {
      case null:
        if (isMobile && stepTab(steps, 'gameViewer')) setMobilePanel('character');
        // Every game screen target sits in the story panel.
        else if (isMobile && targetRoute(steps)) setMobilePanel('game');
        break;
      case 'settings': {
        const landing = settingsLanding(steps);
        if (landing.tab) setSettingsTab(landing.tab);
        if (landing.endpointTab) setSettingsEndpointTab(landing.endpointTab);
        // The request replaces an earlier prompt jump, which would otherwise win once the landing clears.
        setSettingsPrompt(undefined);
        setIsSettingsOpen(true);
        break;
      }
      case 'worldEditor': setIsEditingWorld(true); break;
      case 'export': setIsExportModalOpen(true); break;
      case 'location': setIsLocationModalOpen(true); break;
      case 'aiContext': setIsDebugOpen(true); break;
      case 'demoAI': demoAINoticeRef.current?.open(); break;
    }
  };
  useSurfaceOpenRequest((steps, clear) => {
    // Leaving asks first, so a refusal leaves an open editor and its edits as they are.
    if (steps.view === 'mainMenu') {
      setLeaveForSurface({ clear });
      return;
    }
    clear();
    // Settings and the World Editor open over the editor; a surface the page lands closes it.
    if (landsOnPage(steps)) leaveEditorThen(() => openSurfaceHere(steps), () => {});
    else openSurfaceHere(steps);
  });
  const exportStory = (format: 'txt' | 'md') => {
    const story = storyText(fullMessageHistory);
    const type = format === 'md' ? 'text/markdown' : 'text/plain';
    const slug = (worldOverview?.name || "world").replace(/[^a-z0-9]+/gi, "-").toLowerCase();
    downloadBlob(new Blob([story], { type }), `story-${slug}.${format}`);
    setIsExportModalOpen(false);
  };

  // Re-generate the current turn: restore the snapshot from *before* it (which also rewinds the
  // message history past it), then re-send the same player action for a fresh response. The re-send is
  // deferred via `pendingTurnNonce` below — sendGameAction reads game state from its render's closure,
  // so it must run after loadGameState has committed, not synchronously alongside it.
  const pendingTurnRef = useRef<PendingTurn | null>(null);
  // The real (editable) opening text last submitted, kept so re-generating the opening can re-fill the box
  // with it — history stores only the "START GAME" proxy (parity), which would otherwise lose the edit.
  const openingActionRef = useRef<string>("");
  // A new game draws at seed; a loaded save draws on first need.
  const openingSessionRef = useRef<OpeningSession>(newOpeningSession());
  // The Custom Persona entity carrying the player's entry, so a Self row it owns names the player.
  const customPersona = customPersonaEntity(traitEntities);
  /** The rows this playthrough draws from. The picked entities come off the initial-turn seed, so a loaded
   *  save rebuilds the same pool. */
  const sessionPool = () => openingPool({
    overview: worldOverview,
    entities,
    locations,
    startingLocationId: openingSessionRef.current.startLocationId ?? pageOneLocationId(fullMessageHistory),
    picked: pickedAtStart(discoveredEntities),
    persona,
    customPersona,
  });
  // An Opening Narration is page one, never a directive to the narrator, so a session that drew one reads
  // an action row here.
  const openingCue = (): DrawnOpening => {
    const session = openingSessionRef.current;
    if (session.drawn?.opening.kind === "action") return session.drawn;
    return (session.cue ??= drawPoolEntry(sessionPool().filter((row) => row.opening.kind === "action"), Math.random));
  };
  /** A drawn row's text, with its owning entity as the Character Name. */
  const resolveDrawn = (drawn: DrawnOpening): string => resolveOpening(drawn.opening.text, {
    owner: openingOwner(drawn.ownerId, [...entities, ...pickedAtStart(discoveredEntities)], persona, customPersona),
  });
  /** The `turn.action` a re-rolled turn reads: history's "START GAME" proxy stands for the opening cue. */
  const rerolledAction = (action: string): string => {
    if (action !== "START GAME") return action.trim();
    if (openingTurnAction !== null) return openingTurnAction;
    return openingSessionRef.current.drawn?.opening.kind === "narration" ? "" : resolveDrawn(openingCue()).trim();
  };
  // Snapshot of the pre-game state (before the opening turn), so page 1 can also be re-generated —
  // gameStates only holds post-turn snapshots, so the first turn has no predecessor there. Captured in
  // sendGameAction on the first turn.
  const initialStateRef = useRef<ReturnType<typeof saveCurrentGameState> | null>(null);
  // Whether the opening turn still runs the At Game Start scripts: this view seeded a new game and no save has
  // loaded since. A regenerated page one on a loaded save rebuilds its baseline from state that already holds
  // the start writes, so it must not run them again.
  const newPlaythroughRef = useRef(false);
  useEffect(() => {
    if (saveLoads > 0) newPlaythroughRef.current = false;
  }, [saveLoads]);
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
    void autosaveGame(worldOverview.name, worldId ? String(worldId) : undefined, totalPages, autosaveSlots);
    // Only re-fire on a new committed turn — reading the latest setting/world at fire time is intentional.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [turnCommitNonce]);

  // Ask once, after enough turns, whether this downloaded world is worth a like. On the same committed
  // turn as the autosave above, so a save restored past the threshold is asked on its next turn.
  const likeAsk = useLikePrompt(worldId ? String(worldId) : null, turnCommitNonce, fullMessageHistory);
  const [pendingTurnNonce, setPendingTurnNonce] = useState(0);

  /** Re-generate the turn on `page`, which Chat passes as the latest page. */
  const handleRegenerate = (page = currentPage) => {
    if (!canRegenerate(page, totalPages)) return;
    // Re-generating the opening turn (page 1) restores the pre-game state, not a gameStates entry. On a
    // loaded save that snapshot was never captured (initialStateRef is only set during a live first turn),
    // so reconstruct a pre-opening baseline from the current state with its history emptied — re-sending
    // START GAME from there re-captures initialStateRef and regenerates the opening.
    const previousState =
      regenerateState(gameStates, initialStateRef.current, page) ??
      (page === 1 ? { ...saveCurrentGameState(), fullMessageHistory: [] } : null);
    const action = lastTurnAction(fullMessageHistory);
    if (!previousState || action === null) return;
    // Page one draws again, before anything is restored: a pool of one Opening Narration has nothing else
    // to show, so the page stays as it is. The draw is recorded only once the restore has succeeded.
    const session = openingSessionRef.current;
    const redraw = page === 1 ? drawUnseenOpening(sessionPool(), session.shown, Math.random) : null;
    const redrawText = redraw ? resolveDrawn(redraw) : "";
    if (redraw?.opening.kind === "narration" && redrawText === pageOneNarration(fullMessageHistory)) return;
    // Restore the prior turn's mechanical state but keep the live narration + notes (see handleRollback),
    // rewinding the flat history to just before the turn being re-rolled. The re-send appends a fresh turn.
    if (!loadGameState(previousState, locations, { keepLiveHistory: true })) return;
    // Stop a render aimed at the turn being re-rolled: left running, it would finish into a dead turn id
    // AND overlap the re-roll's language-model request on the one GPU.
    cancelSceneImage();
    rewindHistoryToPage(page - 1);
    // The notes scratchpad is left alone: regen only targets the latest page, where the live scratchpad is
    // always at least as fresh as the message's frozen notes (a stopped turn freezes none at all —
    // re-seeding from the message here wiped the player's notes).
    // Mark the current turn's AI-context entry as superseded; sendGameAction appends a fresh one.
    setDebugTurns((prev) => markRegeneratedTurn(prev));
    // Re-generating the opening (page 1) returns to the not-started state. An Opening Narration then starts
    // the game again on its own; an Opening Action fills the box for the player to edit and submit.
    if (redraw) {
      const priorOpening = session.drawn;
      openingSessionRef.current = {
        ...session, drawn: { opening: redraw.opening, ownerId: redraw.ownerId }, shown: redraw.shown,
      };
      setIsGameStarted(false);
      if (redraw.opening.kind === "narration") {
        pendingTurnRef.current = { action: "START GAME", writtenNarration: redrawText };
        setPendingTurnNonce((n) => n + 1);
        return;
      }
      // History holds the "START GAME" proxy, so the player's own edit of this same opening comes back from
      // the ref. A save from before the proxy kept the real text in history, and its first redraw keeps it.
      const sameRow = priorOpening?.opening === redraw.opening;
      setPlayerInput(
        priorOpening === null && action !== "START GAME" ? action : (sameRow && openingActionRef.current) || redrawText,
      );
      return;
    }
    pendingTurnRef.current = { action, resentAttachments: latestTurnAttachments(actionAttachments, fullMessageHistory) };
    setPendingTurnNonce((n) => n + 1);
  };

  // Read the committed latest turn + its originating action, or null when a partial re-generate can't run
  // (busy, not on the latest page, or the turn can't be parsed).
  const partialRegenTarget = (page = currentPage) => {
    // A running scene render blocks these too: it holds the graphics card, and unlike rollback /
    // re-generate these keep the turn, so its picture is still the correct one and must not be canceled.
    if (isWaitingForAI || sceneImageJob !== null || !canRegenerate(page, totalPages)) return null;
    const last = fullMessageHistory[fullMessageHistory.length - 1];
    if (!last || last.role !== "assistant") return null;
    const prev = parseTurnContent(last.content);
    const action = lastTurnAction(fullMessageHistory);
    if (!prev || action === null) return null;
    return { prev, action };
  };

  // Replace one slice of the latest assistant turn's JSON, preserving every other field.
  const patchLatestTurn = (patch: Partial<AITurnResult>) => {
    setFullMessageHistory((history) => withLatestTurnPatched(history, patch));
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
      // A stats re-roll holds its turn's reading; whatever ended the run, the next run reads between turns.
      turnReadRef.current = null;
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
    // The new list streams in from empty; replacing the old one row by row would show it at once.
    setChoices([]);
    void runPartialRegen(async (signal) => {
      const presentNames = new Set([
        ...(prev.entities ?? []),
        ...recentParticipants(fullMessageHistory, CHOICES_PRESENCE_TURNS - 1),
      ]);
      const sceneEntities = allEntities.filter((e) => presentNames.has(e.name));
      let response = "";
      try {
        response = await requestChoices(
          contextValues(),
          sceneEntityOverride(currentLocation, sceneEntities),
          action,
          prev.narration ?? "",
          signal,
        );
      } finally {
        // A stopped or failed re-roll puts the turn's own choices back.
        if (signal.aborted || !response) setChoices(prev.choices ?? []);
      }
      if (signal.aborted) return;
      const choices = parseChoices(response);
      setChoices(choices);
      patchLatestTurn({ choices });
      armTurnSnapshot();
    });
  };

  // Re-roll only the stat changes for the latest turn. Deltas are applied onto the pre-turn baseline
  // (not the current, already-changed stats), so repeated re-rolls don't stack.
  const handleRegenerateStats = (page = currentPage) => {
    const target = partialRegenTarget(page);
    if (!target || !statUpdatesEnabled || requestStatCount === 0) return;
    const preTurnState = regenerateState(gameStates, initialStateRef.current, page);
    if (!preTurnState?.globalStats) return;
    const preTurn = liveSnapshotOf(preTurnState);
    const { prev, action } = target;
    void runPartialRegen(async (signal) => {
      // Mirror the live turn's stat commit: reset the per-turn bar deltas, apply max-cap + value deltas onto
      // the pre-turn baseline, then re-run the regen/starvation tick (thresholded on that baseline) WITHOUT
      // re-advancing game time. Not awaited, so regen stacks before stat code — the same order the live turn
      // uses. Without this the re-roll dropped the turn's regen and left stale held deltas on the bar.
      holdStatDeltas(null, {});
      // The turn's own measured duration, so a re-roll reproduces the regen and stat code the turn actually
      // charged rather than a flat hour (unmeasured turns store nothing and fall back to that hour anyway).
      // `gameTime` already includes this turn — only the latest turn is ever re-rolled — so it is the
      // end-of-turn elapsed the live pass used, and code re-derives the same value instead of drifting.
      const turnHours = prev.timeDelta ?? FLAT_HOURS_PER_TURN;
      // The turn's code writes go back to the pre-turn Code Pins and traits, so stat code re-makes them once.
      // Entity stats too: no ask resets them, so without this the replayed regen and code would stack.
      const toPreTurn = () => {
        resetEntityStats(preTurn.entityStats ?? {});
        setCodePins(preTurn.codePins ?? {});
        setGlobalTraits(preTurn.globalTraits);
        setDisabledTraitIds(preTurn.disabledTraitIds ?? []);
        setAppliedTraitValues(preTurn.appliedTraitValues ?? {});
        setCascadeOffTraitIds(preTurn.cascadeOffTraitIds ?? {});
        setOwnedTraits(preTurn.ownedTraits ?? {});
      };
      toPreTurn();
      // The replayed turn is still the latest in history, so its number is the closed count.
      turnReadRef.current = { action: rerolledAction(action), number: closedTurns(fullMessageHistoryRef.current) };
      // A re-roll replays the whole turn, so the before box runs again first, on the clock as it read at
      // turn start. Its writes are the baseline the asks then land on, and the request reads them.
      beforeBoxDeltasRef.current = {};
      // The replay tells again, so its timings' tells give way to the new ones (Q54); an abandoned re-roll puts them back.
      const tellTurn = latestTurnId(fullMessageHistoryRef.current);
      const priorTells = turnTells(scriptTells, tellTurn);
      if (tellTurn) setScriptTells((now) => withoutTimings(now, tellTurn, REROLLED_TIMINGS));
      // Page one of a fresh game restores the pre-start state, so the start scripts run again first.
      // A stat re-roll keeps the turn's location, clock and cast, so the replay's world writes drop.
      let { written } = await runBeforeAI(
        preTurn.globalStats ?? [], { deltaHours: 0, elapsedHours: gameTime - turnHours, calendar }, preTurn,
        page === 1 && newPlaythroughRef.current,
      );
      // The box has written by the time the request can be stopped, so every exit that abandons the
      // re-roll puts the pre-turn state back rather than leaving those writes over a turn with no asks.
      let committed = false;
      try {
        if (signal.aborted) return;
        // The turn's Tool effects replay (Q39): its On Call writes land as saved, with no script run (Q41), and
        // its After calls fire again with the batch.
        const { onCallWrites, afterTriggers } = replayedToolEffects(worldTools, prev.toolCalls ?? []);
        const onCalled = onCallWrites.length ? prepareTurnStartCode(written ?? preTurn) : null;
        if (onCalled) {
          written = onCalled.finish(await runStatCodeTurn({ ...onCalled.turn, replayed: onCallWrites, triggersOnly: true })).written ?? written;
        }
        if (signal.aborted) return;
        const base = written ?? preTurn;
        const snapshot = statRequestFor(enabledStats(
          written ? resolveStatNames(written.globalStats ?? [], resolvePH) : globalStatsRef.current,
          statEnabledRef.current,
        ), presentEntitiesOf(splitParticipants(prev.entities ?? [], liveScene(null, turnCodeView(written)).entities, []).diary), base.entityStats ?? {});
        // A turn with nothing to ask about replays its regen and code over no asks, as the live turn did.
        const parsed: StatResponse = statRequestReady(snapshot)
          ? readStatResponse(await requestStats(
            contextValues(null, turnCodeView(written), snapshot), snapshot, action, prev.narration ?? "", signal,
          ), snapshot)
          : { requestId: snapshot.id, updates: [], diagnostics: [] };
        if (signal.aborted) return;
        const statChanges = statResponseChanges(parsed);
        const statCode = applyStatChanges(parsed, {
          deltaHours: turnHours,
          elapsedHours: gameTime,
          calendar,
        }, base, base.globalStats, afterTriggers);
        applyRegenTick(turnHours, base.globalStats);
        patchLatestTurn({ stat_changes: statChanges });
        committed = true;
        // Code writes land after the sandbox settles; the settle and the snapshot wait for them.
        const run = await statCode;
        await settleTurn(run?.gateStats ?? null);
        armTurnSnapshot();
      } finally {
        if (!committed && written) {
          beforeBoxDeltasRef.current = {};
          setGlobalStats(preTurn.globalStats ?? []);
          toPreTurn();
        }
        if (!committed && tellTurn) setScriptTells((now) => setTurnTells(now, tellTurn, priorTells));
      }
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
  // cheaply — the AI call itself lives in the Background Pass Queue below. Only AGED candidates filter
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
  // contextValues is declared further down (it depends on callbacks defined below), so the history
  // builder reaches it through a ref rather than the closure — same dodge as sendAiRequestRef.
  const contextValuesRef = useRef<(loc?: GameLocation | null) => TokenValues>(() => ({}));

  // Narration's resolved target backs every budget the story history is trimmed against — the window and the
  // reserved output belong to whichever endpoint narration actually sends to, not the globally-selected one.
  // The planner resolves its own below, since routing may point the two at very differently-sized models.
  const narrationEndpoint = useMemo(() => resolveEndpointForKind('narration'), [resolveEndpointForKind]);
  const contextWindow = narrationEndpoint.contextWindow;

  // The per-call settings snapshot the AI Request Spec layer reads. Every engine-shaped decision
  // (sampler resolution, the reasoning budget/effort split, the `/no_think` switch, penalty spellings)
  // lives behind that seam; this component only states the values.
  const aiSnapshot = useAiSettingsSnapshot();
  const snapshotFor = (target: AiEndpointTarget): AiSettingsSnapshot => ({ ...aiSnapshot, resolveTarget: () => target });
  // The reserve holds the answer plus the prompt's own budget; the length guidance reads the answer alone.
  const narrationCaps = outputCaps(snapshotFor(narrationEndpoint), { requestType: 'narration' });
  const narrationAnswerCap = narrationCaps.answerCap;
  const reserveTokens = outputReserve(narrationCaps.reserve);

  const getTrimmedMessageHistory = useCallback((
    promptTokens = 0, action = "", relevanceScores: Map<string, number> | null = null, actionVec: Float32Array | null = null, liveRecall = false,
    turnView: HistoryTurnView = {},
  ): { messages: ChatMessage[]; runs: AnatomyRun[][]; picks?: HistoryPicks } => {
    const turns = parseEffectiveTurns(fullMessageHistory);
    if (memoryDigests) {
      const keywords = extractKeywords(action, dictionary);
      // Entities the action references (case-insensitive — actions are lowercase) drive participation rehydration.
      const actionEntities = findEntityNames(action, allEntities, { requireCapital: false });
      const rehydrateCap = Math.round(Math.max(0, contextWindow - promptTokens - reserveTokens) * 0.25);
      // Semantic rehydration: rank the old scenes this action returns to (threshold + near-duplicate
      // guard in lib/semanticRehydration). Floor/band split here is the budget-free approximation of
      // buildBandedHistory's; it re-validates band membership before spending tokens.
      const select = semanticRehydration && semanticMemory && actionVec ? (blocked: ReadonlySet<string>) => {
        const floorCount = Math.min(narrationVerbatimTurns, turns.length);
        const floorTurns = turns.slice(turns.length - floorCount);
        const drop = getMilestoneDrop(turns);
        const band = turns.slice(0, turns.length - floorCount).filter(
          (t) => t.summary?.trim() && !(drop && t.turnId && drop.has(t.turnId)),
        );
        return selectSemanticRehydrations(band, floorTurns, actionVec, embedVectorsRef.current, blocked);
      } : null;
      const book = { lastRecallTurn: lastRecallTurnRef.current, lastFired: rehydrateLastFiredRef.current };
      // A re-render keeps the picks its turn's first trim made, so the recall records once.
      const picks = pickHistoryRecall({
        picks: turnView.picks, live: liveRecall, turnCount: turns.length, book, sticky: lastBandIdsRef.current, select,
      });
      lastRecallTurnRef.current = book.lastRecallTurn;
      const { semanticRehydrate, stickyIds } = picks;
      // The recap's "where things stand" closer: mid-scene anchor (location + recent participants) plus
      // the player's standing notes. Probed on real failure turns (now-line-probe.mjs): removed the
      // scene-reset / roleplay-identity-inversion class entirely; without it the recap reads as backstory.
      // In-world time (experimental): each remembered moment is stamped with when it happened — the recap
      // otherwise reads as an undated chronicle (docs-internal/designs/time-system/design.md).
      const stamp = timeContext ? buildStamper({ nowHours: turnView.nowHours ?? gameTime, hoursAt: hoursByPosition(turns), calendar }) : undefined;
      // Assembled from the same context values every other prompt uses: each chip carries its own wording
      // in its affixes and disappears with its value, so any combination still reads as a sentence.
      const nowLine = currentLocation ? renderPromptTemplate(nowLinePrompt, turnView.values ?? contextValuesRef.current()) : undefined;
      const { messages, runs, counts, bandTurnIds, rehydratedTurnIds } = buildBandedHistory({
        turns,
        contextWindow,
        promptTokens,
        maxTokens: reserveTokens,
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
        stickyIds,
        semanticRehydrate,
        rehydratePrompt: rehydrateUserPrompt,
        notes: effectiveNotes,
        stamp,
        stripMedia,
      });
      lastBandCountsRef.current = counts;
      // `liveRecall` is the real turn's call — the AI-context preview builds the same band with it off, so
      // gating here keeps the Memory panel reporting what was actually sent rather than what a preview drew.
      // A turn's re-render is what was sent, so the panel follows it too.
      if (liveRecall || turnView.picks) {
        lastBandIdsRef.current = new Set(bandTurnIds);
        setContextMemoryIds(bandTurnIds);
        setRehydratedMemoryIds(rehydratedTurnIds);
      }
      return { messages, runs, picks };
    }
    lastBandCountsRef.current = null;
    // Digests off: no band to anchor into, so the player's own memories lead as a standing block.
    return buildVerbatimHistory(turns, contextWindow, promptTokens, reserveTokens, effectiveNotes, recapUserPrompt, stripMedia);
  }, [stripMedia, fullMessageHistory, contextWindow, reserveTokens, memoryDigests, semanticMemory, semanticRehydration, semanticBandCap, dictionary, allEntities, narrationVerbatimTurns, getMilestoneDrop, recapUserPrompt, rehydrateUserPrompt, currentLocation, parseEffectiveTurns, effectiveNotes, timeContext, gameTime, calendar, nowLinePrompt, setContextMemoryIds, setRehydratedMemoryIds]);

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
      const vecs = await embedTexts([action], EMBED_BOUND_MS);
      return vecs.length > 0 ? vecs[0] : null;
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

  // A stat is live unless its author started it off or an active trait switched it off. Disabled stats keep
  // their value in `globalStats` — they are filtered out of everything that reads or moves them instead, so
  // switching the trait back on resumes exactly where the stat left off.
  const statEnabled = useMemo(() => activeStatEnabled(globalStats, statTraits), [globalStats, statTraits]);
  const activeStats = useMemo(() => enabledStats(globalStats, statEnabled), [globalStats, statEnabled]);
  statEnabledRef.current = statEnabled;

  /** Each entity's stat traits in force under `owned`, the owned trait state they read, in `world`. */
  const entityInForceUnder = useCallback(
    (owned: OwnedTraitStates, world: TraitWorld = gatedWorld()) => (ownerId: string) => entityStatTraitsInForce(owned, world, ownerId),
    [gatedWorld],
  );
  const statEntities = useMemo(() => statOwnerEntities(codeEntities), [codeEntities]);
  /** The library in play under `world`'s persona, which a persona change's run reads before its render. */
  const libraryIn = useCallback(
    (world: TraitWorld) => libraryUnder(codeEntities.library, personaRef, world.persona),
    [codeEntities, personaRef],
  );
  /** The entity owners whose regen and code run over `values`: everyone in the playthrough, present or not.
   *  `owned` is the owned trait state their toggles read, the live one by default; `world` is the one they
   *  hold under, the live one by default. */
  const entityOwnersOf = useCallback(
    (values: EntityStatValues, owned: OwnedTraitStates = ownedTraits, world: TraitWorld = gatedWorld()) => {
      const library = libraryIn(world);
      const entities = library === codeEntities.library ? statEntities : statOwnerEntities({ world: codeEntities.world, library });
      return entityStatOwners(values, entities, world.persona, entityInForceUnder(owned, world));
    },
    [statEntities, ownedTraits, gatedWorld, libraryIn, codeEntities, entityInForceUnder],
  );
  // The latest committed entity stats, which the turn callbacks read as they read `rawGlobalStatsRef`.
  const entityStatsRef = useRef(entityStats);
  entityStatsRef.current = entityStats;
  // The entities whose stats are the player's: the played one, and the Custom Persona entity whose traits are.
  const playedEntities = useMemo(
    () => personaEntities(persona?.entity, traitEntities, personaRef), [persona, traitEntities, personaRef],
  );
  // The live stats a stat request could hold: the player's, the played entities', and every entity's that can be present.
  const requestStatCount = useMemo(
    () => activeStats.length
      + [
        ...personaStatOwners(playedEntities, entityStats, (owned) => owned, entityInForceUnder(ownedTraits), (groups) => groups),
        ...statRequestOwners(statEntities, entityStats, personaRef, (owned) => owned, entityInForceUnder(ownedTraits), (groups) => groups),
      ].reduce((n, owner) => n + owner.stats.length, 0),
    [activeStats, playedEntities, statEntities, entityStats, personaRef, entityInForceUnder, ownedTraits],
  );

  // The same derivation for a paged-back turn, so history shows the stats that were live on that turn.
  const viewActiveStats = useMemo(
    () => activeUnderTraits(
      viewStats, refreshChosenTraits(viewTraits, traits), viewDisabledTraitIds, traitOrder,
      globalRowTraits({ ownedTraits: viewOwnedTraits, entityStats: viewEntityStats }, gatedWorld()),
    ).activeStats,
    [viewStats, viewTraits, viewDisabledTraitIds, viewOwnedTraits, viewEntityStats, traitOrder, traits, gatedWorld],
  );

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
      settleStatDeltas();

      // Track regen changes
      const regenChanges: Record<string, number> = {};

      // The same tick runStatCode folds into the pipeline it hands stat code, so both read one regen.
      setGlobalStats((prevStats) => {
        const tick = applyRegen(prevStats, hours, statEnabledRef.current);
        const stats = [...tick.stats];
        const { applied } = tick;
        for (const stat of stats) {
          if (applied[stat.id] !== undefined) regenChanges[stat.name.toLowerCase()] = applied[stat.id];
        }
        return stats;
      });
      setEntityStats((prev) => withEntityRegen(prev, entityOwnersOf(prev), hours));

      // Add the regen to the chips and bands. Read when the update applies, after the stats updater filled it.
      addStatDeltas(null, regenChanges);

      // This turn's AI changes and the regen above are both still queued, so the penalty subtracts via an
      // updater, which lands on the regenerated Health rather than overwriting it. The threshold reads the
      // pre-turn Hunger (thresholdStats), which the caller passes explicitly.
      const healthLoss = starvationLoss(thresholdStats, statEnabledRef.current, hours);
      if (healthLoss !== null) {
        adjustStatByName("Health", -healthLoss);
        // The loss scales by the turn's measured hours, so it's usually fractional — the log reads to a
        // tenth rather than printing the raw float. The stat still takes the exact amount.
        addLogEntry(`You're starving! Lost ${Math.round(healthLoss * 10) / 10} health.`);
        addStatDeltas(null, { health: -healthLoss });
      }
    },
    [adjustStatByName, addLogEntry, setGlobalStats, setEntityStats, entityOwnersOf, addStatDeltas, settleStatDeltas],
  );

  const handleTimePassed = useCallback(
    (hours: number) => {
      setGameTime((prevTime) => prevTime + hours);
      // Threshold on the pre-turn stats (globalStats here is still this render's pre-commit snapshot).
      applyRegenTick(hours, globalStats);
    },
    [applyRegenTick, setGameTime, globalStats],
  );

  const getEndpointUrl = () => endpointUrl;

  // The world as this turn's passes read it, over what its code wrote and React has not rendered yet, at the
  // time its clock advances reached. Null when code moved nothing, which leaves every pass on the memoized reads.
  const turnCodeView = useCallback((over: TurnCodeState | null, elapsed?: number): SceneWrites | null => {
    if (!over) return elapsed === undefined ? null : { elapsed };
    const overPins = pinsFor(over.codePins ?? {}, {
      traits: over.globalTraits, disabledTraitIds: over.disabledTraitIds, ownedTraits: over.ownedTraits, stats: over.globalStats,
    });
    const resolve = (text: string) => resolveFor(overPins.world, text);
    const held = savedTraits(over, traits);
    return {
      ...activeUnderTraits(
        resolveStatNames(over.globalStats, resolve), held.acquired, held.disabledTraitIds, traitOrder,
        globalRowTraits({ ...held, entityStats: over.entityStats }, gatedWorld()),
      ),
      ownedTraits: over.ownedTraits ?? {},
      entityStats: over.entityStats,
      resolve,
      resolveTrait: (trait, text, owner) => resolveTraitFor(overPins, trait, text, owner),
      resolveEntity: (entity, text) => resolveEntityFor(overPins, entity, text),
      ...(elapsed === undefined ? {} : { elapsed }),
    };
  }, [pinsFor, resolveFor, resolveTraitFor, resolveEntityFor, traits, traitOrder, gatedWorld]);

  // The README is authored text shown to the player, so its chips resolve like any other.
  const readmeResolved = useMemo(() => resolvePH(readmeText), [resolvePH, readmeText]);

  // True while the story's opening hour is still unmeasured and about to be asked for — i.e. the clock is on
  // and the opening turn hasn't committed. A game that started with the clock off keeps `startHour` null
  // forever, but `isGameStarted` is true by then, so it is never treated as pending.
  const openingHourPending = aiClock && startHour === null && !isGameStarted;

  // The story clock as the Time chip reads it. Off ⇒ none, so an affixed placement (the now-line's) simply
  // vanishes and the setting needs no special case anywhere else. Also withheld until the opening hour is
  // known: on the opening turn the clock would read the untested 08:00 default, and the opening-time pass is
  // about to ask the model what time it is from that very narration. Telling it first would make the answer
  // a restatement of the guess.
  const chipTime = useMemo<ChipSceneTime | null>(
    () => (timeContext && !openingHourPending ? { elapsed: gameTime, calendar } : null),
    [timeContext, openingHourPending, gameTime, calendar],
  );
  const participants = useMemo(
    () => recentParticipants(fullMessageHistory, CHOICES_PRESENCE_TURNS),
    [fullMessageHistory],
  );
  // The world's shared placeholders: the combined list minus the ones an entity or a book owns.
  const sharedPlaceholders = useMemo(
    () => worldPlaceholders.filter((p) => !placeholderOwners.has(p.id)),
    [worldPlaceholders, placeholderOwners],
  );
  // The author's groups place the global stats, so a save made before a regrouping follows it.
  const globalStatPlacement = useMemo(
    () => ({ groups: authoredStatGroups, authored: authoredStats }),
    [authoredStatGroups, authoredStats],
  );
  // Each present owner's tree, so a cast entity's links reach the AI like its owned traits.
  const sceneTrees = useMemo(() => {
    const { global, owners } = gatedWorld();
    return { global, owners };
  }, [gatedWorld]);
  // The playthrough as a Chip Scene: the live adapter. A turn's location and a before box in flight each
  // yield their own scene.
  const liveScene = useLiveChipScene({
    overview: worldOverview.systemPrompt || "",
    stats: activeStats,
    statPlacement: globalStatPlacement,
    traits: activeTraits,
    traitGroups,
    ownedTraits,
    global: sceneTrees.global,
    owners: sceneTrees.owners,
    entityStats,
    playedEntities,
    resolve: resolvePH,
    resolveTrait: resolveTraitText,
    resolveEntity: resolveEntityText,
    persona,
    location: currentLocation,
    locations,
    connections,
    entities,
    allEntities,
    participants,
    notes: playerNotes,
    time: chipTime,
    placeholders: sharedPlaceholders,
  });

  const contextValues = useCallback((
    locationOverride?: GameLocation | null,
    /** The world under a before box's writes; absent, every value reads live state. */
    box?: SceneWrites | null,
    /** The stat pass's request: every owned stat then reads under its request key. Narration passes none. */
    statRequest?: StatRequestSnapshot,
  ): TokenValues => {
    const base = liveScene(locationOverride, box);
    const scene = statRequest ? keyedScene(base, statRequest) : base;
    // Lore activates per turn inside the narration prompt builder, so the scene-level lore blocks are
    // dropped here. The lore chip is the one in-game token the Preview tab reads from the pool's samples.
    const values = omitValues(chipValues(scene), (key) => variableForToken(key) === DICTIONARY_VARIABLE);
    // The placeholder chips this world's own custom prompts place, keyed by token. A preset places none.
    return layerValues(values, worldPromptChipValues(worldOverview, declinedWorldPrompts, scene.resolve));
  }, [liveScene, worldOverview, declinedWorldPrompts]);
  contextValuesRef.current = contextValues;

  // Scene-roster override for the entity chips: choices and re-roll prompts see only who is in the scene.
  const sceneEntityOverride = useCallback(
    (sceneLoc: GameLocation | null, sceneEntities: Entity[]): TokenValues =>
      sceneEntityChipValues(liveScene(sceneLoc), entityIdsAt(sceneLoc?.id, sceneEntities)),
    [liveScene],
  );

  // Live variable values for the Settings prompt-editor Preview tab (full-description variant, like the
  // game-text request). Only meaningful in-game, which is the only place this modal receives them.
  // What this playthrough can actually answer for. The lore blocks and the per-turn value tokens
  // (action / narration / speaking character) are assembled fresh per request, so there is nothing live to
  // show between turns — those fall through to the shared pool's samples rather than to a second set of
  // placeholder strings kept here, which is how the two copies used to drift.
  const promptPreviewValues = useMemo<TokenValues>(() => contextValues(), [contextValues]);
  // Recall searches the committed history as the narration prompt's memory reads it; digests off, no memory.
  // Its meaning match reads the drainer's vectors under the drainer's own gates.
  const toolMemorySource = useCallback(
    (): ToolMemorySource | null => (memoryDigests ? {
      history: fullMessageHistory, overrides: memoryOverrides, verbatimFloor: narrationVerbatimTurns, stripMedia,
      meaning: semanticMemory
        ? { embed: embedActionVec, vectors: embedVectorsRef.current, diaries: semanticDiaries && characterDiaries }
        : null,
    } : null),
    [memoryDigests, fullMessageHistory, memoryOverrides, narrationVerbatimTurns, stripMedia, semanticMemory, embedActionVec, semanticDiaries, characterDiaries],
  );
  // What a user Tool's script reads (Q24): the turn's start as code has left it, as an On Call World Tool reads it.
  // Set beside `prepareTurnStartCode`, once per render.
  const toolScriptSourceRef = useRef<((base: TurnCodeState | null) => ToolScriptSource) | null>(null);
  // Settings → Tools runs Try It on the playthrough, read as a Tool call in play reads it.
  const toolWorld = useCallback(() => {
    const source = toolScriptSourceRef.current?.(null);
    // A call outside the turn's requests reads between turns, even while a turn runs.
    const between = source?.state
      ? { ...source, state: { ...source.state, turn: { action: "", number: closedTurns(fullMessageHistoryRef.current) } } }
      : source;
    return buildToolSnapshot(liveScene(), dictionaries, toolMemorySource(), between);
  }, [liveScene, dictionaries, toolMemorySource]);
  // A Formaquestion Tool reads the same playthrough while the game shows; the code test reads the authored world.
  useHelpWorldSource(toolWorld, getWorldData);
  // Each request's round between its Tool calls and the next round's first token, as the called Tool names.
  const [toolLookups, setToolLookups] = useState<readonly (readonly string[])[]>([]);

  /** The prompt texts this turn's passes render from — the active preset's fields, as authored. */
  const turnPrompts = (): TurnPrompts => ({
    locationChange: locationChangePromptText || "",
    locationChangeUser: locationChangeUserPrompt,
    entityLocation: entityLocationPrompt,
    entityLocationUser: entityLocationUserPrompt,
    thinking: thinkingPrompt,
    director: directorPrompt,
    directorUser: directorUserPrompt,
    character: characterPrompt,
    storyboard: storyboardPrompt,
    narrationUser: narrationUserPrompt,
    oocDirective: oocDirectivePrompt,
    // This session's opening, resolved: an old save's history holds the sentinel rather than the text.
    openingCue: resolveDrawn(openingCue()),
    choices: resolvedChoicesPrompt,
    choicesUser: choicesUserPrompt,
    statUpdates: resolvedStatUpdatesPrompt,
    statUpdatesUser: statUpdatesUserPrompt,
    statText: statTextFor(statTextPrompts, { worldPrompt: worldStatPromptApplies }),
    summary: summaryPrompt,
    summaryUser: summaryUserPrompt,
    milestoneSelect: milestoneSelectPrompt,
    milestoneSelectUser: milestoneSelectUserPrompt,
    timePassed: timePassedPrompt,
    timePassedUser: timePassedUserPrompt,
    openingTime: openingTimePrompt,
    openingTimeUser: openingTimeUserPrompt,
    diary: diaryPrompt,
    discoverEntity: discoverEntityPrompt,
    discoverEntityUser: discoverEntityUserPrompt,
    sceneTags: sceneTagsPrompt,
    sceneTagsUser: sceneTagsUserPrompt,
  });

  /** The plan input a pass dispatched outside a turn builds its request from — the scene-tag pass, which
   *  the scene-image flow drives on a turn already stored, the background passes, the regenerates, and the
   *  choices and stats re-rolls. */
  const standalonePassInput = (): TurnPlanInput => ({
    action: "",
    isGameStarted: true,
    destinationCount: 0,
    locationCount: locations.length,
    hasCurrentLocation: !!currentLocation,
    settings: turnSettings(),
    prompts: turnPrompts(),
  });

  /** The character-note request for one character, attached to the turn that introduced them. The
   *  Background Pass Queue sends a first note; the rewrite adds what the story has shown of them since. */
  const buildDiscoverRequest = (args: {
    name: string;
    turnId: string | undefined;
    firstPassage: string;
    laterMaterial?: string[];
  }) => ({
    ...discoverEntityPass.buildRequest(standalonePassInput(), {
      ...emptyTurnMaterial({ action: "", effectiveAction: "", turnId: args.turnId ?? "", baseCtx: {}, destinations: [] }),
      ctx: contextValues(),
      narration: args.firstPassage,
      subject: { name: args.name, laterMaterial: args.laterMaterial },
    }),
    attachTurnId: args.turnId,
  });
  const buildDiscoverRequestRef = useRef(buildDiscoverRequest);
  buildDiscoverRequestRef.current = buildDiscoverRequest;

  /** The milestone selector's request over the kept and fresh digests, and the reply parser numbered to
   *  match, attached to the latest turn. */
  const buildMilestoneSelect = (kept: string[], fresh: string[], turnId: string | undefined) => {
    const material = {
      ...emptyTurnMaterial({ action: "", effectiveAction: "", turnId: turnId ?? "", baseCtx: contextValues(), destinations: [] }),
      milestone: { kept, fresh },
    };
    return {
      request: { ...milestoneSelectPass.buildRequest(standalonePassInput(), material), attachTurnId: turnId },
      parse: (reply: string) => milestoneSelectPass.parseResponse(reply, material),
    };
  };
  const buildMilestoneSelectRef = useRef(buildMilestoneSelect);
  buildMilestoneSelectRef.current = buildMilestoneSelect;

  /** The digest request for one stored turn, attached to that turn. */
  const buildDigestRequest = (target: DigestTarget) => summaryPass.buildRequest(standalonePassInput(), {
    ...emptyTurnMaterial({
      action: target.action, effectiveAction: target.action, turnId: target.turnId, baseCtx: contextValues(), destinations: [],
    }),
    narration: target.narration,
  });
  const buildDigestRequestRef = useRef(buildDigestRequest);
  buildDigestRequestRef.current = buildDigestRequest;

  /** The diary request for one participant of a stored turn. It sends the entity's text as it stands,
   *  resolved with its owner; a name no entity backs carries none. */
  const buildDiaryRequest = (target: DiaryTarget) => {
    const found = findEntityByCharacterName(target.name, allEntities);
    return diaryPass.buildRequest(standalonePassInput(), {
      ...emptyTurnMaterial({ action: "", effectiveAction: "", turnId: target.turnId, baseCtx: contextValues(), destinations: [] }),
      narration: target.narration,
      subject: { name: target.name, entity: found && resolveEntityTexts([found], resolveEntityText)[0] },
    });
  };
  const buildDiaryRequestRef = useRef(buildDiaryRequest);
  buildDiaryRequestRef.current = buildDiaryRequest;

  /** The settings-derived booleans this turn's shape depends on. */
  const turnSettings = (): TurnSettings => ({
    thinkingMode,
    concurrentTurnRequests,
    choicesEnabled,
    statUpdatesEnabled,
    statCount: requestStatCount,
    locationChangeEnabled,
    locationAutoApply,
    entityMovement,
    aiClock,
    memoryDigests,
    characterDiaries,
    describeCharacters,
    imageAttachments,
    promptAttachments,
    language,
    stripLinksAndImages: stripMedia,
  });

  /**
   * What one failure tells the player. Recovery guidance is the toast's own text. `spokeForItself` is the
   * failed request when sendAiRequest already surfaced its own toast — it does that for foreground
   * requests only, so a silent pass that can't reach the server still needs the generic one.
   */
  const reportTurnFailure = (kind: TurnErrorKind, error: unknown, spokeForItself: boolean, isOpeningTurn: boolean) => {
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
    // One failure carries one View Details link: a foreground request's own toast already has it.
    if (spokeForItself) {
      toast.error(errorMessage, {
        position: "top-right",
        autoClose: 3000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
      });
    } else {
      toastError(error, { headline: errorMessage });
    }
    addSystemLogEntry(errorMessage);
  };

  // A script's verdicts, edits and removals land on the fields the Memory Manager writes, so a rewind keeps them (Q18).
  const landMemoryWrites = useCallback((writes: WorldWrites | undefined | null) => {
    const verbs = writes?.memoryWrites;
    if (!verbs?.length) return;
    setMemoryPins((prev) => pinsAfter(prev, verbs));
    setMemoryEdits((prev) => editsAfter(prev, verbs));
    setMemoryNotes((prev) => notesAfter(prev, verbs));
    setMemoryDeleted((prev) => deletedAfter(prev, verbs));
  }, [setMemoryPins, setMemoryEdits, setMemoryNotes, setMemoryDeleted]);

  /**
   * Apply one Turn Commit: thin setters, in the order the turn's presentation depends on. The turn's own
   * locals ride in `turn` — everything else here is component state.
   */
  const applyTurnCommit = async (
    commit: TurnCommit,
    turn: {
      signal: AbortSignal; location: GameLocation | null; participants: string[]; destinations: GameLocation[];
      /** Page one came from an Opening Narration, so no reveal ran and there is none to wait out. */
      written: boolean;
      /** What the commit was computed from, which the later code writes lay over. */
      context: TurnCommitContext;
      /** Where tracked entities stood and who followed when the turn began, where the player stood, and what
       *  the turn already applied when its move committed. */
      entityMove: { start: FollowerState; from: string | undefined; applied: FollowerState };
    },
  ) => {
    const { signal } = turn;
    // The move offer lands before the reveal is held below — it is the one result that has always
    // appeared while the narration was still fading. Scoped to the local navigable graph: the router's
    // reply named one of these or nothing.
    // A During AI Output move already beats the offer, so it never shows.
    const toolCalls = worldToolTurnRef.current;
    worldToolTurnRef.current = null;
    const outputMoved = outputRunRef.current?.run.result()?.worldWrites?.location !== undefined;
    if (commit.suggestedLocation && !outputMoved) {
      const target = turn.destinations.find((loc) => loc.name === commit.suggestedLocation);
      if (target) setSuggestedLocation(target);
    }

    // The turn's results wait for its end to land: the narration settled and its action row open, so the
    // choices and stat changes never appear over a still-fading narration.
    await landNarration(turn.written);
    // Stop pressed while the reveal was still draining — bail before committing choices/stats/snapshot.
    // abortGeneration already kept the narration.
    if (signal.aborted) return;

    setChoices(commit.turn.choices);

    // Seed the story's opening hour. Only ever written on the opening turn; null reads downstream as the
    // shipped DEFAULT_START_HOUR, so an unreadable answer plays exactly as before this pass existed.
    if (commit.isOpeningTurn) setStartHour(commit.openingHour);

    // What the narration's During AI Output scripts wrote lands now, so the After batch starts from it. Its
    // bar share joins the before box's.
    // The On Call runs' state is already live, and the output run's lands over it.
    const { written: outputBase, world: outputWorld } = await landOutputRun();
    const afterTriggers = toolCalls?.armed("after") ?? [];

    // Reset the persistent bar deltas for this turn, then let stat changes + regen below re-fill them. The
    // before box already moved before the narration, so its share is laid straight back over the reset.
    holdStatDeltas(null, beforeBoxDeltasRef.current);

    // Apply stat changes. Stat code runs inside; it is awaited below, before the snapshot arms, so the
    // snapshot holds its writes even when the sandbox first loads on this turn.
    // A turn with no stat response still runs code, over zero asks: the request off, the request failed,
    // or the opening turn.
    // The starvation check below reads the same pre-turn stats, so the run's stat snapshot holds the penalty.
    const statCode = commit.statResponse
      ? applyStatChanges(commit.statResponse, commit.clock, outputBase, globalStats, afterTriggers)
      : runStatCode(
        outputBase?.globalStats ?? rawGlobalStatsRef.current, outputBase?.globalStats ?? rawGlobalStatsRef.current, [], commit.clock,
        outputBase ?? undefined, 'after', { thresholdStats: globalStats, triggers: afterTriggers },
      );

    // Advance the clock by what this turn actually took (the flat hour when unmeasured).
    handleTimePassed(commit.turnHours);

    // Snapshot this turn once the updates above commit (deferred so the snapshot captures the finalized
    // message, applied stat changes, code writes, and advanced time rather than a stale mid-batch read).
    // The per-turn settle runs first, against the run's one stat snapshot (Q9, Q19).
    const run = await statCode;

    // The output and After the AI code writes beat the passes too, so the stored turn waits for them.
    const final = withCodeWrites(commit, mergeWorldWrites(outputWorld, run?.world), turn.context);
    if (commit.suggestedLocation && !final.suggestedLocation) setSuggestedLocation(null);
    // Regen already ticked at the commit's hours: a longer code duration ticks the extra, a shorter one moves the clock alone.
    const extraHours = final.turnHours - commit.turnHours;
    if (extraHours > 0) handleTimePassed(extraHours);
    else if (extraHours < 0) setGameTime((prev) => prev + extraHours);
    const codeTarget = final.codeMove && final.codeMove !== turn.location?.id ? locations.find((loc) => loc.id === final.codeMove) : undefined;
    if (codeTarget) {
      changeLocation(codeTarget);
      addLogEntry(`Moved to location: ${codeTarget.name}`);
    }
    const location = codeTarget ?? turn.location;
    const { start, from, applied } = turn.entityMove;
    if (from) {
      const { state, offer } = commitEntityMoves(start, final, { from, to: location?.id });
      const { peel } = turn.context;
      const turnId = final.turn.turnId ?? currentTurnIdRef.current;
      const anyKnown = new Set<string>();
      if (state !== applied) {
        applyFollowerState(
          { followers: state.followers, positions: movedPositions(state.positions, applied.positions) },
          peeledCharacters(state, peel, anyKnown, turnId),
        );
        // Removes peeled followers the final move dropped.
        const unmade = peeledCharacters(applied, peel, anyKnown, turnId).filter((d) => !state.followers.includes(d.entity.id));
        if (unmade.length) setDiscoveredEntities((prev) => prev.filter((d) => !unmade.some((gone) => gone.entity.id === d.entity.id)));
      }
      entityOfferRef.current = offer;
      followerPeelRef.current = offer.comeAlong.length && peel ? { peelOff: peel, turnId } : undefined;
    }

    setFullMessageHistory((prev) => {
      const updatedHistory = [...prev];
      if (
        updatedHistory.length > 0 &&
        updatedHistory[updatedHistory.length - 1].role === "assistant"
      ) {
        updatedHistory[updatedHistory.length - 1] = {
          role: "assistant",
          content: JSON.stringify(final.turn),
        };
      }
      return updatedHistory;
    });
    // Pins become notes anchored after this turn, so they leave with it.
    const committedTurnId = final.turn.turnId;
    const pins = final.codeWrites?.pins;
    if (committedTurnId && pins?.length) {
      const anchor = fullMessageHistoryRef.current.length;
      setMemoryNotes((prev) => withScriptPins(prev, committedTurnId, pins, anchor));
    }
    landMemoryWrites(final.codeWrites);

    // Persist any characters this turn discovered, anchored to its location + turn so they roll back with
    // it. Guarded against a double-add (variant-aware name match) by a visitor added moments ago.
    if (final.discoveries.length > 0) {
      setDiscoveredEntities((prev) => {
        const additions = final.discoveries.filter(
          (d) => !prev.some((p) => sameCharacterName(p.entity.name, d.entity.name)),
        );
        return additions.length ? [...prev, ...additions] : prev;
      });
    }

    await settleTurn(run?.gateStats ?? null);
    armTurnSnapshot();
    // The turn committed, so the before box's writes stand.
    beforeBoxUndoRef.current = null;

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
          narration: final.turn.narration,
          participants: turn.participants,
          locationId: location?.id,
          playerInFrame: final.turn.playerInFrame,
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
  const sendGameAction = async (
    action: string,
    { writtenNarration, attachments, resentAttachments, script }: {
      writtenNarration?: string;
      attachments?: ImageAttachment[];
      /** The re-sent turn's images. They are kept even when the turn may not send them. */
      resentAttachments?: ImageAttachment[];
      /** Plays the turn on canned narration and choices streams, with no other pass. */
      script?: TurnScript;
    } = {},
  ) => {
    setUserPage(null); // taking an action resumes following, so the player sees their new turn land
    stopCommandPreview(); // a real turn supersedes any command preview
    // On the opening turn, snapshot the pre-game state so page 1 can be re-generated later.
    if (fullMessageHistory.length === 0) initialStateRef.current = saveCurrentGameState();

    // Places navigable from here. Nowhere to go means nothing to route: the router's reply is matched
    // against this exact list, so with it empty the call cannot produce a move however the model answers.
    const destinations = currentLocation ? navigableDestinations(currentLocation, locations, connections) : [];
    const planInput = {
      action,
      isGameStarted,
      destinationCount: destinations.length,
      locationCount: locations.length,
      hasCurrentLocation: !!currentLocation,
      writtenNarration,
      attachments: resentAttachments ?? attachments,
      settings: script ? { ...turnSettings(), thinkingMode: "off" as const, choicesEnabled: true } : turnSettings(),
      prompts: turnPrompts(),
    };
    const scripted = (planned: TurnPlan): TurnPlan =>
      script ? { ...planned, passes: planned.passes.filter((pass) => SCRIPTED_PASSES.has(pass.id)) } : planned;
    let plan = scripted(planTurn(planInput));
    // Only narration sees the real opening text; every other consumer (stats, planner, choices, dictionary
    // triggers, stored history) sees the terse "START GAME" proxy — the full cue is a narrator directive
    // that derails those prompts. The player's own text lives on in openingActionRef.
    const { isOpeningTurn, effectiveAction } = plan;
    if (isOpeningTurn) {
      // A written page one was never the player's text, so there is no edit to bring back.
      openingActionRef.current = plan.writtenNarration === null ? action : "";
    }

    // One AbortController for the whole turn, so Stop aborts every sub-request — not just the active one.
    const controller = new AbortController();
    abortControllerRef.current = controller;
    const { signal } = controller;
    setIsWaitingForAI(true);
    // Not revealing yet — the narration stream flips this on. Until then the reveal view shows the
    // committed narration, never the stale last-turn text (which would otherwise animate all at once
    // during setup, most visibly on re-generate). The live reasoning is cleared for the same reason: the
    // last turn's thought would otherwise sit on this pending turn until its narration stream opens. The
    // committed turn keeps its own copy in its saved message.
    setIsRevealingNarration(false);
    turnReasoningRef.current = { text: "", ms: 0 };
    setLiveReasoning({ text: "", ms: 0, active: false });
    // A new turn end to land: its action row stays closed and its choices wait until then.
    turnSeqRef.current++;
    landingRef.current = null;
    choicesHeldRef.current = true;
    heldChoicesRef.current = null;
    setNarrationSettled(false);

    // What the turn's own derivations carry between passes. The pipeline's material holds everything the
    // requests render from; these are the view-side reads that outlive a single pass.
    let turnLocation = currentLocation;
    // What the runs before the AI and the On Call runs wrote to the location, the clock and the cast.
    let turnWorldWrites: WorldWrites | undefined;
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
    // The planner's call on whether the player is in the picture; undefined until a planner has cast the turn.
    let playerInFrame: boolean | undefined;
    let turnParticipants: string[] = [];
    // Where tracked entities stood and who followed when the turn began; every join this turn starts here.
    const moveStart = liveFollowerState();
    const moveFrom = currentLocation?.id;
    let entityIntents = NO_ENTITY_MOVES;
    // The join the narration is written over: followers already beside the player. Null when it moves nobody.
    let turnJoin: FollowerState | null = null;
    const movingCast = positionedCast(allEntities, personaRef);
    const peel = turnPeelOff(movingCast, randomUUID);
    // The runtime characters the scene list names, the only ones asked unless they already follow.
    const runtimeInScene = new Set(discoveredEntities
      .filter((d) => participants.some((name) => sameCharacterName(name, d.entity.name)))
      .map((d) => d.entity.id));
    /** Each entity the turn asks whether it moves, with the replies it is offered. */
    const moveSubjects = (): TurnPassSubject[] => !moveFrom ? [] : entityMoveSubjects(
      movingCast, moveStart, moveFrom, { runtime: discoveredEntities, inScene: runtimeInScene },
    ).map((entity) => ({
      name: entity.name,
      entity,
      ...entityMoveOffers(entity, moveStart.followers.includes(entity.id), moveFrom, locations, connections),
    }));
    /** The characters `join` peels off, born this turn. */
    const peeledBy = (join: FollowerState) =>
      peeledCharacters(join, peel, new Set(discoveredEntities.map((d) => d.entity.id)), currentTurnIdRef.current);

    const reportFailure = (error: unknown) =>
      reportTurnFailure(classifyTurnError(error), error, false, isOpeningTurn);

    try {
      // Drain last turn's stat-bar colors and fade any lingering delta text now (they clear during the AI
      // wait), so this turn's changes animate onto clean bars.
      drainStatDeltas();
      // This turn's entity deltas count from here, before the before box moves anything.
      setEntityStatBaseline(entityStatsRef.current);
      // Clear the box now (the action is captured in `action`), so anything the player types
      // after choices unlock the box isn't wiped when the turn finishes.
      setPlayerInput("");
      setChoices([]);
      setChoicesReady(false);
      setSuggestedLocation(null);
      entityOfferRef.current = NO_ENTITY_OFFER;
      followerPeelRef.current = undefined;
      // Stamp a stable id for this turn, written into its assistant JSON (powers the digest apply-guard).
      currentTurnIdRef.current = randomUUID();
      // The attachments leave the action box with the text, and the turn keeps the ones it may carry.
      // A regenerate keeps its turn's attachments and leaves the box alone.
      const turnId = currentTurnIdRef.current;
      tellTurnRef.current = turnId;
      const carried = resentAttachments ?? plan.attachments;
      setActionAttachments((prev) => setTurnAttachments(prev, turnId, carried));
      if (!resentAttachments) setPendingAttachments([]);
      // This turn hasn't entered history yet; an abort before the user message is added (the up-front
      // location request) must not be mistaken for "narration came through" (see abortGeneration).
      userTurnAddedRef.current = false;
      // Start a new turn in the AI-context history (cap to the last 50 turns).
      pendingDictionaryDebugRef.current = null;
      setDebugTurns((prev) => [...prev, { action: effectiveAction, requests: [], turnId: currentTurnIdRef.current }].slice(-50));
      // Open this turn in the Turn Pipeline parity recording (inert unless the harness armed it).
      recordParityTurn(effectiveAction, currentTurnIdRef.current);

      // The before-the-AI box, on the turn's starting state: no asks and no regen yet, and the clock still
      // reading turn start. Its writes reach live state at once and ride into every prompt below through
      // `codeView`, which React has not re-rendered for.
      beforeBoxDeltasRef.current = {};
      const preBox: TurnCodeState = {
        globalStats: rawGlobalStatsRef.current, codePins, globalTraits, disabledTraitIds, appliedTraitValues, cascadeOffTraitIds,
        ownedTraits, entityStats: entityStatsRef.current,
      };
      // The At Game Start scripts shape the opening: once per new playthrough, ahead of the before box.
      scriptLocationRef.current = turnLocation;
      turnMemoriesRef.current = scriptMemoriesRef.current;
      turnReadRef.current = { action: scriptActionFor(planInput), number: closedTurns(fullMessageHistory) + 1 };
      if (isOpeningTurn) setOpeningTurnAction(turnReadRef.current.action);
      const { written: beforeBox, world: beforeWorld } = await runBeforeAI(
        rawGlobalStatsRef.current, { deltaHours: 0, elapsedHours: gameTime, calendar }, undefined, isOpeningTurn && newPlaythroughRef.current,
      );
      turnWorldWrites = beforeWorld;
      // A move before the AI lands before routing, so the narration is written where code put the turn.
      const beforeTarget = beforeWorld?.location === undefined ? undefined : locations.find((loc) => loc.id === beforeWorld.location);
      if (beforeTarget) {
        turnLocation = beforeTarget;
        scriptLocationRef.current = beforeTarget;
      }
      // Any code move beats the router and the suggest pass, so neither request is sent.
      if (beforeWorld?.location !== undefined) plan = scripted(planTurn({ ...planInput, destinationCount: 0, locationCount: 0 }));
      beforeBoxUndoRef.current = beforeBox ? preBox : null;
      turnPreBoxRef.current = preBox;
      turnBeforeBoxRef.current = beforeBox;
      outputRunRef.current = null;
      onCallStateRef.current = null;
      const beforeClock = advancedClock(gameTime, beforeWorld);
      turnClockRef.current = beforeClock ?? null;
      let codeView = turnCodeView(beforeBox, beforeClock);
      /** The world the turn's prompts read: the code view, with the followers at the player's side. */
      const sceneBox = (): SceneWrites | null => {
        if (!turnJoin) return codeView;
        const peeled = peeledBy(turnJoin);
        return { ...(codeView ?? {}), positions: turnJoin.positions, ...(peeled.length && { addedEntities: discoveredAsEntities(peeled) }) };
      };
      // An On Call write since the narration's context values were built, which later prompts must read (Q52).
      let narrationBuilt = false;
      let ctxStale = false;
      // The same, for the staged planning passes still to come (Q55).
      let planCtxStale = false;
      let relevanceScores: Map<string, number> | null = null;
      let historyPicks: HistoryPicks | undefined;

      /**
       * The narration's context values, system prompt and trimmed history, under the turn's code view and
       * clock. `picks` re-renders with the memories the first trim chose.
       */
      const renderNarration = (picks?: HistoryPicks) => {
        // The shared context base (incl. all three Stats-chip variants), scoped to this turn's location;
        // every system-prompt render below spreads it and adds its own tokens.
        const ctx = contextValues(turnLocation, sceneBox());
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
          maxTokens: narrationAnswerCap,
          markdownOutput,
          sectionStyle: activeSectionStyle,
          resolvePH: codeView?.resolve ?? resolvePH,
        });
        pendingDictionaryDebugRef.current = dictionaryDebug;
        // Get trimmed history before adding new action (history fills the window left by the prompt).
        // Pass the action so banding can rehydrate older turns it references.
        const history = getTrimmedMessageHistory(
          estimateTokens(prompt.length), effectiveAction, relevanceScores, actionVec, !picks,
          // A turn its code left alone keeps the live now-line, byte for byte.
          { nowHours: codeView?.elapsed, values: codeView ? ctx : undefined, picks },
        );
        // Track the assembled system-prompt size for the memory-usage breakdown
        setLastPromptChars(prompt.length);
        return { ctx, prompt, runs, history };
      };

      /**
       * Everything the narration rides on, assembled once the up-front router has settled where the turn
       * takes place: the context values, the dictionary scan, the system prompt, and the trimmed history
       * this turn's user message is appended to.
       */
      const assembleNarration = async (): Promise<Partial<TurnMaterial>> => {
        // One action embedding for every semantic consumer this turn (lore activation, band relevance,
        // diary retrieval). Null = all semantic features quietly off for this turn.
        actionVec = await embedActionVec(effectiveAction);
        // Relevance scores are computed once here and shared with the planner rebuild below so both stages
        // trim identically. The context meter re-trims with the same scores + action vector so its counts
        // mirror this turn.
        relevanceScores = computeRelevanceScores(actionVec);
        lastRelevanceScoresRef.current = relevanceScores;
        lastActionVecRef.current = actionVec;
        const { ctx, prompt, runs, history } = renderNarration();
        const { messages: trimmedHistory, runs: historyRuns } = history;
        historyPicks = history.picks;
        narrationBuilt = true;

        // Add user message to history after getting trimmed history. Stores the proxy on the opening turn so
        // later turns' context is byte-identical to the old flow (the real opening text lives in openingActionRef).
        addMessageToHistory("user", effectiveAction);
        userTurnAddedRef.current = true;

        // All past narration the player has read — the corpus for "has this name been revealed yet?" (drives
        // both the plan sanitizer and each scene-list row's reveal state).
        priorNarration = fullMessageHistory
          .filter((m) => m.role === "assistant")
          .map((m) => narrationOf(m.content) ?? "")
          .join("\n");

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
              stripMedia,
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
        const classified = classifyCast(cast, allEntities, playerNames);
        flaggedCast = classified.flaggedCast;
        playerInFrame = classified.flaggedCast.some((c) => c.isPlayer);
        directorCandidates = classified.directorCandidates;
        adHocCandidates = classified.adHocCandidates;
        sceneCast = classified.npcCast;
        return classified;
      };

      /** What the narration confirms: who took part, who is on screen, and who just walked in. */
      const applyNarrationReading = (narration: string): Partial<TurnMaterial> => {
        // Commit the auto-resolved move now that the narration — already written for the new location —
        // succeeded, so an aborted/empty turn leaves the location unchanged.
        if (turnJoin) {
          applyFollowerState({ followers: turnJoin.followers, positions: movedPositions(turnJoin.positions, moveStart.positions) }, peeledBy(turnJoin));
        }
        if (turnLocation && turnLocation.id !== currentLocation?.id) {
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
      // One Tool Snapshot for the turn, built at its first Tool call and read by every later one. A move by
      // the router starts it over, so the narration reads the scene it is written for.
      // The turn's own World Tool calls (R6). An On Call run reads the turn as code left it so far and lands at
      // once, so later prompts read it through `codeView` (Q38, Q40); a turn that never commits puts it back.
      const onCall = onCallRunner(() => {
        const prepared = prepareTurnStartCode(onCallStateRef.current ?? turnBeforeBoxRef.current);
        if (!prepared) throw new Error("The Tool's script could not start");
        return {
          turn: prepared.turn,
          land: (result) => {
            const { written, world } = prepared.finish(result);
            // Scene writes join the before box's (Q44): a move sets where later prompts and Tool calls stand.
            turnWorldWrites = mergeWorldWrites(turnWorldWrites, world);
            const target = world?.location === undefined ? undefined : locations.find((loc) => loc.id === world.location);
            if (target) {
              turnLocation = target;
              scriptLocationRef.current = target;
            }
            // An advance moves the time later prompts, Tool calls and scripts read (Q45); any write, what a user Tool reads.
            if (target || world?.minutes !== undefined || written) executeTool = turnToolExecutor();
            if (written) {
              if (!beforeBoxUndoRef.current) beforeBoxUndoRef.current = turnPreBoxRef.current;
              onCallStateRef.current = written;
            }
            if (!written && !world) return;
            const clock = advancedClock(gameTime, turnWorldWrites);
            turnClockRef.current = clock ?? null;
            codeView = turnCodeView(onCallStateRef.current ?? turnBeforeBoxRef.current, clock);
            if (narrationBuilt) ctxStale = planCtxStale = true;
          },
        };
      });
      const worldToolTurn = openWorldToolTurn(worldTools, onCall);
      worldToolTurnRef.current = worldToolTurn;
      const turnToolExecutor = () => worldToolTurn.executor(
        snapshotToolExecutor(() => buildToolSnapshot(
          liveScene(turnLocation, sceneBox()), dictionaries, toolMemorySource(), toolScriptSourceRef.current?.(onCallStateRef.current ?? turnBeforeBoxRef.current),
        )),
      );
      let executeTool = turnToolExecutor();

      /** The context values for the staged passes after a planning answer: fresh only when an On Call write landed. */
      const takeStagedCtx = (): Partial<TurnMaterial> => {
        if (!planCtxStale) return {};
        planCtxStale = false;
        return { ctx: contextValues(turnLocation, sceneBox()) };
      };

      const advance: TurnAdvance = async (event, material) => {
        if (event.at === "written") {
          // Page one as the author wrote it, stored the way a streamed narration's first write stores it,
          // so the page renders it through the normal path and Stop keeps it like any narration.
          setFullMessageHistory((prev) => [...prev, {
            role: "assistant",
            content: JSON.stringify({ narration: event.narration, choices: [], stat_changes: [], turnId: currentTurnIdRef.current }),
          }]);
          const patch = applyNarrationReading(event.narration);
          if (ttsLoaded) await generateTTS(event.narration);
          return patch;
        }
        if (event.at === "stage") {
          // Assembled once the up-front router has settled the location, and before the planner reads it.
          if (event.stage === "preNarration" && planHasPass(plan, "entityLocationAuto")) {
            return { subjects: { ...material.subjects, entityLocationAuto: moveSubjects() } };
          }
          if (event.stage === "planning") {
            // The router has settled the move, so the followers and "come along" can stand beside the player.
            if (moveFrom) {
              const joined = joinEntityMoves(moveStart, { from: moveFrom, to: turnLocation?.id }, entityIntents);
              turnJoin = joined === moveStart ? null : joined;
            }
            return assembleNarration();
          }
          if (event.stage === "narration") {
            // Hand the streaming narration (inside sendAiRequest) this turn's scene-list inputs so it can
            // keep the Entities tab live per sentence.
            sceneListCtxRef.current = { cast: sceneCast, prior: priorNarration };
            if (!ctxStale) return;
            ctxStale = false;
            // A Planning On Call write landed after the prompt was built, so the narration reads it (Q44, Q52).
            const { ctx, prompt, runs, history } = renderNarration(historyPicks);
            return {
              ctx,
              narrationSystemPrompt: prompt,
              narrationSystemPromptRuns: runs,
              trimmedHistory: history.messages,
              historyRuns: history.runs,
            };
          }
          if (event.stage === "postNarration") {
            // With no choices pass there is nothing to wait on, so the input unblocks right away.
            if (!planHasPass(plan, "choices")) setChoicesReady(true);
            // The scene's cast, whose text resolved with each owner: the diary pass sends it as is.
            const fanOut = splitParticipants(turnParticipants, liveScene(null, codeView).entities, suppressedCharacterNames);
            // The stat request follows the same confirmed participants: those who took part bring their stats.
            const statRequest = statRequestFor(
              enabledStats(globalStatsRef.current, statEnabledRef.current), presentEntitiesOf(fanOut.diary), entityStatsRef.current,
            );
            // A call during the narration never rebuilds its text; the passes after it read the change (Q44).
            const ctx = ctxStale ? { ctx: contextValues(turnLocation, sceneBox()) } : {};
            ctxStale = false;
            return {
              ...ctx,
              subjects: {
                ...material.subjects, ...fanOut,
                ...(planHasPass(plan, "entityLocationSuggest") && { entityLocationSuggest: moveSubjects() }),
              },
              statRequest,
              statCtx: contextValues(turnLocation, sceneBox(), statRequest),
            };
          }
          return;
        }

        const [first] = event.outcomes;
        switch (first.id) {
          case "locationAuto": {
            const matchedName = first.parsed as string | null;
            const target = matchedName ? destinations.find((loc) => loc.name === matchedName) : undefined;
            if (target && currentLocation && target.id !== currentLocation.id) {
              turnLocation = target;
              scriptLocationRef.current = target;
              executeTool = turnToolExecutor();
            }
            return;
          }
          case "entityLocationAuto":
            entityIntents = peelIntents(entityMovesOf(event.outcomes), peel);
            return;
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
              return { ...takeStagedCtx(), directorScene: scene, npcCastSize: 0, turnPlan: buildStagedPlan({ scene, stances: flaggedCast, beats: "" }) };
            }
            // The scene's cast, whose text resolved with each owner: the character pass sends it as is.
            const castScene = liveScene(turnLocation, sceneBox());
            const { chosen, overflow } = matchCastToEntities(
              npcCast,
              castScene.entities.filter((e) => castScene.presentIds.includes(e.id)),
              limitActiveCharacters ? activeCharacterLimit : Infinity,
            );
            return {
              ...takeStagedCtx(),
              directorScene: scene,
              npcCastSize: npcCast.length,
              overflow,
              subjects: {
                ...material.subjects,
                character: chosen.map((member) => ({
                  name: member.name,
                  stance: member.stance,
                  entity: member.entity,
                  stats: entityStatsField(castScene, member.entity),
                  diary: diaryFor(member.name),
                })),
              },
            };
          }
          case "character":
            // Intents keep cast order, which the storyboard message relies on.
            return {
              ...takeStagedCtx(),
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

      // The status label names the first request still running, so a batch shows what it really waits on.
      const pendingRequests = createPendingRequests((type) => { if (mounted.current && !signal.aborted) setAiRequestType(type); });

      /** The pipeline's request seam, filled by the Request Transport. */
      // Each call reads the executor at call time, so a later call in the same request sees an earlier one's move.
      const request: TurnRequestAdapter = (spec, context) => pendingRequests.track(spec.type, () => sendAiRequest({
        ...spec, signal: context.signal, executeTool: (tool, args) => executeTool(tool, args),
        fetchImpl: spec.type === "narration" ? script?.narration : spec.type === "choices" ? script?.choices : undefined,
      }));

      const result = await runTurn({
        plan,
        material: emptyTurnMaterial({
          action,
          effectiveAction,
          turnId: currentTurnIdRef.current,
          // The location the turn began in: what the up-front router routes from, and what the digest and
          // diary passes record against.
          baseCtx: contextValues(null, codeView),
          destinations: destinations.map((loc) => loc.name),
        }),
        request,
        signal,
        advance,
        // Choices are the interactive part: unblock the input the moment they show rather than when the rest
        // of their batch settles. They show once the turn end lands, so Continue joins after them.
        onPassSettled: (id, outcome) => {
          if (id !== "choices" || !outcome.ok || signal.aborted) return;
          void landNarration(plan.writtenNarration !== null).then(() => { if (!signal.aborted) setChoicesReady(true); });
        },
      });

      // The user stopping is an expected, silent exit (the `finally` resets waiting state).
      if (result.status === "aborted") return;
      if (result.status === "failed") {
        // A written page one is already the story, whatever failed after it: keep the turn as Stop keeps a
        // narration that came through, so the next submit is a normal turn and not a second opening.
        const pageOneStands = plan.writtenNarration !== null && result.run.material.narration !== "";
        reportTurnFailure(result.kind, result.error, result.request ? !result.request.silent : false, isOpeningTurn && !pageOneStands);
        if (pageOneStands) {
          setIsGameStarted(true);
          setChoicesReady(true);
          beforeBoxUndoRef.current = null;
          armTurnSnapshot();
        }
        return;
      }

      const commitContext: TurnCommitContext = {
        participants: turnParticipants,
        locationId: turnLocation?.id,
        currentLocationName: currentLocation?.name,
        discoveryLocationId: turnLocation?.id ?? currentLocation?.id,
        knownDiscoveredNames: discoveredEntities.map((d) => d.entity.name),
        // Freeze this turn's player notes and reasoning (both additive save-shape fields).
        notes: playerNotes,
        reasoning: turnReasoningRef.current,
        playerInFrame,
        gameTime,
        fixedTurnHours,
        calendar,
        codeWrites: turnWorldWrites,
        heldNames: [...entities.map((entity) => entity.name), ...suppressedCharacterNames],
        diaryNames,
        toolCalls: worldToolTurn.calls(),
        peel,
      };
      const commit = computeTurnCommit({ result, plan, context: commitContext });
      if (!commit) return;
      await applyTurnCommit(commit, {
        signal,
        location: turnLocation,
        participants: turnParticipants,
        destinations,
        written: plan.writtenNarration !== null,
        context: commitContext,
        entityMove: { start: moveStart, from: moveFrom, applied: turnJoin ?? moveStart },
      });
    } catch (error) {
      // The pipeline's own failures come back as a typed result above; what lands here is a derivation
      // throwing — context assembly, the read-aloud pass, or applying the commit.
      reportFailure(error);
    } finally {
      setIsWaitingForAI(false);
      setIsRevealingNarration(false);
      // A turn that ended without landing (stopped, failed) still opens its row and lets choices through.
      setNarrationSettled(true);
      releaseChoices();
      setAiRequestType(null);
      scriptLocationRef.current = null;
      turnClockRef.current = null;
      turnMemoriesRef.current = null;
      turnReadRef.current = null;
      // Release the turn's controller (unless a newer turn already replaced it).
      if (abortControllerRef.current === controller) {
        abortControllerRef.current = null;
        tellTurnRef.current = null;
      }
    }
  };

  useEffect(() => {
    const startIndex = (currentPage - 1) * messagesPerPage;
    const endIndex = startIndex + messagesPerPage;
    setDisplayedMessages(fullMessageHistory.slice(startIndex, endIndex));
  }, [fullMessageHistory, currentPage, setDisplayedMessages]);

  // Fires the re-send half of a re-generate, once the restored pre-turn state has committed. A new game
  // that drew an Opening Narration starts through here too, once its seeded state has committed.
  useEffect(() => {
    if (pendingTurnNonce === 0) return;
    const pending = pendingTurnRef.current;
    pendingTurnRef.current = null;
    if (pending !== null) sendGameAction(pending.action, { writtenNarration: pending.writtenNarration, resentAttachments: pending.resentAttachments });
    // sendGameAction is deliberately not a dependency — we want this render's (post-restore) closure.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingTurnNonce]);

  const handlePageChange = (page: number) => {
    // Paging to the latest page resumes following (null); paging back pins that page.
    setUserPage(page >= totalPages ? null : page);
  };

  // Latest committed stats, so off-render derivations (below) don't rely on a stale closure.
  const globalStatsRef = useRef(globalStats);
  globalStatsRef.current = globalStats;
  const rawGlobalStatsRef = useRef(rawGlobalStats);
  rawGlobalStatsRef.current = rawGlobalStats;
  // What this turn's before box moved, kept because the commit clears the bar deltas before the AI's own
  // land. Without it a value the box showed on the bar loses its color halfway through the turn.
  const beforeBoxDeltasRef = useRef<Record<string, number>>({});
  // The pin and trait state a run reads, by ref. A turn's after box runs out of the closure its render
  // minted, which is older than the before box's writes — the same reason the stats ride in on a ref.
  const liveCodeStateRef = useRef({
    codePins, pins, chosenTraits, disabledTraitIds, appliedTraitValues, cascadeOffTraitIds, ownedTraits, statTraits,
  });
  liveCodeStateRef.current = {
    codePins, pins, chosenTraits, disabledTraitIds, appliedTraitValues, cascadeOffTraitIds, ownedTraits, statTraits,
  };
  /** The gameplay slice the trait runtime reads and rewrites. */
  const traitState = useMemo<TraitRuntimeState>(
    () => ({
      stats: globalStats, traits: chosenTraits, disabledTraitIds, appliedValues: appliedTraitValues, cascadeOffTraitIds, ownedTraits,
      entityStats,
    }),
    [globalStats, chosenTraits, disabledTraitIds, appliedTraitValues, cascadeOffTraitIds, ownedTraits, entityStats],
  );
  // The trait state play stands at, which a switch run lands onto. A commit writes it at once, so a landing
  // before the next render builds on that commit.
  const liveTraitStateRef = useRef(traitState);
  liveTraitStateRef.current = traitState;
  const commitTraitState = useCallback(
    (next: TraitRuntimeState) => {
      liveTraitStateRef.current = next;
      // Runtime-only: the authored world (GameData.stats) is never mutated by play.
      setGlobalStats(next.stats);
      setGlobalTraits(next.traits);
      setDisabledTraitIds(next.disabledTraitIds);
      setAppliedTraitValues(next.appliedValues);
      setCascadeOffTraitIds(next.cascadeOffTraitIds ?? {});
      setOwnedTraits(next.ownedTraits ?? {});
      setEntityStats(next.entityStats ?? {});
    },
    [setGlobalStats, setGlobalTraits, setDisabledTraitIds, setAppliedTraitValues, setCascadeOffTraitIds, setOwnedTraits, setEntityStats],
  );
  // Stats, Code Pins and traits as they stood before this turn's before box, so a turn that never commits
  // puts back exactly what the box moved. The last snapshot holds the same seven fields — nothing else
  // touches them between it and the box — and undoing the box alone spares a trait the player switched
  // by hand while the AI was thinking. Null between turns and once a turn commits.
  const beforeBoxUndoRef = useRef<TurnCodeState | null>(null);
  // This turn's state before and after its before box, which the During AI Output run reads and undoes against.
  const turnPreBoxRef = useRef<TurnCodeState | null>(null);
  const turnBeforeBoxRef = useRef<TurnCodeState | null>(null);
  // The turn's During AI Output run, and the run's turn, held until the commit lands its writes.
  const outputRunRef = useRef<{ run: OutputRun; prepared: PreparedStatCode } | null>(null);
  // The running turn's World Tool calls, whose After triggers its commit fires; a new turn replaces them.
  const worldToolTurnRef = useRef<WorldToolTurn | null>(null);
  // The state this turn's On Call runs left, which the output run and the After batch land over.
  const onCallStateRef = useRef<TurnCodeState | null>(null);
  // Where a running turn stands for its scripts' `location`, ahead of the render that commits a move. Null
  // between turns, where the live location stands.
  const scriptLocationRef = useRef<GameLocation | null>(null);
  // The Memory panel's rows as a script's `memories` reads them, from the ledger the panel builds.
  const scriptMemoryList = useMemo(() => scriptMemories(buildMemoryLedger({
    history: fullMessageHistory, overrides: memoryOverrides, pins: memoryPins, selection: milestoneSelection,
    verbatimFloor: narrationVerbatimTurns, context: { bandIds: contextMemoryIds, rehydratedIds: rehydratedMemoryIds },
  }), fullMessageHistory, calendar), [
    fullMessageHistory, memoryOverrides, memoryPins, milestoneSelection, narrationVerbatimTurns, contextMemoryIds, rehydratedMemoryIds, calendar,
  ]);
  const scriptMemoriesRef = useRef(scriptMemoryList);
  scriptMemoriesRef.current = scriptMemoryList;
  // The list every run of a turn reads, taken once as the turn starts (Q40). Null between turns, where the live list stands.
  const turnMemoriesRef = useRef<SandboxMemory[] | null>(null);
  // The turn in progress as `turn` reads it; between turns, null and the last closed turn reads instead.
  const turnReadRef = useRef<SandboxTurn | null>(null);
  // The story hours a running turn's clock advances reached, which its later runs read (Q45). Null when the
  // turn has not advanced the clock, and between turns.
  const turnClockRef = useRef<number | null>(null);

  // The world's list and books; the run joins the library entities' and library books' pools itself.
  const statCodePlaceholders = useMemo(() => playthroughPlaceholderSet({
    placeholders: worldPlaceholders, owners: placeholderOwners, dictionaries, libraryDictionaries, runtimeDictionaries, rolls: sessionRolls,
  }), [worldPlaceholders, placeholderOwners, dictionaries, libraryDictionaries, runtimeDictionaries, sessionRolls]);

  // Set up one timing's scripts over this turn, regen included: the run's turn, and `finish`, which folds the
  // result into live state and the delta feedback. A re-roll passes the pre-turn state, so code reads
  // placeholders and traits as the turn it replaces did. `finish` hands back what the run left, for the before
  // box's caller (its passes run before React re-renders with these writes), and the run's stat snapshot, for
  // the per-turn settle. Null when the set-up failed. During AI Output executes apart from its landing, so it
  // uses the two halves itself.
  const prepareStatCode = useCallback(
    (
      before: PlayerStat[], afterAsks: PlayerStat[], asks: StatCodeTurn["asks"], clock: StatClock,
      preTurn?: PreTurnCodeState,
      timing: RunTiming = 'after',
      { entityTurn, thresholdStats, traitWorld, triggers }: {
        /** World Tool calls that run ahead of the timing's scripts. */
        triggers?: readonly ScriptTrigger[];
        /** The entities' values after this turn's AI asks, and the asks, by owner. */
        entityTurn?: { values: EntityStatValues; asks: Record<string, StatCodeTurn["asks"]> };
        /** The pre-turn stats the regen tick's starvation check reads. Absent ⇒ no penalty lands beside the run. */
        thresholdStats?: readonly PlayerStat[];
        /** The world the run's traits hold under, when its render has not committed yet. Absent ⇒ the live one. */
        traitWorld?: TraitWorld;
      } = {},
    ): PreparedStatCode | null => {
      try {
        const enabled = statEnabledRef.current;
        // The before box, the start scripts and the output scripts run at the turn's start, so there is no regen
        // yet to fold in.
        const tick = readsTurnStart(timing) ? null
          : applyRegen(afterAsks, clock.deltaHours ?? FLAT_HOURS_PER_TURN, enabled);
        const regenApplied = tick?.applied ?? {};
        // A save runs the world's current stat code, not the copy frozen in the save. Descriptions resolve
        // for the run; names do not — code reaches a stat by its code name, which the turn derives from the
        // authored name, so a chip in a name reads the same in every playthrough.
        const regenStats = tick ? [...tick.stats] : afterAsks;
        const stats = resolveStatText(refreshSavedStats(regenStats, authoredStats), resolvePH);
        // Every entity in the playthrough runs beside the player, over the same tick, each over its own asks.
        const entityPrevious = preTurn ? preTurn.entityStats ?? {} : entityStatsRef.current;
        const entityBase = entityTurn?.values ?? entityPrevious;
        const world = traitWorld ?? gatedWorld();
        const ownerRows = entityCodeTurns(
          entityOwnersOf(entityBase, preTurn ? preTurn.ownedTraits ?? {} : undefined, world), readsTurnStart(timing) ? null : clock.deltaHours ?? FLAT_HOURS_PER_TURN,
          (ownerId, ticked) => resolveStatText(
            refreshSavedStats(ticked, statEntities.find((e) => e.id === ownerId)?.stats ?? []), resolvePH,
          ),
          { previous: entityPrevious, asks: entityTurn?.asks },
        );
        // The same slice the player's checkbox switches, so a code switch is that switch.
        const live = liveCodeStateRef.current;
        const held = preTurn ? savedTraits(preTurn, traits)
          : {
            acquired: live.chosenTraits, disabledTraitIds: live.disabledTraitIds, appliedValues: live.appliedTraitValues,
            cascadeOffTraitIds: live.cascadeOffTraitIds, ownedTraits: live.ownedTraits,
          };
        const inForce = preTurn ? inForceOn(held, entityBase) : live.statTraits;
        const basePins = preTurn ? preTurn.codePins ?? {} : live.codePins;
        // The starvation penalty the regen tick lands beside this run, so the run's stat snapshot holds it.
        const healthLoss = tick && thresholdStats ? starvationLoss(thresholdStats, enabled, clock.deltaHours ?? FLAT_HOURS_PER_TURN) : null;
        const health = healthLoss === null ? undefined : stats.find((s) => s.name === "Health");
        const here = scriptLocationRef.current ?? currentLocation;
        const { owners, ownerTurns } = splitOwnerTurns(ownerRows);
        const state: SandboxState = {
          stats, enabled, clock,
          gateStats: gateStatsOf({
            traits: held.acquired, disabledTraitIds: held.disabledTraitIds, ownedTraits: held.ownedTraits, stats, entityStats: entityBase,
          }, world),
          ownerTraits: {
            ...held, world, entities: codeEntities.world, library: libraryIn(world), discovered: laterDiscovered(discoveredEntities),
            inSceneIds: liveScene().inSceneIds,
          },
          placeholders: {
            ...statCodePlaceholders,
            pins: preTurn ? pinsFor(basePins).world : live.pins,
            // The stored shape too, so an Object pinned to a list reads that list back rather than its join.
            codePins: basePins,
            // A During AI Output run reads the pins its earlier sentences left.
            pinsAfter: (after) => pinsFor(after.codePins, {
              traits: [...after.acquired], disabledTraitIds: [...after.disabledTraitIds], ownedTraits: after.ownedTraits, stats: [...after.stats],
            }).world,
          },
          owners,
          places: { locations, location: here && { id: here.id, name: here.name }, connections },
          positions: { ...runtimePositions(discoveredEntities), ...entityPositions },
          followers: entityFollowers,
          resolveText: (text, owner) => (owner ? resolveEntityText(owner, text) : resolvePH(text)),
          memories: turnMemoriesRef.current ?? scriptMemoriesRef.current,
          notes: liveScene().notes,
          turn: turnReadRef.current ?? { action: "", number: closedTurns(fullMessageHistoryRef.current) },
        };
        const turn: StatCodeTurn = {
          state,
          timing,
          prompts: playPrompts(timing),
          previous: before, asks, regenApplied, ownerTurns,
          ...(health && healthLoss !== null ? { penalties: { [health.id]: healthLoss } } : {}),
          statNameOf: (stat) => resolvePH(stat.name),
          traitNameOf: (trait) => resolveTraitText(trait, trait.name),
          worldScripts,
          ...(triggers?.length ? { triggers } : {}),
        };
        /** Lays the run's result onto live state and hands back what it left. */
        const finish = (result: StatCodeTurnResult) => {
          if (timing === 'switch') return landSwitch(result);
          const nextPins = withPinWrites(basePins, result.pinWrites);
          // Onto the latest values, as the player's stats below: the regen tick can apply while the run awaits.
          const ownersInForce = entityInForceUnder(result.traits?.ownedTraits ?? held.ownedTraits ?? {});
          setEntityStats((prev) => withOwnerCodeResults(prev, result.owners, ownersInForce));
          const nextEntityStats = withOwnerCodeResults(entityBase, result.owners, ownersInForce);
          setCodePins((prev) => withPinWrites(prev, result.pinWrites));
          if (result.traits) {
            setGlobalTraits(result.traits.acquired);
            setDisabledTraitIds(result.traits.disabledTraitIds);
            setAppliedTraitValues(result.traits.appliedValues);
            setCascadeOffTraitIds(result.traits.cascadeOffTraitIds);
            setOwnedTraits(result.traits.ownedTraits);
            for (const line of result.traits.log) addLogEntry(line);
          }
          /** What this run left, in the shapes state holds. */
          const stateAfterRun = (): TurnCodeState => ({
            globalStats: overlayStatCodeResult(afterAsks, result, inForce),
            codePins: nextPins,
            globalTraits: [...(result.traits?.acquired ?? held.acquired)],
            disabledTraitIds: [...(result.traits?.disabledTraitIds ?? held.disabledTraitIds)],
            appliedTraitValues: result.traits?.appliedValues ?? held.appliedValues,
            cascadeOffTraitIds: result.traits?.cascadeOffTraitIds ?? held.cascadeOffTraitIds,
            ownedTraits: result.traits?.ownedTraits ?? held.ownedTraits,
            entityStats: nextEntityStats,
          });
          const world = result.worldWrites;
          if (!result.traits && result.moved.length === 0 && result.boundsChanged.length === 0 && result.hiddenChanged.length === 0) {
            const written = nextPins === basePins && nextEntityStats === entityPrevious ? null : stateAfterRun();
            return { written, gateStats: result.gateStats, world };
          }
          // The bars are keyed by the name the player reads, so the run's stats resolve theirs here.
          const codeChanges = appliedStatDeltas(stats, resolveStatNames(result.stats, resolvePH));
          // Onto the LATEST stats, not a blanket `setGlobalStats(result.stats)`: the run read the pre-`await`
          // baseline, and anything applied in the meantime (starvation, a re-generate) must survive.
          setGlobalStats((prev) => overlayStatCodeResult(prev, result, inForce));
          // Fold the code-derived movement into the live delta feedback, so a code stat's bar/text animates
          // live — matching the history view (pageStatDeltas diffs the final, post-code snapshot).
          addStatDeltas(null, codeChanges);
          // The commit resets the bar deltas mid-turn, so the share of the runs before the AI is re-laid over that.
          // The start scripts, the before box and the output scripts can move one stat, so their shares add.
          if (readsTurnStart(timing)) beforeBoxDeltasRef.current = sumDeltas(beforeBoxDeltasRef.current, codeChanges);
          return { written: stateAfterRun(), gateStats: result.gateStats, world };
        };
        /** A switch run's landing: only what the run changed lands on the state play reached meanwhile. */
        const landSwitch = (result: StatCodeTurnResult) => {
          const latest = liveTraitStateRef.current;
          const start: TraitRuntimeState = {
            stats, traits: [...held.acquired], disabledTraitIds: [...held.disabledTraitIds], appliedValues: held.appliedValues,
            cascadeOffTraitIds: held.cascadeOffTraitIds, ownedTraits: held.ownedTraits, entityStats: entityPrevious,
          };
          const ranTraits = result.traits;
          const ran: TraitRuntimeState = {
            stats: [...result.stats],
            traits: ranTraits?.acquired ?? start.traits, disabledTraitIds: ranTraits?.disabledTraitIds ?? start.disabledTraitIds,
            appliedValues: ranTraits?.appliedValues ?? start.appliedValues,
            cascadeOffTraitIds: ranTraits?.cascadeOffTraitIds ?? start.cascadeOffTraitIds, ownedTraits: ranTraits?.ownedTraits ?? start.ownedTraits,
            entityStats: { ...entityPrevious, ...Object.fromEntries(Object.entries(result.owners ?? {}).map(([id, run]) => [id, [...run.stats]])) },
          };
          const { state: landed, dropped } = landSwitchRun(start, ran, latest, world);
          commitTraitState(landed);
          setCodePins((prev) => withPinWrites(prev, result.pinWrites));
          ranTraits?.log.forEach((line, i) => {
            const trait = ranTraits.logTraits?.[i];
            if (!trait || !dropped.has(trait)) addLogEntry(line);
          });
          addStatDeltas(null, appliedStatDeltas(resolveStatNames(latest.stats, resolvePH), resolveStatNames(landed.stats, resolvePH)));
          return { written: null, gateStats: result.gateStats, world: result.worldWrites };
        };
        return { turn, finish };
      } catch (error) {
        console.error("Error processing stat code:", error);
        return null;
      }
    },
    [setGlobalStats, setEntityStats, entityOwnersOf, entityInForceUnder, addStatDeltas, setCodePins, resolvePH, statCodePlaceholders, pinsFor, traits, authoredStats, worldScripts, resolveTraitText, gatedWorld, codeEntities, statEntities, inForceOn, liveScene, libraryIn, locations, currentLocation, discoveredEntities,
      entityPositions, entityFollowers, resolveEntityText, setGlobalTraits, setDisabledTraitIds, setAppliedTraitValues, setCascadeOffTraitIds, setOwnedTraits, addLogEntry, playPrompts, commitTraitState],
  );

  // Runs one timing's scripts over this turn and lays the result: a turn with no stat response runs it directly.
  // Null when the run failed.
  const runStatCode = useCallback(
    async (...args: Parameters<typeof prepareStatCode>): Promise<ReturnType<PreparedStatCode["finish"]> | null> => {
      const prepared = prepareStatCode(...args);
      if (!prepared) return null;
      try {
        return prepared.finish(await runStatCodeTurn(prepared.turn));
      } catch (error) {
        console.error("Error processing stat code:", error);
        return null;
      }
    },
    [prepareStatCode],
  );

  // A run outside a turn lands its memory and diary lines on the latest turn, and its pins anchored after it (Q6).
  const landOnLatestTurn = useCallback((writes: WorldWrites | undefined) => {
    // A verdict needs no turn: a Custom line can stand before the first one.
    landMemoryWrites(writes);
    const history = fullMessageHistoryRef.current;
    const turnId = latestTurnId(history);
    if (!writes || !turnId) return;
    setFullMessageHistory((prev) => {
      const at = prev.findLastIndex((message) => message.role === "assistant");
      const turn = at < 0 ? null : parseTurnContent(prev[at].content);
      const landed = turn?.turnId === turnId ? withCodeLines(turn, writes, diaryNames) : turn;
      if (!turn || landed === turn) return prev;
      const next = [...prev];
      next[at] = { role: "assistant", content: JSON.stringify(landed) };
      return next;
    });
    if (writes.pins?.length) setMemoryNotes((prev) => addScriptPins(prev, turnId, writes.pins ?? [], history.length));
  }, [setFullMessageHistory, setMemoryNotes, diaryNames, landMemoryWrites]);
  // The writes of runs that ended while a turn ran: the turn's stream and commit rewrite its message.
  const heldWritesRef = useRef<WorldWrites | undefined>(undefined);
  const landBetweenTurns = useCallback((writes: WorldWrites | undefined) => {
    if (abortControllerRef.current) heldWritesRef.current = mergeWorldWrites(heldWritesRef.current, writes);
    else landOnLatestTurn(writes);
  }, [landOnLatestTurn]);
  useEffect(() => {
    if (isWaitingForAI || abortControllerRef.current || !heldWritesRef.current) return;
    const held = heldWritesRef.current;
    heldWritesRef.current = undefined;
    landOnLatestTurn(held);
  }, [isWaitingForAI, fullMessageHistory, landOnLatestTurn]);

  // The When a Trait Switches runs of every trait an in-play action switched, over the state the action left;
  // their writes land at once (Q12, Q47). A run's own switches fire inside the run.
  const fireSwitchScripts = useCallback(
    /** `world` is the one `to` holds under; a persona change passes the one `from` held under as `fromWorld`. */
    async (from: TraitRuntimeState, to: TraitRuntimeState, world: TraitWorld, fromWorld: TraitWorld = world) => {
      const events = traitSwitchEvents(from, to, world, fromWorld);
      if (!events.length) return;
      const prepared = prepareStatCode(to.stats, to.stats, [], { deltaHours: 0, elapsedHours: gameTime, calendar }, {
        codePins: liveCodeStateRef.current.codePins, globalTraits: to.traits, disabledTraitIds: to.disabledTraitIds,
        appliedTraitValues: to.appliedValues, cascadeOffTraitIds: to.cascadeOffTraitIds ?? {}, ownedTraits: to.ownedTraits ?? {},
        entityStats: to.entityStats ?? {},
        // The render that committed `to` has not run yet, so the run reads `world` rather than the live one.
      }, 'switch', { traitWorld: world });
      if (!prepared) return;
      try {
        // No action caused a player's switch, so it reads none, even while a turn runs.
        const read = { action: "", number: turnReadRef.current?.number ?? closedTurns(fullMessageHistoryRef.current) };
        const played = { ...prepared.turn, state: { ...prepared.turn.state, turn: read } };
        const turn = fromWorld === world ? played : { ...played, switchedFrom: fromWorld };
        const result = await runSwitchScripts(turn, events);
        if (result && mounted.current) landBetweenTurns(prepared.finish(result).world);
      } catch (error) {
        console.error("Error processing stat code:", error);
      }
    },
    [prepareStatCode, gameTime, calendar, mounted, landBetweenTurns],
  );

  // The runs before the AI, over a turn's starting stats: on an opening that runs the start scripts, the start
  // scripts first, then the before box over the state they left. Hands back what the runs left, null when
  // neither wrote, and their world writes. The opening of a fresh game restarts from its pre-start state on
  // every redo, so each redo passes `opening`.
  const runBeforeAI = async (
    stats: PlayerStat[], clock: StatClock, preTurn: PreTurnCodeState | undefined, opening: boolean,
  ): Promise<{ written: TurnCodeState | null; world?: WorldWrites }> => {
    const start = opening ? await runStatCode(stats, stats, [], clock, preTurn, 'start') : null;
    const started = start?.written ?? null;
    const base = started?.globalStats ?? stats;
    const before = await runStatCode(base, base, [], clock, started ?? preTurn, 'before');
    return { written: before?.written ?? started, world: mergeWorldWrites(start?.world, before?.world) };
  };

  // Apply request identities to authored state; resolved names are only for code and display feedback.
  const applyStatChanges = useCallback(
    // `base` is the pre-turn snapshot a stat re-generation starts from (defaults to the live state), so
    // repeated re-rolls don't stack on already-applied changes or Code Pins.
    async (
      response: StatResponse,
      clock: StatClock = {},
      base: TurnCodeState | null = null,
      // The pre-turn stats the regen tick's starvation check reads.
      thresholdStats?: readonly PlayerStat[],
      // The turn's armed After the AI World Tool calls; a re-roll passes the saved ones (Q39).
      triggers: readonly ScriptTrigger[] = [],
    ) => {
      const baseStats = base?.globalStats ?? rawGlobalStatsRef.current;
      const live = new Set(enabledStats(rawGlobalStatsRef.current, statEnabledRef.current).map((s) => s.id));
      const applied = applyStatResponse(baseStats, response, live, null);
      const directApplied = applied.stats;
      const entityBase = base ? base.entityStats ?? {} : entityStatsRef.current;
      const entityApplied = applyEntityStatResponse(entityBase, response, entityInForceUnder(base ? base.ownedTraits ?? {} : ownedTraits));
      const diagnostics = [...applied.diagnostics, ...entityApplied.diagnostics];
      setDebugTurns((turns) => turns.map((turn) => ({ ...turn, requests: turn.requests.map((request) =>
        request.statRequestId === response.requestId ? { ...request, statDiagnostics: diagnostics } : request,
      ) })));
      // Onto the latest values, owner by owner: regen and code land on these the same way.
      if (entityApplied.values !== entityBase) {
        setEntityStats((prev) => ({ ...prev, ...Object.fromEntries(
          Object.entries(entityApplied.values).filter(([id, stats]) => stats !== entityBase[id] && prev[id]),
        ) }));
      }

      // Show the *actual* applied change (clamped to min/max and honoring noIncrease/noDecrease), not the
      // raw request — so a stat pinned at its cap shows no delta, and the live bar/text match the history
      // view's value-diff deltas (`pageStatDeltas`) instead of diverging from them.
      const resolvedApplied = resolveStatNames(directApplied, resolvePH);
      const actualChanges = appliedStatDeltas(resolveStatNames(baseStats, resolvePH), resolvedApplied);

      // The chips show the changes for 10 s; the bands take them over the caller's per-turn reset, so AI
      // changes and regen combine into one turn delta.
      showStatDeltas(null, actualChanges);

      setGlobalStats(directApplied);
      const asksOf = (ownerId: OwnerId) => response.updates.filter((update) => update.ownerId === ownerId);
      return runStatCode(baseStats, directApplied, asksOf(null), clock, base ?? undefined, 'after', {
        entityTurn: {
          values: entityApplied.values,
          asks: Object.fromEntries(Object.keys(entityApplied.values).map((id) => [id, asksOf(id)])),
        },
        thresholdStats,
        triggers,
      });
    },
    [runStatCode, setGlobalStats, setEntityStats, showStatDeltas, resolvePH, entityInForceUnder, ownedTraits],
  );

  // Discard a turn's dangling, unpaired user message. The failure exits (empty narration, request error)
  // and user-initiated Stop can all leave the user message with no assistant reply; left in place it
  // corrupts history pairing — page math and parseTurns both walk strict index pairs — and silently drops
  // every later turn from the model's context. Guarded on the tail actually being a lone user message, so a
  // partially-streamed assistant turn is kept intact. Also restores the choices cleared at turn start.
  const discardUnpairedUserTurn = () => {
    // Half a turn leaves no trace: put back the stats, Code Pins and traits the before box moved. Clearing
    // the bar deltas outright is the box's share alone — the turn drained the previous ones before it ran.
    const undo = beforeBoxUndoRef.current;
    if (undo) {
      beforeBoxUndoRef.current = null;
      beforeBoxDeltasRef.current = {};
      setGlobalStats(undo.globalStats ?? []);
      setCodePins(undo.codePins ?? {});
      setGlobalTraits(undo.globalTraits ?? []);
      setDisabledTraitIds(undo.disabledTraitIds ?? []);
      setAppliedTraitValues(undo.appliedTraitValues ?? {});
      setCascadeOffTraitIds(undo.cascadeOffTraitIds ?? {});
      setOwnedTraits(undo.ownedTraits ?? {});
      resetEntityStats(undo.entityStats ?? {});
      dropStatDeltas();
    }
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
    const restored = lastAssistant ? parseTurnContent(lastAssistant.content)?.choices : undefined;
    setChoices(Array.isArray(restored) ? [...restored] : []);
  };

  // Function to abort ongoing AI generation
  const abortGeneration = () => {
    if (!abortControllerRef.current) return;
    abortControllerRef.current.abort();
    // A script waiting on the player fails as canceled, so the stopped turn's run ends.
    cancelOpenPrompts(scriptPrompts);
    tellTurnRef.current = null;
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
      // The turn is kept, so the before box's writes are kept with it.
      beforeBoxUndoRef.current = null;
      // Its Tool calls are kept too, so a re-roll replays the On Call writes the kept text was written with (Q43).
      const toolCalls = worldToolTurnRef.current?.calls() ?? [];
      const keepCalls = (history: readonly ChatMessage[]) => (toolCalls.length ? withLatestTurnPatched(history, { toolCalls }) : [...history]);
      if (toolCalls.length) setFullMessageHistory(keepCalls);
      // Event-handler context: saveCurrentGameState reads the latest committed state, and the kept
      // narration already landed during streaming — so a synchronous snapshot here is fresh. Index it by
      // its own history length to keep gameStates aligned (same rule as the normal post-turn save).
      const saved = saveCurrentGameState();
      const snapshot = { ...saved, isGameStarted: true, ...(saved.fullMessageHistory ? { fullMessageHistory: keepCalls(saved.fullMessageHistory) } : {}) };
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

  // The Request Transport's context: plain values, read once per request.
  const transportContext = (): TransportContext => ({
    settings: aiSnapshot,
    resolveEndpoint: resolveEndpointForKind,
    tools: allTools,
    worldTools,
    enabledTools,
    toolsEnabled,
    toolSnapshot: toolWorld,
    showSilentRequests,
    noteReasoningReply,
    noteSchemaRejected,
  });

  /** Updates the debug turn a capture belongs to: the current turn, or the turn a silent request names. */
  const updateDebugTurn = (attachTo: string | null, update: (turn: DebugTurn) => DebugTurn) => setDebugTurns((prev) => {
    if (!prev.length) return prev;
    const idx = attachTo === null ? prev.length - 1 : prev.findIndex((t) => t.turnId === attachTo);
    if (idx === -1) return prev;
    const next = prev.slice();
    next[idx] = update(next[idx]);
    return next;
  });

  /** The AI-context viewer's sink: each capture lands on its turn, the response on its own request. */
  const captureSink = (requestType: AIRequestType): TransportSink => (event) => {
    if (event.type === "requestCaptured") {
      // The dictionary activation rides the narration request only, the sole request that injects lore.
      const dictionary = requestType === "narration" ? pendingDictionaryDebugRef.current ?? undefined : undefined;
      updateDebugTurn(event.attachTo, (turn) => ({ ...turn, requests: [...turn.requests, { ...event.record, dictionary }] }));
    } else if (event.type === "responseCaptured") {
      updateDebugTurn(event.attachTo, (turn) => ({
        ...turn,
        requests: turn.requests.map((r) => (r.id === event.id ? { ...r, ...event.response } : r)),
      }));
    }
  };

  /** Shows what a failure needs: the rejected override's notice, or the one failure toast. */
  const failureSink: TransportSink = (event) => {
    if (event.type !== "failure") return;
    const { failure } = event;
    if (failure.kind === "rejectedOverride") surfaceRejectedEndpointOverride(failure, disableEndpointOverride);
    else toastAiRequestFailure(failure.error, () => setConnectionGuideOpen(true));
  };

  /** From a round's Tool calls until the next round's first token, the request waits on those Tools. */
  const lookupSink = (): { sink: TransportSink; end: () => void } => {
    let waiting: readonly string[] | null = null;
    const end = () => {
      const done = waiting;
      if (!done) return;
      waiting = null;
      setToolLookups((rounds) => rounds.filter((round) => round !== done));
    };
    const sink: TransportSink = (event) => {
      if (event.type === "toolCalls") {
        end();
        const round = event.names;
        waiting = round;
        setToolLookups((rounds) => [...rounds, round]);
      }
      if (event.type === "roundStarted") end();
    };
    return { sink, end };
  };

  // The turn end plays in order: the narration's last word fades in, its action row opens, then the choices
  // stream. A turn holds its choices from its start until `landNarration` resolves.
  const turnSeqRef = useRef(0);
  const landingRef = useRef<{ turn: number; landed: Promise<void> } | null>(null);
  const choicesHeldRef = useRef(false);
  const heldChoicesRef = useRef<string[] | null>(null);

  const releaseChoices = () => {
    choicesHeldRef.current = false;
    const held = heldChoicesRef.current;
    heldChoicesRef.current = null;
    if (held) setChoices((prev) => keepSameRows(prev, held));
  };

  /** Waits out the narration's reveal (none for written narration), opens the action row, then releases the
   *  choices once it has opened. Called at the narration's end and again by the commit; the first call runs it. */
  const landNarration = (written = false): Promise<void> => {
    const turn = turnSeqRef.current;
    if (landingRef.current?.turn === turn) return landingRef.current.landed;
    const landed = (fadeRevealActive && !written ? fadeReveal.drained() : Promise.resolve()).then(() => {
      if (turnSeqRef.current !== turn) return;
      setNarrationSettled(true);
      return new Promise<void>((resolve) => setTimeout(() => {
        if (turnSeqRef.current === turn) releaseChoices();
        resolve();
      }, TURN_CHROME_ENTER_MS));
    });
    landingRef.current = { turn, landed };
    return landed;
  };

  /** Starts landing the turn end as soon as the narration stream finishes. */
  const landingListener: NarrationListener = (event) => {
    if (event.type === "finished") void landNarration();
  };

  /** Live choices: each delta parses the list, and a retracted round clears it. Until the turn end lands they
   *  wait in `heldChoicesRef`, so none shows before the narration settles and its action row opens. */
  const choicesSink: TransportSink = (event) => {
    if (event.type === "retract") {
      heldChoicesRef.current = null;
      setChoices([]);
    }
    if (event.type !== "delta") return;
    const choicesList = parseStreamingChoices(stripReasoningLive(event.content));
    if (choicesList.length === 0) return;
    if (choicesHeldRef.current) heldChoicesRef.current = choicesList;
    else setChoices((prev) => keepSameRows(prev, choicesList));
  };

  /**
   * The live reasoning block, from the transport's reasoning and delta events: it shows the thinking until
   * narration starts, then collapses with the think time (first token to first visible narration).
   */
  const liveReasoningSink = (): TransportSink => {
    let content = "";
    let reasoningText = "";
    let firstTokenAt = 0;
    let narrationAt = 0;
    let lastLiveReasoningTick = 0;

    // Two sources: the native `reasoning` field, and an inline <think> body still open inside `content`.
    const renderLiveReasoning = () => {
      lastLiveReasoningTick = performance.now();
      const liveText = [reasoningText.trim(), extractReasoningLive(content)].filter(Boolean).join("\n\n").trim();
      if (liveText) setLiveReasoning({ text: liveText, ms: 0, active: true });
    };

    return (event) => {
      if (event.type === "opened") {
        turnReasoningRef.current = { text: "", ms: 0 };
        setLiveReasoning({ text: "", ms: 0, active: false });
      } else if (event.type === "reasoning") {
        if (!firstTokenAt) firstTokenAt = performance.now();
        reasoningText = event.text;
        if (!narrationAt) renderLiveReasoning();
      } else if (event.type === "delta") {
        if (!firstTokenAt) firstTokenAt = performance.now();
        content = event.content;
        if (narrationAt) return;
        // Inline <think> rides content, which is unthrottled; reasoning events arrive already throttled.
        if (performance.now() - lastLiveReasoningTick > DEFAULT_REASONING_THROTTLE_MS) renderLiveReasoning();
        if (!stripReasoningLive(content).trim()) return;
        narrationAt = performance.now();
        const lr = getLiveReasoning();
        if (lr.active) setLiveReasoning({ text: lr.text, ms: Math.max(0, Math.round(narrationAt - firstTokenAt)), active: false });
      } else if (event.type === "retract") {
        content = "";
        narrationAt = 0;
      } else if (event.type === "done") {
        // The native field plus any inline <think> body. Stored for the block and the committed turn.
        const reasoning = [event.reasoningText.trim(), extractReasoning(event.raw)].filter(Boolean).join("\n\n").trim();
        const ms = reasoning ? Math.max(0, Math.round((narrationAt || performance.now()) - (firstTokenAt || narrationAt || performance.now()))) : 0;
        turnReasoningRef.current = { text: reasoning, ms };
        setLiveReasoning({ text: reasoning, ms, active: false });
      }
    };
  };

  /** The reveal: fade releases whole sentences paced to Streamdown's per-word fade; smooth crawls the text. */
  const revealListenerFor = (wholeSentences: boolean): NarrationListener => narrationRevealListener({
    fade: fadeReveal, crawl: smoothReveal, paced: fadeRevealActive, wholeSentences,
    onOpened: () => setIsRevealingNarration(true),
  });

  /** Streaming read-aloud: synthesizes each sentence as it completes. */
  const readAloudListener: NarrationListener = (event) => {
    const tts = ttsModalRef.current;
    if (event.type === "opened" || event.type === "retract") tts?.streamStart();
    else if (event.type === "sentence") tts?.streamSentence(event.text);
    else if (event.type === "finished") tts?.streamEnd();
    else if (event.type === "canceled") tts?.streamCancel();
  };

  /**
   * The scene list, rebuilt per completed sentence: a name flips from its alias to the real name the moment
   * the narration says it. The turn reapplies it authoritatively at the end.
   */
  const sceneListListener: NarrationListener = (event) => {
    if (event.type !== "display" || !event.boundary) return;
    const { cast, prior } = sceneListCtxRef.current;
    setVisibleEntities((previous) => buildSceneList({ cast, entities: allEntities, narrationSoFar: event.text, priorNarration: prior, previous }));
  };

  /** The in-progress assistant message in history. The turn commits the final text when it finishes. */
  const historyListener: NarrationListener = (event) => {
    if (event.type === "partial") {
      const message = {
        role: "assistant" as const,
        content: JSON.stringify({ narration: event.text, choices: [], stat_changes: [], turnId: currentTurnIdRef.current }),
      };
      setFullMessageHistory((prev) => (prev.at(-1)?.role === "assistant" ? [...prev.slice(0, -1), message] : [...prev, message]));
    } else if (event.type === "retract" && event.hadPartial) {
      setFullMessageHistory((prev) => (prev.at(-1)?.role === "assistant" ? prev.slice(0, -1) : prev));
    }
  };

  /** Opens this turn's During AI Output run over the state the before box left; null when no script or World
   *  Tool has one. */
  const startOutputRun = (): OutputRun | null => {
    const prepared = prepareTurnStartCode(onCallStateRef.current ?? turnBeforeBoxRef.current, 'output');
    // The narration's own offer, as the transport builds it: a Tool it can't call never opens the run.
    const offered = toolsSupported(narrationEndpoint.reasoning)
      ? toolsOfferedTo("narration", allTools, enabledTools, toolsEnabled, worldTools) : [];
    const triggers = worldToolTurnRef.current?.outputTriggers(offered);
    // The crawl shows each sentence as it passes, so only the fade reveal holds any back.
    const run = prepared && openOutputRun(prepared.turn, { released: fadeRevealActive ? getRevealReleased : undefined, triggers });
    outputRunRef.current = prepared && run ? { run, prepared } : null;
    return run;
  };

  /**
   * Lays the output run's writes onto live state, once, ahead of the After batch. Answers the state it left,
   * which the After batch then starts from, null when the run wrote nothing or never ran, and its world writes,
   * which the commit lays on.
   */
  const landOutputRun = async (): Promise<{ written: TurnCodeState | null; world?: WorldWrites }> => {
    const held = outputRunRef.current;
    outputRunRef.current = null;
    const result = await held?.run.landing();
    // The On Call runs landed after the run opened, so the run's writes go on over theirs.
    const onCalled = onCallStateRef.current;
    if (!held || !result) return { written: onCalled };
    const landing = onCalled ? prepareTurnStartCode(onCalled, 'output') : held.prepared;
    if (!landing) return { written: onCalled };
    const { written, world } = landing.finish(result);
    // A turn that never commits puts the writes back with the before box's.
    if (written && !beforeBoxUndoRef.current) beforeBoxUndoRef.current = turnPreBoxRef.current;
    return { written: written ?? onCalled, world };
  };

  /** A run over the turn's start as code has left it: `base`, else the live state; no asks, no regen. */
  const prepareTurnStartCode = (base: TurnCodeState | null, timing: RunTiming = 'before') => {
    const stats = base?.globalStats ?? rawGlobalStatsRef.current;
    return prepareStatCode(stats, stats, [], { deltaHours: 0, elapsedHours: turnClockRef.current ?? gameTime, calendar }, base ?? undefined, timing);
  };
  toolScriptSourceRef.current = (base) => {
    const world = getWorldData();
    return { state: prepareTurnStartCode(base)?.turn.state ?? openingStateOf(world), authored: world };
  };

  /**
   * The narration's sink: live reasoning on the transport, the rest on the Narration Stream. `settled` answers
   * the narration after its During AI Output scripts, once the last sentence has passed; undefined with none.
   */
  const narrationSink = (): { sink: TransportSink; settled: () => Promise<string | undefined> } => {
    const output = startOutputRun();
    // An output script rewrites whole sentences, so the crawl must not show the raw tail.
    const listeners = [revealListenerFor(output !== null), landingListener, sceneListListener, historyListener];
    // Opt-in streaming read-aloud needs a loaded model.
    if (streamNarrationAudio && ttsLoaded) listeners.push(readAloudListener);
    const rewriting = output && rewriteSentences(output.rewrite, ...listeners);
    const toScreen = fanOut([liveReasoningSink(), narrationStream(...(output && rewriting ? [output.listener, rewriting.listener] : listeners))]);
    // Unmount aborts the turn, and its canceled event must not reach the screen. The turn stops waiting on the scripts.
    return {
      sink: (event) => { if (mounted.current) toScreen(event); else rewriting?.abandon(); },
      settled: rewriting ? rewriting.final : () => Promise.resolve(undefined),
    };
  };

  /** Sends one request through the Request Transport, with the sinks its type reports to. */
  const sendAiRequest = async ({ fetchImpl, ...args }: ViewRequest): Promise<string> => {
    const { type: requestType, silent = false, quiet = false } = args;
    if (!silent && !quiet) setAiRequestType(requestType);
    const lookups = lookupSink();
    const sinks = [captureSink(requestType), failureSink, lookups.sink];
    const narration = requestType === "narration" ? narrationSink() : null;
    if (narration) sinks.push(narration.sink);
    if (requestType === "choices") sinks.push(choicesSink);
    try {
      const text = await transportRequest(args, { ...transportContext(), ...(fetchImpl && { fetchImpl }) }, fanOut(sinks));
      // The turn reads the narration its scripts left, which is what the screen and the save already hold.
      return (narration && text ? await narration.settled() : undefined) ?? text;
    } finally {
      lookups.end();
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
        { snapshot: aiSnapshot, tagPrompt: imageTagPrompt, cleanTags: imageCleanTags, signal },
      );
      const cleaned = scrub ? scrub(tags) : tags;
      derivedTagsRef.current.set(subject.id, cleaned);
      return cleaned;
    } catch {
      return ""; // a failed derivation just leaves the subject untagged for this turn
    }
  };

  /** The cast in frame: the persona when the player is in the picture, then this turn's participants resolved
   *  to entities, capped at what a booru model can hold apart (see pickSceneCast). */
  const resolveSceneCast = async (
    participants: string[], playerInFrame: boolean | undefined, signal: AbortSignal, scrub?: (line: string) => string, fresh = false,
  ): Promise<SceneCharacter[]> => {
    const found = pickSceneCast({ participants, entities: allEntities, persona: persona?.entity ?? null, playerInFrame });
    const named = resolveEntityTexts(found, resolveEntityText);
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
    playerInFrame?: boolean;
    /** Re-derive the untagged subjects rather than reusing this session's guesses. */
    fresh?: boolean;
    signal: AbortSignal;
  }): Promise<string> => {
    const { turnId, narration, participants, locationId, playerInFrame, fresh, signal } = args;
    setSceneImageJob("tags");
    // Every place the world knows, not just this one: the narration routinely names somewhere the player
    // is not, and an invented place name is no more useful as a tag for being off-screen.
    const knownTags = await loadKnownTags();
    const places = locations.map((l) => l.name);
    const scrubPlaces = (line: string) =>
      splitTags(line).map((t) => stripPlaces(t, places, knownTags)).filter(Boolean).join(", ");
    const cast = await resolveSceneCast(participants, playerInFrame, signal, scrubPlaces, fresh);
    const location = locations.find((l) => l.id === locationId) ?? currentLocation;
    const locationTags = location ? await resolveSubjectTags(location, "location", signal, scrubPlaces, fresh) : "";
    if (signal.aborted) return "";
    // The tag pass is silent and attached to this turn, so it shows in the AI-context viewer under the
    // scene it describes (with Show Silent Requests on) rather than under whatever turn is current.
    const request = sceneTagsPass.buildRequest(standalonePassInput(), {
      ...emptyTurnMaterial({ action: "", effectiveAction: "", turnId, baseCtx: {}, destinations: [] }),
      ctx: contextValues(),
      narration,
      sceneCast: cast.map((c) => c.name),
    });
    const actionTags = await sendAiRequest({ ...request, signal });
    if (signal.aborted) return "";
    const line = composeSceneTags({
      characters: cast, locationTags, actionTags, places, knownTags, cleanTags: imageCleanTags,
      segmented: takesCharacterPrompts(imageProvider, imageModel),
    });
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
    playerInFrame?: boolean;
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
      // The turn's number as the player counts them, for the file name.
      const turn = fullMessageHistory
        .filter((m) => m.role === "assistant")
        .findIndex((m) => parseTurnContent(m.content)?.turnId === turnId) + 1 || undefined;
      // A scene is landscape by definition; everything else about the request is the user's image preset,
      // shared with the editor's Generate dialog.
      const { provider, params, opts } = buildImageRequest(settings, {
        prompt: line,
        width: imageLandscapeWidth,
        height: imageLandscapeHeight,
        file: { world: worldOverview.name, subject: turn ? `turn-${turn}-scene` : "scene", turn },
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
      if (args.tagsOnly) toastError(error, "Couldn't write tags for this scene.");
      else toastImageFailure(error, "Couldn't draw this scene.");
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

  /** Run the pipeline against `page` (default: the turn the player is looking at). `tagsOnly` stops after the tag line, which
   *  is the cheap loop for judging the tags. Queues behind an in-flight turn rather than competing with it. */
  const startSceneJob = ({ page = currentPage, ...opts }: { tags?: string; tagsOnly?: boolean; page?: number } = {}) => {
    if (imageGenDisabled || sceneImageJob) return;
    const index = pageAssistantIndex(page, messagesPerPage);
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
      playerInFrame: turn.playerInFrame,
      ...opts,
      tags: sceneDrawTags(opts, turn.sceneTags),
      signal: controller.signal,
    });
  };
  const handleSceneImage = (tags?: string, page?: number) => startSceneJob({ tags, page });
  const handleSceneTags = (page?: number) => startSceneJob({ tagsOnly: true, page });

  /** Stop the render in flight; the provider interrupts its server where it can. */
  const cancelSceneImage = () => {
    pendingSceneImageRef.current = null;
    sceneImageAbortRef.current?.abort();
  };

  const handleDeleteSceneImage = (turnId: string, index: number) => {
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
      playerInFrame: parsed.playerInFrame,
      tags: sceneDrawTags(queued, parsed.sceneTags),
      tagsOnly: queued.tagsOnly,
      signal: controller.signal,
    });
  }, [isWaitingForAI, sceneImageJob, fullMessageHistory]);

  // Hold the latest sendAiRequest so the background passes always call a fresh closure without
  // re-running its effect every render (sendAiRequest is rebuilt each render by design).
  const sendAiRequestRef = useRef(sendAiRequest);
  sendAiRequestRef.current = sendAiRequest;

  // The choices/stats requests for the standalone re-rolls (handleRegenerateChoices/Stats), built by the pass
  // records a live turn uses. Callers own the enable-guard and result handling. `quiet: false` keeps the
  // re-roll's own status label; the pass records quiet it under Concurrent Requests.
  const rerollMaterial = (ctx: TokenValues, action: string, narration: string): TurnMaterial => ({
    ...emptyTurnMaterial({ action, effectiveAction: action, turnId: "", baseCtx: ctx, destinations: [] }),
    ctx,
    narration,
  });
  const requestChoices = (
    ctx: TokenValues,
    sceneEntityTokens: TokenValues,
    action: string,
    narration: string,
    signal: AbortSignal,
  ): Promise<string> =>
    sendAiRequest({
      ...choicesPass.buildRequest(standalonePassInput(), { ...rerollMaterial(ctx, action, narration), sceneEntityTokens }),
      quiet: false,
      signal,
    });
  const requestStats = (
    ctx: TokenValues,
    snapshot: StatRequestSnapshot,
    action: string,
    narration: string,
    signal: AbortSignal,
  ): Promise<string> =>
    sendAiRequest({
      ...statUpdatesPass.buildRequest(standalonePassInput(), { ...rerollMaterial(ctx, action, narration), statRequest: snapshot }),
      quiet: false,
      signal,
    });

  /** A stat request snapshot over the player's live `stats`, the played entities' live stats and the live stats
   *  of the `present` entities in `values`, marked for the text pass when its endpoint has refused the schema. */
  const statRequestFor = (stats: readonly PlayerStat[], present: readonly Entity[], values: EntityStatValues): StatRequestSnapshot => {
    const playedOwners = personaStatOwners(
      playedEntities, values, (owned) => resolveStatNames(owned, resolvePH), entityInForceUnder(ownedTraits),
      (groups) => resolveStatGroupTexts(groups, resolvePH),
    );
    return createStatRequest(stats, {
      textPass: !schemaAccepted(resolveEndpointForKind("statUpdates").reasoning),
      placement: { groups: resolveStatGroupTexts(authoredStatGroups, resolvePH), authored: authoredStats },
      // Every played entity's stats are the Player Character's.
      persona: playedOwners.find((owner) => owner.id === persona?.entity.id),
      played: playedOwners.filter((owner) => owner.id !== persona?.entity.id),
      entities: statRequestOwners(
        present, values, personaRef, (owned) => resolveStatNames(owned, resolvePH), entityInForceUnder(ownedTraits),
        (groups) => resolveStatGroupTexts(groups, resolvePH),
      ),
      inSceneIds: present.map((entity) => entity.id),
    });
  };
  /** The defined entities among a turn's participants, as the diary fan-out resolves them. */
  const presentEntitiesOf = (participants: readonly TurnPassSubject[]): Entity[] =>
    participants.flatMap((subject) => subject.entity ? [subject.entity] : []);

  // DEV-only: expose window.__baseline for the fork-local test harness (no-op in production builds).
  const debugTurnsRef = useRef(debugTurns);
  debugTurnsRef.current = debugTurns;
  // A real turn whose narration and choices stream from canned text: the turn's end runs as in play, so its
  // reveal, action row and choices can be watched without an endpoint. The narration is short enough that
  // the choices stream in view.
  runTurnTestRef.current = (profileName = 'steady') => {
    const profile = REVEAL_TEST_PROFILES[profileName];
    if (!profile) {
      toast.info(`Unknown profile. Try: ${Object.keys(REVEAL_TEST_PROFILES).join(', ')}`);
      return;
    }
    void sendGameAction(TURN_TEST_ACTION, {
      script: {
        narration: scriptedFetch(TURN_TEST_NARRATION, profile.schedule(TURN_TEST_NARRATION.length)),
        choices: scriptedFetch(TURN_TEST_CHOICES, REVEAL_TEST_PROFILES.steady.schedule(TURN_TEST_CHOICES.length)),
      },
    });
  };

  const sendGameActionRef = useRef(sendGameAction);
  sendGameActionRef.current = sendGameAction;
  const isGameStartedRef = useRef(isGameStarted);
  isGameStartedRef.current = isGameStarted;
  useBaselineTestHook(debugTurnsRef, sendGameActionRef, abortControllerRef, isGameStartedRef);

  // The Background Pass Queue runs the discover, digest, diary and milestone passes between turns. It lives
  // as long as the view: leaving the game disposes it, which cancels its running passes.
  const passSessionRef = useRef(0); // bumped on load and new game, so a pass from the old session applies nothing
  const currentLocationRef = useRef(currentLocation);
  currentLocationRef.current = currentLocation;
  const [passQueue, setPassQueue] = useState<BackgroundPassQueue | null>(null);
  useEffect(() => {
    const queue = createBackgroundPassQueue({
      send: (request) => sendAiRequestRef.current(request),
      digestRequest: (target) => buildDigestRequestRef.current(target),
      discoverRequest: (target) => buildDiscoverRequestRef.current({
        name: target.name, turnId: target.turnId, firstPassage: target.narration,
      }),
      diaryRequest: (target) => buildDiaryRequestRef.current(target),
      milestoneRequest: (kept, fresh, attachTurnId) => buildMilestoneSelectRef.current(kept, fresh, attachTurnId),
      setHistory: setFullMessageHistory,
      setMilestoneSelection,
      addDiscovered: (target, description) => {
        const entity = materializeDiscoveredEntity(target.name, description);
        const locationId = target.locationId ?? currentLocationRef.current?.id;
        setDiscoveredEntities((prev) =>
          // One entity per character, variants included.
          prev.some((d) => sameCharacterName(d.entity.name, target.name))
            ? prev
            : [...prev, { entity, locationId, sourceTurnId: target.turnId }],
        );
      },
      session: () => passSessionRef.current,
    });
    setPassQueue(queue);
    return () => queue.dispose();
  }, [setFullMessageHistory, setMilestoneSelection, setDiscoveredEntities]);
  const subscribePasses = useCallback(
    (listener: () => void) => passQueue?.subscribe(listener) ?? (() => {}),
    [passQueue],
  );
  const passesRunning = useSyncExternalStore(subscribePasses, () => passQueue?.running() ?? NO_PASSES);

  // A running turn streams its narration into history sentence by sentence; the queue is busy then, so it
  // reads the history as the turn found it and re-derives once the turn ends.
  const settledHistoryRef = useRef(fullMessageHistory);
  if (!isWaitingForAI) settledHistoryRef.current = fullMessageHistory;
  const settledHistory = settledHistoryRef.current;
  useEffect(() => {
    passQueue?.update({
      history: settledHistory,
      effectiveTurns: parseEffectiveTurns(settledHistory),
      milestoneSelection,
      memoryPins,
      busy: isWaitingForAI || sceneImageJob !== null,
      concurrent: concurrentTurnRequests,
      memoryDigests,
      describeCharacters,
      // Diaries are read only by the staged character pass.
      characterDiaries: characterDiaries && thinkingMode === "staged",
      entityNames: allEntities.map((e) => e.name),
      suppressedNames: suppressedCharacterNames,
    });
  }, [passQueue, settledHistory, parseEffectiveTurns, milestoneSelection, memoryPins, isWaitingForAI, sceneImageJob, concurrentTurnRequests, memoryDigests, describeCharacters, characterDiaries, thinkingMode, allEntities, suppressedCharacterNames]);

  const fullMessageHistoryRef = useRef(fullMessageHistory);
  fullMessageHistoryRef.current = fullMessageHistory;

  // Scripts ask the player through the inline prompt line while the game is mounted.
  useScriptPromptListener(scriptPrompts);
  // DEV dev-router: `#dev?modal=scriptPrompt&tab=<sample>` fires one canned prompt once a turn is on screen, as a
  // switch script between turns would. A fixture boots a fresh game, then loads its save, so the sample waits.
  const firedPromptSample = useRef<string | null>(null);
  useEffect(() => {
    if (!import.meta.env.DEV || devRoute?.modal !== 'scriptPrompt') return;
    const sample = devRoute.tab;
    if (!isScriptPromptSample(sample) || firedPromptSample.current === sample) return;
    if (isWaitingForAI || !latestTurnId(fullMessageHistory)) return;
    const timer = setTimeout(() => {
      firedPromptSample.current = sample;
      playPrompts('switch').prompt(SCRIPT_PROMPT_SAMPLES[sample]).then(
        (answer) => console.info('[scriptPrompt]', sample, answer),
        () => console.info('[scriptPrompt]', sample, 'canceled'),
      );
    }, 1000);
    return () => clearTimeout(timer);
  }, [devRoute?.modal, devRoute?.tab, isWaitingForAI, fullMessageHistory, playPrompts]);

  // Regenerate one memory on demand (Memory Manager): re-run the digest prompt on that turn and land the
  // result in the override layer as AI text — no pin and no importance bump, because the player authored
  // nothing here; the selector's verdict still governs it. Silent, like every other digest request.
  // It is a foreground queue job: it waits for running passes, holds the queue, and `signal` cancels it.
  // Returns false when the turn has nothing to summarize or the call fails, and undefined when canceled.
  const regenerateMemory = useCallback(async (turnId: string, signal: AbortSignal): Promise<boolean | undefined> => {
    if (!passQueue) return false;
    try {
      const run = await passQueue.runForeground(async (queueSignal) => {
        // Read at start: a pass that ran first may have written this turn's digest.
        const target = digestTarget(fullMessageHistoryRef.current, turnId);
        if (!target) return false;
        const digest = await sendAiRequestRef.current({ ...buildDigestRequestRef.current(target), signal: queueSignal });
        const trimmed = (digest ?? "").trim();
        if (!trimmed || queueSignal.aborted || !mounted.current) return false;
        // The fresh digest replaces the AI's text only; the turn's `memories.add` lines still follow it.
        const codeMemory = parsedTurnById(fullMessageHistoryRef.current, turnId)?.codeMemory;
        const text = turnMemory({ summary: trimmed, codeMemory }) ?? trimmed;
        setMemoryEdits((prev) => ({ ...prev, [turnId]: { text, source: 'ai' } }));
        return true;
      }, signal);
      return run ? run.value : undefined;
    } catch {
      return false;
    }
  }, [passQueue, setMemoryEdits, mounted]);

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
        const d = wantDigests ? turnMemory(parsed)?.trim() : undefined;
        if (d) wanted.set(vectorKey(d), d);
        if (wantDiaries) {
          for (const text of Object.values(turnDiaries(parsed))) {
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
        // when a batch lands (unlike the background passes, it never touches history), so a first-enable
        // backfill must finish in one pass.
        const toEmbed = missing.filter((k) => !cached.has(k));
        for (let start = 0; start < toEmbed.length; start += 8) {
          const batch = toEmbed.slice(start, start + 8);
          const vecs = await embedTexts(batch.map((k) => wanted.get(k)!), EMBED_BATCH_BOUND_MS);
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

  /** A regeneration waits behind the turn, a scene render and running passes, so it never contends with
   *  them for a single local GPU. */
  const regenWaiting = useSyncExternalStore(subscribePasses, () => passQueue?.waiting() ?? false);

  /**
   * Rewrite a discovered character's description from everything the story has shown of them since.
   * The supplemental context comes from exactly one source, picked by the memory settings; see
   * lib/discoveredRegen. A foreground queue job: `signal` cancels it while it waits or runs.
   * Resolves to the new text, null when nothing usable came back, or undefined when canceled.
   */
  const discoveredDescriptionJob = useCallback(async (entity: Entity, signal: AbortSignal): Promise<string | null> => {
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
        const vecs = await embedTexts([query], EMBED_BOUND_MS);
        if (vecs.length > 0) semantic = { queryVec: vecs[0], vectorsByKey: embedVectorsRef.current };
      } catch {
        semantic = null;
      }
    }
    if (signal.aborted) return null;

    // Read at start: a pass that ran first may have written the digests and diaries this reads.
    const history = fullMessageHistoryRef.current;
    const context = buildRegenContext({
      history,
      name,
      sourceTurnId: record?.sourceTurnId,
      source,
      diaryEntries: source === 'diary' ? collectCharacterDiary(history, name, -1) : undefined,
      semantic,
    });

    const response = await sendAiRequestRef.current({
      ...buildDiscoverRequestRef.current({
        name,
        turnId: record?.sourceTurnId,
        firstPassage: context.firstPassage,
        laterMaterial: context.supplemental,
      }),
      signal,
    });
    if (signal.aborted) return null;
    return cleanDiscoveredDescription(response ?? "", name) || null;
  }, [discoveredEntities, semanticMemory, characterDiaries, memoryDigests]);

  const regenerateDiscoveredDescription = useCallback(
    async (entity: Entity, signal: AbortSignal): Promise<string | null | undefined> => {
      if (!passQueue) return null;
      const run = await passQueue.runForeground((queueSignal) => discoveredDescriptionJob(entity, queueSignal), signal);
      return run ? run.value : undefined;
    },
    [passQueue, discoveredDescriptionJob],
  );

  const handleSendAction = () => {
    const input = playerInput.trim();
    // A scene render holds the turn as well as the input: the model and the image server share one card.
    if (!input || isWaitingForAI || sceneImageJob) return;
    if (input.startsWith("/")) {
      runSlashCommand(input);
      setPlayerInput("");
      return;
    }
    sendGameAction(input, { attachments: pendingAttachments });
  };

  // Enter submits; Shift+Enter inserts a newline (the action box is a multi-line textarea).
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey && !isWaitingForAI && !sceneImageJob) {
      e.preventDefault();
      handleSendAction();
    }
  };

  // The banner naming what the player's last switch or persona change turned off. Session-only.
  const [traitCascade, setTraitCascade] = useState<TraitCascade | null>(null);
  const traitName = useCallback((trait: Trait) => resolveTraitText(trait, trait.name), [resolveTraitText]);
  const commitGatedTraits = useCallback(
    (result: GatedTraitResult, because: string) => {
      if (result.state !== traitState) commitTraitState(result.state);
      for (const line of result.log) addLogEntry(line);
      setTraitCascade(result.cascadeNames.length ? { off: result.cascadeNames, because } : null);
    },
    [traitState, commitTraitState, addLogEntry],
  );
  const commitLoadSettle = useCallback(
    (result: GatedTraitResult) => commitGatedTraits(result, 'changes to the world'),
    [commitGatedTraits],
  );
  const settleHistory = useMemo(() => ({ states: gameStates, commit: setGameStates }), [gameStates, setGameStates]);
  useSettleOnSaveLoad(saveLoads, !personaPending, traitState, gatedWorld, traitName, commitLoadSettle, settleHistory);
  useSeedAvatarOnSaveLoad(saveLoads, !personaPending, persona);
  // The per-turn settle writes log lines and leaves the banner alone, as a stat-code switch does (Q26).
  const commitTurnSettle = useCallback(
    (result: GatedTraitResult) => {
      commitTraitState(result.state);
      for (const line of result.log) addLogEntry(line);
      // The settle waits for these runs, so the turn's snapshot holds their writes.
      return fireSwitchScripts(traitState, result.state, gatedWorld());
    },
    [commitTraitState, addLogEntry, fireSwitchScripts, traitState, gatedWorld],
  );
  const settleTurn = useTurnSettle(traitState, gatedWorld, traitName, commitTurnSettle);

  /**
   * Switch a trait on or off mid-play, acquiring it first if the player doesn't have it yet. Every trait the
   * author marked switchable is available whenever its gate holds; everything the trait does beyond its stat changes (AI
   * text, stat availability, placeholder pins) is derived from the active set and simply follows. An acquired
   * trait freezes the world's stat changes as they stand right now, authored and chips intact, as seeding does.
   */
  const toggleTrait = useCallback(
    (traitId: string, enabled: boolean, ownerId: OwnerId) => {
      const world = gatedWorld();
      const result = switchPlayerTrait(traitState, traitId, enabled, world, traitName, ownerId);
      if (!result) return;
      commitGatedTraits(result, traitNameIn(world, traitId, traitName, ownerId) ?? traitId);
      void fireSwitchScripts(traitState, result.state, world);
    },
    [traitState, gatedWorld, traitName, commitGatedTraits, fireSwitchScripts],
  );

  /** Move the stats onto a new persona, whose linked stat traits replace the old one's, then settle the traits
   *  under it, which can open or close "playing as" gates. */
  const settlePersonaTraits = useCallback(
    (ref: PersonaRef, name: string | null, from: TraitWorld) => {
      const to = gatedWorld(ref);
      const moved = switchPersonaStats(traitState, from, to, traitName);
      const settled = settleTraits(moved.state, to, traitName);
      commitGatedTraits({ ...settled, log: [...moved.log, ...settled.log] }, name ?? 'the persona change');
      void fireSwitchScripts(traitState, settled.state, to, from);
    },
    [traitState, gatedWorld, traitName, commitGatedTraits, fireSwitchScripts],
  );
  // A library persona settles once its entity loads, so the settle and the run read it (Q15). `from` is the
  // world the traits still hold under.
  const [waitingPersona, setWaitingPersona] = useState<{ ref: PersonaRef; name: string | null; from: TraitWorld } | null>(null);
  const changePersona = useCallback(
    (ref: PersonaRef, name: string | null) => {
      const from = waitingPersona?.from ?? gatedWorld();
      if (ref.source === 'library') {
        setWaitingPersona({ ref, name, from });
        return;
      }
      setWaitingPersona(null);
      settlePersonaTraits(ref, name, from);
    },
    [waitingPersona, gatedWorld, settlePersonaTraits],
  );
  useEffect(() => {
    if (!waitingPersona || personaPending || !personaRef || !samePersonaRef(personaRef, waitingPersona.ref)) return;
    setWaitingPersona(null);
    settlePersonaTraits(waitingPersona.ref, waitingPersona.name, waitingPersona.from);
  }, [waitingPersona, personaPending, personaRef, settlePersonaTraits]);

  const changeLocation = useCallback(
    (newLocation: GameLocation) => {
      setCurrentLocation(newLocation);
      carryFollowersTo(newLocation.id);

      if (newLocation.ambientSound) {
        setAmbientSound(newLocation.ambientSound);
      } else {
        setAmbientSound(null);
      }
    },
    [setCurrentLocation, carryFollowersTo],
  );

  const isInitialized = useRef(false);

  useEffect(() => {
    // Gate on the world being loaded, NOT on `locations.length` — a world with no locations authored yet
    // (every freshly created one) would otherwise never initialize, silently skipping the stat baselines,
    // traits, dictionaries and the opening-cue pre-fill below. `worldLoaded` turns true in the same batch
    // as the rest of the world data, and holds for a world file with no id.
    if (!isInitialized.current && worldLoaded) {
      isInitialized.current = true;
      passSessionRef.current += 1;

      // Cold-load from the main menu: restore the save instead of starting a fresh game. Its world is
      // already in GameData (loaded before this view mounted), so `locations` here are the right ones.
      if (initialSaveId) {
        void loadGame(initialSaveId, locations, authoredStats, codeEntities.world, worldOverview.vrmStore);
        return;
      }

      // New game, once: a loaded save returned above. The fold reads the authored world, chips and all.
      const opening = openingFold(getWorldData(), { traits: initialTraits, owned: initialOwnedTraits }, {
        ...(initialPersona ?? { ref: { source: 'none' } }), characters: initialCharacters ?? [],
      });
      const acquired = opening.state.ownerTraits.acquired;
      const seedLibrary = opening.state.ownerTraits.library ?? [];
      newPlaythroughRef.current = true;
      // A log line is frozen when written, so each authored trait resolves now with its owner's pins.
      const ownerEntity = (id: string | null) =>
        (id == null ? null : traitEntities.find((e) => e.id === id) ?? seedLibrary.find((e) => e.id === id) ?? null);
      for (const { trait, ownerId } of opening.startingTraits) {
        for (const line of startingTraitLog([trait], (t) => resolveTraitText(t, t.name, ownerEntity(ownerId)))) addLogEntry(line);
      }
      commitTraitState(opening.traitState);
      // The seeded entity stats are also the baseline their first changes read from.
      resetEntityStats(opening.entityStats);
      // A new game starts with no entity picked in the stat panel or the entity view.
      setSelectedEntityId(undefined);

      // Use the player's chosen starting location, else a random starting point (fallback: any location).
      const location = resolveStartingLocation(locations, initialLocationId);
      const authoredLocation = location ? authoredLocations.find((l) => l.id === location.id) ?? location : null;
      // The pins the game opens under, from every source: the traits just applied, the starting location
      // and the bands the post-trait stats fall in. None of it is in state yet, so anything written in this
      // pass resolves against these rather than the (empty) pins still in force.
      const openingPins = ownerPins({
        world: ownerWorld,
        persona: initialPersona?.ref,
        library: seedLibrary,
        globalTraits: acquired,
        owned: initialOwnedTraits,
        sharedPlaceholders: worldPlaceholders,
      }, { location: authoredLocation, stats: opening.traitState.stats, placeholders, rolls: sessionRolls }).world;
      if (location && authoredLocation) {
        changeLocation(location);
        // A log line is frozen the moment it is written.
        addLogEntry(`Starting in location: ${resolveWith(openingPins, authoredLocation.name)}`);
      }

      // Seed the per-playthrough dictionary set: the entry-step selection, or the world's authored books
      // when the step was skipped. A loaded save overrides this later via loadGame.
      const runBooks = initialDictionaries ?? dictionaries;
      setRuntimeDictionaries(runBooks);

      // Fresh playthrough: no memory pins, Code Pins, selection or player overrides yet. loadGame overrides.
      setMemoryPins({});
      setCodePins({});
      setEntityVisualPreference({});
      // A new game always holds a reference; None is a choice, and absence means a save from before personas.
      const personaPick: PersonaPick = initialPersona ?? { ref: { source: 'none' } };
      setPersonaRef(personaPick.ref);
      setOpeningTurnAction(null);
      // Drawn now, so page one reads the Wildcard values every later turn reads.
      setSessionPersona(personaPick.libraryEntity ?? null);
      setEntityImageIndex({});
      setMilestoneSelection(null);
      setMemoryEdits({});
      setMemoryDeleted([]);
      setMemoryNotes([]);

      // Seed the entry-step characters into the starting location as runtime-only entities (never written
      // to the authored world). They flow through the existing discovered-entity path; loadGame overrides.
      // The opening draw reads the same list, so a reload's pool matches this one.
      const picked = location ? initialCharacters ?? [] : [];
      if (location && picked.length > 0) {
        setDiscoveredEntities(
          picked.map((entity) => ({ entity, locationId: location.id, sourceTurnId: INITIAL_SOURCE_TURN_ID })),
        );
      }
      // Their placeholders and the library books' are drawn now too, for the same reason as the persona's.
      const libraryBooks = libraryBooksInPlay(runBooks, dictionaries);
      const openingRolls = setSessionLibraryAdditions(picked, libraryBooks);

      // Pre-fill the drawn opening so the player can shape the first turn before submitting it. Resolved
      // here (against the pins the traits above are about to impose) so the player reads plain prose.
      // An Opening Narration is page one: the game starts on it at once, with the box left empty.
      // Each One entity starts at one of its locations, so the opening pool reads who stands at the start.
      const startPositions = startingPositions(positionedCast(codeEntities.world, personaPick.ref), locations.map((l) => l.id));
      setEntityPositions(startPositions);
      setEntityFollowers([]);
      setMetEntities([]);
      entityOfferRef.current = NO_ENTITY_OFFER;
      followerPeelRef.current = undefined;
      // The whole world, since the cast in state still reads the persona from before this seed.
      const { persona: drawnPersona, draw: drawn, owner: drawnOwner } = drawNewGameOpening({
        pick: personaPick, worldEntities: entitiesInPlay(traitEntities, startPositions), overview: worldOverview, locations, startingLocationId: location?.id,
        picked, random: Math.random,
      });
      openingSessionRef.current = {
        ...newOpeningSession(), drawn: { opening: drawn.opening, ownerId: drawn.ownerId }, shown: drawn.shown,
        startLocationId: location?.id ?? null,
      };
      const openingText = resolveOpening(drawn.opening.text, {
        extraPins: openingPins, persona: drawnPersona, rolls: openingRolls, libraryAdditions: [...picked, ...libraryBooks], owner: drawnOwner,
      });
      if (drawn.opening.kind === "narration") {
        pendingTurnRef.current = { action: "START GAME", writtenNarration: openingText };
        setPendingTurnNonce((n) => n + 1);
      } else {
        setPlayerInput(openingText);
      }
    }
  }, [
    initialSaveId,
    loadGame,
    resetEntityStats,
    setSelectedEntityId,
    initialTraits,
    initialOwnedTraits,
    traitEntities,
    initialLocationId,
    placeholders,
    sessionRolls,
    initialDictionaries,
    initialCharacters,
    initialPersona,
    dictionaries,
    getWorldData,
    authoredLocations,
    ownerWorld,
    worldPlaceholders,
    locations,
    worldLoaded,
    worldOverview,
    entities,
    authoredStats,
    resolveWith,
    resolveOpening,
    commitTraitState,
    codeEntities,
    resolveTraitText,
    changeLocation,
    addLogEntry,
    setRuntimeDictionaries,
    setPersonaRef,
    setOpeningTurnAction,
    setSessionPersona,
    setSessionLibraryAdditions,
    setDiscoveredEntities,
    setPlayerInput,
    setMemoryPins,
    setCodePins,
    setEntityPositions,
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

  useLoopingAudio(bgmEnabled ? worldOverview?.bgm : null);
  useLoopingAudio(ambientSound?.data);

  // Extract the displayed narration from an assistant message (see lib/aiResponse).
  const parseAssistantMessage = (content: string) => narrationOf(content) ?? "";

  // The status strip names the running request: a turn's AI request, a Tool round, or a background pass.
  // One start per busy stretch, so the timer spans every request of the turn and resets with the next.
  const busyStartedAtRef = useRef<number | null>(null);
  if (!isWaitingForAI) busyStartedAtRef.current = null;
  else busyStartedAtRef.current ??= Date.now();
  const turnStartedAt = busyStartedAtRef.current ?? undefined;

  const progressBar = (() => {
    // The active turn's request takes the status row; a silent memory digest (which runs between turns)
    // shows here too when no turn is in flight, but only when "Show Silent Requests" is enabled. Tool
    // rounds are silent requests, so their line follows the same setting.
    const toolStatus = toolCallStatus(toolLookups);
    if (toolStatus && showSilentRequests) return <RequestStatusRow label={toolStatus} glyph={TOOL_GLYPH} startedAt={turnStartedAt} />;
    if (isWaitingForAI) {
      const status = requestStatus(aiRequestType);
      return <RequestStatusRow label={requestLabel(status)} glyph={status.glyph} startedAt={turnStartedAt} />;
    }
    // Null when no pass runs, so the footer floats no empty strip and the narration takes no strip fade.
    return showSilentRequests && passesRunning.size > 0 ? <BackgroundPassStatus running={passesRunning} /> : null;
  })();

  // The context meter's history math is O(turns) (parseTurns + banding), so memoize it. A running turn
  // writes its narration into history sentence by sentence, so the meter holds its last reading until the
  // turn ends.
  const memoryStatsRef = useRef<{ promptTokens: number; trimmed: ChatMessage[]; bandCounts: BandCounts | null; historyTokens: number } | null>(null);
  const memoryStats = useMemo(() => {
    if (isWaitingForAI && memoryStatsRef.current) return memoryStatsRef.current;
    const promptTokens = estimateTokens(lastPromptChars);
    const { messages: trimmed } = getTrimmedMessageHistory(promptTokens, "", lastRelevanceScoresRef.current, lastActionVecRef.current);
    return {
      promptTokens,
      trimmed,
      bandCounts: lastBandCountsRef.current, // set as a side effect of the call above
      historyTokens: estimateTokens(estimateHistoryChars(trimmed)),
    };
  }, [getTrimmedMessageHistory, lastPromptChars, isWaitingForAI]);
  memoryStatsRef.current = memoryStats;

  const memoryBar = (() => {
    // Token breakdown of the model's context window: prompt + history + reserved output vs the window.
    const windowTokens = contextWindow || 1;
    const { promptTokens, trimmed, bandCounts, historyTokens } = memoryStats;
    const outputTokens = reserveTokens;
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
          <Tip tip="Memory usage">
            <PopoverTrigger asChild>
              <button className="text-muted-foreground hover:text-foreground">
                <Database className="h-4 w-4" />
              </button>
            </PopoverTrigger>
          </Tip>
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

  // DEV dev-router: `#dev?modal=likePrompt` asks about a canned listing, because a dev world has no
  // listing and the card's answer comes from the server. Tree-shaken in prod.
  const devLikePrompt = import.meta.env.DEV && devRoute?.modal === 'likePrompt';
  const likePromptCard = (
    <LikePrompt
      listingId={devLikePrompt ? 'dev-listing' : likeAsk.listingId}
      worldName={worldOverview.name}
      onClosed={likeAsk.closed}
      readListing={devLikePrompt
        ? async () => ({ status: 'ok' as const, liked: false, ownListing: false, anonymousLikes: true })
        : undefined}
      className="w-full max-w-xl"
    />
  );

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
          const offer = entityOfferRef.current;
          const offered = followerPeelRef.current;
          entityOfferRef.current = NO_ENTITY_OFFER;
          followerPeelRef.current = undefined;
          if (hasEntityOffer(offer)) {
            const live = liveFollowerState();
            const went = moveWithPlayer(live, offer, suggestedLocation.id);
            applyFollowerState(
              { followers: went.followers, positions: movedPositions(went.positions, live.positions) },
              offered ? peeledCharacters(went, offered.peelOff, new Set(), offered.turnId) : [],
            );
          }
          setSuggestedLocation(null);
        }}
      >
        Go
      </Button>
      <Button
        size="sm"
        variant="ghost"
        onClick={() => {
          entityOfferRef.current = NO_ENTITY_OFFER;
          followerPeelRef.current = undefined;
          setSuggestedLocation(null);
        }}
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
      narrationPrompt={systemPrompt}
      requestedTab={surfaceNav.tab('gameViewer')}
      requestKey={surfaceNav.key}
    />
  );

  // The scene images belonging to the page being viewed (one turn per page).
  const viewedTurn = parseTurnContent(fullMessageHistory[pageAssistantIndex(currentPage, messagesPerPage)]?.content ?? "");

  const middlePanel = (
    <MiddlePanel
      parseAssistantMessage={parseAssistantMessage}
      narrationBadge={<DemoAIBadge onOpen={openDemoAIDialog} />}
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
      likePrompt={likePromptCard}
      locationSuggestion={locationSuggestion}
      commandPreview={commandPreview}
      commandChoices={commandChoices}
      commandRunId={commandRunId}
      commandAction={commandChoices ? CHOICES_TEST_ACTION : null}
      onDismissCommandPreview={stopCommandPreview}
      onRescanNarration={rescanNarration}
    />
  );

  const rightPanel = (
    <RightPanel
      onLocationClick={() => setIsLocationModalOpen(true)}
      onToggleTrait={toggleTrait}
      onPersonaChange={changePersona}
      traitCascade={traitCascade}
      onDismissTraitCascade={() => setTraitCascade(null)}
      onRegenerateStats={handleRegenerateStats}
      sceneImageJob={sceneImageJob}
      language={language}
      setLanguage={setLanguage}
    />
  );

  // The location whose background the scene shows — the paged turn's when browsing history, else live.
  const viewLocation = isViewingPast
    ? (locations.find((l) => l.id === viewLocationId) ?? currentLocation)
    : currentLocation;
  const backdrop = useLocationBackdrop(viewLocation);
  const mapBackdrop = useMapBackdrop(worldOverview);

  // Menu save/load handlers, extracted so the desktop (header) and mobile (tab-row) MenuModal instances share them.
  const handleMenuSave = (name: string, opts?: { overwriteId?: string; includeSceneImages?: boolean }) =>
    saveGame(name, worldOverview.name, worldId ? String(worldId) : undefined, opts?.overwriteId, {
      includeSceneImages: opts?.includeSceneImages,
    });
  const handleMenuLoad = async (id: string, targetWorldId?: string) => {
    // A render or a background pass from the outgoing session must not finish into the loaded one.
    cancelSceneImage();
    passSessionRef.current += 1;
    passQueue?.abort();
    // The loaded save draws its own opening on first need, with nothing shown yet.
    openingSessionRef.current = newOpeningSession();
    // A save from another (installed) world: swap GameData to that world first, then restore the save against
    // its locations — otherwise the save would run inside the current world's shell.
    if (targetWorldId && targetWorldId !== (worldId ? String(worldId) : undefined)) {
      try {
        const world = await WorldStorageService.getWorldData(targetWorldId) as World;
        // Use the migrated world for the save restore — the raw one may be a legacy shape whose locations/
        // stats lack the migration fixes (morph bindings, renamed keys) that loadWorldData just applied.
        const { world: migrated } = loadWorldData(world, false, { stored: true });
        return await loadGame(
          id, Array.isArray(migrated.locations) ? migrated.locations : [], Array.isArray(migrated.stats) ? migrated.stats : [],
          Array.isArray(migrated.entities) ? migrated.entities : [], migrated.worldOverview?.vrmStore,
        );
      } catch (error) {
        console.error('Cross-world load failed:', error);
        toastError(error, { headline: "Couldn't load that save's world." });
        return false;
      }
    }
    return loadGame(id, locations, stats, codeEntities.world, worldOverview.vrmStore);
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
      className={`flex ${isMobile ? "flex-col pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]" : "p-4"} app-viewport isolate text-label md:text-body bg-background overflow-hidden`}
    >
      {locationBackground && (
        <LocationBackdrop
          image={backdrop}
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
      <Tip tip={uiHidden ? "Show UI" : "Hide UI"}>
        <Button
          onClick={() => setUiHidden((h) => !h)}
          className={`absolute bottom-2 left-2 z-30 flex items-center justify-center rounded-full w-10 h-10 p-0 transition-opacity ${
            uiHidden ? "opacity-0 hover:opacity-100" : "opacity-100"
          }`}
        >
          {uiHidden ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
        </Button>
      </Tip>
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
        <Tip tip="Show the full AI context sent each turn">
          <Button
            onClick={() => setIsDebugOpen(true)}
            className="flex items-center justify-center rounded-full w-10 h-10 p-0"
          >
            <ScrollText className="h-5 w-5" />
          </Button>
        </Tip>
      </div>
      )}

      {/* Edit-world + Menu buttons — desktop only. On mobile both fold into the tab-row menu. */}
      {!uiHidden && !isMobile && (
      <div className="absolute top-16 right-2 md:top-2 flex gap-2">
        <Tip tip="Edit World">
          <Button
            onClick={() => setIsEditingWorld(true)}
            className="flex items-center justify-center rounded-full w-10 h-10 p-0"
          >
            <SquarePen className="h-5 w-5" />
          </Button>
        </Tip>
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
        // The persona opens from the Entities tab too, though it is never part of the cast.
        const found = allEntities.find((f) => f.name === selectedEntity)
          ?? (persona?.entity.name === selectedEntity ? persona.entity : null);
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
              waiting: regenWaiting,
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
        entitiesAt={metRoster}
        mapBackground={mapBackdrop}
        changeLocation={changeLocation}
        resolveText={resolvePH}
      />


      {/* Edit-world popup: non-fullscreen; keeps GameViewer + live session mounted */}
      <Dialog
        open={isEditingWorld}
        onOpenChange={(open) => {
          if (open) { setIsEditingWorld(true); return; }
          // Guard close (X / Esc / overlay): the same leave as any other.
          leaveEditorThen(() => {}, () => {});
        }}
      >
        <DialogContent surface="worldEditor" aria-describedby={undefined} className="max-w-[95vw] w-[95vw] h-[90dvh] p-0 overflow-hidden">
          <DialogTitle className="sr-only">World Editor</DialogTitle>
          <WorldEditor
            embedded
            inGame
            onClose={() => setIsEditingWorld(false)}
            initialTab={surfaceNav.tab('worldEditor')}
            initialBenchTab={surfaceNav.tab('worldEditorBench')}
            initialTarget={surfaceNav.target}
            requestKey={surfaceNav.key}
            exitRef={editorExit}
          />
        </DialogContent>
      </Dialog>
      <UnsavedChangesDialog
        open={showEditorExitPrompt && !worldChangedElsewhere}
        // A dismissal is a refusal of whatever waited on the prompt.
        onOpenChange={(open) => { setShowEditorExitPrompt(open); if (!open) takeEditorLeave()?.cancel(); }}
        autoSaved={editorPromptAutoSaved}
        // The editor saves and discards, so the prompt shares autosave's lock and its failure toast.
        onSave={async () => {
          // No editor means nothing to save; the prompt stays up rather than close on a save that never ran.
          const exit = editorExit.current;
          if (!exit) return;
          const next = takeEditorLeave();
          const saved = await exit.save();
          if (!mounted.current) return;
          setShowEditorExitPrompt(false);
          // A failed save stops the request and keeps the editor open with its edits, as the menu editor does.
          if (saved) { setIsEditingWorld(false); next?.then(); } else next?.cancel();
        }}
        onExit={() => {
          const next = takeEditorLeave();
          setShowEditorExitPrompt(false);
          const leave = () => { setIsEditingWorld(false); next?.then(); };
          if (editorExit.current) editorExit.current.discard(leave); else leave();
        }}
      />
      {/* A surface request for the main menu asks the in-game Exit's question, then the editor's. */}
      <ConfirmDialog
        open={leaveForSurface !== null}
        onOpenChange={(open) => {
          if (open) return;
          if (!leavingForSurface.current) leaveForSurface?.clear();
          leavingForSurface.current = false;
          setLeaveForSurface(null);
        }}
        title={EXIT_TO_MENU_PROMPT.title}
        icon={<DoorOpen className="h-4 w-4" />}
        description={EXIT_TO_MENU_PROMPT.description}
        onConfirm={() => {
          leavingForSurface.current = true;
          const clear = leaveForSurface?.clear ?? (() => {});
          leaveEditorThen(onExitToMenu, clear);
        }}
      />

      {/* Full AI context sent each turn, paginated by turn */}
      <Dialog open={isDebugOpen} onOpenChange={setIsDebugOpen}>
        <DialogContent surface="aiContext" aria-describedby={undefined} className="max-w-[95vw] w-[95vw] h-[90dvh] flex flex-col overflow-hidden">
          <RenderMounted render={() => {
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
              const regions = anatomyRegions(toAnatomyBlocks(req.messages, req.anatomy));
              const inputs = [...regions.system, ...regions.messages].map(([block, bi]) => ({ blockIndex: bi, text: block.content }));
              const chunks = inputs.map(({ blockIndex, text }) => ({
                key: `${i}:in:${blockIndex}`, group: `group-${i}`, section: i as string | number, request: i, text,
              }));
              if (req.reasoning) {
                chunks.push({ key: `${i}:reasoning`, group: `group-${i}`, section: `reasoning-${i}`, request: i, text: req.reasoning });
              }
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
                  : variant.includes("known") ? "known here"
                  : "here";
                return `${what} ${scope}${variant.includes("summary") ? " (summary)" : ""}`;
              }
              return region;
            };
            const ruleLabel = (rule: MatchRule): string => {
              const parts = [rule.regex ? "regex" : rule.wholeWord ? "whole word" : "substring"];
              if (rule.regex && rule.wholeWord) parts.push("whole word");
              if (rule.caseSensitive) parts.push("case-sensitive");
              return parts.join(", ");
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
            const segmentsFor = (text: string, req: AiRequestRecord, isOutput: boolean): Seg[] =>
              debugHighlightMode === "hydrations"
                ? buildHydrationSegments(text, req.type === "narration" ? activeHydrationRules : [])
                : buildDictSegments(text, isOutput ? undefined : req.dictionary);
            /* One slice of one block, marked by the highlighters and then by the search. `key` names the
               block in this turn's hit plan and `start` is where the slice begins inside it, so a block
               drawn in pieces still marks the same hits under the same numbers. */
            const renderBlock = (text: string, req: AiRequestRecord, isOutput: boolean, key: string, start = 0) => {
              const segs = segmentsFor(text, req, isOutput);
              const plan = searchActive ? findByKey.get(key) : undefined;
              return renderSegs(plan ? markFindHits(segs, plan.hits, start, plan.base) : segs);
            };
            // The memory digest for this turn (stored on its assistant message), if one has been generated.
            const currentParsed = currentTurn?.turnId ? parsedTurnById(fullMessageHistory, currentTurn.turnId) : undefined;
            const currentSummary = currentParsed ? turnMemory(currentParsed) : undefined;
            // Collapse keys: one per request group ("group-<i>"), one per request body, plus one per
            // captured reasoning ("reasoning-<i>") and raw output ("out-<i>"). Collapse/expand all toggles every level.
            const collapseKeys: (string | number)[] = [];
            currentRequests.forEach((req, i) => {
              collapseKeys.push(`group-${i}`);
              collapseKeys.push(i);
              if (req.reasoning) collapseKeys.push(`reasoning-${i}`);
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
            // The search effect above resets the hit position when the text empties.
            const clearSearch = () => {
              setDebugSearch("");
              debugSearchInputRef.current?.focus();
            };
            return (
              <>
                {/* The header row: the title beside the search field; pr-8 keeps it clear of the
                    dialog's Close button. Below md the title goes back to being screen-reader-only. */}
                <div className="flex items-center gap-2 flex-shrink-0 pr-8">
                  <DialogTitle className="sr-only md:not-sr-only md:flex md:flex-shrink-0 md:items-center md:gap-1.5">
                    <ScrollText className="h-5 w-5" />
                    AI Context
                  </DialogTitle>
                  {/* The find controls share the search field's frame, so the toolbar keeps its one row. */}
                  <div className="relative min-w-0 flex-grow">
                    <Search className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      ref={debugSearchInputRef}
                      value={debugSearch}
                      onChange={(e) => setDebugSearch(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key !== "Enter") return;
                        e.preventDefault();
                        stepHit(e.shiftKey ? -1 : 1);
                      }}
                      placeholder="Search (space-separated terms)…"
                      className={`pl-8 ${debugSearch !== "" ? "pr-36" : ""}`}
                    />
                    {/* Any text shows the group. The X follows the counter, whose width changes with the count. */}
                    {debugSearch !== "" && (
                      <div className="absolute right-1 top-1/2 flex -translate-y-1/2 items-center gap-0.5">
                        <span className="px-1 text-meta tabular-nums text-muted-foreground">
                          {hitTotal > 0 ? `${currentHit + 1} of ${hitTotal}` : "0 of 0"}
                        </span>
                        <ClearSearchButton size="sm" onClick={clearSearch} />
                        <Tip tip="Previous match (Shift+Enter)">
                          <button
                            type="button"
                            onClick={() => stepHit(-1)}
                            disabled={hitTotal === 0}
                            aria-label="Previous match"
                            className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-40"
                          >
                            <ChevronUp className="h-4 w-4" />
                          </button>
                        </Tip>
                        <Tip tip="Next match (Enter)">
                          <button
                            type="button"
                            onClick={() => stepHit(1)}
                            disabled={hitTotal === 0}
                            aria-label="Next match"
                            className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-40"
                          >
                            <ChevronDown className="h-4 w-4" />
                          </button>
                        </Tip>
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2 flex-shrink-0 text-meta">
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
                            <Tip key={entry.id} tip="Did not activate this turn" labelsChild={false}>
                              <span className="rounded border border-border px-1.5 py-0.5 opacity-40 text-muted-foreground">
                                {label}
                              </span>
                            </Tip>
                          );
                        }
                        const disabled = disabledHighlights[entry.id];
                        return (
                          <Tip
                            key={entry.id}
                            labelsChild={false}
                            tip={
                              semantic
                                ? `Activated by meaning (similarity ${activation?.semanticSimilarity?.toFixed(2) ?? "?"}) — no keyword hit to highlight`
                                : disabled ? "Click to show highlights" : "Click to hide highlights"
                            }
                          >
                            <button
                              onClick={() =>
                                setDisabledHighlights((prev) => ({ ...prev, [entry.id]: !prev[entry.id] }))
                              }
                              className="rounded border px-1.5 py-0.5"
                              style={
                                disabled
                                  ? { borderColor: colorMap[entry.id], opacity: 0.5 }
                                  : { backgroundColor: colorMap[entry.id], borderColor: colorMap[entry.id], color: "#000" }
                              }
                            >
                              {label}
                            </button>
                          </Tip>
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
                        <Tip
                          key={term}
                          labelsChild={false}
                          tip={disabled ? "Click to enable highlight" : "Click to disable highlight"}
                        >
                          <button
                            onClick={() =>
                              setDisabledHydrations((prev) => ({ ...prev, [term]: !prev[term] }))
                            }
                            className="rounded border px-1.5 py-0.5"
                            style={
                              disabled
                                ? { borderColor: color, opacity: 0.5 }
                                : { backgroundColor: color, borderColor: color, color: "#000" }
                            }
                          >
                            {term}
                          </button>
                        </Tip>
                      );
                    })
                  ) : (
                    <span className="text-muted-foreground">No hydration terms for this turn.</span>
                  )}
                </div>
                {/* The turn line and the view controls share one row: the text truncates on the left,
                    the buttons keep their size on the right. */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  <div className="min-w-0 flex-grow truncate text-meta text-muted-foreground">
                    {currentTurn && (
                      <>
                        <span className={currentTurn.regenerated || currentTurn.pruned ? "line-through" : ""}>
                          Turn {pageIndex + 1} of {totalDebugPages}
                          {currentTurn.action ? ` — "${currentTurn.action}"` : ""}
                        </span>
                        {currentTurn.regenerated ? (
                          <span className="ml-2 font-medium text-warning">Re-generated</span>
                        ) : currentTurn.pruned ? (
                          <span className="ml-2 font-medium text-warning">Pruned</span>
                        ) : null}
                      </>
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
                  {/* The full turn history, exactly the structure this viewer draws, for a bug report. */}
                  <AiContextExportButton data={debugTurns} name={worldOverview?.name || "world"} tip="Download the full turn history as JSON" disabled={debugTurns.length === 0} />
                </div>
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
                          // The collapse map keys this card's sections by request index, in the names the
                          // find plan opens them by (`group-<i>`, <i>, `reasoning-<i>`, `out-<i>`).
                          const sectionKey = (section: AiContextCardSection): string | number =>
                            section === "group" ? `group-${i}`
                            : section === "input" ? i
                            : section === "output" ? `out-${i}`
                            : `${section}-${i}`;
                          const chunkKey = (slot: AiContextTextSlot) =>
                            slot.part === "input" ? `${i}:in:${slot.blockIndex}`
                            : slot.part === "reasoning" ? `${i}:reasoning`
                            : `${i}:out`;
                          return (
                            <AiContextRequestCard
                              key={i}
                              record={req}
                              index={i}
                              folded={folded}
                              isOpen={(section) => (section === "group" && folded
                                ? !!debugUnfolded[`group-${i}`]
                                : !collapsedDebug[sectionKey(section)])}
                              onOpenChange={(section, o) => (section === "group" && folded
                                ? setDebugUnfolded((prev) => ({ ...prev, [`group-${i}`]: o }))
                                : setCollapsedDebug((prev) => ({ ...prev, [sectionKey(section)]: !o })))}
                              renderText={(text, slot) => renderBlock(text, req, slot.part !== "input", chunkKey(slot), slot.start)}
                            />
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
          }} />
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

      {ttsRequested && (
        <Suspense fallback={null}>
          <TTSModal
            ref={ttsModalRef}
            isOpen={isTTSModalOpen}
            onOpenChange={setIsTTSModalOpen}
            onLoadedChange={setTtsLoaded}
          />
        </Suspense>
      )}

      <FeedbackDialog open={showBugReport} onOpenChange={setShowBugReport} />

      <SettingsModal
        isOpen={isSettingsOpen}
        onOpenChange={(v) => { setIsSettingsOpen(v); if (!v) { setSettingsTab(undefined); setSettingsEndpointTab(undefined); setSettingsPrompt(undefined); } }}
        previewValues={promptPreviewValues}
        toolWorld={toolWorld}
        initialTab={settingsTab ?? asSettingsTab(devRoute?.tab)}
        initialEndpointTab={settingsEndpointTab}
        initialPromptTab={surfaceNav.settings?.promptTab ?? settingsPrompt?.tab ?? devRoute?.subtab}
        initialPromptSurface={surfaceNav.settings?.promptSurface ?? settingsPrompt?.surface ?? devRoute?.surface}
        initialPromptField={settingsPrompt?.field}
        initialTarget={surfaceNav.target}
        requestKey={surfaceNav.key}
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

      <DemoAINotice ref={demoAINoticeRef} entry={demoAIEntry === 'open'} onEntryDone={handleDemoAIEntryDone} />

      <LlmSetupGuide
        open={connectionGuideOpen}
        onOpenChange={setConnectionGuideOpen}
        endpointUrl={getEndpointUrl()}
      />

      <AlertDialog open={isExportModalOpen} onOpenChange={setIsExportModalOpen}>
        <AlertDialogContent surface="export">
          <AlertDialogHeader>
            <AlertDialogTitle>Export story</AlertDialogTitle>
            <AlertDialogDescription>
              Download every turn&apos;s narration as a single file. Markdown keeps the formatting
              (<strong>bold</strong>, headings, lists); plain text is unformatted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter {...targetAttribute('export', 'story-format')}>
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
