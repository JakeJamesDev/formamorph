import { fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { harborWorld, renderGameViewer } from '@/test/gameViewer';
import { sseFrame, sseReply, sseResponse } from '@/test/aiTextFixtures';
import { scriptWorldTool } from '@/test/worldToolFixtures';
import { presetStoreCodec, type PromptPresetStore } from '@/lib/promptPresets';
import { UNKNOWN_REASONING_CAPABILITY } from '@/lib/reasoningEffort';
import type { GameLocation, PlayerStat, Tool, World } from '@/types';

// An On Call write in staged planning reaches the staged passes built after it (Q38, Q55).

vi.hoisted(() => { vi.stubEnv('VITE_DEFAULT_ENDPOINT', ''); });
vi.mock('@/views/VRMViewer', () => import('@/test/stubs/vrmViewer'));
vi.mock('react-toastify', () => ({
  toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn(), info: vi.fn(), warn: vi.fn(), dismiss: vi.fn(), isActive: vi.fn() }),
  ToastContainer: () => null,
}));

const ENDPOINT = 'http://127.0.0.1:5190/v1/chat/completions';
const MODEL = 'm';
// Each staged prompt names the place, the time and the stat values, so a request shows what it was built from.
const SCENE = 'at <LOCATION|name>. It is <TIME>. <STATS DESCRIPTION|numbers>';
const PROMPTS = {
  systemPrompt: `NARRATOR ${SCENE}`,
  directorPrompt: `DIRECTOR ${SCENE}`,
  characterPrompt: `CHARACTER ${SCENE}`,
  storyboardPrompt: `STORYBOARD ${SCENE}`,
};
const STAGES = ['DIRECTOR', 'CHARACTER', 'STORYBOARD', 'NARRATOR'] as const;
type Stage = typeof STAGES[number];

const mark: PlayerStat = { id: 'mark', name: 'Mark', value: 3, type: 'number', description: '', min: 0, max: 100, regen: 0, descriptors: [] };
const LIGHTHOUSE: GameLocation = { id: 'lighthouse', name: 'Lighthouse' };

const world = (tools: Tool[]): World => {
  const base = harborWorld({ stats: [mark] });
  return { ...base, locations: [...base.locations, LIGHTHOUSE], tools };
};
const directorTool = (code: string): Tool => ({ ...scriptWorldTool('act', 'act', code, 'call'), offeredTo: ['director'] });

/** Each request's body by its stage. The director calls the Tools `calls` in order, one per round. */
function stubEndpoint({ calls = [] as string[] } = {}) {
  const sent: Record<Stage, string[]> & { toolCalls: number } = { DIRECTOR: [], CHARACTER: [], STORYBOARD: [], NARRATOR: [], toolCalls: 0 };
  vi.stubGlobal('fetch', vi.fn(async (_url: string, init?: RequestInit) => {
    if (!init?.body) return new Response(JSON.stringify({ data: [{ id: MODEL }] }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    const body = JSON.parse(init.body as string) as { messages: { role: string; content: string }[]; tools?: unknown[] };
    const system = body.messages.find((m) => m.role === 'system')?.content ?? '';
    const stage = STAGES.find((s) => system.startsWith(s));
    if (stage) sent[stage].push(init.body as string);
    const replies = body.messages.filter((m) => m.role === 'tool').length;
    if (body.tools?.length && replies < calls.length) {
      sent.toolCalls++;
      return sseResponse([
        sseFrame({ tool_calls: [{ index: 0, id: `call-${replies}`, type: 'function', function: { name: calls[replies], arguments: '{}' } }] }),
        sseFrame({}, 'tool_calls'),
        'data: [DONE]\n\n',
      ]);
    }
    if (stage === 'DIRECTOR') return sseResponse(sseReply('The pier is quiet.\nCast:\n- Gull - watching the water'));
    if (stage === 'CHARACTER') return sseResponse(sseReply('Gull keeps watch.'));
    if (stage === 'STORYBOARD') return sseResponse(sseReply('Gull watches. The player waits.'));
    if (stage === 'NARRATOR') return sseResponse(sseReply('The tide turns.'));
    if (system.includes('stat tracker')) return sseResponse(sseReply('No changes'));
    return sseResponse(sseReply('1. Wait\n2. Go'));
  }));
  return sent;
}

const systemOf = (body: string) =>
  (JSON.parse(body) as { messages: { role: string; content: string }[] }).messages.find((m) => m.role === 'system')!.content;

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem('FORMAMORPH_endpointUrl', ENDPOINT);
  localStorage.setItem('FORMAMORPH_modelName', MODEL);
  localStorage.setItem('FORMAMORPH_toolsEnabled', 'true');
  localStorage.setItem('FORMAMORPH_timeContext', 'true');
  localStorage.setItem('FORMAMORPH_thinkingMode', 'staged');
  localStorage.setItem('FORMAMORPH_reasoningSupport', JSON.stringify({
    [`${ENDPOINT}|${MODEL}`]: { ...UNKNOWN_REASONING_CAPABILITY, reasons: false, levels: [], tools: true, sources: { reasons: 'native', levels: 'native', tools: 'native' } },
  }));
  const prompts: PromptPresetStore = {
    activeId: 'mine',
    presets: [{ id: 'mine', name: 'Mine', values: PROMPTS as never, style: 'markdown' }],
  };
  localStorage.setItem('FORMAMORPH_promptPresets', presetStoreCodec.serialize(prompts));
});

afterEach(() => vi.restoreAllMocks());

async function playTurn(action: string) {
  fireEvent.change(await screen.findByPlaceholderText(/Type your action/), { target: { value: action } });
  fireEvent.click(screen.getByRole('button', { name: 'Send' }));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Re-generate Stats' })).toBeEnabled());
}

describe('an On Call write in staged planning', () => {
  it('puts the character and storyboard passes at the place the move set', async () => {
    renderGameViewer(world([directorTool("location.move('Lighthouse');")]));
    const sent = stubEndpoint({ calls: ['act'] });

    await playTurn('I climb.');
    expect(sent.toolCalls).toBe(1);
    expect(systemOf(sent.DIRECTOR[0])).toContain('at Harbor.');
    expect(systemOf(sent.CHARACTER[0])).toContain('at Lighthouse.');
    expect(systemOf(sent.STORYBOARD[0])).toContain('at Lighthouse.');
    expect(systemOf(sent.NARRATOR[0])).toContain('at Lighthouse.');
  });

  it('shows a stat write in the stat values of the passes after it', async () => {
    renderGameViewer(world([directorTool('stats.Mark.value = 42;')]));
    const sent = stubEndpoint({ calls: ['act'] });

    await playTurn('I mark it.');
    expect(systemOf(sent.DIRECTOR[0])).toMatch(/Mark\D*3\b/);
    expect(systemOf(sent.CHARACTER[0])).toMatch(/Mark\D*42\b/);
    expect(systemOf(sent.STORYBOARD[0])).toMatch(/Mark\D*42\b/);
  });

  it('shows a clock advance in the time of the passes after it', async () => {
    renderGameViewer(world([directorTool('clock.advance(480);')]));
    const sent = stubEndpoint({ calls: ['act'] });

    await playTurn('I sleep.');
    // 08:00 plus eight hours.
    expect(systemOf(sent.DIRECTOR[0])).toContain('It is Day 1, morning.');
    expect(systemOf(sent.CHARACTER[0])).toContain('It is Day 1, afternoon.');
    expect(systemOf(sent.STORYBOARD[0])).toContain('It is Day 1, afternoon.');
  });

  it('shows a character pass write in the storyboard built after it', async () => {
    renderGameViewer(world([{ ...directorTool('stats.Mark.value = 42;'), offeredTo: ['character'] }]));
    const sent = stubEndpoint({ calls: ['act'] });

    await playTurn('I mark it.');
    expect(systemOf(sent.CHARACTER[0])).toMatch(/Mark\D*3\b/);
    expect(systemOf(sent.STORYBOARD[0])).toMatch(/Mark\D*42\b/);
  });

  it('sends every staged request byte-equal when the call wrote nothing', async () => {
    const idle = directorTool("return 'Nothing moves.';");
    const first = renderGameViewer(world([idle]));
    const called = stubEndpoint({ calls: ['act'] });
    await playTurn('I wait.');
    first.unmount();

    localStorage.removeItem('FORMAMORPH_gameStates');
    renderGameViewer(world([idle]));
    const plain = stubEndpoint();
    await playTurn('I wait.');

    expect(called.toolCalls).toBe(1);
    expect(called.CHARACTER[0]).toBe(plain.CHARACTER[0]);
    expect(called.STORYBOARD[0]).toBe(plain.STORYBOARD[0]);
    expect(called.NARRATOR[0]).toBe(plain.NARRATOR[0]);
  });
});
