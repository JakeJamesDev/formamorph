// Storage is real (in-memory) rather than mocked: GameDataProvider opens IndexedDB on mount, and the
// model library behind the player VRM reads it too. Must be imported before anything touches `indexedDB`.
import 'fake-indexeddb/auto';
import { useEffect, type ComponentProps, type ReactNode } from 'react';
import { render } from '@testing-library/react';
import { vi } from 'vitest';
import { SettingsProvider, useSettings } from '@/contexts/SettingsContext';
import { GameDataProvider, useGameData } from '@/contexts/GameDataContext';
import { GameplayProvider, useGameplay } from '@/contexts/GameplayContext';
import { setGameplayText } from '@/lib/gameplayTextStore';
import { pageAssistantIndex } from '@/lib/turnHistory';
import { LeftPanel, MiddlePanel, RightPanel } from '@/components/game/GamePanels';
import type { AITurnResult, ChatMessage, GameState, PlayerStat, Stat, World } from '@/types';

/**
 * Render helper for the three gameplay panels (`GamePanels.tsx`).
 *
 * The panels are thin readers of three contexts — Settings, GameData (the authored world) and Gameplay
 * (the live playthrough) — and GameViewer, which owns every callback they take, is far too large to mount in
 * a test. So the real providers go up, the runtime state is staged into them, and the panel under test runs
 * for real against spy callbacks.
 *
 * Two dependencies can't run in jsdom and are stubbed by the calling test file (`vi.mock` is hoisted per
 * file, so it can't live here):
 *
 * ```ts
 * vi.mock('@/views/VRMViewer', () => import('@/test/stubs/vrmViewer'));
 * vi.mock('@/lib/useTtsPlayback', () => import('@/test/stubs/ttsPlayback'));
 * ```
 *
 * The VRM stub is only load-bearing for `LeftPanel` with a player model staged; the TTS stub is what lets a
 * test put a panel into its "audio exists" state.
 */

type MiddlePanelProps = ComponentProps<typeof MiddlePanel>;
type LeftPanelProps = ComponentProps<typeof LeftPanel>;
type RightPanelProps = ComponentProps<typeof RightPanel>;

/** The live Gameplay context, as the panels see it. */
export type Gameplay = ReturnType<typeof useGameplay>;
/** The live GameData context (the authored world). */
export type GameData = ReturnType<typeof useGameData>;
/** The live Settings context. */
export type Settings = ReturnType<typeof useSettings>;

/** One committed turn: the player's action and the assistant JSON the panels read back. */
export interface TurnFixture {
  /** What the player typed. */
  action?: string;
  narration: string;
  choices?: string[];
  /** Stable turn id — what keys scene images and the memory digest to this turn. */
  turnId?: string;
  /** The booru tag line this turn's images were drawn from. */
  sceneTags?: string;
  /** This turn's frozen player notes. */
  notes?: string;
  /** Who took part, as the narration parse recorded them. */
  entities?: string[];
  /** This turn's memory digest, once the drainer has written one. */
  summary?: string;
  /** Per-character diary entries for this turn. */
  diaries?: Record<string, string>;
}

export interface PanelHarnessOptions {
  /** Committed turns to stage in the message history; drives paging, the narration shown and the turn id. */
  turns?: TurnFixture[];
  /** Which page to view, 1-based. Defaults to the latest (live) page. An earlier page puts the panels into
   *  history mode, which needs one snapshot per turn — those are staged from `turns` automatically. */
  page?: number;
  /** Fields merged over the blank authored world. */
  world?: Partial<World>;
  /** The player's stats (also seeded as the world's stat definitions). */
  stats?: PlayerStat[];
  /** The live narration-reveal text, which lives in its own store rather than in context. */
  gameplayText?: string;
  /** Adjust settings before the panel reads them. */
  settings?: (settings: Settings) => void;
  /** Escape hatch for state the options above don't cover; runs last, once, on mount. */
  seed?: (gameplay: Gameplay) => void;
}

/** A minimal authored world, with `overrides` merged over it. */
export function worldFixture(overrides: Partial<World> = {}): World {
  return {
    id: 'test-world',
    worldOverview: {
      name: 'Sedge Landing', description: '', author: '', thumbnail: null, bgm: null,
      systemPrompt: '<NOTES>', use3DModel: true, tags: [],
    },
    stats: [], locations: [], entities: [], traits: [], statUpdates: [],
    ...overrides,
  } as unknown as World;
}

/** A number stat with a live value, for `stats`. */
export function statFixture(name: string, value: number, overrides: Partial<PlayerStat> = {}): PlayerStat {
  return {
    id: name.toLowerCase(), name, type: 'number', description: '',
    min: 0, max: 100, regen: 0, descriptors: [], value, ...overrides,
  };
}

/** The assistant JSON one turn is stored as. */
function turnContent(turn: TurnFixture): string {
  const content: AITurnResult = {
    narration: turn.narration,
    choices: turn.choices ?? [],
    stat_changes: [],
    ...(turn.turnId ? { turnId: turn.turnId } : {}),
    ...(turn.sceneTags ? { sceneTags: turn.sceneTags } : {}),
    ...(turn.notes ? { notes: turn.notes } : {}),
    ...(turn.entities ? { entities: turn.entities } : {}),
    ...(turn.summary ? { summary: turn.summary } : {}),
    ...(turn.diaries ? { diaries: turn.diaries } : {}),
  };
  return JSON.stringify(content);
}

/** The assistant turn stored for `page`, parsed back out of a history read off Gameplay. Throws if that
 *  page holds no readable turn — a silent `null` here reads as "the field was cleared". */
export function readTurn(history: ChatMessage[], page: number): AITurnResult {
  const message = history[pageAssistantIndex(page, 2)];
  if (!message || message.role !== 'assistant') throw new Error(`no assistant turn on page ${page}`);
  return JSON.parse(message.content) as AITurnResult;
}

/** Turns as the flat action/narration message history the panels page through. */
export function turnHistory(turns: TurnFixture[]): ChatMessage[] {
  return turns.flatMap((turn) => [
    { role: 'user' as const, content: turn.action ?? 'look around' },
    { role: 'assistant' as const, content: turnContent(turn) },
  ]);
}

/** The per-turn mechanical snapshot paging back reads; only the fields the panels display are filled. */
function snapshotFixture(turn: TurnFixture, stats: PlayerStat[]): GameState {
  return {
    playerStats: stats,
    playerTraits: [],
    visibleEntities: [],
    logEntries: [],
    gameplayText: turn.narration,
    gameTime: 0,
    fullMessageHistory: [],
    characterData: null,
    choices: turn.choices ?? [],
    isGameStarted: true,
    timestamp: '2026-01-01T00:00:00.000Z',
    worldName: null,
    playerNotes: '',
    previousStateIndex: null,
    stateVersion: 2,
  };
}

/** Stage a committed history (and the snapshots that make paging back work) into Gameplay. */
function seedTurns(gameplay: Gameplay, turns: TurnFixture[], page: number, stats: PlayerStat[]): void {
  const history = turnHistory(turns);
  gameplay.setFullMessageHistory(history);
  gameplay.setGameStates(turns.map((turn) => snapshotFixture(turn, stats)));
  // GameViewer shows the viewed page's pair; the panels read this rather than slicing the history themselves.
  gameplay.setDisplayedMessages(history.slice((page - 1) * 2, page * 2));
  gameplay.setChoices(turns[turns.length - 1]?.choices ?? []);
  if (page < turns.length) gameplay.setUserPage(page);
}

/** Mounts the providers, stages state once, and exposes the live contexts to the caller. */
// eslint-disable-next-line react-refresh/only-export-components -- test-only module; nothing is hot-reloaded
const Stage =({ options, stats, expose, children }: {
  options: PanelHarnessOptions;
  stats: PlayerStat[];
  expose: (contexts: { gameplay: Gameplay; gameData: GameData; settings: Settings }) => void;
  children: ReactNode;
}) => {
  const gameplay = useGameplay();
  const gameData = useGameData();
  const settings = useSettings();
  expose({ gameplay, gameData, settings });

  useEffect(() => {
    gameData.loadWorldData(worldFixture({ ...options.world, stats: stats as unknown as Stat[] }));
    options.settings?.(settings);
    gameplay.setPlayerStats(stats);
    if (options.turns?.length) {
      seedTurns(gameplay, options.turns, options.page ?? options.turns.length, stats);
    }
    if (options.gameplayText !== undefined) setGameplayText(options.gameplayText);
    options.seed?.(gameplay);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps -- stage once, then the panel owns the state

  return <>{children}</>;
};

/** Result of rendering a panel: the RTL handles, the resolved props (spies included) and the live contexts. */
export interface PanelHarness<P> extends ReturnType<typeof render> {
  /** The props the panel was rendered with — the callbacks are `vi.fn()` spies. */
  props: P;
  /** Re-render the same panel (and the same providers) with props merged over the current ones. */
  setProps: (next: Partial<P>) => void;
  gameplay: () => Gameplay;
  gameData: () => GameData;
  settings: () => Settings;
}

/** Shared plumbing: mount `panel(props)` under the provider stack and keep re-renders on the same tree. */
function renderPanel<P extends object>(
  defaults: P,
  overrides: Partial<P>,
  options: PanelHarnessOptions,
  panel: (props: P) => ReactNode,
): PanelHarness<P> {
  installBrowserShims();
  // Settings live in localStorage, so a previous test's toggles would otherwise carry into this one.
  localStorage.clear();
  setGameplayText('');

  const stats = options.stats ?? [];
  let contexts: { gameplay: Gameplay; gameData: GameData; settings: Settings } | null = null;
  let props = { ...defaults, ...overrides };

  const tree = () => (
    <SettingsProvider>
      <GameDataProvider>
        <GameplayProvider>
          <Stage options={options} stats={stats} expose={(c) => { contexts = c; }}>
            {panel(props)}
          </Stage>
        </GameplayProvider>
      </GameDataProvider>
    </SettingsProvider>
  );

  const view = render(tree());
  const live = () => {
    if (!contexts) throw new Error('panel harness: contexts not available (did the render throw?)');
    return contexts;
  };

  return {
    ...view,
    get props() { return props; },
    setProps: (next: Partial<P>) => { props = { ...props, ...next }; view.rerender(tree()); },
    gameplay: () => live().gameplay,
    gameData: () => live().gameData,
    settings: () => live().settings,
  };
}

/** Default `MiddlePanel` props: every callback a spy, nothing in flight. `totalPages` and `sceneTurnId` come
 *  from the staged turns, and `disabled` mirrors GameViewer's own rule that a scene render holds the input. */
export function middlePanelProps(
  overrides: Partial<MiddlePanelProps> = {},
  options: PanelHarnessOptions = {},
): MiddlePanelProps {
  const turns = options.turns ?? [];
  const page = options.page ?? Math.max(1, turns.length);
  const job = overrides.sceneImageJob ?? null;
  return {
    parseAssistantMessage: (content: string) => {
      try {
        const parsed = JSON.parse(content) as { narration?: string };
        return parsed.narration ?? content;
      } catch { return content; }
    },
    totalPages: Math.max(1, turns.length),
    handlePageChange: vi.fn(),
    handleSendAction: vi.fn(),
    handleKeyPress: vi.fn(),
    handleRollback: vi.fn(),
    handleRegenerate: vi.fn(),
    handleRegenerateChoices: vi.fn(),
    handleRegenerateStats: vi.fn(),
    abortGeneration: vi.fn(),
    disabled: job !== null,
    sceneImages: [],
    sceneTags: turns[page - 1]?.sceneTags ?? '',
    sceneTurnId: turns[page - 1]?.turnId,
    sceneImageJob: job,
    sceneImageProgress: null,
    sceneImagePreview: null,
    sceneImagesAvailable: true,
    onSceneImage: vi.fn(),
    onSceneTags: vi.fn(),
    onCancelSceneImage: vi.fn(),
    onDeleteSceneImage: vi.fn(),
    onTTSClick: vi.fn(),
    onExportStory: vi.fn(),
    onRegenerateTTS: vi.fn(),
    ttsLoaded: false,
    ttsGenerating: false,
    ttsProgress: null,
    memoryBar: null,
    progressBar: null,
    locationSuggestion: null,
    commandPreview: false,
    onDismissCommandPreview: vi.fn(),
    ...overrides,
  };
}

/** Render the narration panel over a staged playthrough. */
export function renderMiddlePanel(
  overrides: Partial<MiddlePanelProps> = {},
  options: PanelHarnessOptions = {},
): PanelHarness<MiddlePanelProps> {
  return renderPanel(
    middlePanelProps(overrides, options),
    {},
    options,
    (props) => <MiddlePanel {...props} />,
  );
}

/** Render the character/notes/memory/log panel over a staged playthrough. */
export function renderLeftPanel(
  overrides: Partial<LeftPanelProps> = {},
  options: PanelHarnessOptions = {},
): PanelHarness<LeftPanelProps> {
  const defaults: LeftPanelProps = { entities: [], onEntityClick: vi.fn() };
  return renderPanel(defaults, overrides, options, (props) => <LeftPanel {...props} />);
}

/** Render the stats/traits/location panel over a staged playthrough. */
export function renderRightPanel(
  overrides: Partial<RightPanelProps> = {},
  options: PanelHarnessOptions = {},
): PanelHarness<RightPanelProps> {
  const defaults: RightPanelProps = {
    onLocationClick: vi.fn(),
    onToggleTrait: vi.fn(),
    language: '',
    setLanguage: vi.fn(),
  };
  return renderPanel(defaults, overrides, options, (props) => <RightPanel {...props} />);
}

/** jsdom gaps the panels hit on mount: `matchMedia` (theme, mobile layout, reduced motion) and the endpoint
 *  probes the settings provider fires on a ~1.2s timer — a test that waits that long would otherwise reach
 *  the real network. Every probe treats a failure as "couldn't detect", so refusing them changes nothing the
 *  panels see. A `fetch` the test mocked itself is left alone. */
function installBrowserShims(): void {
  if (typeof window.matchMedia !== 'function') {
    window.matchMedia = ((query: string) => ({
      matches: false, media: query, onchange: null,
      addEventListener: () => {}, removeEventListener: () => {},
      addListener: () => {}, removeListener: () => {}, dispatchEvent: () => false,
    })) as unknown as typeof window.matchMedia;
  }
  if (!vi.isMockFunction(globalThis.fetch)) {
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('offline (panel harness)'))));
  }
}
