import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { harborWorld, renderGameViewer } from '@/test/gameViewer';
import { stubChatLayout } from '@/test/gamePanels';
import { sseReply, sseResponse } from '@/test/aiTextFixtures';
import { useGameplay } from '@/contexts/GameplayContext';
import { presetStoreCodec, type PromptPresetStore } from '@/lib/promptPresets';
import { embedTexts } from '@/lib/embeddingWorkerClient';
import type { ChatMessage, Dictionary, LoreToggles, PlayerStat, Script, World } from '@/types';

/** A script's lore writes shape the prompts its timing reaches, and the overlay rewinds with the turn (Q11, Q16, Q28). */

vi.hoisted(() => { vi.stubEnv('VITE_DEFAULT_ENDPOINT', ''); });
vi.mock('@/views/VRMViewer', () => import('@/test/stubs/vrmViewer'));
vi.mock('react-toastify', () => ({
  toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn(), info: vi.fn(), warn: vi.fn(), dismiss: vi.fn(), isActive: vi.fn() }),
  ToastContainer: () => null,
}));
vi.mock('@/lib/embeddingWorkerClient', async (importOriginal) => ({
  ...await importOriginal<typeof import('@/lib/embeddingWorkerClient')>(),
  isEmbeddingModelReady: () => true,
  loadEmbeddingModel: vi.fn(async () => {}),
  embedTexts: vi.fn(),
}));
vi.mock('@/lib/embeddingCache', () => ({ getVectors: vi.fn(async () => new Map()), putVector: vi.fn(async () => {}) }));

const ENDPOINT = 'http://127.0.0.1:5190/v1/chat/completions';
const MODEL = 'm';
const NARRATOR = 'NARRATOR. <DICTIONARY>';

const LORE: Dictionary = {
  id: 'lore', name: 'Lore', entries: [
    { id: 'sealed', name: 'Sealed', key: ['vault'], value: 'SEALED-LORE', enabled: false },
    { id: 'beacon', name: 'Beacon', key: ['zzqq'], value: 'BEACON-LORE' },
  ],
};

const script = (timing: Script['timing'], code: string): Script => ({ id: `s-${timing}`, timing, name: timing, code });
// A stat, so every turn sends a stats request a re-roll repeats.
const vigor: PlayerStat = { id: 'vigor', name: 'Vigor', type: 'number', description: '', min: 0, max: 100, value: 50, regen: 0, descriptors: [] };
const world = (scripts: Script[]): World => ({ ...harborWorld({ stats: [vigor] }), dictionaries: [LORE], scripts });

let lore: LoreToggles = {};
let history: ChatMessage[] = [];
let waiting = false;
function Probe() {
  const play = useGameplay();
  lore = play.loreToggles;
  history = play.fullMessageHistory;
  waiting = play.isWaitingForAI;
  return null;
}
const closedTurns = () => history.filter((m) => m.role === 'assistant').length;

let statCalls = 0;

/** The narration system prompt of each request, in send order. */
function stubEndpoint() {
  const narration: string[] = [];
  vi.stubGlobal('fetch', vi.fn(async (_url: string, init?: RequestInit) => {
    if (!init?.body) return new Response(JSON.stringify({ data: [{ id: MODEL }] }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    const body = JSON.parse(init.body as string) as { messages: { role: string; content: string }[] };
    const system = body.messages.find((m) => m.role === 'system')?.content ?? '';
    if (system.startsWith('NARRATOR')) {
      narration.push(system);
      return sseResponse(sseReply('The tide turns.'));
    }
    if (system.includes('stat tracker')) {
      statCalls++;
      return sseResponse(sseReply('No changes'));
    }
    return sseResponse(sseReply('1. Wait\n2. Go'));
  }));
  return narration;
}

const turnDone = () => waitFor(() => expect(screen.getByRole('button', { name: 'Re-generate Stats' })).toBeEnabled());

async function playTurn(action: string) {
  fireEvent.change(await screen.findByPlaceholderText(/Type your action/), { target: { value: action } });
  fireEvent.click(screen.getByRole('button', { name: 'Send' }));
  await turnDone();
}

beforeEach(() => {
  lore = {};
  statCalls = 0;
  localStorage.clear();
  localStorage.setItem('FORMAMORPH_endpointUrl', ENDPOINT);
  localStorage.setItem('FORMAMORPH_modelName', MODEL);
  localStorage.setItem('FORMAMORPH_thinkingMode', 'off');
  const prompts: PromptPresetStore = {
    activeId: 'mine',
    presets: [{ id: 'mine', name: 'Mine', values: { systemPrompt: NARRATOR } as never, style: 'markdown' }],
  };
  localStorage.setItem('FORMAMORPH_promptPresets', presetStoreCodec.serialize(prompts));
  vi.mocked(embedTexts).mockImplementation(async (texts: string[]) => texts.map(() => new Float32Array([1, 0])));
});

afterEach(() => vi.restoreAllMocks());

describe('lore writes in play', () => {
  it('puts an entry a Before the AI script switches on in this turn’s narration when its keyword matches', async () => {
    renderGameViewer(world([script('before', 'if (turn.number === 2) dictionaries.Lore.entries.Sealed.enabled = true;')]), { inGameplay: <Probe /> });
    const narration = stubEndpoint();
    await playTurn('I open the vault.');
    await playTurn('I open the vault again.');
    expect(narration[0]).not.toContain('SEALED-LORE');
    expect(narration[1]).toContain('SEALED-LORE');
    expect(lore).toEqual({ lore: { entries: { sealed: { enabled: true } } } });
  });

  it('keeps an After the AI write out of this turn’s narration and puts it in the next one’s', async () => {
    renderGameViewer(world([script('after', 'dictionaries.Lore.entries.Sealed.enabled = true;')]), { inGameplay: <Probe /> });
    const narration = stubEndpoint();
    await playTurn('I open the vault.');
    await playTurn('I open the vault again.');
    expect(narration[0]).not.toContain('SEALED-LORE');
    expect(narration[1]).toContain('SEALED-LORE');
  });

  it('injects an entry made constant with no keyword match', async () => {
    renderGameViewer(world([script('before', 'dictionaries.Lore.entries.Beacon.constant = true;')]), { inGameplay: <Probe /> });
    const narration = stubEndpoint();
    await playTurn('I wait.');
    expect(narration[0]).toContain('BEACON-LORE');
  });

  it('starts a stats re-roll from the pre-turn lore state', async () => {
    const flip = 'const e = dictionaries.Lore.entries.Beacon; e.constant = !e.constant;';
    renderGameViewer(world([script('after', flip)]), { inGameplay: <Probe /> });
    stubEndpoint();
    await playTurn('I wait.');
    await waitFor(() => expect(lore).toEqual({ lore: { entries: { beacon: { constant: true } } } }));
    const asked = statCalls;
    fireEvent.click(screen.getByRole('button', { name: 'Re-generate Stats' }));
    await waitFor(() => expect(statCalls).toBe(asked + 1));
    await turnDone();
    // A re-roll over the post-turn state would flip it back off.
    expect(lore).toEqual({ lore: { entries: { beacon: { constant: true } } } });
  });

  it('queues an entry a script switches on for embedding, and the turn does not wait for it (Q28)', async () => {
    localStorage.setItem('FORMAMORPH_semanticLore', 'true');
    const sealedText = 'Sealed — vault — SEALED-LORE';
    // The entry's own batch never answers; every other text embeds at once.
    vi.mocked(embedTexts).mockImplementation((texts: string[]) => (texts.includes(sealedText)
      ? new Promise<Float32Array[]>(() => {})
      : Promise.resolve(texts.map(() => new Float32Array([1, 0])))));
    renderGameViewer(world([script('before', 'if (turn.number === 2) dictionaries.Lore.entries.Sealed.enabled = true;')]), { inGameplay: <Probe /> });
    const narration = stubEndpoint();
    await playTurn('I wait.');
    expect(vi.mocked(embedTexts)).not.toHaveBeenCalledWith([sealedText], expect.any(Number));
    await playTurn('I open the vault.');
    expect(narration[1]).toContain('SEALED-LORE');
    await waitFor(() => expect(vi.mocked(embedTexts)).toHaveBeenCalledWith([sealedText], expect.any(Number)));
  });

  it('queues an entry switched on while another drain runs, once that drain ends (Q28)', async () => {
    localStorage.setItem('FORMAMORPH_semanticLore', 'true');
    const sealedText = 'Sealed — vault — SEALED-LORE';
    const beaconText = 'Beacon — zzqq — BEACON-LORE';
    let releaseBeacon = () => {};
    const beaconHeld = new Promise<void>((resolve) => { releaseBeacon = resolve; });
    vi.mocked(embedTexts).mockImplementation(async (texts: string[]) => {
      if (texts.includes(beaconText)) await beaconHeld;
      return texts.map(() => new Float32Array([1, 0]));
    });
    renderGameViewer(world([script('before', 'if (turn.number === 2) dictionaries.Lore.entries.Sealed.enabled = true;')]), { inGameplay: <Probe /> });
    stubEndpoint();
    await waitFor(() => expect(vi.mocked(embedTexts)).toHaveBeenCalledWith([beaconText], expect.any(Number)));
    await playTurn('I wait.');
    await playTurn('I open the vault.');
    expect(vi.mocked(embedTexts)).not.toHaveBeenCalledWith([sealedText], expect.any(Number));
    releaseBeacon();
    await waitFor(() => expect(vi.mocked(embedTexts)).toHaveBeenCalledWith([sealedText], expect.any(Number)));
  });

  describe('in the chat layout', () => {
    let restore: () => void = () => {};
    const realScrollTo = HTMLElement.prototype.scrollTo;
    beforeAll(() => {
      restore = stubChatLayout();
      // jsdom has no scrolling; the chat layout scrolls to the latest turn.
      HTMLElement.prototype.scrollTo = () => {};
    });
    afterAll(() => {
      restore();
      HTMLElement.prototype.scrollTo = realScrollTo;
    });

    /** A chat-layout turn, whose stat re-roll sits in a menu: done once the turn is stored and play is idle. */
    async function playChatTurn(action: string, turns: number) {
      fireEvent.change(await screen.findByPlaceholderText(/Type your action/), { target: { value: action } });
      fireEvent.click(screen.getByRole('button', { name: 'Send' }));
      await waitFor(() => expect(closedTurns()).toBe(turns));
      await waitFor(() => expect(waiting).toBe(false));
    }

    it('restores the earlier lore state in the next request after a rewind past the writing turn', async () => {
      localStorage.setItem('FORMAMORPH_narrationLayout', 'chat');
      renderGameViewer(world([script('after', 'if (turn.number === 2) dictionaries.Lore.entries.Sealed.enabled = true;')]), { inGameplay: <Probe /> });
      const narration = stubEndpoint();
      await playChatTurn('I wait.', 1);
      await playChatTurn('I wait again.', 2);
      await waitFor(() => expect(lore).toEqual({ lore: { entries: { sealed: { enabled: true } } } }));

      const turns = await screen.findAllByRole('article');
      fireEvent.click(within(within(turns[0]).getByTestId('bubble-actions')).getByRole('button', { name: 'Rewind to Here' }));
      fireEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Confirm' }));
      await waitFor(() => expect(closedTurns()).toBe(1));
      await playChatTurn('I open the vault.', 2);
      expect(narration[2]).not.toContain('SEALED-LORE');
    });
  });
});
