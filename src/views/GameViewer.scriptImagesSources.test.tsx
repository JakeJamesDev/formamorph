import { fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { harborWorld, renderGameViewer } from '@/test/gameViewer';
import { sseFrame, sseReply, sseResponse } from '@/test/aiTextFixtures';
import { scriptWorldTool } from '@/test/worldToolFixtures';
import { useGameplay } from '@/contexts/GameplayContext';
import { deleteSaveRecord, getAllSaveRecords } from '@/components/modals/dbUtils';
import { UNKNOWN_REASONING_CAPABILITY } from '@/lib/reasoningEffort';
import type { Entity, Item, PlayerStat, Script, Tool, World } from '@/types';

/** Where an item script's and an On Call Tool's `player.show` image lands, on a mounted game (Q8). */

vi.hoisted(() => { vi.stubEnv('VITE_DEFAULT_ENDPOINT', ''); });
vi.mock('@/views/VRMViewer', () => import('@/test/stubs/vrmViewer'));
vi.mock('react-toastify', () => ({
  toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn(), info: vi.fn(), warn: vi.fn(), dismiss: vi.fn(), isActive: vi.fn() }),
  ToastContainer: () => null,
}));

const ENDPOINT = 'http://127.0.0.1:5190/v1/chat/completions';
const MODEL = 'm';

const gem: Item = {
  id: 'gem', name: 'Gem', stackable: false, statEffects: [], traitEffects: [], equipRequires: [],
  scripts: [{ id: 'gained', timing: 'gained', code: 'player.show("Gem Art"); player.tell("The gem glints.");' } as Script],
};
const vigor: PlayerStat = { id: 'vigor', name: 'Vigor', type: 'number', description: '', min: 0, max: 100, regen: 0, descriptors: [], value: 50 };
const ash: Entity = { id: 'ash', name: 'Ash', persona: true, personaOnly: true };
const baseWorld = (): World => harborWorld({ stats: [vigor], entities: [ash] });
const fetchTool = (code: string): Tool => ({ ...scriptWorldTool('fetch', 'fetch', code, 'call'), offeredTo: ['narration'] });
const withImages = (world: World): World => ({
  ...world,
  worldOverview: {
    ...world.worldOverview,
    mediaList: {
      'm-harbor': { id: 'm-harbor', name: 'Harbor', kind: 'image', data: 'data:image/png;base64,AAAA' },
      'm-gem': { id: 'm-gem', name: 'Gem Art', kind: 'image', data: 'data:image/png;base64,BBBB' },
    },
  },
});

let live: ReturnType<typeof useGameplay> | null = null;
const Probe = () => { live = useGameplay(); return null; };
const gameplay = () => {
  if (!live) throw new Error('no gameplay yet');
  return live;
};

/** The AI calls the Tool once in its narration request. */
function stubEndpoint(operations: object[] = []) {
  vi.stubGlobal('fetch', vi.fn(async (_url: string, init?: RequestInit) => {
    if (!init?.body) return new Response(JSON.stringify({ data: [{ id: MODEL }] }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    const { messages, tools } = JSON.parse(init.body as string) as { messages: { role: string; content: string }[]; tools?: unknown[] };
    const system = messages.find((m) => m.role === 'system')?.content ?? '';
    if (tools?.length && !messages.some((m) => m.role === 'tool')) {
      return sseResponse([
        sseFrame({ tool_calls: [{ index: 0, id: 'call-0', type: 'function', function: { name: 'fetch', arguments: '{}' } }] }),
        sseFrame({}, 'tool_calls'),
        'data: [DONE]\n\n',
      ]);
    }
    if (system.includes('location router')) return sseResponse(sseReply('NONE'));
    if (system.includes('You track where the characters in an interactive story go')) return sseResponse(sseReply('{}'));
    if (system.includes('inventory keeper')) return sseResponse(sseReply(JSON.stringify({ operations })));
    if (system.includes('stat tracker')) return sseResponse(sseReply('No changes'));
    if (system.includes('player choice writer')) return sseResponse(sseReply('1. Walk on\n2. Wait'));
    return sseResponse(sseReply('The ferry bell rings twice.'));
  }));
}

beforeEach(async () => {
  live = null;
  for (const { id } of await getAllSaveRecords()) await deleteSaveRecord(id);
  localStorage.clear();
  localStorage.setItem('FORMAMORPH_endpointUrl', ENDPOINT);
  localStorage.setItem('FORMAMORPH_modelName', MODEL);
  localStorage.setItem('FORMAMORPH_thinkingMode', 'off');
  localStorage.setItem('FORMAMORPH_toolsEnabled', 'true');
  localStorage.setItem('FORMAMORPH_reasoningSupport', JSON.stringify({
    [`${ENDPOINT}|${MODEL}`]: { ...UNKNOWN_REASONING_CAPABILITY, reasons: false, levels: [], tools: true, sources: { reasons: 'native', levels: 'native', tools: 'native' } },
  }));
});
afterEach(() => vi.restoreAllMocks());

const order = () => [...document.querySelectorAll('[data-testid="narration"], [data-testid="script-tell"], [data-testid="script-image"] img')]
  .map((node) => (node instanceof HTMLImageElement ? `image ${node.alt}` : node.textContent ?? ''));

async function playOneTurn(world: World, operations: object[] = []) {
  renderGameViewer(withImages(world), { inGameplay: <Probe />, initialPersona: { ref: { source: 'world', entityId: 'ash' } } });
  const box = await screen.findByPlaceholderText(/Type your action/);
  stubEndpoint(operations);
  fireEvent.change(box, { target: { value: 'I ring the bell.' } });
  await waitFor(() => expect(screen.getByRole('button', { name: 'Send' })).toBeEnabled());
  fireEvent.click(screen.getByRole('button', { name: 'Send' }));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Regenerate Stats' })).toBeEnabled());
}

describe('a World Tool’s On Call player.show', () => {
  it('shows above the narration when the Tool runs during the turn', async () => {
    await playOneTurn({ ...baseWorld(), tools: [fetchTool('player.show("Harbor");')] });
    expect(Object.values(gameplay().scriptTells)).toEqual([[{ image: 'm-harbor', size: 'medium', wrap: 'block', timing: 'before' }]]);
    expect(order()).toEqual(['image Harbor', 'The ferry bell rings twice.']);
  });
});

describe('an item script’s player.show', () => {
  it('shows below the narration when the story gains the item, in call order with the script’s tell', async () => {
    await playOneTurn({ ...baseWorld(), items: [gem] }, [{ op: 'gain', item: 'Gem', quantity: 1, owner: '', to: 'you' }]);
    const entries = Object.values(gameplay().scriptTells).flat();
    expect(entries).toEqual([
      { image: 'm-gem', size: 'medium', wrap: 'block', timing: 'gained' },
      { text: 'The gem glints.', timing: 'gained' },
    ]);
    expect(order()).toEqual(['The ferry bell rings twice.', 'image Gem Art', 'The gem glints.']);
  });
});
