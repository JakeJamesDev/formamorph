import { fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { harborWorld, renderGameViewer } from '@/test/gameViewer';
import { sseResponse, sseReply } from '@/test/aiTextFixtures';
import { useGameplay } from '@/contexts/GameplayContext';
import { getGameplayText } from '@/lib/gameplayTextStore';
import type { ChatMessage, PlayerStat, Script, World } from '@/types';

/** During AI Output on a mounted game: the sentence rewrite reaches every copy, and its writes land once. */

vi.hoisted(() => { vi.stubEnv('VITE_DEFAULT_ENDPOINT', ''); });
vi.mock('@/views/VRMViewer', () => import('@/test/stubs/vrmViewer'));
vi.mock('react-toastify', () => ({
  toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn(), info: vi.fn(), warn: vi.fn(), dismiss: vi.fn(), isActive: vi.fn() }),
  ToastContainer: () => null,
}));

const stat = (over: Partial<PlayerStat> & Pick<PlayerStat, 'id' | 'name' | 'value'>): PlayerStat =>
  ({ type: 'number', description: '', min: 0, max: 100, regen: 0, descriptors: [], ...over });

const LINK = '[door](https://example.test)';
const NARRATION = 'The door creaks. Wind howls. Rain falls.';
const LINKED = `The ${LINK} creaks. Wind howls. Rain falls.`;

// Every sentence gets its word linked and adds one Health. Mirror reads Health in its After script.
const outputScript: Script = {
  id: 'link', timing: 'output', name: 'Link doors',
  code: `narration.sentence = narration.sentence.replace('door', '${LINK}'); stats.Health.value += 1;`,
};
const mirror = stat({
  id: 'mirror', name: 'Mirror', value: 0, scripts: [{ id: 'mirror:after', timing: 'after', code: 'return stats.Health.value * 2;' }],
});
const world = (scripts: Script[]): World => ({ ...harborWorld({ stats: [stat({ id: 'health', name: 'Health', value: 10 }), mirror] }), scripts });

let history: ChatMessage[] = [];
let stats: PlayerStat[] = [];
function Probe() {
  const play = useGameplay();
  history = play.fullMessageHistory;
  stats = play.globalStats;
  return null;
}

/** The narration requests the model got, and an endpoint that answers every pass with one plain reply. */
function stubEndpoint(narration: string) {
  const narrationBodies: string[] = [];
  vi.stubGlobal('fetch', vi.fn(async (_url: string, init?: RequestInit) => {
    if (!init?.body) return new Response(JSON.stringify({ data: [{ id: 'm' }] }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    const body = JSON.parse(init.body as string) as { messages: { role: string; content: string }[] };
    const system = body.messages.find((m) => m.role === 'system')?.content ?? '';
    if (system.includes('stat tracker')) return sseResponse(sseReply('No changes'));
    if (system.includes('player choice writer')) return sseResponse(sseReply('1. Wait\n2. Go'));
    if ((init.body as string).includes('You are the narrator stage')) narrationBodies.push(init.body as string);
    return sseResponse(sseReply(narration));
  }));
  return narrationBodies;
}

beforeEach(() => {
  history = [];
  stats = [];
  localStorage.clear();
  localStorage.setItem('FORMAMORPH_endpointUrl', 'http://127.0.0.1:5190/v1/chat/completions');
  localStorage.setItem('FORMAMORPH_thinkingMode', 'off');
});

afterEach(() => vi.restoreAllMocks());

async function playTurn(action: string) {
  fireEvent.change(await screen.findByPlaceholderText(/Type your action/), { target: { value: action } });
  fireEvent.click(screen.getByRole('button', { name: 'Send' }));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Re-generate Stats' })).toBeEnabled());
}

const valueOf = (id: string) => stats.find((s) => s.id === id)?.value;
const savedNarration = () => (JSON.parse(history.filter((m) => m.role === 'assistant').at(-1)!.content) as { narration: string }).narration;

describe('During AI Output in play', () => {
  it('shows the rewrite in the reveal and the saved turn, and sends it as the next request\'s last story', async () => {
    // Strip Links And Images off, so the link marks the rewrite in the request.
    localStorage.setItem('FORMAMORPH_stripLinksAndImages', 'false');
    renderGameViewer(world([outputScript]), { inGameplay: <Probe /> });
    const narrationBodies = stubEndpoint(NARRATION);

    await playTurn('I wait.');
    expect(getGameplayText()).toBe(LINKED);
    expect(savedNarration()).toBe(LINKED);

    await playTurn('I wait more.');
    expect(narrationBodies).toHaveLength(2);
    expect(narrationBodies[0]).not.toContain(LINK);
    expect(narrationBodies[1]).toContain(LINK);
  });

  it('keeps the rewritten link in the saved turn but strips it from the next request by default', async () => {
    renderGameViewer(world([outputScript]), { inGameplay: <Probe /> });
    const narrationBodies = stubEndpoint(NARRATION);

    await playTurn('I wait.');
    expect(savedNarration()).toBe(LINKED);

    await playTurn('I wait more.');
    expect(narrationBodies[1]).toContain(NARRATION);
    expect(narrationBodies[1]).not.toContain('](');
  });

  it('lands the sum of a script\'s per-sentence writes once, before the After scripts read it', async () => {
    renderGameViewer(world([outputScript]), { inGameplay: <Probe /> });
    stubEndpoint(NARRATION);

    await playTurn('I wait.');
    // Three sentences, one Health each: 10 + 3, and the After script saw all three.
    expect(valueOf('health')).toBe(13);
    expect(valueOf('mirror')).toBe(26);
  });

  it('leaves the narration as the model wrote it in a world with no output script', async () => {
    renderGameViewer(world([]), { inGameplay: <Probe /> });
    stubEndpoint(NARRATION);

    await playTurn('I wait.');
    expect(getGameplayText()).toBe(NARRATION);
    expect(savedNarration()).toBe(NARRATION);
    expect(valueOf('health')).toBe(10);
    expect(valueOf('mirror')).toBe(20);
  });

  it('passes a sentence unchanged when its script throws, and the turn goes on', async () => {
    const failure = vi.spyOn(console, 'error').mockImplementation(() => {});
    const broken: Script = { id: 'broken', timing: 'output', name: 'Broken filter', code: "throw new Error('boom');" };
    renderGameViewer(world([broken]), { inGameplay: <Probe /> });
    stubEndpoint(NARRATION);

    await playTurn('I wait.');
    expect(savedNarration()).toBe(NARRATION);
    expect(failure).toHaveBeenCalledWith(expect.stringMatching(/Broken filter.*During AI Output/), expect.stringContaining('boom'));
  });
});
