import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { harborWorld, renderGameViewer } from '@/test/gameViewer';
import { sseResponse, sseReply } from '@/test/aiTextFixtures';
import { useGameplay } from '@/contexts/GameplayContext';
import { useSettings } from '@/contexts/SettingsContext';
import { deleteSaveRecord, getAllSaveRecords } from '@/components/modals/dbUtils';
import { closedTurns } from '@/lib/memoryView';
import { OPENING_SCENE_CUE } from '@/components/game/GamePrompts';
import type { ChatMessage, PlayerStat, Script, ScriptTiming, Trait, World } from '@/types';

/** What `turn` reads on a mounted game: the live turn, both re-rolls, and switches in and between turns. */

vi.hoisted(() => { vi.stubEnv('VITE_DEFAULT_ENDPOINT', ''); });
vi.mock('@/views/VRMViewer', () => import('@/test/stubs/vrmViewer'));
vi.mock('react-toastify', () => ({
  toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn(), info: vi.fn(), warn: vi.fn(), dismiss: vi.fn(), isActive: vi.fn() }),
  ToastContainer: () => null,
}));

const TIMINGS = ['start', 'before', 'output', 'after', 'switch'] as const satisfies readonly ScriptTiming[];
type Seen = Record<(typeof TIMINGS)[number], number>;

const statOf = (id: string): PlayerStat => ({ id, name: id, type: 'number', description: '', min: -1, max: 999999, value: -1, regen: 0, descriptors: [] });

/** Each timing writes its own stat: the turn number times 1000, plus the action's length. */
const recorder = (timing: ScriptTiming): Script => ({
  id: `read:${timing}`, timing, code: `stats.${timing}.value = turn.number * 1000 + turn.action.length;`,
});
const brave: Trait = { id: 'brave', name: 'Brave', statChanges: [], playerToggle: true };

const worldWith = (extra: Script[] = []): World => ({
  ...harborWorld({ stats: TIMINGS.map(statOf) }), traits: [brave], scripts: [...TIMINGS.map(recorder), ...extra],
});

/** The page the player sees: the reply below with its During AI Output rewrite. */
const PAGE = 'The ferry gong rings twice across the water.';
const CHOICES = ['Ring the bell', 'Wait at the dock'];
const gong: Script = { id: 'gong', timing: 'output', code: "narration.sentence = narration.sentence.replace('bell', 'gong');" };

/** Each timing writes its `r_` stat: 10 for the rewritten page (20 for any other), plus 1 for the choices in order (2 for any other). */
const replyRecorder = (timing: ScriptTiming): Script => ({
  id: `reply:${timing}`, timing, code: [
    `const page = turn.narration === ${JSON.stringify(PAGE)} ? 1 : turn.narration === '' ? 0 : 2;`,
    `const picks = JSON.stringify(turn.choices) === ${JSON.stringify(JSON.stringify(CHOICES))} ? 1 : turn.choices.length === 0 ? 0 : 2;`,
    `stats.r_${timing}.value = page * 10 + picks;`,
  ].join('\n'),
});

const replyWorld = (extra: Script[] = []): World => ({
  ...harborWorld({ stats: [...TIMINGS.map(statOf), ...TIMINGS.map((timing) => statOf(`r_${timing}`))] }),
  traits: [brave], scripts: [...TIMINGS.map(recorder), ...TIMINGS.map(replyRecorder), gong, ...extra],
});

let seen: Seen;
let replies: Seen;
let history: ChatMessage[] = [];
let showTraits = () => {};
let choicesOff = () => {};
function Probe() {
  const play = useGameplay();
  const settings = useSettings();
  choicesOff = () => settings.setChoicesEnabled(false);
  seen = Object.fromEntries(TIMINGS.map((id) => [id, play.globalStats.find((s) => s.id === id)?.value ?? NaN])) as Seen;
  replies = Object.fromEntries(TIMINGS.map((id) => [id, play.globalStats.find((s) => s.id === `r_${id}`)?.value ?? NaN])) as Seen;
  history = play.fullMessageHistory;
  showTraits = () => play.setActiveTab('traits');
  return null;
}

let calls = 0;
let statCalls = 0;
/** While set, every AI call waits on it, so a test can act mid-turn. */
let held: Promise<void> | null = null;
/** While set, every stat request waits on it, after its count goes up. */
let statHeld: Promise<void> | null = null;
function stubEndpoint() {
  vi.stubGlobal('fetch', vi.fn(async (_url: string, init?: RequestInit) => {
    if (!init?.body) return new Response(JSON.stringify({ data: [{ id: 'm' }] }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    if (held) await held;
    const { messages } = JSON.parse(init.body as string) as { messages: { role: string; content: string }[] };
    const system = messages.find((m) => m.role === 'system')?.content ?? '';
    if (system.includes('player choice writer')) return sseResponse(sseReply('1. Ring the bell\n2. Wait at the dock'));
    if (system.includes('stat tracker')) {
      statCalls += 1;
      if (statHeld) await statHeld;
      return sseResponse(sseReply('No changes.'));
    }
    calls += 1;
    return sseResponse(sseReply('The ferry bell rings twice across the water.'));
  }));
}

beforeEach(async () => {
  for (const { id } of await getAllSaveRecords()) await deleteSaveRecord(id);
  calls = 0;
  statCalls = 0;
  held = null;
  statHeld = null;
  localStorage.clear();
  localStorage.setItem('FORMAMORPH_endpointUrl', 'http://127.0.0.1:5190/v1/chat/completions');
  localStorage.setItem('FORMAMORPH_thinkingMode', 'off');
});

const box = () => screen.getByPlaceholderText(/Type your action/);
const turnDone = () => waitFor(() => expect(screen.getByRole('button', { name: 'Re-generate Stats' })).toBeEnabled());

async function enter(world: World) {
  renderGameViewer(world, { inGameplay: <Probe /> });
  await screen.findByPlaceholderText(/Type your action/);
  stubEndpoint();
}

async function send(action?: string) {
  const turns = closedTurns(history);
  if (action !== undefined) fireEvent.change(box(), { target: { value: action } });
  fireEvent.click(screen.getByRole('button', { name: 'Send' }));
  await waitFor(() => expect(closedTurns(history)).toBe(turns + 1));
  await turnDone();
}

async function clickBrave() {
  showTraits();
  const global = await screen.findByRole('group', { name: 'Global' });
  const header = within(global).getByRole('button', { name: /^Global,/ });
  if (header.getAttribute('aria-expanded') !== 'true') fireEvent.click(header);
  const disabled = within(global).queryByRole('button', { name: /^Disabled/ });
  if (disabled?.getAttribute('aria-expanded') === 'false') fireEvent.click(disabled);
  fireEvent.click(await within(global).findByRole('checkbox', { name: /Brave/ }));
}

const OPENING = '  [OOC: keep it short] I walk the pier.  ';
const TRIMMED = OPENING.trim();

describe('turn on the live turn', () => {
  it('reads the trimmed action with its OOC brackets, one number across a turn’s timings, on the memories scale', async () => {
    await enter(worldWith());
    await send(OPENING);
    expect(seen).toMatchObject({ start: 1000 + TRIMMED.length, before: 1000 + TRIMMED.length, output: 1000 + TRIMMED.length, after: 1000 + TRIMMED.length });

    await send('I ring the bell.');
    expect(seen).toMatchObject({ before: 2016, output: 2016, after: 2016 });
    // The committed turn is turn 2 on the memories scale.
    expect(closedTurns(history)).toBe(2);
  });

  it('reads the drawn opening on an untouched opening turn', async () => {
    await enter(worldWith());
    await waitFor(() => expect(box()).toHaveValue(OPENING_SCENE_CUE));
    await send();
    expect(seen.before).toBe(1000 + OPENING_SCENE_CUE.trim().length);
  });
});

describe('turn on a re-roll', () => {
  it('reads the same action and number on the stats re-roll', async () => {
    await enter(worldWith());
    await send(OPENING);
    await send('I ring the bell.');
    const asked = statCalls;
    fireEvent.click(screen.getByRole('button', { name: 'Re-generate Stats' }));
    await waitFor(() => expect(statCalls).toBe(asked + 1));
    await turnDone();
    expect(seen).toMatchObject({ before: 2016, after: 2016 });
  });

  it('reads the opening cue again on a page-one stats re-roll', async () => {
    await enter(worldWith());
    await send(OPENING);
    const asked = statCalls;
    fireEvent.click(screen.getByRole('button', { name: 'Re-generate Stats' }));
    await waitFor(() => expect(statCalls).toBe(asked + 1));
    await turnDone();
    expect(seen).toMatchObject({ before: 1000 + TRIMMED.length, after: 1000 + TRIMMED.length });
  });

  it('reads the same action and number on the full re-roll', async () => {
    await enter(worldWith());
    await send(OPENING);
    await send('I ring the bell.');
    const before = calls;
    fireEvent.click(screen.getByRole('button', { name: 'Re-generate Narration' }));
    await waitFor(() => expect(calls).toBeGreaterThan(before));
    await turnDone();
    expect(seen).toMatchObject({ before: 2016, after: 2016 });
    expect(closedTurns(history)).toBe(2);
  });
});

describe('turn in a switch run', () => {
  it('reads turn 0 and an empty action on a toggle before the opening turn', async () => {
    await enter(worldWith());
    await clickBrave();
    await waitFor(() => expect(seen.switch).toBe(0));
  });

  it('reads the last turn that ended and an empty action on a toggle between turns', async () => {
    await enter(worldWith());
    await send(OPENING);
    await send('I ring the bell.');
    await clickBrave();
    await waitFor(() => expect(seen.switch).toBe(2000));
  });

  it('reads an empty action and the turn in progress on a toggle while a turn runs', async () => {
    await enter(worldWith());
    await send(OPENING);
    let release = () => {};
    held = new Promise<void>((resolve) => { release = resolve; });
    fireEvent.change(box(), { target: { value: 'I ring the bell.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    await waitFor(() => expect(calls).toBeGreaterThan(0));
    await clickBrave();
    await waitFor(() => expect(seen.switch).toBe(2000));
    held = null;
    release();
    await waitFor(() => expect(closedTurns(history)).toBe(2));
  });

  it('reads that turn’s action and number on a switch a script fires inside the turn', async () => {
    const switcher: Script = { id: 'switcher', timing: 'after', code: 'if (turn.number === 2) traits.Brave.enabled = true;' };
    await enter(worldWith([switcher]));
    await send(OPENING);
    await send('I ring the bell.');
    await waitFor(() => expect(seen.switch).toBe(2016));
  });
});

describe('turn.narration and turn.choices', () => {
  it('reads the rewritten page and the choices in order at After the AI, and empty at the earlier timings', async () => {
    await enter(replyWorld());
    await send(OPENING);
    expect(replies).toMatchObject({ start: 0, before: 0, output: 0, after: 11 });
    await send('I ring the bell.');
    expect(replies).toMatchObject({ before: 0, output: 0, after: 11 });
  });

  it('reads no choices at After the AI with the player’s choices off', async () => {
    await enter(replyWorld());
    act(() => choicesOff());
    await send(OPENING);
    expect(replies.after).toBe(10);
  });

  it('reads the re-rolled turn’s page and choices on a stats re-roll’s After the AI run', async () => {
    await enter(replyWorld());
    await send(OPENING);
    // Page one's re-roll starts from the pre-start stats, where every r_ stat is -1, so 11 is the re-roll's own write.
    const asked = statCalls;
    fireEvent.click(screen.getByRole('button', { name: 'Re-generate Stats' }));
    await waitFor(() => expect(statCalls).toBe(asked + 1));
    await turnDone();
    expect(replies).toMatchObject({ before: 0, after: 11 });
  });

  it('reads empty on a switch a stats re-roll’s Before the AI script fires', async () => {
    const switcher: Script = { id: 'switcher', timing: 'before', code: 'traits.Brave.enabled = true;' };
    await enter(replyWorld([switcher]));
    await send(OPENING);
    // Page one's re-roll restores Brave off and r_switch to -1, so 0 is the replayed switch's own read.
    const asked = statCalls;
    fireEvent.click(screen.getByRole('button', { name: 'Re-generate Stats' }));
    await waitFor(() => expect(statCalls).toBe(asked + 1));
    await turnDone();
    expect(replies.switch).toBe(0);
  });

  it('reads no choices on a toggle during a stats re-roll once the player turns choices off', async () => {
    await enter(replyWorld());
    await send(OPENING);
    act(() => choicesOff());
    let release = () => {};
    statHeld = new Promise<void>((resolve) => { release = resolve; });
    const asked = statCalls;
    fireEvent.click(screen.getByRole('button', { name: 'Re-generate Stats' }));
    await waitFor(() => expect(statCalls).toBe(asked + 1));
    await clickBrave();
    await waitFor(() => expect(replies.switch).toBe(10));
    statHeld = null;
    release();
  });

  it('reads empty on a toggle before the opening turn', async () => {
    await enter(replyWorld());
    await clickBrave();
    await waitFor(() => expect(replies.switch).toBe(0));
  });

  it('reads the last turn’s page and choices on a toggle between turns', async () => {
    await enter(replyWorld());
    await send(OPENING);
    await clickBrave();
    await waitFor(() => expect(replies.switch).toBe(11));
  });

  it('reads no choices on a toggle between turns once the player turns choices off', async () => {
    await enter(replyWorld());
    await send(OPENING);
    act(() => choicesOff());
    await clickBrave();
    await waitFor(() => expect(replies.switch).toBe(10));
  });

  it('reads empty on a toggle while a turn runs, before its reply lands', async () => {
    await enter(replyWorld());
    await send(OPENING);
    let release = () => {};
    held = new Promise<void>((resolve) => { release = resolve; });
    fireEvent.change(box(), { target: { value: 'I ring the bell.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    await waitFor(() => expect(calls).toBeGreaterThan(0));
    await clickBrave();
    await waitFor(() => expect(replies.switch).toBe(0));
    held = null;
    release();
    await waitFor(() => expect(closedTurns(history)).toBe(2));
  });

  it('reads the turn’s page and choices on a switch an After the AI script fires', async () => {
    const switcher: Script = { id: 'switcher', timing: 'after', code: 'traits.Brave.enabled = true;' };
    await enter(replyWorld([switcher]));
    await send(OPENING);
    await waitFor(() => expect(replies.switch).toBe(11));
  });
});
