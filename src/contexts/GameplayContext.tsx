import { randomUUID } from "@/lib/uuid";
import { createContext, useContext, useState, useRef, useCallback, useEffect, useMemo, type ReactNode } from 'react';
import { putSaveRecord, getSaveRecord, getAllSaveRecords, deleteSaveRecord } from '../components/modals/dbUtils';
import { autosaveName, autosavesToTrim } from '../lib/autosave';
import { toast } from 'react-toastify';
import { toastError } from '@/lib/linkToast';
import { convertSaveFile, terminateWorker } from '../lib/saveConversionWorkerUtils';
import { useTtsPlayback } from '../lib/useTtsPlayback';
import { APP_VERSION, isSaveEnvelope, migrateSave, migrateLegacySaveState, stripSnapshotHistory } from '../lib/version';
import { flattenEnabledBookEntries } from '../lib/dictionaryUtils';
import { getGameplayText, setGameplayText } from '../lib/gameplayTextStore';
import { turnActivity } from '../lib/turnActivity';
import { setLiveReasoning } from '../lib/reasoningStreamStore';
import { usePlaceholderSession } from './PlaceholderSessionContext';
import { parseTurnContent, serializeTurnContent } from '../lib/turnDigest';
import type { SceneImageMap } from '../lib/sceneImages';
import { restoreAttachments, type AttachmentMap } from '../lib/actionAttachments';
import { restoreTells, type TellMap } from '../lib/scriptTells';
import { matchChoicesToAction, CONTINUE_CHOICE } from '../lib/choices';
import { pageStatDeltas } from '../lib/statChanges';
import { activeTraits, recoverStatBases, type AppliedTraitValues } from '../lib/traitRuntime';
import { heldEntityIds, withHeldOwners } from '../lib/ownedTraitState';
import { pageAssistantIndex, pageNextActionIndex, placeSnapshot } from '../lib/turnHistory';
import { backfillGameStateStats } from '../lib/statBackfill';
import { liveAppliedValues, migrateGlobalFields, savedAppliedValues, savedCascadeOff } from '../lib/globalSaveFields';
import { backfillEntityStats, backfillGameStateEntityStats, entityStatDeltas, withEntityStatValue, withoutEntityCodeBounds } from '../lib/entityStats';
import { positionedCast, reconcileGameStatePositions, type PlaceableEntity } from '../lib/entityPresence';
import { reconcileGameStateFollowers, withRuntimePositions, type FollowerState } from '../lib/entityFollowing';
import { deltasOf, useStatDeltas } from '../lib/useStatDeltas';

import { normalizeVisibleEntities } from '../lib/sceneEntities';
import { appendLogEntry, type LogKind } from '../lib/playLog';
import { registerDevHook } from '../lib/devRouter';
import { useLibraryEntity } from '../lib/useLibraryEntity';
import { bindCarriedBlueprints, blueprintBindWorld } from '../lib/blueprintTravel';
import { playLibraryStats } from '../lib/portableStats';
import { useGameData } from './GameDataContext';
import { addedCharacters } from '../lib/ownedTraitsInPlay';
import { libraryBooksInPlay } from '../lib/dictionarySelection';
import type { WorldCalendar } from '../lib/gameClock';
import type { MemoryPinMap } from '../lib/milestoneMemory';
import type { MemoryEditMap, MemoryNote } from '../lib/memoryOverrides';
import type {
  CharacterData,
  CodePins,
  Entity,
  EntityStatChanges,
  EntityStatValues,
  EntityPositions,
  ImageAttachment,
  LogEntry,
  GameLocation,
  Stat,
  PlayerStat,
  Trait,
  ChatMessage,
  GameState,
  SaveObject,
  SaveRecord,
  Choice,
  DiscoveredEntity,
  Dictionary,
  SceneEntity,
  EntityVisualPreference,
  PersonaRef,
  TraitsPanelView,
  CascadeOffTraitIds,
  OwnedTraitStates,
  WorldVrmStore,
} from '@/types';
import { remapChosenVrm } from '../lib/legacyVrm';

// Frozen empties for the `view*` fallbacks: a literal `[]` there is a new identity per render, which
// leaks into consumers' dependency arrays and can drive a render loop while viewing a past page.
const EMPTY_IDS: string[] = [];
const EMPTY_OWNED: OwnedTraitStates = {};
const EMPTY_ENTITY_CHANGES: EntityStatChanges = {};
const EMPTY_CHOICES: Choice[] = [];
const EMPTY_INDICES: number[] = [];
const EMPTY_PINS: CodePins = {};

const EMPTY_ENTITY_STATS: EntityStatValues = {};

function useProvideGameplay() {
  const [characterData, setCharacterData] = useState<CharacterData | null>(null);
  const [visibleEntities, setVisibleEntities] = useState<SceneEntity[]>([]);
  const [discoveredEntities, setDiscoveredEntities] = useState<DiscoveredEntity[]>([]);
  // Names the player deleted from the discovered cast; blocks re-discovery via every path.
  const [suppressedCharacterNames, setSuppressedCharacterNames] = useState<string[]>([]);
  const [logEntries, setLogEntries] = useState<LogEntry[]>([]);
  // What the last real turn actually sent: the memories that made the digest band, and the ones sent as
  // full prose instead. Derived from the request, so deliberately not persisted — a loaded save reports
  // nothing until its first turn rather than replaying a stale band.
  const [contextMemoryIds, setContextMemoryIds] = useState<string[]>([]);
  const [rehydratedMemoryIds, setRehydratedMemoryIds] = useState<string[]>([]);
  const [gameTime, setGameTime] = useState(0);
  // Hour of day the story opened at (see GameState.startHour). Null until the opening-time pass answers,
  // and null forever for a game that started without it — both read as DEFAULT_START_HOUR downstream.
  const [startHour, setStartHour] = useState<number | null>(null);
  // The single object every clock reader passes to gameClock. Undefined while the story has no measured
  // opening, which is what makes "never asked" and "asked before this feature existed" the same code path
  // as the shipped default rather than a special case at each call site.
  const calendar = useMemo<WorldCalendar | undefined>(
    () => (startHour !== null ? { startHour } : undefined),
    [startHour],
  );
  const [currentLocation, setCurrentLocation] = useState<GameLocation | null>(null);
  const [globalStats, setGlobalStats] = useState<PlayerStat[]>([]);
  const [globalTraits, setGlobalTraits] = useState<Trait[]>([]);
  // Chosen traits the player has switched off mid-play. Kept as ids so `globalTraits` stays the full chosen
  // set and a trait can go back on; snapshotted per turn, so a rewind restores the switch positions too.
  const [disabledTraitIds, setDisabledTraitIds] = useState<string[]>([]);
  // What each active trait's stat changes actually moved, so switching one off gives back what it took
  // rather than what it asked for. Snapshotted per turn alongside the switch positions.
  const [appliedTraitValues, setAppliedTraitValues] = useState<AppliedTraitValues>({});
  // Owner id → the traits a gate cascade turned off and that may still return. Snapshotted per turn too.
  const [cascadeOffTraitIds, setCascadeOffTraitIds] = useState<CascadeOffTraitIds>({});
  // Entity id → its owned traits chosen and switched off. Snapshotted per turn too.
  const [ownedTraits, setOwnedTraits] = useState<OwnedTraitStates>({});
  // Entity id → its stat values. Snapshotted per turn too.
  const [entityStats, setEntityStats] = useState<EntityStatValues>({});
  // Entity id → where it stands, for each positioned entity. Snapshotted per turn too.
  const [entityPositions, setEntityPositions] = useState<EntityPositions>({});
  // The ids of the entities following the player. Snapshotted per turn too. The ref is read by a move made in
  // the same batch as a followers write.
  const [entityFollowers, setFollowersState] = useState<readonly string[]>([]);
  const entityFollowersRef = useRef<readonly string[]>([]);
  const setEntityFollowers = useCallback((followers: readonly string[]) => {
    entityFollowersRef.current = followers;
    setFollowersState(followers);
  }, []);
  // The ids of the entities the player has met. Snapshotted per turn too.
  const [metEntities, setMetEntities] = useState<readonly string[]>([]);
  // The runtime character ids, so a join can tell their positions from the world entities'. A join adds its
  // peeled ids at once, so a move in the same batch reads them.
  const runtimeIdsRef = useRef<ReadonlySet<string>>(new Set());
  runtimeIdsRef.current = new Set([...runtimeIdsRef.current, ...discoveredEntities.map((d) => d.entity.id)]);
  /** Writes `moved` over the live positions: a runtime character's onto its anchor, `added` ones included. */
  const placeMoved = useCallback((moved: Readonly<EntityPositions>, added: readonly DiscoveredEntity[] = []) => {
    if (added.length) runtimeIdsRef.current = new Set([...runtimeIdsRef.current, ...added.map((d) => d.entity.id)]);
    const runtimeIds = runtimeIdsRef.current;
    const world = Object.fromEntries(Object.entries(moved).filter(([id]) => !runtimeIds.has(id)));
    if (Object.keys(world).length) setEntityPositions((positions) => ({ ...positions, ...world }));
    if (added.length || Object.keys(world).length < Object.keys(moved).length) {
      setDiscoveredEntities((prev) => {
        const fresh = added.filter((d) => !prev.some((known) => known.entity.id === d.entity.id));
        return withRuntimePositions(fresh.length ? [...prev, ...fresh] : prev, moved);
      });
    }
  }, []);
  /** Brings every follower to `locationId`: the player just moved there. */
  const carryFollowersTo = useCallback((locationId: string) => {
    const followers = entityFollowersRef.current;
    if (followers.length) placeMoved(Object.fromEntries(followers.map((id) => [id, locationId])));
  }, [placeMoved]);
  /** Puts a join in place: its followers, the positions it moved over the live ones, and the characters it
   *  peeled off. */
  const applyFollowerState = useCallback((state: FollowerState, peeled: readonly DiscoveredEntity[] = []) => {
    setEntityFollowers(state.followers);
    placeMoved(state.positions, peeled);
  }, [setEntityFollowers, placeMoved]);
  // The entity stats as this turn found them, which the turn's entity deltas count from. Runtime only.
  const [entityStatBaseline, setEntityStatBaseline] = useState<EntityStatValues>({});
  const entityStatChanges = useMemo(() => entityStatDeltas(entityStats, entityStatBaseline), [entityStats, entityStatBaseline]);
  /** Put the entity stats back to `values`, as a turn that moved nothing yet. */
  const resetEntityStats = useCallback((values: EntityStatValues) => {
    setEntityStats(values);
    setEntityStatBaseline(values);
  }, []);
  // Placeholder id → the text stat code pinned it to. Snapshotted per turn, so undo and re-roll restore it.
  const [codePins, setCodePins] = useState<CodePins>(EMPTY_PINS);
  // Per-playthrough dictionary set chosen at world entry (or restored from a save). Runtime-only: the
  // authored world's books live in GameDataContext and are never mutated by gameplay.
  const [runtimeDictionaries, setRuntimeDictionaries] = useState<Dictionary[]>([]);
  // Frozen placeholder rolls for this playthrough (see lib/placeholders). Owned by the world session, which
  // opens before this provider mounts so the pre-game pickers share these values; re-exposed here because
  // the save envelope carries them and every gameplay reader already goes through this context.
  const {
    rolls: placeholderRolls, setRolls: setPlaceholderRolls, setPersona: setSessionPersona, setLibraryAdditions: setSessionLibraryAdditions,
  } = usePlaceholderSession();
  // Milestone-memory player pins, keyed by turn id ('keep' resurrects a dropped digest, 'drop' removes a
  // kept one). Persisted in the save envelope.
  const [memoryPins, setMemoryPins] = useState<MemoryPinMap>({});
  // Which of an entity's two pictures the player would rather open on, keyed by entity id. A viewing
  // preference, not story state, so it lives here rather than in the per-turn snapshot and an undo leaves
  // it alone. Persisted in the save envelope.
  const [entityVisualPreference, setEntityVisualPreference] = useState<EntityVisualPreference>({});
  // Which picture of each entity's gallery is on screen, keyed by entity id. Runtime-only and deliberately
  // absent from the save envelope: where you had paged to is a property of looking at something, not of the
  // playthrough, so a load starts every entity back at its primary.
  const [entityImageIndex, setEntityImageIndex] = useState<Record<string, number>>({});
  // Who the player plays (see lib/persona). Envelope state beside the dictionaries, so an undo leaves it.
  const [personaRef, setPersonaRef] = useState<PersonaRef | undefined>(undefined);
  // A library persona is a live read, never a copy. Its copies bind to this world's blueprints, and its stat
  // Links resolve into stats against this world's Blueprints.
  const { entity: storedPersona, pending: personaPending } = useLibraryEntity(
    personaRef?.source === 'library' ? personaRef.entityId : null,
  );
  const { worldPlaceholders, placeholderGroups, dictionaries: worldBooks, stats: worldStats, statGroups: worldStatGroups } = useGameData();
  const libraryPersona = useMemo(
    () => storedPersona && bindCarriedBlueprints(
      playLibraryStats(storedPersona, { stats: worldStats, statGroups: worldStatGroups }),
      blueprintBindWorld({ placeholders: worldPlaceholders, placeholderGroups }),
    ).entity,
    [storedPersona, worldStats, worldStatGroups, worldPlaceholders, placeholderGroups],
  );
  // A library persona's placeholders join the session's set, and its Wildcards are drawn when it lands.
  useEffect(() => {
    if (personaPending) return;
    setSessionPersona(personaRef?.source === 'library' ? libraryPersona : null);
  }, [personaRef, libraryPersona, personaPending, setSessionPersona]);
  // The library persona is read live, so its stats backfill whenever its entry or the values change, as a
  // load backfills the world's.
  useEffect(() => {
    if (personaRef?.source !== 'library' || !libraryPersona) return;
    setEntityStats((prev) => backfillEntityStats(prev, [libraryPersona]));
  }, [personaRef, libraryPersona, entityStats]);
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    return registerDevHook('setPersona', (ref: PersonaRef | undefined) => setPersonaRef(ref));
  }, []);
  // The accumulated milestone verdicts (T4: incremental, sticky): which candidate turn ids the
  // selector has judged and which it kept (`selected` null = a legacy malformed full-vote → keep
  // everything). Persisted in the save envelope so verdicts survive load.
  const [milestoneSelection, setMilestoneSelection] = useState<{ seen: string[]; selected: string[] | null } | null>(null);
  // The player's memory override layer (see lib/memoryOverrides): rewrites, tombstones and hand-written
  // memories. The AI's own summaries stay untouched on their turns, so every override is reversible.
  // All three persist in the save envelope.
  const [memoryEdits, setMemoryEdits] = useState<MemoryEditMap>({});
  const [memoryDeleted, setMemoryDeleted] = useState<string[]>([]);
  const [memoryNotes, setMemoryNotes] = useState<MemoryNote[]>([]);
  // Scene images by turn id. Held beside the history rather than inside the turns: everything that walks
  // the message list parses it, and a megabyte of base64 in a turn made the narration reveal crawl for the
  // rest of the session (see lib/sceneImages). Persisted only when the player opts in on the Save dialog.
  const [sceneImages, setSceneImages] = useState<SceneImageMap>({});
  // The images each sent action carried, by turn id, and the ones waiting in the action box. Held beside the
  // history for the same reason as scene images (see lib/actionAttachments).
  const [actionAttachments, setActionAttachments] = useState<AttachmentMap>({});
  const [pendingAttachments, setPendingAttachments] = useState<ImageAttachment[]>([]);
  // What scripts told the player, by turn id, beside the history so no request carries it (Q23).
  const [scriptTells, setScriptTells] = useState<TellMap>({});
  // The opening turn's `turn.action`; null until a playthrough opens, and on a save that lacks it.
  const [openingCue, setOpeningCue] = useState<string | null>(null);
  // Flattened enabled entries fed to the injection pipeline (mirrors GameData's old derived `dictionary`).
  const runtimeDictionary = useMemo(() => flattenEnabledBookEntries(runtimeDictionaries), [runtimeDictionaries]);
  const libraryDictionaries = useMemo(() => libraryBooksInPlay(runtimeDictionaries, worldBooks), [runtimeDictionaries, worldBooks]);
  const added = useMemo(() => addedCharacters(discoveredEntities), [discoveredEntities]);
  // Added characters' and library books' placeholders join the session's set, and their Wildcards are drawn.
  useEffect(() => { setSessionLibraryAdditions(added, libraryDictionaries); }, [added, libraryDictionaries, setSessionLibraryAdditions]);
  // Every live chip and band. Entity rows follow the turn's entity deltas; the global ones are written.
  // After `globalStats` in hook order, so a regen `add` reads the changes the stats updater just filled.
  const statDeltas = useStatDeltas(entityStatChanges);
  const clearStatDeltas = statDeltas.clear;
  const [activeTab, setActiveTab] = useState("stats");
  // The entity the entity view and the stat panel both show: an id, null for (None), undefined before any
  // pick. Runtime-only, like the gallery position. An id that matches no entity reads as no pick.
  const [selectedEntityId, setSelectedEntityId] = useState<string | null | undefined>(undefined);
  // The Traits tab's arrangement lives out here for the same reason `activeTab` does: the panel is unmounted
  // the moment the player looks at another tab.
  const [traitsView, setTraitsView] = useState<TraitsPanelView>({
    query: '', keys: null, open: new Set(), openDisabled: new Set(), expanded: new Set(),
  });
  // Stat-driven body morph influences, keyed by morph name (built from stats' morphBindings).
  const [bodyMorphValues, setBodyMorphValues] = useState<Record<string, number>>({});
  const [isFlashing, setIsFlashing] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [choices, setChoices] = useState<Choice[]>([]);
  const [isGameStarted, setIsGameStarted] = useState(false);
  const [playerInput, setPlayerInput] = useState('');
  const [isWaitingForAI, setIsWaitingForAI] = useState(false);
  // True only while the narration is actively streaming into the reveal — distinct from isWaitingForAI,
  // which is true across the whole turn (setup/thinking/aux). The reveal view keys on this so the stale
  // last-turn text can't animate during setup (e.g. the re-generate flash).
  const [isRevealingNarration, setIsRevealingNarration] = useState(false);
  // False from a turn's start until its narration's last word has faded in; the turn card's action row
  // opens then, ahead of the choices.
  const [narrationSettled, setNarrationSettled] = useState(true);
  // Formaquestion holds its Send while a turn generates. Leaving the game ends the turn.
  useEffect(() => { turnActivity.set(isWaitingForAI); }, [isWaitingForAI]);
  useEffect(() => () => turnActivity.set(false), []);
  // The live thought is module state; the next game must not open on this one's.
  useEffect(() => () => setLiveReasoning({ text: "", ms: 0, active: false }), []);
  const [fullMessageHistory, setFullMessageHistory] = useState<ChatMessage[]>([]);
  const [displayedMessages, setDisplayedMessages] = useState<ChatMessage[]>([]);
  // The page the player has deliberately paged back to; null means "follow the latest turn".
  const [userPage, setUserPage] = useState<number | null>(null);
  const [gameStates, setGameStates] = useState<GameState[]>([]);
  const [playerNotes, setPlayerNotes] = useState('');

  const messagesPerPage = 2;
  const totalPages = Math.max(1, Math.ceil(fullMessageHistory.length / messagesPerPage));
  // `currentPage` follows the latest turn unless the player has paged back (`userPage`). Deriving it —
  // rather than syncing it through an effect — keeps it from lagging `totalPages` by a frame when a new
  // turn is appended, which would transiently flag "viewing history" and flicker the panels. Clamped into
  // range so a shrunk history (rollback) can't strand it past the end.
  const currentPage = userPage === null ? totalPages : Math.min(Math.max(1, userPage), totalPages);

  // Web Audio engine for progressive (gapless) TTS playback as sentences generate.
  const ttsPlayback = useTtsPlayback();

  const logsEndRef = useRef<HTMLDivElement>(null);

  const pushLogEntry = useCallback((entry: string, kind: LogKind) => {
    setLogEntries(prev => appendLogEntry(prev, entry, gameTime, kind));
  }, [gameTime]);

  /** Log something that happened in the story — it carries an in-world timestamp. */
  const addLogEntry = useCallback((entry: string) => pushLogEntry(entry, 'world'), [pushLogEntry]);

  /** Log something that happened to the app rather than in the story (saves, load failures, aborted
   *  requests). Shown without a timestamp: story time has nothing to say about when you pressed save. */
  const addSystemLogEntry = useCallback((entry: string) => pushLogEntry(entry, 'system'), [pushLogEntry]);

  const changeLocation = useCallback((newLocation: GameLocation) => {
    setCurrentLocation(newLocation);
    carryFollowersTo(newLocation.id);
    addLogEntry(`Entered new location: ${newLocation.name}`);
  }, [addLogEntry, carryFollowersTo]);

  // Note: flattenNestedGameStates has been moved to a web worker to prevent UI freezing

  /** Snapshot the live gameplay state into a single `GameState` (stamped `stateVersion: 2`), deliberately
   *  omitting the `gameStates` history array and instead recording `previousStateIndex`; `worldName` is left
   *  null for the caller (GameViewer) to fill at save time. */
  const saveCurrentGameState = useCallback((): GameState => {
    const savedApplied = savedAppliedValues(appliedTraitValues);
    const savedCascade = savedCascadeOff(cascadeOffTraitIds);
    // Create a state object without the gameStates array
    return {
      globalStats: globalStats,
      globalTraits: globalTraits,
      ...(disabledTraitIds.length ? { disabledTraitIds } : {}),
      ...(savedApplied ? { appliedTraitValues: savedApplied } : {}),
      ...(savedCascade ? { cascadeOffTraitIds: savedCascade } : {}),
      ...(Object.keys(ownedTraits).length ? { ownedTraits } : {}),
      ...(Object.keys(entityStats).length ? { entityStats } : {}),
      ...(Object.keys(entityPositions).length ? { entityPositions } : {}),
      ...(entityFollowers.length ? { entityFollowers: [...entityFollowers] } : {}),
      ...(metEntities.length ? { metEntities: [...metEntities] } : {}),
      ...(Object.keys(entityStatChanges).length ? { entityStatChanges } : {}),
      ...(Object.keys(codePins).length ? { codePins } : {}),
      visibleEntities,
      discoveredEntities,
      suppressedCharacterNames,
      logEntries,
      gameplayText: getGameplayText(),
      locationId: currentLocation?.id,
      gameTime,
      ...(startHour !== null ? { startHour } : {}),
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
  }, [globalStats, globalTraits, disabledTraitIds, appliedTraitValues, cascadeOffTraitIds, ownedTraits, entityStats, entityPositions, entityFollowers, metEntities, entityStatChanges, codePins, visibleEntities, discoveredEntities, suppressedCharacterNames, logEntries, currentLocation,
      gameTime, startHour, fullMessageHistory, characterData, choices, isGameStarted, playerNotes, currentPage]);

  /** Restore a `GameState` into the live gameplay state, resolving `locationId` against `locations` and
   *  recovering `playerNotes` from the newest nested state when the top-level field is absent (legacy saves).
   *  Returns false and toasts on failure. */
  const loadGameState = useCallback((gameState: GameState, locations: GameLocation[], opts?: { keepLiveHistory?: boolean; worldStats?: Stat[] }) => {
    try {
      // Restore all state
      // A save written before bounds were derived carries no bases; recover them from the world's authored
      // maxes and the traits that were active when it was written, so re-deriving reproduces its own numbers
      // rather than rebalancing them.
      setGlobalStats(
        recoverStatBases(
          gameState.globalStats,
          activeTraits(gameState.globalTraits, gameState.disabledTraitIds ?? []),
          opts?.worldStats,
        ),
      );
      setGlobalTraits(gameState.globalTraits);
      setDisabledTraitIds(gameState.disabledTraitIds ?? []);
      setAppliedTraitValues(liveAppliedValues(gameState.appliedTraitValues));
      setCascadeOffTraitIds(gameState.cascadeOffTraitIds ?? {});
      setOwnedTraits(gameState.ownedTraits ?? {});
      resetEntityStats(gameState.entityStats ?? {});
      setEntityPositions(gameState.entityPositions ?? {});
      setEntityFollowers(gameState.entityFollowers ?? []);
      setMetEntities(gameState.metEntities ?? []);
      setCodePins(gameState.codePins ?? EMPTY_PINS);
      setVisibleEntities(normalizeVisibleEntities(gameState.visibleEntities));
      // Rollback / re-generate also keep the live discovered cast + suppressed names (they carry the
      // player's edits and deletions, which land after the snapshot froze); the rewind handlers prune
      // the cast to the surviving turns themselves.
      if (!opts?.keepLiveHistory) {
        // A loaded save is another playthrough: the old pick may name an entity this one never met.
        setSelectedEntityId(undefined);
        clearStatDeltas();
        setLiveReasoning({ text: "", ms: 0, active: false });
        setDiscoveredEntities(gameState.discoveredEntities ?? []);
        setSuppressedCharacterNames(gameState.suppressedCharacterNames ?? []);
      }
      setLogEntries(gameState.logEntries);
      setGameplayText(gameState.gameplayText);
      setGameTime(gameState.gameTime);
      setStartHour(gameState.startHour ?? null);
      // Rollback / re-generate keep the live narration + notes (they carry the player's post-turn edits) and
      // rewind the flat history themselves; the snapshot's frozen copies would revert those edits.
      if (!opts?.keepLiveHistory) {
        setFullMessageHistory(gameState.fullMessageHistory ?? []);
      }
      setCharacterData(gameState.characterData);
      setChoices(gameState.choices);
      setIsGameStarted(gameState.isGameStarted);

      // Load notes from the game state or from the latest game state if available
      if (!opts?.keepLiveHistory) {
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
      toastError(error, { headline: 'Failed to load game state' });
      addSystemLogEntry('Failed to load game state');
      return false;
    }
  }, [addSystemLogEntry, resetEntityStats, clearStatDeltas]);

  /** Persist the current turn to IndexedDB as a flat envelope (`currentState` + `stateHistory` +
   *  `APP_VERSION`), stamping `worldName`/`worldId` for per-world folders. A fresh `id` creates a new save;
   *  passing `saveId` overwrites that record in place (the dup-name "overwrite" path). Returns success. */
  // The name of the save the player is currently "in" this session (last loaded or saved). Not persisted —
  // used to prefill the Save dialog so re-saving over the same slot is one step. Cleared per fresh session.
  const [lastSaveName, setLastSaveName] = useState('');
  // Counts successful save loads, so the view settles traits against its world once per load.
  const [saveLoads, setSaveLoads] = useState(0);

  const saveGame = useCallback(async (saveName: string, worldName: string, worldId?: string, saveId?: string, opts?: { isAutosave?: boolean; includeSceneImages?: boolean }) => {
    const isAutosave = opts?.isAutosave ?? false;
    // Scene images ride along only when the player asked for them on this save (autosave never carries
    // them): each is around a megabyte of base64, so a long illustrated session would otherwise write a
    // save an order of magnitude larger than the story in it.
    const keepSceneImages = !isAutosave && (opts?.includeSceneImages ?? false);
    try {
      const gameState = saveCurrentGameState();
      gameState.worldName = worldName;

      const record: SaveRecord = {
        id: saveId ?? randomUUID(),
        name: saveName,
        worldId,
        // The one canonical flat history; snapshots below are stripped of their own copies (O(N²) on disk).
        messageHistory: gameState.fullMessageHistory ?? [],
        currentState: stripSnapshotHistory(gameState),
        stateHistory: gameStates.map(stripSnapshotHistory), // per-turn snapshots, history-free
        version: APP_VERSION, // stamp the current app version (legacy envelopes used numeric 2 ≙ v1.2)
        dictionaries: runtimeDictionaries, // the player's per-playthrough dictionary set, restored on load
        ...(placeholderRolls.world || placeholderRolls.unique ? { placeholderRolls } : {}),
        ...(Object.keys(memoryPins).length ? { memoryPins } : {}),
        ...(Object.keys(entityVisualPreference).length ? { entityVisualPreference } : {}),
        ...(personaRef ? { persona: personaRef } : {}),
        ...(milestoneSelection ? { milestoneSelection } : {}),
        ...(Object.keys(memoryEdits).length ? { memoryEdits } : {}),
        ...(memoryDeleted.length ? { memoryDeleted } : {}),
        ...(memoryNotes.length ? { memoryNotes } : {}),
        ...(keepSceneImages && Object.keys(sceneImages).length ? { sceneImages } : {}),
        ...(Object.keys(actionAttachments).length ? { actionAttachments } : {}),
        ...(Object.keys(scriptTells).length ? { scriptTells } : {}),
        ...(openingCue !== null ? { openingCue } : {}),
        ...(isAutosave ? { isAutosave: true } : {}),
      };

      await putSaveRecord(record);
      // Autosave is silent and doesn't become the "current slot": no prefill name, no log line, no toast.
      if (!isAutosave) {
        setLastSaveName(saveName);
        addSystemLogEntry(`Game saved as "${saveName}"`);
      }
      return true;
    } catch (error) {
      console.error('Error saving game:', error);
      if (!isAutosave) {
        toastError(error, { headline: 'Failed to save game' });
        addSystemLogEntry('Failed to save game');
      }
      return false;
    }
  }, [saveCurrentGameState, gameStates, runtimeDictionaries, placeholderRolls, memoryPins, entityVisualPreference, personaRef, milestoneSelection, memoryEdits, memoryDeleted, memoryNotes, sceneImages, actionAttachments, scriptTells, openingCue, addSystemLogEntry]);

  // Autosave has failed at least once this session — used to toast only once, re-armed on a later success.
  const autosaveFailedRef = useRef(false);

  /** Write this turn as a new autosave, then delete the world's oldest past `slots`, so the last `slots` turns
   *  can always be gone back to. `turn` names the save, and a regenerate replaces its turn's autosave. Silent
   *  on success; toasts once per session on failure and keeps trying on later turns. */
  const autosaveGame = useCallback(async (worldName: string, worldId?: string, turn?: number, slots?: number) => {
    const trim = autosavesToTrim(await getAllSaveRecords(), worldName, worldId, slots, turn);
    const ok = await saveGame(autosaveName(turn), worldName, worldId, undefined, { isAutosave: true });
    if (ok) {
      for (const id of trim) await deleteSaveRecord(id);
      autosaveFailedRef.current = false;
    } else if (!autosaveFailedRef.current) {
      autosaveFailedRef.current = true;
      toast.error('Autosave failed — your manual saves still work.');
    }
    return ok;
  }, [saveGame]);

  /** Load a save by its record `id` from IndexedDB and restore it. A flat envelope (`isSaveEnvelope`, current or
   *  legacy numeric version) loads directly; an older nested shape is flattened off-thread via the
   *  `convertSaveFile` worker, with a best-effort raw load if conversion throws. Returns success.
   *  `worldEntities` given, the owned trait state and stat values of an entity the playthrough no longer holds
   *  are dropped, and each authored entity's missing stats are backfilled. `vrmStore` is the world's Avatar
   *  store, which a pre-per-entity-Avatar save's chosen Avatar remaps against. */
  const loadGame = useCallback(async (
    saveId: string, locations: GameLocation[], worldStats: Stat[] = [], worldEntities?: readonly (PlaceableEntity & Pick<Entity, 'stats'>)[],
    vrmStore?: WorldVrmStore,
  ) => {
    const locationIds = locations.map((l) => l.id);
    /** The state with its chosen Avatar remapped against the world's Avatar store. */
    const withChosenVrmRemapped = (raw: GameState) => (raw.characterData
      ? { ...raw, characterData: remapChosenVrm(raw.characterData, vrmStore) }
      : raw);
    /** The state with every stat the world has since added, global and each entity's, no entity stat
     *  carrying stored code bounds, each position checked against the world, and its chosen Avatar remapped. */
    const backfilled = (raw: GameState, persona?: PersonaRef) => {
      const state = withChosenVrmRemapped(raw);
      const players = backfillGameStateStats(withoutEntityCodeBounds(state), worldStats);
      if (!worldEntities) return players;
      const cast = positionedCast(worldEntities, persona);
      return reconcileGameStateFollowers(
        reconcileGameStatePositions(backfillGameStateEntityStats(players, worldEntities), cast, locationIds),
        new Set([...cast.map((entity) => entity.id), ...(state.discoveredEntities ?? []).map((d) => d.entity.id)]),
      );
    };
    try {
      // IndexedDB returns dynamically-shaped data; narrowed by the runtime checks below.
      const savedData = await getSaveRecord(saveId) as SaveObject | null;

      if (!savedData) {
        addSystemLogEntry('No save data found');
        return false;
      }
      const saveName = (savedData as SaveRecord).name ?? 'save';
      // Loading the autosave leaves the Save box empty (it's a system slot you can't manually overwrite).
      setLastSaveName((savedData as SaveRecord).isAutosave ? '' : saveName);

      // Flat envelope (legacy numeric `2` or current APP_VERSION) — detected by shape, not version.
      if (isSaveEnvelope(savedData)) {
        // Migrate a legacy v1.2 envelope to the current shape (no-op for a save already stamped with
        // APP_VERSION). Same migrateSave the import boundary runs, so both stay in lockstep.
        const migrated = migrateSave(savedData);
        const held = (state: GameState) => (worldEntities
          ? withHeldOwners(state, heldEntityIds(worldEntities.map((e) => e.id), state, migrated.persona))
          : state);
        // Snapshots are history-free post-migration; reconstitute the live current state with the canonical
        // top-level history so loadGameState restores narration/rollback correctly. Backfill any stat the
        // world has since added (e.g. an updated default world) so an older save shows it — additive only.
        const success = loadGameState(
          held(backfilled({ ...migrated.currentState, fullMessageHistory: migrated.messageHistory ?? [] }, migrated.persona)),
          locations,
          { worldStats },
        );
        if (success) {
          setGameStates(migrated.stateHistory.map((s) => held(backfilled(s, migrated.persona))));
          // Restore the per-playthrough dictionary set; older saves lack it, so keep the entry-seeded set.
          if (Array.isArray(migrated.dictionaries)) setRuntimeDictionaries(migrated.dictionaries);
          setPlaceholderRolls(migrated.placeholderRolls ?? {});
          setMemoryPins(migrated.memoryPins ?? {});
          // Absent on saves written before the preference existed ⇒ every entity opens on its image.
          setEntityVisualPreference(migrated.entityVisualPreference ?? {});
          setEntityImageIndex({});
          // Absent on saves written before personas ⇒ no persona, never the player's default.
          setPersonaRef(migrated.persona);
          // Restore accumulated verdicts (T4: sticky, never re-voted); older saves lack the field —
          // the loaded history is then judged fresh in one incremental batch on the next idle tick.
          setMilestoneSelection(migrated.milestoneSelection ?? null);
          // The player's override layer; older saves lack all three ⇒ pure AI memory, unchanged behavior.
          setMemoryEdits(migrated.memoryEdits ?? {});
          setMemoryDeleted(migrated.memoryDeleted ?? []);
          setMemoryNotes(migrated.memoryNotes ?? []);
          // Absent whenever the save was written without images — the story loads with its tag lines and
          // no pictures, which is the default.
          setSceneImages(migrated.sceneImages ?? {});
          // Absent on a save written with no attachments ⇒ none.
          setActionAttachments(restoreAttachments(migrated.actionAttachments));
          setScriptTells(restoreTells(migrated.scriptTells));
          setOpeningCue(typeof migrated.openingCue === 'string' ? migrated.openingCue : null);
          setPendingAttachments([]);
          addSystemLogEntry(`Game loaded from "${saveName}"`);
          setSaveLoads((n) => n + 1);
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
          const { convertedData, flattenedStates } = await convertSaveFile(savedData) as { convertedData: GameState; flattenedStates: GameState[] };

          // Close the loading toast
          toast.dismiss(loadingToastId);

          // If we have flattened states, use them. migrateLegacySaveState brings each snapshot's frozen trait/
          // stat copies up to the current shape (trait aiDescription, body-stat morphBindings, discoveredEntities)
          // — the flat-envelope path gets this via migrateSave, so the nested path must apply it too.
          if (flattenedStates && flattenedStates.length > 0) {
            setGameStates(flattenedStates.map((s) => backfilled(migrateLegacySaveState(s))));

            // Show toast message for successful conversion
            toast.success('Old save format converted to new format successfully', {
              position: "top-right",
              autoClose: 3000,
              hideProgressBar: false,
              closeOnClick: true,
              pauseOnHover: true,
              draggable: true
            });

            addSystemLogEntry('Old save format converted to new format successfully');
          }

          const success = loadGameState(backfilled(migrateLegacySaveState(convertedData)), locations, { worldStats });
          if (success) {
            setPersonaRef(undefined);
            // A legacy save predates attachments ⇒ none.
            setActionAttachments({});
            setScriptTells({});
            setOpeningCue(null);
            setPendingAttachments([]);
            addSystemLogEntry(`Game loaded from "${saveName}"`);
            setSaveLoads((n) => n + 1);
          }
          return success;
        } catch (error) {
          console.error('Error converting old save format:', error);
          toastError(error, { headline: 'Failed to convert old save format. Some features may not work correctly.' });

          addSystemLogEntry('Failed to convert old save format');

          // Try to load the save anyway (legacy shape, best-effort)
          try {
            const success = loadGameState(withChosenVrmRemapped(migrateGlobalFields(savedData as unknown as GameState)), locations, { worldStats });
            if (success) {
              addSystemLogEntry(`Game loaded from "${saveName}" (with conversion errors)`);
              setSaveLoads((n) => n + 1);
            }
            return success;
          } catch (loadError) {
            console.error('Error loading game after conversion failure:', loadError);
            toastError(loadError, { headline: 'Failed to load game' });
            addSystemLogEntry('Failed to load game');
            return false;
          }
        }
      }
    } catch (error) {
      console.error('Error loading game:', error);
      toastError(error, { headline: 'Failed to load game' });
      addSystemLogEntry('Failed to load game');
      return false;
    }
  }, [loadGameState, addSystemLogEntry, setPlaceholderRolls]);

  // Cleanup web worker when component unmounts
  useEffect(() => {
    return () => {
      // Terminate the web worker when the component unmounts
      terminateWorker();
    };
  }, []);

  // --- Per-page "viewed" state (immersive time-travel) ---
  // Paging back to an earlier turn shows that turn's whole state read-only, without mutating the live
  // (latest-turn) state. Every `view*` field aliases the live value when you're on the latest page, so
  // normal play is unchanged; only when `isViewingPast` do they read the paged snapshot instead.
  // A page counts as "history" only when it has a mechanical snapshot to show. On a save whose snapshots
  // are short of the page count (e.g. a converted deep-nested legacy save), paging back would otherwise
  // flag history mode while every view* silently fell back to the LIVE latest turn — banner + disabled
  // controls contradicting live stats/location. No snapshot ⇒ not viewing past (panels stay live).
  const viewedSnapshot = currentPage < totalPages ? (gameStates[currentPage - 1] ?? null) : null;
  const isViewingPast = viewedSnapshot !== null;
  const viewStats = viewedSnapshot?.globalStats ?? globalStats;
  const viewTraits = viewedSnapshot?.globalTraits ?? globalTraits;
  // Every `view*` below must keep a STABLE identity across renders while the viewed page doesn't change.
  // A fresh `[]` (or a fresh derived array) on each render propagates into consumers' useMemo/useEffect
  // deps — `viewDisabledTraitIds` feeds GameViewer's `viewActiveStats`, whose effect writes state, which
  // re-renders this provider and mints the next fresh array: an unbreakable render loop that only exists
  // on a past page, since the live branch returns the state values themselves.
  const viewDisabledTraitIds = viewedSnapshot ? (viewedSnapshot.disabledTraitIds ?? EMPTY_IDS) : disabledTraitIds;
  const viewOwnedTraits = viewedSnapshot ? (viewedSnapshot.ownedTraits ?? EMPTY_OWNED) : ownedTraits;
  const viewEntityStats = viewedSnapshot ? (viewedSnapshot.entityStats ?? EMPTY_ENTITY_STATS) : entityStats;
  // What the shown turn moved each entity stat: live, this turn's; on a past page, that turn's record.
  const viewEntityStatChanges = viewedSnapshot ? (viewedSnapshot.entityStatChanges ?? EMPTY_ENTITY_CHANGES) : entityStatChanges;
  const viewCodePins = viewedSnapshot ? (viewedSnapshot.codePins ?? EMPTY_PINS) : codePins;
  const viewEntityFollowers: readonly string[] = viewedSnapshot ? (viewedSnapshot.entityFollowers ?? EMPTY_IDS) : entityFollowers;
  const viewCharacterData = viewedSnapshot?.characterData ?? characterData;
  const viewVisibleEntities = useMemo(
    () => (viewedSnapshot ? normalizeVisibleEntities(viewedSnapshot.visibleEntities) : visibleEntities),
    [viewedSnapshot, visibleEntities],
  );
  const viewGameTime = viewedSnapshot?.gameTime ?? gameTime;
  const viewLocationId = viewedSnapshot?.locationId ?? currentLocation?.id;
  // Parse the paged turn's assistant message once — choices and notes both live on it.
  const viewedTurn = useMemo(
    () => (viewedSnapshot
      ? parseTurnContent(fullMessageHistory[pageAssistantIndex(currentPage, messagesPerPage)]?.content ?? '')
      : null),
    [viewedSnapshot, fullMessageHistory, currentPage, messagesPerPage],
  );
  // Choices already live on each turn's message JSON; read the paged turn's, else the live choices.
  const viewChoices: Choice[] = viewedSnapshot ? (viewedTurn?.choices ?? EMPTY_CHOICES) : choices;
  // On a past page, infer which of that turn's choices the player acted on by fuzzy-matching the next
  // turn's action (the user message right after this page) against the choice list; [] = custom action.
  // Multiple indices when the action stacked several choices (shift+click).
  const viewSelectedChoice = useMemo(
    () => (viewedSnapshot
      ? matchChoicesToAction(fullMessageHistory[pageNextActionIndex(currentPage, messagesPerPage)]?.content ?? '', viewChoices)
      : EMPTY_INDICES),
    [viewedSnapshot, fullMessageHistory, currentPage, messagesPerPage, viewChoices],
  );
  // Whether the action taken from a past page was the hard-coded continue pseudo-choice, so that page can
  // show it back as the picked option. An exact match, unlike the fuzzy choice inference above.
  const viewContinueUsed = viewedSnapshot
    ? (fullMessageHistory[pageNextActionIndex(currentPage, messagesPerPage)]?.content ?? '').includes(CONTINUE_CHOICE)
    : false;
  // Stat deltas: while live, the animated last-turn changes; while viewing the past, the change this turn
  // made — vs the previous page's stats, or (on the opening turn, which has no predecessor) vs each stat's
  // starting value, so turn 1 still shows its deltas.
  const liveGlobalChips = deltasOf(statDeltas.recent, null);
  const viewStatChanges: Readonly<Record<string, number>> = useMemo(
    () => (viewedSnapshot
      ? pageStatDeltas(viewStats, gameStates[currentPage - 2]?.globalStats)
      : liveGlobalChips),
    [viewedSnapshot, viewStats, gameStates, currentPage, liveGlobalChips],
  );
  // Per-turn player notes: on the current page the live scratchpad; on a past page that turn's frozen notes
  // (from its assistant message), falling back to the snapshot's global notes for pre-per-turn-notes saves.
  const viewNotes = viewedSnapshot
    ? (viewedTurn?.notes ?? viewedSnapshot.playerNotes ?? '')
    : playerNotes;
  // Route a notes edit to the right place: the live scratchpad on the current page, else patch the viewed
  // turn's assistant message so the edit sticks to that turn only.
  const setViewNotes = useCallback((text: string) => {
    if (currentPage >= totalPages) { setPlayerNotes(text); return; }
    const idx = pageAssistantIndex(currentPage, messagesPerPage);
    setFullMessageHistory((prev) => {
      const msg = prev[idx];
      if (!msg || msg.role !== 'assistant') return prev;
      // Bail if the turn JSON doesn't parse — writing a stub would wipe its narration/choices/turnId.
      const parsed = parseTurnContent(msg.content);
      if (!parsed) return prev;
      const next = [...prev];
      next[idx] = { ...msg, content: serializeTurnContent({ ...parsed, notes: text }) };
      return next;
    });
  }, [currentPage, totalPages, messagesPerPage]);

  // A manual stat edit (the in-game slider) is authoritative post-turn state, so it must also update the
  // current page's snapshot — the mechanical baseline a later re-generate of the *next* turn restores from
  // (regenerateState reads gameStates[nextPage - 2] = this page's snapshot). Without this the edit lives
  // only in `globalStats` and gets reverted on the next re-generate. Editing is disabled while viewing the
  // past, so this always targets the latest snapshot; guarded so a not-yet-captured slot is left alone.
  const commitManualStatEdit = useCallback((newStats: PlayerStat[]) => {
    setGlobalStats(newStats);
    const idx = currentPage - 1;
    setGameStates((prev) => (idx >= 0 && idx < prev.length
      ? placeSnapshot(prev, idx, { ...prev[idx], globalStats: newStats })
      : prev));
  }, [currentPage]);

  // The same for an entity's stat. The baseline moves with it, so the edit is not counted as the turn's change.
  // Every write is absolute, so a burst of slider moves between renders lands on the last value without drift.
  const commitManualEntityStatEdit = useCallback((ownerId: string, statId: string, value: number) => {
    const turnChange = entityStatChanges[ownerId]?.[statId] ?? 0;
    setEntityStats((prev) => withEntityStatValue(prev, ownerId, statId, value));
    setEntityStatBaseline((prev) => withEntityStatValue(prev, ownerId, statId, value - turnChange));
    const idx = currentPage - 1;
    setGameStates((prev) => (idx >= 0 && idx < prev.length && prev[idx].entityStats
      ? placeSnapshot(prev, idx, { ...prev[idx], entityStats: withEntityStatValue(prev[idx].entityStats, ownerId, statId, value) })
      : prev));
  }, [currentPage, entityStatChanges]);

  const value = {
    characterData,
    setCharacterData,
    bodyMorphValues,
    setBodyMorphValues,
    visibleEntities,
    setVisibleEntities,
    discoveredEntities,
    setDiscoveredEntities,
    suppressedCharacterNames,
    setSuppressedCharacterNames,
    logEntries,
    setLogEntries,
    addLogEntry,
    addSystemLogEntry,
    contextMemoryIds,
    setContextMemoryIds,
    rehydratedMemoryIds,
    setRehydratedMemoryIds,
    gameTime,
    setGameTime,
    startHour,
    setStartHour,
    calendar,
    currentLocation,
    setCurrentLocation,
    changeLocation,
    globalStats,
    setGlobalStats,
    commitManualStatEdit,
    commitManualEntityStatEdit,
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
    viewEntityFollowers,
    metEntities,
    setMetEntities,
    codePins,
    setCodePins,
    runtimeDictionaries,
    setRuntimeDictionaries,
    libraryDictionaries,
    placeholderRolls,
    setPlaceholderRolls,
    sceneImages,
    actionAttachments,
    setActionAttachments,
    scriptTells,
    setScriptTells,
    openingCue,
    setOpeningCue,
    pendingAttachments,
    setPendingAttachments,
    setSceneImages,
    memoryPins,
    setMemoryPins,
    entityVisualPreference,
    setEntityVisualPreference,
    entityImageIndex,
    setEntityImageIndex,
    personaRef,
    setPersonaRef,
    libraryPersona,
    personaPending,
    milestoneSelection,
    setMilestoneSelection,
    memoryEdits,
    setMemoryEdits,
    memoryDeleted,
    setMemoryDeleted,
    memoryNotes,
    setMemoryNotes,
    runtimeDictionary,
    statDeltas,
    activeTab,
    setActiveTab,
    traitsView,
    setTraitsView,
    selectedEntityId,
    setSelectedEntityId,
    logsEndRef,
    isFlashing,
    setIsFlashing,
    isEditMode,
    setIsEditMode,
    ttsPlayback,
    choices,
    setChoices,
    isGameStarted,
    setIsGameStarted,
    playerInput,
    setPlayerInput,
    isWaitingForAI,
    setIsWaitingForAI,
    isRevealingNarration,
    setIsRevealingNarration,
    narrationSettled,
    setNarrationSettled,
    fullMessageHistory,
    setFullMessageHistory,
    displayedMessages,
    setDisplayedMessages,
    currentPage,
    setUserPage,
    totalPages,
    isViewingPast,
    viewStats,
    viewTraits,
    viewDisabledTraitIds,
    viewOwnedTraits,
    viewEntityStats,
    viewEntityStatChanges,
    viewCodePins,
    viewCharacterData,
    viewVisibleEntities,
    viewGameTime,
    viewLocationId,
    viewChoices,
    viewSelectedChoice,
    viewContinueUsed,
    viewStatChanges,
    viewNotes,
    setViewNotes,
    gameStates,
    setGameStates,
    playerNotes,
    setPlayerNotes,
    saveGame,
    autosaveGame,
    loadGame,
    saveLoads,
    lastSaveName,
    saveCurrentGameState,
    loadGameState
  };

  return value;
}

type GameplayContextValue = ReturnType<typeof useProvideGameplay>;

const GameplayContext = createContext<GameplayContextValue | null>(null);

/** Access the live playthrough state — character, stats, traits, log, location, message history, choices,
 *  TTS playback, edit/wait flags — plus save/load and state-snapshot callbacks. Throws if called outside
 *  a `GameplayProvider`. */
// eslint-disable-next-line react-refresh/only-export-components
export const useGameplay = () => {
  const context = useContext(GameplayContext);
  if (!context) {
    throw new Error('useGameplay must be used within a GameplayProvider');
  }
  return context;
};

/** Provides the live gameplay state (see `useGameplay`); terminates the save-conversion worker on unmount. */
export const GameplayProvider = ({ children }: { children: ReactNode }) => {
  const value = useProvideGameplay();

  return (
    <GameplayContext.Provider value={value}>
      {children}
    </GameplayContext.Provider>
  );
};
