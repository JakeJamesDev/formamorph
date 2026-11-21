import { describe, it, expect } from 'vitest';
import { planTurn } from './planTurn';
import { computeTurnCommit, withCodeWrites, type TurnCommit, type TurnCommitContext } from './computeTurnCommit';
import { runTurn, type TurnRequestAdapter } from './turnRunner';
import { RAIN_WEATHER, testInput } from './turnTestInputs';
import { emptyTurnMaterial, type TurnPassRequest, type TurnPlanInput } from './turnPlan';
import { isDaylight, landedWeatherChange, offeredWeatherKinds } from '@/lib/weather';
import { gateOf, gateStates } from '@/lib/traitGates';
import { traitGateInput, type TraitRuntimeState } from '@/lib/traitRuntime';
import type { GameLocation, Trait, WeatherKind, WorldWeather } from '@/types';

/**
 * The Weather Pass through the Turn Pipeline's seam: a fake request adapter answers as the model, the real
 * pass records build and parse, and the Turn Commit carries the World Weather the landing applies.
 */

const NARRATION = 'Clouds pile up over the harbor as you walk the boards.';

/** Story hours after the default 08:00 start: morning, 18:00 and 23:00. */
const MORNING = 0;
const EVENING = 10;
const NIGHT = 15;

const WORLD: WorldWeather = { on: true, allowed: ['rain', 'snow', 'storm', 'brightSun'] };

/** The pass's input as the view builds it: offered kinds read at the turn's start. */
const weatherAt = (current: WeatherKind, gameTime: number, startWeatherSet = false): NonNullable<TurnPlanInput['weather']> =>
  ({ current, offered: offeredWeatherKinds(WORLD, isDaylight(gameTime)), startWeatherSet });

interface Turn {
  weather?: TurnPlanInput['weather'];
  isGameStarted?: boolean;
  gameTime?: number;
  /** The Weather Pass's raw reply. */
  answer?: string;
  /** The clock pass's raw reply. */
  clock?: string;
}

const turn = async ({ weather, isGameStarted = true, gameTime = MORNING, answer = 'no change', clock = '30m' }: Turn) => {
  const sent: TurnPassRequest[] = [];
  const adapter: TurnRequestAdapter = async (request) => {
    sent.push(request);
    if (request.type === 'narration') return NARRATION;
    if (request.type === 'weather') return answer;
    if (request.type === 'timePassed') return clock;
    return '';
  };
  const plan = planTurn(testInput({ weather, isGameStarted }, { thinkingMode: 'off', concurrentTurnRequests: false }));
  const material = emptyTurnMaterial({
    action: 'I walk the boards.', effectiveAction: 'I walk the boards.', turnId: 't1', baseCtx: {}, destinations: [],
  });
  const result = await runTurn({ plan, material, request: adapter, signal: new AbortController().signal });
  const context: TurnCommitContext = { participants: [], knownDiscoveredNames: [], notes: '', reasoning: { text: '', ms: 0 }, gameTime };
  const commit = computeTurnCommit({ result, plan, context });
  if (!commit) throw new Error('the turn did not commit');
  return { plan, commit, context, weatherRequest: sent.find((r) => r.type === 'weather') };
};

const OPEN: Pick<GameLocation, 'sheltered'> = {};
const TAVERN: Pick<GameLocation, 'sheltered'> = { sheltered: true };

/** The landing's Weather Change for the commit, from `from` to `to` (one place unless moved). */
const changeOf = (before: WeatherKind, commit: TurnCommit, from = OPEN, to = from) =>
  landedWeatherChange({
    before, after: commit.weather ?? 'clear', from, to, isOpeningTurn: commit.isOpeningTurn, nightfall: commit.nightfall,
  });

const lastMessage = (request: TurnPassRequest | undefined): string => {
  const content = request?.messages.at(-1)?.content;
  return typeof content === 'string' ? content : '';
};

describe('the Weather Pass in a turn', () => {
  it('keeps the World Weather on no change, and reports nothing', async () => {
    const { commit } = await turn({ weather: weatherAt('rain', MORNING), answer: 'no change' });
    expect(commit.weather).toBe('rain');
    expect(changeOf('rain', commit)).toBeNull();
  });

  it.each(['rain', 'snow', 'storm', 'brightSun'] as const)('moves the World Weather to %s and fires foreground', async (kind) => {
    const words = { rain: 'rain', snow: 'snow', storm: 'storm', brightSun: 'bright sun' };
    const { commit } = await turn({ weather: weatherAt('clear', MORNING), answer: words[kind] });
    expect(commit.weather).toBe(kind);
    expect(changeOf('clear', commit)).toEqual({ from: 'clear', to: kind, foreground: true });
  });

  it('moves into Clear with no foreground', async () => {
    const { commit } = await turn({ weather: weatherAt('storm', MORNING), answer: 'clear' });
    expect(commit.weather).toBe('clear');
    expect(changeOf('storm', commit)).toEqual({ from: 'storm', to: 'clear', foreground: false });
  });

  it('reads an answer outside the allowed kinds as no change', async () => {
    const { commit } = await turn({ weather: { current: 'rain', offered: ['clear', 'rain'], startWeatherSet: false }, answer: 'snow' });
    expect(commit.weather).toBe('rain');
  });

  it('reads a schema reply like a text one', async () => {
    const { commit } = await turn({ weather: weatherAt('clear', MORNING), answer: '{"shown":"yes","weather":"storm"}' });
    expect(commit.weather).toBe('storm');
  });

  it('keeps the weather when the pass says the scene does not show it, whatever kind it names', async () => {
    const { commit } = await turn({ weather: weatherAt('clear', MORNING), answer: '{"shown":"no","weather":"storm"}' });
    expect(commit.weather).toBe('clear');
  });

  it('offers Bright Sun in daylight only, and an answer of it at night is no change', async () => {
    const day = await turn({ weather: weatherAt('clear', MORNING) });
    expect(lastMessage(day.weatherRequest)).toContain('bright sun');
    const night = await turn({ weather: weatherAt('clear', NIGHT), answer: 'bright sun' });
    expect(lastMessage(night.weatherRequest)).not.toContain('bright sun');
    expect(night.commit.weather).toBe('clear');
  });

  it('turns Bright Sun into Clear at nightfall, with no foreground', async () => {
    const { commit } = await turn({ weather: weatherAt('brightSun', EVENING), gameTime: EVENING, clock: 'until nightfall' });
    expect(commit.weather).toBe('clear');
    expect(commit.nightfall).toBe(true);
    expect(changeOf('brightSun', commit)).toEqual({ from: 'brightSun', to: 'clear', foreground: false });
  });

  it('reads the nightfall rule again when code moves the clock past dusk', async () => {
    const { commit, context } = await turn({ weather: weatherAt('clear', EVENING), gameTime: EVENING, answer: 'bright sun' });
    expect(commit.weather).toBe('brightSun');
    const late = withCodeWrites(commit, { minutes: 6 * 60 }, context);
    expect(late.weather).toBe('clear');
    expect(late.nightfall).toBe(true);
  });

  it('sends no Weather Pass while the world has Weather off', async () => {
    const { plan, commit } = await turn({});
    expect(plan.passes.some((p) => p.id === 'weather')).toBe(false);
    expect(commit.weather).toBeNull();
  });
});

describe('a script weather set in the Turn Commit', () => {
  it('replaces the pass answer and fires a Weather Change with foreground', async () => {
    const { commit, context } = await turn({ weather: weatherAt('clear', MORNING), answer: 'rain' });
    const set = withCodeWrites(commit, { weather: 'storm' }, context);
    expect(set.weather).toBe('storm');
    expect(changeOf('clear', set)).toEqual({ from: 'clear', to: 'storm', foreground: true });
  });

  it('fires nothing when the set matches what the player already has', async () => {
    const { commit, context } = await turn({ weather: weatherAt('rain', MORNING) });
    expect(changeOf('rain', withCodeWrites(commit, { weather: 'rain' }, context))).toBeNull();
  });

  it('keeps the set when a later write moves the clock inside the day', async () => {
    const { commit, context } = await turn({ weather: weatherAt('clear', MORNING) });
    const set = withCodeWrites(commit, { weather: 'snow' }, context);
    expect(withCodeWrites(set, { minutes: 30 }, context).weather).toBe('snow');
  });

  it('turns a set of Bright Sun into Clear when the turn ends at night, with no foreground', async () => {
    const { commit, context } = await turn({ weather: weatherAt('clear', NIGHT), gameTime: NIGHT });
    const set = withCodeWrites(commit, { weather: 'brightSun' }, context);
    expect(set.weather).toBe('clear');
    expect(set.nightfall).toBe(true);
    expect(changeOf('rain', set)).toEqual({ from: 'rain', to: 'clear', foreground: false });
  });

  it('keeps a set after the clock moves past dusk, with the nightfall rule applied to it', async () => {
    const { commit, context } = await turn({ weather: weatherAt('clear', EVENING), gameTime: EVENING });
    const set = withCodeWrites(commit, { weather: 'brightSun', minutes: 6 * 60 }, context);
    expect(set.weather).toBe('clear');
  });

  it('carries no weather while the world has Weather off', async () => {
    const { commit, context } = await turn({});
    expect(withCodeWrites(commit, { weather: 'storm' }, context).weather).toBeNull();
  });

  it('applies the set on the opening turn without foreground', async () => {
    const { commit, context } = await turn({ weather: weatherAt('clear', MORNING), isGameStarted: false });
    const set = withCodeWrites(commit, { weather: 'storm' }, context);
    expect(set.weather).toBe('storm');
    expect(changeOf('clear', set)).toEqual({ from: 'clear', to: 'storm', foreground: false });
  });
});

describe('Shelter in the landing', () => {
  it('fires nothing while Sheltered, whatever the World Weather does', async () => {
    const { commit } = await turn({ weather: weatherAt('clear', MORNING), answer: 'storm' });
    expect(commit.weather).toBe('storm');
    expect(changeOf('clear', commit, TAVERN)).toBeNull();
  });

  it('reports a move into Shelter with no foreground, and a move out with foreground', async () => {
    const { commit } = await turn({ weather: weatherAt('rain', MORNING) });
    expect(changeOf('rain', commit, OPEN, TAVERN)).toEqual({ from: 'rain', to: null, foreground: false });
    expect(changeOf('rain', commit, TAVERN, OPEN)).toEqual({ from: null, to: 'rain', foreground: true });
  });

  it('reports a move out of Shelter into a new storm as that storm', async () => {
    const { commit } = await turn({ weather: weatherAt('rain', MORNING), answer: 'storm' });
    expect(changeOf('rain', commit, TAVERN, OPEN)).toEqual({ from: null, to: 'storm', foreground: true });
  });
});

describe('the opening turn', () => {
  it('reads page one when no start weather was authored, with no foreground', async () => {
    const { plan, commit, weatherRequest } = await turn({ weather: weatherAt('clear', MORNING), isGameStarted: false, answer: 'storm' });
    expect(plan.passes.some((p) => p.id === 'weather')).toBe(true);
    expect(lastMessage(weatherRequest)).not.toContain('before this passage');
    expect(commit.weather).toBe('storm');
    expect(changeOf('clear', commit)).toEqual({ from: 'clear', to: 'storm', foreground: false });
  });

  it('leaves the pass out when the start weather was authored', async () => {
    const { plan, commit } = await turn({ weather: weatherAt('rain', MORNING, true), isGameStarted: false });
    expect(plan.passes.some((p) => p.id === 'weather')).toBe(false);
    expect(commit.weather).toBe('rain');
  });

  it('sends the weather before the passage on a later turn', async () => {
    const { weatherRequest } = await turn({ weather: RAIN_WEATHER });
    expect(lastMessage(weatherRequest)).toContain('The weather before this passage: rain.');
  });
});

describe('a Weather Condition after the turn commit', () => {
  const stormy: Trait = { id: 'stormy', name: 'Stormy', statChanges: [], requires: [{ all: [{ kind: 'weather', kinds: ['storm'] }] }] };
  const rainy: Trait = { id: 'rainy', name: 'Rainy', statChanges: [], requires: [{ all: [{ kind: 'weather', kinds: ['rain'] }] }] };
  const state: TraitRuntimeState = { stats: [], traits: [stormy, rainy], disabledTraitIds: [], appliedValues: {} };
  /** Whether each trait's gate holds when the view reads the commit's weather, as the gated world does. */
  const holds = (commit: TurnCommit) => {
    const states = gateStates(traitGateInput(state, { traits: [stormy, rainy], groups: [], ...(commit.weather ? { weather: commit.weather } : {}) }));
    return { stormy: gateOf(states, null, 'stormy')!.unlocked, rainy: gateOf(states, null, 'rainy')!.unlocked };
  };

  it('reads the kind a script set, not the one the pass answered', async () => {
    const { commit, context } = await turn({ weather: weatherAt('clear', MORNING), answer: 'rain' });
    expect(holds(commit)).toEqual({ stormy: false, rainy: true });
    expect(holds(withCodeWrites(commit, { weather: 'storm' }, context))).toEqual({ stormy: true, rainy: false });
  });

  it('reads the nightfall rule applied to a set', async () => {
    const { commit, context } = await turn({ weather: weatherAt('clear', NIGHT), gameTime: NIGHT });
    const set = withCodeWrites(commit, { weather: 'brightSun' }, context);
    expect(set.weather).toBe('clear');
    expect(holds(set)).toEqual({ stormy: false, rainy: false });
  });
});
