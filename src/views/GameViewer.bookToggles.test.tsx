import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { harborWorld, renderGameViewer } from '@/test/gameViewer';
import { stubChatLayout } from '@/test/gamePanels';
import { sseFrame, sseReply, sseResponse } from '@/test/aiTextFixtures';
import { useGameplay } from '@/contexts/GameplayContext';
import { presetStoreCodec, type PromptPresetStore } from '@/lib/promptPresets';
import { UNKNOWN_REASONING_CAPABILITY } from '@/lib/reasoningEffort';
import DictionaryStorageService from '@/services/DictionaryStorageService';
import { buildInitialSelection, finalizeSelection } from '@/lib/dictionarySelection';
import type { ChatMessage, Dictionary, LoreToggles, Script, World } from '@/types';

/** A script's book writes shape the prompts and the Tool lookup, and rewind with the turn (Q36–Q40). */

vi.hoisted(() => { vi.stubEnv('VITE_DEFAULT_ENDPOINT', ''); });
vi.mock('@/views/VRMViewer', () => import('@/test/stubs/vrmViewer'));
vi.mock('react-toastify', () => ({
  toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn(), info: vi.fn(), warn: vi.fn(), dismiss: vi.fn(), isActive: vi.fn() }),
  ToastContainer: () => null,
}));

const ENDPOINT = 'http://127.0.0.1:5190/v1/chat/completions';
const MODEL = 'm';
const NARRATOR = 'NARRATOR. <DICTIONARY>';

const LORE: Dictionary = { id: 'lore', name: 'Lore', entries: [{ id: 'gate', name: 'Gate', key: ['vault'], value: 'GATE-LORE' }] };
const CHAPTER: Dictionary = {
  id: 'chapter', name: 'Chapter', enabled: false, entries: [{ id: 'sealed', name: 'Sealed', key: ['vault'], value: 'CHAPTER-LORE' }],
};
// A library book as Enter World hands it over: a fresh id no authored book has.
const ALMANAC: Dictionary = {
  id: 'almanac-copy', name: 'Almanac', enabled: true, entries: [
    { id: 'comet', name: 'Comet', key: ['vault'], value: 'COMET-LORE', enabled: false },
    { id: 'star', name: 'Star', key: ['star'], value: 'STAR-LORE' },
  ],
};

const script = (timing: Script['timing'], code: string): Script => ({ id: `s-${timing}`, timing, name: timing, code });
const world = (scripts: Script[]): World => ({ ...harborWorld(), dictionaries: [LORE, CHAPTER], scripts });
// What Enter World hands over when the player keeps each book's shipped setting: the shipped-off book left out.
const ENTERED = finalizeSelection(buildInitialSelection([LORE, CHAPTER], []), new Map());

let lore: LoreToggles = {};
let runtime: Dictionary[] = [];
let history: ChatMessage[] = [];
let waiting = false;
function Probe() {
  const play = useGameplay();
  lore = play.loreToggles;
  runtime = play.runtimeDictionaries;
  history = play.fullMessageHistory;
  waiting = play.isWaitingForAI;
  return null;
}
const closedTurns = () => history.filter((m) => m.role === 'assistant').length;

/** The narration system prompt of each request, in send order, and each Tool reply the narrator got. Each turn's
 *  first narration request calls the dictionary lookup with the keyword `lookups` gives that turn, if any. */
function stubEndpoint(lookups: string[] = []) {
  const narration: string[] = [];
  const toolReplies: string[] = [];
  vi.stubGlobal('fetch', vi.fn(async (_url: string, init?: RequestInit) => {
    if (!init?.body) return new Response(JSON.stringify({ data: [{ id: MODEL }] }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    const body = JSON.parse(init.body as string) as { messages: { role: string; content: string }[]; tools?: unknown[] };
    const system = body.messages.find((m) => m.role === 'system')?.content ?? '';
    if (system.startsWith('NARRATOR')) {
      const reply = body.messages.findLast((m) => m.role === 'tool');
      const keyword = lookups[closedTurns()];
      if (body.tools?.length && keyword && !reply) {
        return sseResponse([
          sseFrame({ tool_calls: [{ index: 0, id: 'call-1', type: 'function', function: { name: 'get_dictionary_entry', arguments: JSON.stringify({ keyword }) } }] }),
          sseFrame({}, 'tool_calls'),
          'data: [DONE]\n\n',
        ]);
      }
      if (reply) toolReplies.push(reply.content);
      narration.push(system);
      return sseResponse(sseReply('The tide turns.'));
    }
    if (system.includes('stat tracker')) return sseResponse(sseReply('No changes'));
    return sseResponse(sseReply('1. Wait\n2. Go'));
  }));
  return { narration, toolReplies };
}

async function playTurn(action: string, turns: number) {
  fireEvent.change(await screen.findByPlaceholderText(/Type your action/), { target: { value: action } });
  fireEvent.click(screen.getByRole('button', { name: 'Send' }));
  await waitFor(() => expect(closedTurns()).toBe(turns));
  await waitFor(() => expect(waiting).toBe(false));
}

const usePreset = (values: Record<string, unknown>, enabledTools?: Record<string, boolean>) => {
  const prompts: PromptPresetStore = {
    activeId: 'mine',
    presets: [{ id: 'mine', name: 'Mine', values: values as never, style: 'markdown', ...(enabledTools ? { enabledTools } : {}) }],
  };
  localStorage.setItem('FORMAMORPH_promptPresets', presetStoreCodec.serialize(prompts));
};

beforeEach(() => {
  lore = {};
  localStorage.clear();
  localStorage.setItem('FORMAMORPH_endpointUrl', ENDPOINT);
  localStorage.setItem('FORMAMORPH_modelName', MODEL);
  localStorage.setItem('FORMAMORPH_thinkingMode', 'off');
  usePreset({ systemPrompt: NARRATOR });
});

afterEach(() => vi.restoreAllMocks());

describe('book writes in play', () => {
  it('puts a shipped-off book a Before the AI script switches on in this turn’s narration', async () => {
    renderGameViewer(world([script('before', 'if (turn.number === 2) dictionaries.Chapter.enabled = !dictionaries.Chapter.enabled;')]), { inGameplay: <Probe />, initialDictionaries: ENTERED });
    const { narration } = stubEndpoint();
    await playTurn('I open the vault.', 1);
    await playTurn('I open the vault again.', 2);
    expect(narration[0]).not.toContain('CHAPTER-LORE');
    expect(narration[1]).toContain('CHAPTER-LORE');
    expect(lore).toEqual({ chapter: { enabled: true } });
  });

  it('takes an on book’s entries out of the next request once a script switches it off', async () => {
    renderGameViewer(world([script('after', 'if (turn.number === 2) dictionaries.Lore.enabled = false;')]), { inGameplay: <Probe />, initialDictionaries: ENTERED });
    const { narration } = stubEndpoint();
    await playTurn('I open the vault.', 1);
    await playTurn('I open the vault again.', 2);
    await playTurn('I open the vault once more.', 3);
    expect(narration[1]).toContain('GATE-LORE');
    expect(narration[2]).not.toContain('GATE-LORE');
  });

  it('lands an entry write on a library book the player added, and leaves the library record and the save’s copy as they were', async () => {
    const stored = vi.spyOn(DictionaryStorageService, 'storeDictionary');
    const added = structuredClone(ALMANAC);
    renderGameViewer(world([script('before', 'dictionaries.Almanac.entries.Comet.enabled = true;')]), {
      inGameplay: <Probe />, initialDictionaries: [LORE, added],
    });
    const { narration } = stubEndpoint();
    await playTurn('I open the vault.', 1);
    await playTurn('I open the vault again.', 2);
    expect(narration[1]).toContain('COMET-LORE');
    expect(lore).toEqual({ 'almanac-copy': { entries: { comet: { enabled: true } } } });
    expect(runtime.find((book) => book.id === 'almanac-copy')).toEqual(ALMANAC);
    expect(stored).not.toHaveBeenCalled();
  });

  describe('with the dictionary lookup on', () => {
    beforeEach(() => {
      localStorage.setItem('FORMAMORPH_toolsEnabled', 'true');
      localStorage.setItem('FORMAMORPH_reasoningSupport', JSON.stringify({
        [`${ENDPOINT}|${MODEL}`]: { ...UNKNOWN_REASONING_CAPABILITY, reasons: false, levels: [], tools: true, sources: { reasons: 'native', levels: 'native', tools: 'native' } },
      }));
      usePreset({ systemPrompt: NARRATOR }, { get_dictionary_entry: true });
    });

    it('finds an entry of a library book the player added', async () => {
      renderGameViewer(world([]), { inGameplay: <Probe />, initialDictionaries: [LORE, structuredClone(ALMANAC)] });
      const { toolReplies } = stubEndpoint(['star']);
      await playTurn('I look up.', 1);
      expect(toolReplies[0]).toContain('STAR-LORE');
    });

    it('skips a book a script switched off', async () => {
      renderGameViewer(world([script('before', 'if (turn.number === 2) dictionaries.Lore.enabled = false;')]), { inGameplay: <Probe />, initialDictionaries: ENTERED });
      const { toolReplies } = stubEndpoint(['vault', 'vault']);
      await playTurn('I wait.', 1);
      await playTurn('I wait again.', 2);
      expect(toolReplies[0]).toContain('GATE-LORE');
      expect(toolReplies[1]).not.toContain('GATE-LORE');
    });
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

    it('restores the book’s earlier state after a rewind past the writing turn', async () => {
      localStorage.setItem('FORMAMORPH_narrationLayout', 'chat');
      renderGameViewer(world([script('after', 'if (turn.number === 2) dictionaries.Chapter.enabled = true;')]), { inGameplay: <Probe />, initialDictionaries: ENTERED });
      const { narration } = stubEndpoint();
      await playTurn('I wait.', 1);
      await playTurn('I wait again.', 2);
      await waitFor(() => expect(lore).toEqual({ chapter: { enabled: true } }));

      const turns = await screen.findAllByRole('article');
      fireEvent.click(within(within(turns[0]).getByTestId('bubble-actions')).getByRole('button', { name: 'Rewind to Here' }));
      fireEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Confirm' }));
      await waitFor(() => expect(closedTurns()).toBe(1));
      expect(lore).toEqual({});
      await playTurn('I open the vault.', 2);
      expect(narration[2]).not.toContain('CHAPTER-LORE');
    });
  });
});
