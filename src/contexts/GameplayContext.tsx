import { randomUUID } from "@/lib/uuid";
import { createContext, useContext, useState, useRef, useCallback, useEffect, useMemo, type ReactNode } from 'react';
import { putSaveRecord, getSaveRecord, getAllSaveRecords } from '../components/modals/dbUtils';
import { findAutosaveId, AUTOSAVE_NAME } from '../lib/autosave';
import { toast } from 'react-toastify';
import { convertSaveFile, terminateWorker } from '../lib/saveConversionWorkerUtils';
import { useTtsPlayback } from '../lib/useTtsPlayback';
import { APP_VERSION, isSaveEnvelope, migrateSave, migrateLegacySaveState, stripSnapshotHistory } from '../lib/version';
import { flattenEnabledBookEntries } from '../lib/dictionaryUtils';
import { getGameplayText, setGameplayText } from '../lib/gameplayTextStore';
import { parseTurnContent, serializeTurnContent } from '../lib/turnDigest';
import { matchChoicesToAction } from '../lib/choices';
import { pageStatDeltas } from '../lib/statChanges';
import { pageAssistantIndex, pageNextActionIndex, placeSnapshot } from '../lib/turnHistory';
import { backfillGameStateStats } from '../lib/statBackfill';
import { appendLogEntry, type LogKind } from '../lib/playLog';
import type { WorldCalendar } from '../lib/gameClock';
import type { MemoryPinMap } from '../lib/milestoneMemory';
import type { MemoryEditMap, MemoryNote } from '../lib/memoryOverrides';
import type {
  CharacterData,
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
  PlaceholderRolls,
  SceneEntity,
} from '@/types';

/** Normalize a snapshot's `visibleEntities`: legacy saves stored a bare `string[]` of names; those become
 *  `{ name, revealed: true }` (a name that was in the old list had, by construction, been shown already). */
function normalizeVisibleEntities(raw: unknown): SceneEntity[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((e) =>
    typeof e === 'string' ? { name: e, revealed: true } : (e as SceneEntity),
  );
}

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
  const [playerStats, setPlayerStats] = useState<PlayerStat[]>([]);
  const [playerTraits, setPlayerTraits] = useState<Trait[]>([]);
  // Per-playthrough dictionary set chosen at world entry (or restored from a save). Runtime-only: the
  // authored world's books live in GameDataContext and are never mutated by gameplay.
  const [runtimeDictionaries, setRuntimeDictionaries] = useState<Dictionary[]>([]);
  // Frozen placeholder rolls for this playthrough (see lib/placeholders). Primed once when a save becomes
  // active, then a pure lookup everywhere. Persisted in the save envelope.
  const [placeholderRolls, setPlaceholderRolls] = useState<PlaceholderRolls>({});
  // Milestone-memory player pins, keyed by turn id ('keep' resurrects a dropped digest, 'drop' removes a
  // kept one). Persisted in the save envelope.
  const [memoryPins, setMemoryPins] = useState<MemoryPinMap>({});
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
  // Flattened enabled entries fed to the injection pipeline (mirrors GameData's old derived `dictionary`).
  const runtimeDictionary = useMemo(() => flattenEnabledBookEntries(runtimeDictionaries), [runtimeDictionaries]);
  const [recentStatChanges, setRecentStatChanges] = useState<Record<string, number>>({});
  // When true, the lingering delta text (+3/-2) fades out fast because a new turn started before its
  // normal ~10s timeout. Reset when the next turn's changes land.
  const [recentStatFading, setRecentStatFading] = useState(false);
  // Like recentStatChanges but never auto-cleared: drives the persistent +/- bar coloring so the player
  // keeps seeing how each stat moved last turn. Overwritten only when stats change again.
  const [heldStatChanges, setHeldStatChanges] = useState<Record<string, number>>({});
  // A snapshot of the held deltas being drained (collapse-animated away) at the start of a new action,
  // so last turn's bars clear cleanly before this turn's grow animation. Cosmetic-only; cleared on a timer.
  const [drainingStatChanges, setDrainingStatChanges] = useState<Record<string, number>>({});
  const [activeTab, setActiveTab] = useState("stats");
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
    addLogEntry(`Entered new location: ${newLocation.name}`);
  }, [addLogEntry]);

  // Note: flattenNestedGameStates has been moved to a web worker to prevent UI freezing

  /** Snapshot the live gameplay state into a single `GameState` (stamped `stateVersion: 2`), deliberately
   *  omitting the `gameStates` history array and instead recording `previousStateIndex`; `worldName` is left
   *  null for the caller (GameViewer) to fill at save time. */
  const saveCurrentGameState = useCallback((): GameState => {
    // Create a state object without the gameStates array
    return {
      playerStats,
      playerTraits,
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
  }, [playerStats, playerTraits, visibleEntities, discoveredEntities, suppressedCharacterNames, logEntries, currentLocation,
      gameTime, startHour, fullMessageHistory, characterData, choices, isGameStarted, playerNotes, currentPage]);

  /** Restore a `GameState` into the live gameplay state, resolving `locationId` against `locations` and
   *  recovering `playerNotes` from the newest nested state when the top-level field is absent (legacy saves).
   *  Returns false and toasts on failure. */
  const loadGameState = useCallback((gameState: GameState, locations: GameLocation[], opts?: { keepLiveHistory?: boolean }) => {
    try {
      // Restore all state
      setPlayerStats(gameState.playerStats);
      setPlayerTraits(gameState.playerTraits);
      setVisibleEntities(normalizeVisibleEntities(gameState.visibleEntities));
      setDiscoveredEntities(gameState.discoveredEntities ?? []);
      setSuppressedCharacterNames(gameState.suppressedCharacterNames ?? []);
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
      toast.error('Failed to load game state');
      addSystemLogEntry('Failed to load game state');
      return false;
    }
  }, [addSystemLogEntry]);

  /** Persist the current turn to IndexedDB as a flat envelope (`currentState` + `stateHistory` +
   *  `APP_VERSION`), stamping `worldName`/`worldId` for per-world folders. A fresh `id` creates a new save;
   *  passing `saveId` overwrites that record in place (the dup-name "overwrite" path). Returns success. */
  // The name of the save the player is currently "in" this session (last loaded or saved). Not persisted —
  // used to prefill the Save dialog so re-saving over the same slot is one step. Cleared per fresh session.
  const [lastSaveName, setLastSaveName] = useState('');

  const saveGame = useCallback(async (saveName: string, worldName: string, worldId?: string, saveId?: string, opts?: { isAutosave?: boolean }) => {
    const isAutosave = opts?.isAutosave ?? false;
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
        ...(milestoneSelection ? { milestoneSelection } : {}),
        ...(Object.keys(memoryEdits).length ? { memoryEdits } : {}),
        ...(memoryDeleted.length ? { memoryDeleted } : {}),
        ...(memoryNotes.length ? { memoryNotes } : {}),
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
        toast.error('Failed to save game');
        addSystemLogEntry('Failed to save game');
      }
      return false;
    }
  }, [saveCurrentGameState, gameStates, runtimeDictionaries, placeholderRolls, memoryPins, milestoneSelection, memoryEdits, memoryDeleted, memoryNotes, addSystemLogEntry]);

  // Autosave has failed at least once this session — used to toast only once, re-armed on a later success.
  const autosaveFailedRef = useRef(false);

  /** Write (or overwrite) the world's single autosave slot with the current state. Silent on success; toasts
   *  once per session on failure and keeps trying on later turns. */
  const autosaveGame = useCallback(async (worldName: string, worldId?: string) => {
    const existingId = findAutosaveId(await getAllSaveRecords(), worldName, worldId);
    const ok = await saveGame(AUTOSAVE_NAME, worldName, worldId, existingId, { isAutosave: true });
    if (ok) {
      autosaveFailedRef.current = false;
    } else if (!autosaveFailedRef.current) {
      autosaveFailedRef.current = true;
      toast.error('Autosave failed — your manual saves still work.');
    }
    return ok;
  }, [saveGame]);

  /** Load a save by its record `id` from IndexedDB and restore it. A flat envelope (`isSaveEnvelope`, current or
   *  legacy numeric version) loads directly; an older nested shape is flattened off-thread via the
   *  `convertSaveFile` worker, with a best-effort raw load if conversion throws. Returns success. */
  const loadGame = useCallback(async (saveId: string, locations: GameLocation[], worldStats: Stat[] = []) => {
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
        // Snapshots are history-free post-migration; reconstitute the live current state with the canonical
        // top-level history so loadGameState restores narration/rollback correctly. Backfill any stat the
        // world has since added (e.g. an updated default world) so an older save shows it — additive only.
        const success = loadGameState(
          backfillGameStateStats({ ...migrated.currentState, fullMessageHistory: migrated.messageHistory ?? [] }, worldStats),
          locations,
        );
        if (success) {
          setGameStates(migrated.stateHistory.map((s) => backfillGameStateStats(s, worldStats)));
          // Restore the per-playthrough dictionary set; older saves lack it, so keep the entry-seeded set.
          if (Array.isArray(migrated.dictionaries)) setRuntimeDictionaries(migrated.dictionaries);
          setPlaceholderRolls(migrated.placeholderRolls ?? {});
          setMemoryPins(migrated.memoryPins ?? {});
          // Restore accumulated verdicts (T4: sticky, never re-voted); older saves lack the field —
          // the loaded history is then judged fresh in one incremental batch on the next idle tick.
          setMilestoneSelection(migrated.milestoneSelection ?? null);
          // The player's override layer; older saves lack all three ⇒ pure AI memory, unchanged behavior.
          setMemoryEdits(migrated.memoryEdits ?? {});
          setMemoryDeleted(migrated.memoryDeleted ?? []);
          setMemoryNotes(migrated.memoryNotes ?? []);
          addSystemLogEntry(`Game loaded from "${saveName}"`);
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
            setGameStates(flattenedStates.map((s) => backfillGameStateStats(migrateLegacySaveState(s), worldStats)));

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

          const success = loadGameState(backfillGameStateStats(migrateLegacySaveState(convertedData), worldStats), locations);
          if (success) {
            addSystemLogEntry(`Game loaded from "${saveName}"`);
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

          addSystemLogEntry('Failed to convert old save format');

          // Try to load the save anyway (legacy shape, best-effort)
          try {
            const success = loadGameState(savedData as unknown as GameState, locations);
            if (success) {
              addSystemLogEntry(`Game loaded from "${saveName}" (with conversion errors)`);
            }
            return success;
          } catch (loadError) {
            console.error('Error loading game after conversion failure:', loadError);
            toast.error('Failed to load game');
            addSystemLogEntry('Failed to load game');
            return false;
          }
        }
      }
    } catch (error) {
      console.error('Error loading game:', error);
      toast.error('Failed to load game');
      addSystemLogEntry('Failed to load game');
      return false;
    }
  }, [loadGameState, addSystemLogEntry]);

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
  const viewStats = viewedSnapshot?.playerStats ?? playerStats;
  const viewTraits = viewedSnapshot?.playerTraits ?? playerTraits;
  const viewCharacterData = viewedSnapshot?.characterData ?? characterData;
  const viewVisibleEntities = viewedSnapshot
    ? normalizeVisibleEntities(viewedSnapshot.visibleEntities)
    : visibleEntities;
  const viewGameTime = viewedSnapshot?.gameTime ?? gameTime;
  const viewLocationId = viewedSnapshot?.locationId ?? currentLocation?.id;
  // Parse the paged turn's assistant message once — choices and notes both live on it.
  const viewedTurn = viewedSnapshot
    ? parseTurnContent(fullMessageHistory[pageAssistantIndex(currentPage, messagesPerPage)]?.content ?? '')
    : null;
  // Choices already live on each turn's message JSON; read the paged turn's, else the live choices.
  const viewChoices: Choice[] = viewedSnapshot ? (viewedTurn?.choices ?? []) : choices;
  // On a past page, infer which of that turn's choices the player acted on by fuzzy-matching the next
  // turn's action (the user message right after this page) against the choice list; [] = custom action.
  // Multiple indices when the action stacked several choices (shift+click).
  const viewSelectedChoice = viewedSnapshot
    ? matchChoicesToAction(fullMessageHistory[pageNextActionIndex(currentPage, messagesPerPage)]?.content ?? '', viewChoices)
    : [];
  // Stat deltas: while live, the animated last-turn changes; while viewing the past, the change this turn
  // made — vs the previous page's stats, or (on the opening turn, which has no predecessor) vs each stat's
  // starting value, so turn 1 still shows its deltas.
  const viewStatChanges: Record<string, number> = viewedSnapshot
    ? pageStatDeltas(viewStats, gameStates[currentPage - 2]?.playerStats)
    : recentStatChanges;
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
  // only in `playerStats` and gets reverted on the next re-generate. Editing is disabled while viewing the
  // past, so this always targets the latest snapshot; guarded so a not-yet-captured slot is left alone.
  const commitManualStatEdit = useCallback((newStats: PlayerStat[]) => {
    setPlayerStats(newStats);
    const idx = currentPage - 1;
    setGameStates((prev) => (idx >= 0 && idx < prev.length
      ? placeSnapshot(prev, idx, { ...prev[idx], playerStats: newStats })
      : prev));
  }, [currentPage]);

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
    playerStats,
    setPlayerStats,
    commitManualStatEdit,
    playerTraits,
    setPlayerTraits,
    runtimeDictionaries,
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
    runtimeDictionary,
    recentStatChanges,
    setRecentStatChanges,
    recentStatFading,
    setRecentStatFading,
    heldStatChanges,
    setHeldStatChanges,
    drainingStatChanges,
    setDrainingStatChanges,
    activeTab,
    setActiveTab,
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
    viewCharacterData,
    viewVisibleEntities,
    viewGameTime,
    viewLocationId,
    viewChoices,
    viewSelectedChoice,
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
