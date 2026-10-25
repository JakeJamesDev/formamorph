import { fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { harborWorld, renderGameViewer } from '@/test/gameViewer';
import { sseFrame, sseReply, sseResponse } from '@/test/aiTextFixtures';
import { scriptWorldTool } from '@/test/worldToolFixtures';
import { useGameplay } from '@/contexts/GameplayContext';
import { presetStoreCodec, type PromptPresetStore } from '@/lib/promptPresets';
import { UNKNOWN_REASONING_CAPABILITY } from '@/lib/reasoningEffort';
import type { GameLocation, PlayerStat, Script, Tool, World } from '@/types';

/** A clock advance made mid-turn shows in the prompts built after it, and the commit counts it once (Q45, Q52). */

vi.hoisted(() => { vi.stubEnv('VITE_DEFAULT_ENDPOINT', ''); });
vi.mock('@/views/VRMViewer', () => import('@/test/stubs/vrmViewer'));
vi.mock('react-toastify', () => ({
  toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn(), info: vi.fn(), warn: vi.fn(), dismiss: vi.fn(), isActive: vi.fn() }),
  ToastContainer: () => null,
}));

const ENDPOINT = 'http://127.0.0.1:5190/v1/chat/completions';
const MODEL = 'm';
// The narration prompt names the time and the location, so a request shows what it was built at.
const NARRATOR = 'NARRATOR. It is <TIME>. You are at <LOCATION|name>.';
const CHOOSER = 'CHOOSER. It is <TIME>.';

const stat = (over: Partial<PlayerStat> & Pick<PlayerStat, 'id' | 'name' | 'value'>): PlayerStat =>
  ({ type: 'number', description: '', min: 0, max: 1000, regen: 0, descriptors: [], ...over });

// An After the AI script banks the hour the turn's own stat code reads as the turn's end.
const endHour = stat({ id: 'end', name: 'End', value: 0, scripts: [{ id: 'end:after', timing: 'after', code: 'return clock.elapsedHours;' }] });
// Regen and starvation tick by the hour, so each shows how many hours the turn charged them.
const rest = stat({ id: 'rest', name: 'Rest', value: 0, regen: 1 });
const health = stat({ id: 'health', name: 'Health', value: 500 });
const hunger = stat({ id: 'hunger', name: 'Hunger', value: 10 });
const mark = stat({ id: 'mark', name: 'Mark', value: 0 });
const LIGHTHOUSE: GameLocation = { id: 'lighthouse', name: 'Lighthouse' };

const world = ({ scripts = [], tools = [] }: { scripts?: Script[]; tools?: Tool[] } = {}): World => {
  const base = harborWorld({ stats: [endHour, rest, health, hunger, mark] });
  return { ...base, locations: [...base.locations, LIGHTHOUSE], scripts, tools };
};
const before = (code: string): Script => ({ id: 'before', timing: 'before', name: 'Before', code });
const onCallTool = (code: string): Tool => ({ ...scriptWorldTool('sleep', 'sleep', code, 'call'), offeredTo: ['thinking'] });

let gameTime = 0;
let stats: PlayerStat[] = [];
function Probe() {
  const play = useGameplay();
  gameTime = play.gameTime;
  stats = play.globalStats;
  return null;
}
const valueOf = (id: string) => stats.find((s) => s.id === id)?.value;

/** What each request sent, by kind. The request offered the Tools calls `calls` in order, one per round. */
function stubEndpoint({ calls = [] as string[] } = {}) {
  const sent = { narration: [] as string[], choices: [] as string[], toolReplies: [] as string[], toolCalls: 0 };
  vi.stubGlobal('fetch', vi.fn(async (_url: string, init?: RequestInit) => {
    if (!init?.body) return new Response(JSON.stringify({ data: [{ id: MODEL }] }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    const body = JSON.parse(init.body as string) as { messages: { role: string; content: string }[]; tools?: unknown[] };
    const system = body.messages.find((m) => m.role === 'system')?.content ?? '';
    const replies = body.messages.filter((m) => m.role === 'tool').map((m) => m.content);
    if (system.startsWith('NARRATOR')) sent.narration.push(init.body as string);
    if (body.tools?.length && replies.length < calls.length) {
      sent.toolCalls++;
      const name = calls[replies.length];
      return sseResponse([
        sseFrame({ tool_calls: [{ index: 0, id: `call-${replies.length}`, type: 'function', function: { name, arguments: '{}' } }] }),
        sseFrame({}, 'tool_calls'),
        'data: [DONE]\n\n',
      ]);
    }
    if (replies.length) sent.toolReplies = replies;
    if (system.startsWith('NARRATOR')) return sseResponse(sseReply('The night passes.'));
    if (system.includes('stat tracker')) return sseResponse(sseReply('No changes'));
    if (system.startsWith('CHOOSER')) {
      sent.choices.push(system);
      return sseResponse(sseReply('1. Wait\n2. Go'));
    }
    return sseResponse(sseReply('Plan: rest.'));
  }));
  return sent;
}

/** The narration system prompt one request sent. */
const narrationSystem = (body: string) =>
  (JSON.parse(body) as { messages: { role: string; content: string }[] }).messages.find((m) => m.role === 'system')!.content;

beforeEach(() => {
  gameTime = 0;
  stats = [];
  localStorage.clear();
  localStorage.setItem('FORMAMORPH_endpointUrl', ENDPOINT);
  localStorage.setItem('FORMAMORPH_modelName', MODEL);
  localStorage.setItem('FORMAMORPH_timeContext', 'true');
  localStorage.setItem('FORMAMORPH_toolsEnabled', 'true');
  localStorage.setItem('FORMAMORPH_reasoningSupport', JSON.stringify({
    [`${ENDPOINT}|${MODEL}`]: { ...UNKNOWN_REASONING_CAPABILITY, reasons: false, levels: [], tools: true, sources: { reasons: 'native', levels: 'native', tools: 'native' } },
  }));
  const prompts: PromptPresetStore = {
    activeId: 'mine',
    presets: [{ id: 'mine', name: 'Mine', values: { systemPrompt: NARRATOR, choicesPrompt: CHOOSER } as never, style: 'markdown' }],
  };
  localStorage.setItem('FORMAMORPH_promptPresets', presetStoreCodec.serialize(prompts));
});

afterEach(() => vi.restoreAllMocks());

async function playTurn(action: string) {
  fireEvent.change(await screen.findByPlaceholderText(/Type your action/), { target: { value: action } });
  fireEvent.click(screen.getByRole('button', { name: 'Send' }));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Re-generate Stats' })).toBeEnabled());
}

const SLEEP = onCallTool('clock.advance(480);');

describe('a clock advance mid-turn', () => {
  it('shows a Before the AI advance in the narration prompt, and the commit counts it once', async () => {
    localStorage.setItem('FORMAMORPH_thinkingMode', 'off');
    renderGameViewer(world({ scripts: [before('clock.advance(240);')] }), { inGameplay: <Probe /> });
    const sent = stubEndpoint();

    await playTurn('I wait.');
    // 08:00 plus four hours.
    expect(narrationSystem(sent.narration[0])).toContain('It is Day 1, midday.');
    await waitFor(() => expect(gameTime).toBe(4));
    expect(valueOf('end')).toBe(4);
  });

  it('shows a Planning On Call advance in the narration built after it', async () => {
    localStorage.setItem('FORMAMORPH_thinkingMode', 'precall');
    renderGameViewer(world({ tools: [SLEEP] }), { inGameplay: <Probe /> });
    const sent = stubEndpoint({ calls: ['sleep'] });

    await playTurn('I sleep.');
    // 08:00 plus eight hours.
    expect(narrationSystem(sent.narration[0])).toContain('It is Day 1, afternoon.');
    await waitFor(() => expect(gameTime).toBe(8));
    expect(valueOf('end')).toBe(8);
  });

  it('charges the clock, regen and starvation once for a Before and an On Call advance together', async () => {
    localStorage.setItem('FORMAMORPH_thinkingMode', 'precall');
    renderGameViewer(world({ scripts: [before('clock.advance(60);')], tools: [SLEEP] }), { inGameplay: <Probe /> });
    const sent = stubEndpoint({ calls: ['sleep'] });

    await playTurn('I sleep.');
    // 08:00 plus nine hours: 17:00.
    expect(narrationSystem(sent.narration[0])).toContain('It is Day 1, afternoon.');
    await waitFor(() => expect(gameTime).toBe(9));
    expect(valueOf('end')).toBe(9);
    expect(valueOf('rest')).toBe(9);
    expect(valueOf('health')).toBe(500 - 5 * 9);
  });

  it('shows an advance to a later Tool call in the same request', async () => {
    localStorage.setItem('FORMAMORPH_thinkingMode', 'precall');
    // A template Tool answers from the turn's Tool Snapshot.
    const clockTool: Tool = { ...onCallTool(''), id: 'clock', name: 'clock', handler: { kind: 'template', body: 'Now: <TIME>' } };
    renderGameViewer(world({ tools: [SLEEP, clockTool] }), { inGameplay: <Probe /> });
    const sent = stubEndpoint({ calls: ['clock', 'sleep', 'clock'] });

    await playTurn('I sleep.');
    expect(sent.toolReplies[0]).toContain('Now: Day 1, morning');
    expect(sent.toolReplies[2]).toContain('Now: Day 1, afternoon');
  });

  it('shows an advance the narration made in the prompts after it', async () => {
    localStorage.setItem('FORMAMORPH_thinkingMode', 'inline');
    renderGameViewer(world({ tools: [{ ...SLEEP, offeredTo: ['narration'] }] }), { inGameplay: <Probe /> });
    const sent = stubEndpoint({ calls: ['sleep'] });

    await playTurn('I sleep.');
    // The narration was already being written at turn start; the choices come after the advance.
    expect(narrationSystem(sent.narration[0])).toContain('It is Day 1, morning.');
    expect(sent.choices[0]).toContain('It is Day 1, afternoon.');
  });

  it('starts a later On Call run at the time an earlier advance reached', async () => {
    localStorage.setItem('FORMAMORPH_thinkingMode', 'precall');
    // The run reads the clock as it started, before its own advance.
    const sleep = onCallTool('stats.Mark.value = clock.elapsedHours; clock.advance(480);');
    renderGameViewer(world({ scripts: [before('clock.advance(60);')], tools: [sleep] }), { inGameplay: <Probe /> });
    stubEndpoint({ calls: ['sleep'] });

    await playTurn('I sleep.');
    expect(valueOf('mark')).toBe(1);
  });

  it('puts the clock back to turn start on a regenerate, so the turn charges it once', async () => {
    localStorage.setItem('FORMAMORPH_thinkingMode', 'off');
    renderGameViewer(world({ scripts: [before('clock.advance(240);')] }), { inGameplay: <Probe /> });
    const sent = stubEndpoint();
    await playTurn('I wait.');
    await playTurn('I wait more.');
    await waitFor(() => expect(gameTime).toBe(8));

    fireEvent.click(screen.getByRole('button', { name: 'Re-generate Narration' }));
    await waitFor(() => expect(sent.narration).toHaveLength(3));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Re-generate Stats' })).toBeEnabled());
    // The regenerated turn reads its own start, four hours in, and ends where the first try did.
    expect(narrationSystem(sent.narration[2])).toBe(narrationSystem(sent.narration[1]));
    expect(gameTime).toBe(8);
    expect(valueOf('end')).toBe(8);
  });

  it('writes the narration at the place a Planning On Call move put the turn', async () => {
    localStorage.setItem('FORMAMORPH_thinkingMode', 'precall');
    renderGameViewer(world({ tools: [onCallTool("location.move('Lighthouse');")] }), { inGameplay: <Probe /> });
    const sent = stubEndpoint({ calls: ['sleep'] });

    await playTurn('I climb.');
    expect(narrationSystem(sent.narration[0])).toContain('You are at Lighthouse.');
  });

  it('sends the narration request byte-equal when the Planning call wrote nothing', async () => {
    localStorage.setItem('FORMAMORPH_thinkingMode', 'precall');
    const idle = onCallTool("return 'You rest a moment.';");
    const first = renderGameViewer(world({ tools: [idle] }), { inGameplay: <Probe /> });
    const called = stubEndpoint({ calls: ['sleep'] });
    await playTurn('I rest.');
    first.unmount();

    localStorage.removeItem('FORMAMORPH_gameStates');
    renderGameViewer(world({ tools: [idle] }), { inGameplay: <Probe /> });
    const plain = stubEndpoint();
    await playTurn('I rest.');

    expect(called.toolCalls).toBe(1);
    expect(called.narration[0]).toBe(plain.narration[0]);
  });
});
