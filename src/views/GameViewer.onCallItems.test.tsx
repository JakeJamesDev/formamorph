import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { bodyFixture } from '@/test/bodyFixture';
import { harborWorld, renderGameViewer } from '@/test/gameViewer';
import { sseFrame, sseReply, sseResponse } from '@/test/aiTextFixtures';
import { scriptWorldTool } from '@/test/worldToolFixtures';
import { useGameplay } from '@/contexts/GameplayContext';
import { deleteSaveRecord, getAllSaveRecords } from '@/components/modals/dbUtils';
import { UNKNOWN_REASONING_CAPABILITY } from '@/lib/reasoningEffort';
import { parseTurnContent } from '@/lib/turnDigest';
import type { Currency, Entity, Item, PlayerStat, Script, Tool, World } from '@/types';

/** An On Call Tool's item writes on a mounted game: the reply reads them, a stat re-roll keeps them, and Regenerate Choices reads what a real After the AI run read. */

vi.hoisted(() => { vi.stubEnv('VITE_DEFAULT_ENDPOINT', ''); });
vi.mock('@/views/VRMViewer', () => import('@/test/stubs/vrmViewer'));
vi.mock('react-toastify', () => ({
  toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn(), info: vi.fn(), warn: vi.fn(), dismiss: vi.fn(), isActive: vi.fn() }),
  ToastContainer: () => null,
}));

const ENDPOINT = 'http://127.0.0.1:5190/v1/chat/completions';
const MODEL = 'm';

const stat = (id: string, name: string, value: number): PlayerStat =>
  ({ id, name, type: 'number', description: '', min: 0, max: 1000, value, regen: 0, descriptors: [] });
const item = (id: string, name: string, over: Partial<Item> = {}): Item =>
  ({ id, name, stackable: false, statEffects: [], traitEffects: [], equipRequires: [], scripts: [], ...over });
const script = (id: string, timing: Script['timing'], code: string): Script => ({ id, timing, code });
const tool = (code: string): Tool => ({ ...scriptWorldTool('fetch', 'fetch', code, 'call'), offeredTo: ['narration'] });

const ash: Entity = { id: 'ash', name: 'Ash', persona: true, personaOnly: true, stats: [stat('funds', 'Funds', 50)] };
const CREDITS: Currency = { id: 'credits', name: 'Credits', backing: { kind: 'stat', statId: 'funds' } };
const COIN: Currency = { id: 'coin', name: 'Coin', backing: { kind: 'items', items: [{ itemId: 'copper', worth: 1 }, { itemId: 'gold', worth: 100 }] } };
const COINS = [item('copper', 'Copper', { stackable: true }), item('gold', 'Gold', { stackable: true })];
const GEM = item('gem', 'Gem');

const worldOf = (over: Partial<World>, entities: Entity[] = [ash]): World => ({ ...harborWorld({ stats: [stat('vigor', 'Vigor', 50)], entities }), ...over });

let live: ReturnType<typeof useGameplay> | null = null;
const Probe = () => { live = useGameplay(); return null; };
const gameplay = () => {
  if (!live) throw new Error('no gameplay yet');
  return live;
};
const vigor = () => gameplay().globalStats.find((s) => s.id === 'vigor')?.value;
const held = (itemId: string) => gameplay().itemCopies
  .filter((copy) => copy.item.kind === 'item' && copy.item.itemId === itemId).reduce((sum, copy) => sum + copy.quantity, 0);

/** The AI calls the Tool once in its narration request. `pass` is the Inventory pass's first answer. */
function stubEndpoint(pass: object[] = []) {
  const calls = { stats: 0, choices: 0, passes: 0 };
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
    if (system.includes('You track where one character goes')) return sseResponse(sseReply('Stay'));
    if (system.includes('inventory keeper')) {
      calls.passes += 1;
      return sseResponse(sseReply(JSON.stringify({ operations: calls.passes === 1 ? pass : [] })));
    }
    if (system.includes('stat tracker')) {
      calls.stats += 1;
      return sseResponse(sseReply('{"Global Stats": {"Vigor": 0, "Vigor max": 0}}'));
    }
    if (system.includes('player choice writer')) {
      calls.choices += 1;
      return sseResponse(sseReply(calls.choices === 1 ? '1. Walk on\n2. Wait' : '1. Swim across\n2. Wait'));
    }
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

const statsButton = () => screen.getByRole('button', { name: 'Regenerate Stats' });

async function playOneTurn(world: World, pass?: object[]) {
  renderGameViewer(world, { inGameplay: <Probe />, initialPersona: { ref: { source: 'world', entityId: 'ash' } } });
  const box = await screen.findByPlaceholderText(/Type your action/);
  const calls = stubEndpoint(pass);
  fireEvent.change(box, { target: { value: 'I ring the bell.' } });
  await waitFor(() => expect(screen.getByRole('button', { name: 'Send' })).toBeEnabled());
  fireEvent.click(screen.getByRole('button', { name: 'Send' }));
  await waitFor(() => expect(statsButton()).toBeEnabled());
  return calls;
}

async function rerollStats(calls: { stats: number }) {
  const before = calls.stats;
  fireEvent.click(statsButton());
  await waitFor(() => expect(calls.stats).toBe(before + 1));
  await waitFor(() => expect(statsButton()).toBeEnabled());
}

describe('an On Call Tool called during the reply', () => {
  it('reaches a During AI Output script through the game’s own landing', async () => {
    await playOneTurn(worldOf({
      items: [GEM], tools: [tool('items.Gem.give(persona);')],
      scripts: [script('out', 'output', 'stats.Vigor.value = items.Gem.copies.length * 10;')],
    }));
    await waitFor(() => expect(vigor()).toBe(10));
    expect(held('gem')).toBe(1);
  });

  it('and a During AI Output script charge a stat Currency in full', async () => {
    await playOneTurn(worldOf({
      currencies: [CREDITS], tools: [tool('currencies.Credits.pay(persona, null, 20);')],
      scripts: [script('out', 'output', 'currencies.Credits.pay(persona, null, 5);')],
    }));
    await waitFor(() => expect(gameplay().entityStats.ash?.find((s) => s.id === 'funds')?.value).toBe(25));
  });
});

describe('a stat re-roll of an On Call Tool’s turn', () => {
  const counted = item('gem', 'Gem', { scripts: [script('gained', 'gained', 'stats.Vigor.value += 1;')] });
  const world = worldOf({
    items: [counted, ...COINS], currencies: [COIN],
    placements: [{ id: 'purse', source: { kind: 'item', itemId: 'gold' }, where: { kind: 'you' }, quantity: 1 }],
    tools: [tool('items.Gem.give(persona); currencies.Coin.pay(persona, null, 30); stats.Vigor.value += 100;')],
  });
  const settled = async () => {
    await waitFor(() => expect(held('gem')).toBe(1));
    expect(held('gold')).toBe(0);
    expect(held('copper')).toBe(70);
    await waitFor(() => expect(vigor()).toBe(151));
  };

  it('brings back its give and coin pay, each counted once', async () => {
    const calls = await playOneTurn(world);
    await settled();
    await rerollStats(calls);
    await settled();
  });

  it('of a save with no saved item writes behaves as it did', async () => {
    const calls = await playOneTurn(world);
    await settled();
    act(() => gameplay().setFullMessageHistory((history) => history.map((message) => {
      const turn = message.role === 'assistant' ? parseTurnContent(message.content) : null;
      if (!turn?.toolCalls?.length) return message;
      const toolCalls = turn.toolCalls.map(({ writes, ...call }) => {
        const { inventory: _new, ...old } = writes ?? {};
        return { ...call, writes: old };
      });
      return { ...message, content: JSON.stringify({ ...turn, toolCalls }) };
    })));
    await rerollStats(calls);
    await waitFor(() => expect(vigor()).toBe(150));
    expect(held('gem')).toBe(0);
    expect(held('gold')).toBe(1);
  });
});

describe('Regenerate Choices', () => {
  // One copy from each stage ahead of the batch. A script's own give has no copy until the script lands.
  const code = 'items.Gem.give(persona); stats.Vigor.value += 1; turn.choices = [...turn.choices, "Held " + items.Gem.copies.length];';
  const world = worldOf({
    items: [GEM], tools: [tool('items.Gem.give(persona);')],
    scripts: [script('b', 'before', 'items.Gem.give(persona);'), script('a', 'after', code)],
  });
  const gain = [{ op: 'gain', item: 'Gem', quantity: 1, owner: '', to: 'you' }];

  it('gives a script the Item Copies a real After the AI run read, and its writes land nothing', async () => {
    const calls = await playOneTurn(world, gain);
    await waitFor(() => expect(gameplay().choices).toEqual(['Walk on', 'Wait', 'Held 3']));
    expect(held('gem')).toBe(4);
    const vigorAfterTurn = vigor();
    fireEvent.click(await screen.findByRole('button', { name: 'Regenerate Choices' }));
    await waitFor(() => expect(calls.choices).toBe(2));
    await waitFor(() => expect(gameplay().choices).toEqual(['Swim across', 'Wait', 'Held 3']));
    expect(held('gem')).toBe(4);
    expect(vigor()).toBe(vigorAfterTurn);
  });

  const reroll = async (calls: { choices: number }, first: string) => {
    await waitFor(() => expect(gameplay().choices).toEqual(['Walk on', 'Wait', first]));
    fireEvent.click(await screen.findByRole('button', { name: 'Regenerate Choices' }));
    await waitFor(() => expect(calls.choices).toBe(2));
  };

  it.each([
    ['alone', []],
    ['with an Inventory pass that settles again', gain],
  ])('reads an earlier script’s item effect once, %s', async (_case, pass) => {
    const charm = item('charm', 'Charm', { statEffects: [{ id: 'e1', statId: 'funds', facet: 'value', timing: 'owned', amount: 5, op: 'add' }] });
    const calls = await playOneTurn(worldOf({
      items: [charm, GEM],
      scripts: [
        script('b', 'before', 'items.Charm.give(persona);'),
        script('a', 'after', 'turn.choices = [...turn.choices, "Funds " + persona.stats.Funds.value];'),
      ],
    }), pass);
    await reroll(calls, 'Funds 55');
    await waitFor(() => expect(gameplay().choices).toEqual(['Swim across', 'Wait', 'Funds 55']));
  });

  it('reads the Inventory pass’s Currency payment, as the real run did', async () => {
    const calls = await playOneTurn(worldOf({
      currencies: [CREDITS],
      scripts: [script('a', 'after', 'turn.choices = [...turn.choices, "Funds " + currencies.Credits.balance(persona)];')],
    }), [{ op: 'pay', item: '', quantity: 1, owner: 'Ash', to: '', price: '20 Credits' }]);
    await reroll(calls, 'Funds 30');
    await waitFor(() => expect(gameplay().choices).toEqual(['Swim across', 'Wait', 'Funds 30']));
  });

  it('reads no item a During AI Output script wrote, since the save keeps no such write', async () => {
    const calls = await playOneTurn(worldOf({
      items: [GEM],
      scripts: [
        script('o', 'output', 'if (items.Gem.copies.length === 0) items.Gem.give(persona);'),
        script('a', 'after', 'turn.choices = [...turn.choices, "Held " + items.Gem.copies.length];'),
      ],
    }));
    await reroll(calls, 'Held 1');
    await waitFor(() => expect(gameplay().choices).toEqual(['Swim across', 'Wait', 'Held 0']));
  });

  it('checks an equip’s requirement against the turn’s stats, not the state the turn ended on', async () => {
    const sword = item('sword', 'Sword', {
      slotRule: { mode: 'either', slotIds: ['hand'] },
      equipRequires: [{ all: [{ kind: 'stat', id: 'vigor', operator: '>=', value: 90, unit: 'raw' }] }],
    });
    const calls = await playOneTurn(worldOf({
      items: [sword], slots: [{ id: 'hand', name: 'Hand' }], bodies: [bodyFixture({ id: 'human', name: 'Humanoid', entries: [{ slotId: 'hand' }] })],
      placements: [{ id: 'mine', source: { kind: 'item', itemId: 'sword' }, where: { kind: 'you' }, quantity: 1 }],
      scripts: [
        script('a1', 'after', 'persona.items[0].equip();'),
        script('a2', 'after', 'turn.choices = [...turn.choices, persona.items[0].equipped ? "Worn" : "Bare"];'),
        script('a3', 'after', 'stats.Vigor.value = 95;'),
      ],
    }));
    await waitFor(() => expect(gameplay().choices).toEqual(['Walk on', 'Wait', 'Bare']));
    await waitFor(() => expect(vigor()).toBe(95));
    fireEvent.click(await screen.findByRole('button', { name: 'Regenerate Choices' }));
    await waitFor(() => expect(calls.choices).toBe(2));
    await waitFor(() => expect(gameplay().choices).toEqual(['Swim across', 'Wait', 'Bare']));
  });
});
