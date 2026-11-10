import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { toast } from 'react-toastify';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { harborWorld, renderGameViewer } from '@/test/gameViewer';
import { sseResponse, sseReply } from '@/test/aiTextFixtures';
import { deleteSaveRecord, getAllSaveRecords } from '@/components/modals/dbUtils';
import { useGameplay } from '@/contexts/GameplayContext';
import type { Currency, Entity, Item, Placement, PlayerStat, World } from '@/types';

/** Paying on a mounted game: the Inventory pass's reply through the turn commit, against the stat pass beside it. */

vi.hoisted(() => { vi.stubEnv('VITE_DEFAULT_ENDPOINT', ''); });
vi.mock('@/views/VRMViewer', () => import('@/test/stubs/vrmViewer'));
vi.mock('react-toastify', () => ({
  toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn(), info: vi.fn(), warn: vi.fn(), dismiss: vi.fn(), isActive: vi.fn() }),
  ToastContainer: () => null,
}));

const stat = (id: string, name: string, value: number): PlayerStat =>
  ({ id, name, type: 'number', description: '', min: 0, max: 100, value, regen: 0, descriptors: [] });
const funds = stat('funds', 'Funds', 50);
const vigor = stat('vigor', 'Vigor', 50);
const CREDITS: Currency = { id: 'credits', name: 'Credits', backing: { kind: 'stat', statId: 'funds' } };
const backingItem = (id: string, name: string, scripts: Item['scripts'] = []): Item =>
  ({ id, name, stackable: true, statEffects: [], traitEffects: [], equipRequires: [], scripts });
// Losing a Gold lowers Vigor through the coin's own When Lost script.
const gold = backingItem('gold', 'Gold', [{ id: 'gold-lost', timing: 'lost', code: 'stats.Vigor.value -= 1;' }]);
const copper = backingItem('copper', 'Copper');
const MONEY: Currency = { id: 'coin', name: 'Coin', backing: { kind: 'items', items: [{ itemId: 'copper', worth: 1 }, { itemId: 'gold', worth: 100 }] } };
const purse = (quantity: number): Placement => ({ id: 'purse', source: { kind: 'item', itemId: 'gold' }, where: { kind: 'you' }, quantity });

const guard = { id: 'guard', name: 'Guard', description: 'A bored guard.', locations: ['harbor'] } as Entity;

const statWorld = (entities: Entity[] = []): World => ({ ...harborWorld({ stats: [funds, vigor], entities }), currencies: [CREDITS] });
const itemWorld = (entities: Entity[] = []): World => ({
  ...harborWorld({ stats: [vigor], entities }), items: [gold, copper], currencies: [MONEY], placements: [purse(1)],
});

const pay = (owner: string, to: string, price: string) => JSON.stringify({ operations: [{ op: 'pay', item: '', quantity: 1, owner, to, price }] });

let live: ReturnType<typeof useGameplay> | null = null;
const Probe = () => { live = useGameplay(); return null; };
const gameplay = () => {
  if (!live) throw new Error('no gameplay yet');
  return live;
};
const statNow = (id: string) => gameplay().globalStats.find((s) => s.id === id)?.value;
const moneyOf = (where: string) => Object.fromEntries(gameplay().itemCopies
  .filter((c) => (c.where.kind === 'entity' ? c.where.id : c.where.kind) === where)
  .map((c) => [c.item.kind === 'item' ? c.item.itemId : '', c.quantity]));

function stubEndpoint(inventoryReply: string, statReply = '{"Global Stats": {"Vigor": 0, "Vigor max": 0}}') {
  const calls = { inventory: 0, stats: 0, statBodies: [] as string[], inventoryReply, statReply };
  vi.stubGlobal('fetch', vi.fn(async (_url: string, init?: RequestInit) => {
    if (!init?.body) return new Response(JSON.stringify({ data: [{ id: 'm' }] }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    const { messages } = JSON.parse(init.body as string) as { messages: { role: string; content: string }[] };
    const system = messages.find((m) => m.role === 'system')?.content ?? '';
    if (system.includes('location router')) return sseResponse(sseReply('NONE'));
    if (system.includes('You track where the characters in an interactive story go')) return sseResponse(sseReply('{}'));
    if (system.includes('inventory keeper')) {
      calls.inventory += 1;
      return sseResponse(sseReply(calls.inventoryReply));
    }
    if (system.includes('stat tracker')) {
      calls.stats += 1;
      calls.statBodies.push(init.body as string);
      return sseResponse(sseReply(calls.statReply));
    }
    if (system.includes('player choice writer')) return sseResponse(sseReply('1. Walk on\n2. Wait'));
    return sseResponse(sseReply('You press the money into the waiting hand.'));
  }));
  return calls;
}

beforeEach(async () => {
  live = null;
  for (const { id } of await getAllSaveRecords()) await deleteSaveRecord(id);
  vi.mocked(toast.error).mockClear();
  vi.mocked(toast.info).mockClear();
  localStorage.clear();
  localStorage.setItem('FORMAMORPH_endpointUrl', 'http://127.0.0.1:5190/v1/chat/completions');
  localStorage.setItem('FORMAMORPH_thinkingMode', 'off');
  localStorage.setItem('FORMAMORPH_concurrentTurnRequests', 'true');
});

async function sendTurn(action = 'I pay.') {
  fireEvent.change(await screen.findByPlaceholderText(/Type your action/), { target: { value: action } });
  await waitFor(() => expect(screen.getByRole('button', { name: 'Send' })).toBeEnabled());
  fireEvent.click(screen.getByRole('button', { name: 'Send' }));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Regenerate Stats' })).toBeEnabled());
}

async function playOneTurn(world: World, inventoryReply: string, statReply?: string) {
  renderGameViewer(world, { inGameplay: <Probe /> });
  await screen.findByPlaceholderText(/Type your action/);
  const calls = stubEndpoint(inventoryReply, statReply);
  await sendTurn();
  return calls;
}

describe('a stat Currency', () => {
  it('moves the stat once, and the stat request omits it while the Inventory pass is due', async () => {
    const calls = await playOneTurn(statWorld(), pay('you', 'the harbor guard', '30'));
    await waitFor(() => expect(statNow('funds')).toBe(20));
    expect(calls.inventory).toBe(1);
    expect(calls.statBodies[0]).toContain('Vigor');
    expect(calls.statBodies[0]).not.toContain('Funds');
    // The move shows on the bar like any stat move of the turn.
    expect(JSON.stringify(gameplay().statDeltas.held)).toMatch(/funds":-30/i);
  });

  it('charges once when the stat pass names the stat anyway', async () => {
    await playOneTurn(statWorld(), pay('you', '', '30'), '{"Global Stats": {"Vigor": 0, "Vigor max": 0, "Funds": -30, "Funds max": 0}}');
    await waitFor(() => expect(statNow('funds')).toBe(20));
  });

  it('charges once across a stats re-roll', async () => {
    const calls = await playOneTurn(statWorld(), pay('you', '', '30'));
    await waitFor(() => expect(statNow('funds')).toBe(20));
    fireEvent.click(screen.getByRole('button', { name: 'Regenerate Stats' }));
    await waitFor(() => expect(calls.stats).toBe(2));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Regenerate Stats' })).toBeEnabled());
    await waitFor(() => expect(statNow('funds')).toBe(20));
    expect(calls.inventory).toBe(1);
    expect(calls.statBodies[1]).not.toContain('Funds');
  });

  it('settles income with no payer', async () => {
    await playOneTurn(statWorld(), pay('', 'you', '30'));
    await waitFor(() => expect(statNow('funds')).toBe(80));
  });

  it('never reads the player as income: a name of the player pays', async () => {
    const withPlayer = statWorld();
    const reply = pay('You', '', '30');
    await playOneTurn(withPlayer, reply);
    await waitFor(() => expect(statNow('funds')).toBe(20));
  });

  it('charges every played entity by name: a library persona plays beside the Custom Persona entity (Q81)', async () => {
    const ash = { id: 'ash', name: 'Ash', customPersona: true, stats: [stat('funds', 'Funds', 50)] } as Entity;
    const wren = { id: 'l-wren', name: 'Wren', persona: true } as Entity;
    renderGameViewer(
      { ...harborWorld({ stats: [vigor], entities: [ash] }), currencies: [CREDITS] },
      { inGameplay: <Probe />, initialPersona: { ref: { source: 'library', entityId: wren.id }, libraryEntity: wren } },
    );
    await screen.findByPlaceholderText(/Type your action/);
    stubEndpoint(pay('Ash', 'the harbor guard', '30'));
    await sendTurn();
    await waitFor(() => expect(gameplay().entityStats.ash?.find((s) => s.id === 'funds')?.value).toBe(20));
  });

  it('refuses what the player cannot afford: state unchanged, a diagnostic, and no toast', async () => {
    await playOneTurn(statWorld(), pay('you', '', '51'));
    await waitFor(() => expect(JSON.stringify(gameplay().logEntries)).toContain('skipped pay'));
    expect(statNow('funds')).toBe(50);
    expect(vi.mocked(toast.error)).not.toHaveBeenCalled();
    expect(vi.mocked(toast.info)).not.toHaveBeenCalled();
  });

  it('runs the pass in a world with a Currency and no items', async () => {
    const calls = await playOneTurn(statWorld(), JSON.stringify({ operations: [] }));
    expect(statWorld().items ?? []).toEqual([]);
    expect(calls.inventory).toBe(1);
  });

  it('runs no pass for a name-only Currency alone', async () => {
    const goats: Currency = { id: 'goats', name: 'Goats', backing: { kind: 'name' } };
    const calls = await playOneTurn({ ...harborWorld({ stats: [vigor] }), currencies: [goats] }, JSON.stringify({ operations: [] }));
    expect(calls.inventory).toBe(0);
  });

  it('keeps the stat in the request of a world with no Currency that names it', async () => {
    const calls = await playOneTurn({ ...harborWorld({ stats: [funds, vigor] }) }, JSON.stringify({ operations: [] }));
    expect(calls.statBodies[0]).toContain('Funds');
  });
});

describe('an Items Currency', () => {
  it('pays with change through ordinary ops, and the item fires its When Lost script', async () => {
    await playOneTurn(itemWorld([guard]), pay('you', 'Guard', '5 Copper'));
    await waitFor(() => expect(moneyOf('you')).toEqual({ copper: 95 }));
    // The Guard holds no Placement of an item, so it is untracked and keeps nothing.
    expect(moneyOf('guard')).toEqual({});
    await waitFor(() => expect(statNow('vigor')).toBe(49));
  });

  it('adds a bounty as coins', async () => {
    await playOneTurn(itemWorld(), pay('', 'you', '2 Gold, 3 Copper'));
    await waitFor(() => expect(moneyOf('you')).toEqual({ gold: 3, copper: 3 }));
  });

  it('refuses a payment the items cannot cover, and moves none', async () => {
    await playOneTurn(itemWorld(), pay('you', '', '2 Gold'));
    await waitFor(() => expect(JSON.stringify(gameplay().logEntries)).toContain('skipped pay'));
    expect(moneyOf('you')).toEqual({ gold: 1 });
  });

  it('pays from a save made before paying existed', async () => {
    const played = renderGameViewer(itemWorld(), { inGameplay: <Probe /> });
    await screen.findByPlaceholderText(/Type your action/);
    stubEndpoint(JSON.stringify({ operations: [] }));
    await sendTurn('I look around.');
    await waitFor(async () => expect((await getAllSaveRecords()).length).toBe(1));
    const [save] = await getAllSaveRecords();
    const keys = Object.keys(save).sort();
    played.unmount();
    cleanup();

    renderGameViewer(itemWorld(), { inGameplay: <Probe />, initialSaveId: save.id });
    await screen.findByRole('button', { name: 'Regenerate Narration' });
    stubEndpoint(pay('you', '', '5 Copper'));
    await sendTurn();
    await waitFor(() => expect(moneyOf('you')).toEqual({ copper: 95 }));
    await waitFor(async () => expect(((await getAllSaveRecords())[0].messageHistory ?? []).filter((m) => m.role === 'assistant').length).toBe(2));
    expect(Object.keys((await getAllSaveRecords())[0]).sort()).toEqual(keys);
  });
});

describe('a script pay then a pass pay in one turn', () => {
  const scriptPays = (code: string): Pick<World, 'scripts'> => ({ scripts: [{ id: 'toll', timing: 'before', code }] });

  it('settles both from a stat Currency', async () => {
    await playOneTurn({ ...statWorld(), ...scriptPays('currencies.Credits.pay(persona, null, 10);') }, pay('you', '', '30'));
    await waitFor(() => expect(statNow('funds')).toBe(10));
  });

  it("refuses the pass pay the script's pay left too little for", async () => {
    await playOneTurn({ ...statWorld(), ...scriptPays('currencies.Credits.pay(persona, null, 10);') }, pay('you', '', '45'));
    await waitFor(() => expect(statNow('funds')).toBe(40));
  });

  it('settles both from an Items Currency, spending the change the script made', async () => {
    await playOneTurn({ ...itemWorld(), ...scriptPays('currencies.Coin.pay(persona, null, 10);') }, pay('you', '', '30 Copper'));
    await waitFor(() => expect(moneyOf('you')).toEqual({ copper: 60 }));
  });
});

describe('a buy at the turn commit', () => {
  const sword: Item = { ...backingItem('sword', 'Iron Sword'), stackable: false, value: 150, currencyId: 'coin' };
  const tonic: Item = { ...backingItem('tonic', 'Tonic'), value: 30, currencyId: 'credits' };
  const merchant = { id: 'merchant', name: 'Merchant', description: 'A shrewd merchant.', locations: ['harbor'] } as Entity;
  const stock = (itemId: string): Placement => ({ id: `stock-${itemId}`, source: { kind: 'item', itemId }, where: { kind: 'entity', id: 'merchant' }, quantity: 1 });
  const shop = (quantity: number): World => ({
    ...harborWorld({ stats: [vigor], entities: [merchant] }), items: [gold, copper, sword], currencies: [MONEY], placements: [purse(quantity), stock('sword')],
  });
  const buy = (over: Record<string, unknown> = {}) => JSON.stringify({ operations: [{ op: 'buy', item: 'Iron Sword', quantity: 1, owner: 'Merchant', to: 'you', ...over }] });

  it('moves items and item together, and the items fire their When Lost script', async () => {
    await playOneTurn(shop(2), buy());
    await waitFor(() => expect(moneyOf('you')).toEqual({ sword: 1, copper: 50 }));
    expect(moneyOf('merchant')).toEqual({});
    await waitFor(() => expect(statNow('vigor')).toBeLessThan(50));
  });

  it('counts a stated price over Value', async () => {
    await playOneTurn(shop(1), buy({ price: '40 Copper' }));
    await waitFor(() => expect(moneyOf('you')).toEqual({ sword: 1, copper: 60 }));
  });

  it('refuses what the player cannot afford: neither moves, a diagnostic, and no toast', async () => {
    await playOneTurn(shop(1), buy());
    await waitFor(() => expect(JSON.stringify(gameplay().logEntries)).toContain('skipped buy'));
    expect(moneyOf('you')).toEqual({ gold: 1 });
    expect(moneyOf('merchant')).toEqual({ sword: 1 });
    expect(toast.error).not.toHaveBeenCalled();
    expect(toast.info).not.toHaveBeenCalled();
  });

  it('moves a stat and the item once, across a stats re-roll', async () => {
    const world: World = { ...harborWorld({ stats: [funds, vigor], entities: [merchant] }), items: [tonic], currencies: [CREDITS], placements: [stock('tonic')] };
    const calls = await playOneTurn(world, JSON.stringify({ operations: [{ op: 'buy', item: 'Tonic', quantity: 1, owner: 'Merchant', to: 'you' }] }));
    await waitFor(() => expect(statNow('funds')).toBe(20));
    expect(moneyOf('you')).toEqual({ tonic: 1 });
    fireEvent.click(screen.getByRole('button', { name: 'Regenerate Stats' }));
    await waitFor(() => expect(calls.stats).toBe(2));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Regenerate Stats' })).toBeEnabled());
    expect(statNow('funds')).toBe(20);
    expect(moneyOf('you')).toEqual({ tonic: 1 });
  });

  it('pays the player for a sale', async () => {
    const world: World = { ...shop(0), placements: [{ id: 'mine', source: { kind: 'item', itemId: 'sword' }, where: { kind: 'you' }, quantity: 1 }] };
    await playOneTurn(world, buy({ owner: 'you', to: 'Merchant' }));
    await waitFor(() => expect(moneyOf('you')).toEqual({ gold: 1, copper: 50 }));
    expect(moneyOf('merchant')).toEqual({ sword: 1 });
  });
});
