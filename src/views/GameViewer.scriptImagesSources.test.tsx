import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { bodyFixture } from '@/test/bodyFixture';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { harborWorld, renderGameViewer } from '@/test/gameViewer';
import { sseFrame, sseReply, sseResponse } from '@/test/aiTextFixtures';
import { scriptWorldTool } from '@/test/worldToolFixtures';
import { useGameplay } from '@/contexts/GameplayContext';
import { deleteSaveRecord, getAllSaveRecords } from '@/components/modals/dbUtils';
import { UNKNOWN_REASONING_CAPABILITY } from '@/lib/reasoningEffort';
import type { Entity, Item, Placement, PlayerStat, Script, Tool, Trait, World } from '@/types';

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
  const calls = { stats: 0 };
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
    if (system.includes('stat tracker')) {
      calls.stats += 1;
      return sseResponse(sseReply('No changes'));
    }
    if (system.includes('player choice writer')) return sseResponse(sseReply('1. Walk on\n2. Wait'));
    return sseResponse(sseReply('The ferry bell rings twice.'));
  }));
  return calls;
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

const statsButton = () => screen.getByRole('button', { name: 'Regenerate Stats' });
const settled = () => waitFor(() => expect(statsButton()).toBeEnabled());

async function playOneTurn(world: World, operations: object[] = [], answer?: string, initialTraits?: string[]) {
  renderGameViewer(withImages(world), { inGameplay: <Probe />, initialPersona: { ref: { source: 'world', entityId: 'ash' } }, initialTraits });
  const box = await screen.findByPlaceholderText(/Type your action/);
  const calls = stubEndpoint(operations);
  fireEvent.change(box, { target: { value: 'I ring the bell.' } });
  await waitFor(() => expect(screen.getByRole('button', { name: 'Send' })).toBeEnabled());
  fireEvent.click(screen.getByRole('button', { name: 'Send' }));
  if (answer) fireEvent.click(await screen.findByRole('button', { name: answer }));
  await settled();
  return calls;
}

/** Regenerate Stats run to its end. */
async function reroll(calls: { stats: number }) {
  const before = calls.stats;
  fireEvent.click(statsButton());
  await waitFor(() => expect(calls.stats).toBe(before + 1));
  await settled();
}

const entries = () => Object.values(gameplay().scriptTells).flat();

describe('a World Tool’s On Call player.show', () => {
  it('shows above the narration when the Tool runs during the turn', async () => {
    await playOneTurn({ ...baseWorld(), tools: [fetchTool('player.show("Harbor");')] });
    expect(Object.values(gameplay().scriptTells)).toEqual([[{ image: 'm-harbor', size: 'medium', wrap: 'block', timing: 'call' }]]);
    expect(order()).toEqual(['image Harbor', 'The ferry bell rings twice.']);
  });
});

describe('an item script’s player.show', () => {
  it('shows below the narration when the story gains the item, in call order with the script’s tell', async () => {
    await playOneTurn({ ...baseWorld(), items: [gem] }, [{ op: 'gain', item: 'Gem', quantity: 1, owner: '', to: 'you' }]);
    expect(entries()).toEqual([
      { image: 'm-gem', size: 'medium', wrap: 'block', timing: 'gained' },
      { text: 'The gem glints.', timing: 'gained' },
    ]);
    expect(order()).toEqual(['The ferry bell rings twice.', 'image Gem Art', 'The gem glints.']);
  });
});

describe('Regenerate Stats (Q33, Q34)', () => {
  const gain = [{ op: 'gain', item: 'Gem', quantity: 1, owner: '', to: 'you' }];
  const gemShown = [
    { image: 'm-gem', size: 'medium', wrap: 'block', timing: 'gained' },
    { text: 'The gem glints.', timing: 'gained' },
  ];

  it('keeps an On Call Tool’s image and tell, which the replay lays on without a run', async () => {
    const calls = await playOneTurn({ ...baseWorld(), tools: [fetchTool('player.show("Harbor"); player.tell("The bell answers.");')] });
    const shown = [
      { image: 'm-harbor', size: 'medium', wrap: 'block', timing: 'call' },
      { text: 'The bell answers.', timing: 'call' },
    ];
    expect(entries()).toEqual(shown);

    await reroll(calls);
    expect(entries()).toEqual(shown);
    expect(order()).toEqual(['image Harbor', 'The ferry bell rings twice.', 'The bell answers.']);
  });

  it('keeps the image and tell of an item script a Tool call fires, above the narration', async () => {
    const calls = await playOneTurn({ ...baseWorld(), items: [gem], tools: [fetchTool('items.Gem.give(persona);')] });
    const shown = gemShown.map((entry) => ({ ...entry, timing: 'call' }));
    expect(entries()).toEqual(shown);

    await reroll(calls);
    expect(entries()).toEqual(shown);
    expect(order()).toEqual(['image Gem Art', 'The ferry bell rings twice.', 'The gem glints.']);
  });

  it('replaces the Inventory pass’s item script entries with the replayed ones, once each', async () => {
    const calls = await playOneTurn({ ...baseWorld(), items: [gem] }, gain);
    expect(entries()).toEqual(gemShown);

    await reroll(calls);
    expect(entries()).toEqual(gemShown);
    expect(order()).toEqual(['The ferry bell rings twice.', 'image Gem Art', 'The gem glints.']);
  });

  it('puts the Inventory pass’s item script entries back when the re-roll is stopped', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const ask: Script = { id: 'ask', timing: 'before', code: 'player.confirm("Ring it?");' };
    await playOneTurn({ ...baseWorld(), items: [gem], scripts: [ask] }, gain, 'Yes');
    expect(entries()).toEqual(gemShown);

    fireEvent.click(statsButton());
    await screen.findByRole('group', { name: 'Ring it?' });
    expect(entries()).toEqual([]);
    fireEvent.click(screen.getByRole('button', { name: /Stop/ }));
    await waitFor(() => expect(gameplay().isWaitingForAI).toBe(false));
    await waitFor(() => expect(entries()).toEqual(gemShown));
  });

  it('drops a between-turns panel equip’s entries with the equip, which the re-roll rolls back (Q35)', async () => {
    const helm: Item = {
      id: 'helm', name: 'Helm', slotRule: { mode: 'either', slotIds: ['head'] }, statEffects: [], traitEffects: [], equipRequires: [],
      scripts: [{ id: 'on', timing: 'equipped', code: 'player.tell("The helm fits.");' }],
    };
    const placements: Placement[] = [{ id: 'p-helm', where: { kind: 'you' }, quantity: 1, source: { kind: 'item', itemId: 'helm' } }];
    const calls = await playOneTurn({
      ...baseWorld(), items: [helm], slots: [{ id: 'head', name: 'Head' }], placements,
      bodies: [bodyFixture({ id: 'human', name: 'Humanoid', entries: [{ slotId: 'head' }] })],
    });
    act(() => gameplay().setActiveTab('inventory'));
    fireEvent.click(await screen.findByRole('button', { name: 'Equip Helm' }));
    await waitFor(() => expect(entries()).toEqual([{ text: 'The helm fits.', timing: 'equipped' }]));

    act(() => gameplay().setActiveTab('stats'));
    await reroll(calls);
    expect(entries()).toEqual([]);
    act(() => gameplay().setActiveTab('inventory'));
    expect(await screen.findByRole('button', { name: 'Equip Helm' })).toBeInTheDocument();
  });

  describe('a switch the turn’s settle makes (Q36)', () => {
    // Brave needs Vigor at 40; the Before box drops Vigor to 10, so the settle turns Brave off each run.
    const gated: Trait = { id: 'brave', name: 'Brave', statChanges: [], requires: [{ all: [{ kind: 'stat', id: 'vigor', operator: '>=', value: 40, unit: 'raw' }] }] };
    const drop: PlayerStat = { ...vigor, scripts: [{ id: 'drop', timing: 'before', code: 'return 10;' }] };
    const fades: Script = { id: 'fades', timing: 'switch', code: 'player.show("Harbor"); player.tell("Brave fades.");' };
    const shown = [
      { image: 'm-harbor', size: 'medium', wrap: 'block', timing: 'switch' },
      { text: 'Brave fades.', timing: 'switch' },
    ];
    const switched = (over: Partial<World> = {}): World => ({ ...baseWorld(), stats: [drop], traits: [gated], scripts: [fades], ...over });

    it('replaces the switch entries with the replayed ones, once each', async () => {
      const calls = await playOneTurn(switched(), [], undefined, ['brave']);
      expect(entries()).toEqual(shown);

      await reroll(calls);
      expect(entries()).toEqual(shown);
    });

    it('puts the switch entries back when the re-roll is stopped', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => {});
      const ask: Script = { id: 'ask', timing: 'before', code: 'player.confirm("Ring it?");' };
      await playOneTurn(switched({ scripts: [fades, ask] }), [], 'Yes', ['brave']);
      expect(entries()).toEqual(shown);

      fireEvent.click(statsButton());
      await screen.findByRole('group', { name: 'Ring it?' });
      expect(entries()).toEqual([]);
      fireEvent.click(screen.getByRole('button', { name: /Stop/ }));
      await waitFor(() => expect(gameplay().isWaitingForAI).toBe(false));
      await waitFor(() => expect(entries()).toEqual(shown));
    });
  });
});
