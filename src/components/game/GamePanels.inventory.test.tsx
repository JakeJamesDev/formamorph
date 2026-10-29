import { describe, expect, it, vi } from 'vitest';
import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderRightPanel, type Gameplay, type TurnFixture } from '@/test/gamePanels';
import type { Entity, GameLocation, Item, ItemCopy, Slot } from '@/types';

vi.mock('@/views/VRMViewer', () => import('@/test/stubs/vrmViewer'));
vi.mock('@/lib/useTtsPlayback', () => import('@/test/stubs/ttsPlayback'));

const item = (id: string, name: string, over: Partial<Item> = {}): Item =>
  ({ id, name, statEffects: [], traitEffects: [], equipRequires: [], ...over });
const slots: Slot[] = [{ id: 'hand', name: 'Hand', capacity: 2 }, { id: 'head', name: 'Head' }];
const items = [
  item('dagger', 'Dagger', { slotId: 'hand' }),
  item('helm', 'Iron Helm', { stackable: false, slotId: 'head' }),
  item('crown', 'Old Crown', { stackable: false, slotId: 'head', bound: true }),
  item('coin', 'Coin'),
  item('tonic', 'Tonic', { consumable: true }),
  item('wand', 'Ash Wand', { charges: 3, stackable: false, slotId: 'hand' }),
];
const yard = { id: 'yard', name: 'Yard' } as GameLocation;
const hall = { id: 'hall', name: 'Hall' } as GameLocation;
const entities = [
  { id: 'bram', name: 'Bram', locations: ['yard'] },
  { id: 'wick', name: 'Wick', locations: ['hall'] },
] as Entity[];
const you = { kind: 'you' } as const;
const copy = (id: string, itemId: string, over: Partial<ItemCopy> = {}): ItemCopy =>
  ({ id, item: { kind: 'item', itemId }, where: you, quantity: 1, visibility: 'visible', ...over });

const turns: TurnFixture[] = [{ narration: 'One.', turnId: 't1' }, { narration: 'Two.', turnId: 't2' }];
const stage = (copies: ItemCopy[], over: { page?: number } = {}) => ({
  world: { items, slots, entities, locations: [yard, hall] },
  turns,
  ...over,
  seed: (g: Gameplay) => {
    g.setCurrentLocation(yard);
    g.setItemCopies(copies);
    g.setActiveTab('inventory');
  },
});

const carried = () => screen.getByRole('region', { name: 'Your inventory' });
const mine = (g: Gameplay) => g.itemCopies.filter((c) => c.where.kind === 'you');

describe('RightPanel — Inventory tab', () => {
  it('equips one dagger from a stack of five at once and leaves four carried', async () => {
    const h = renderRightPanel({}, stage([copy('d', 'dagger', { quantity: 5 })]));
    await userEvent.click(await screen.findByRole('button', { name: 'Equip Dagger' }));
    expect(mine(h.gameplay()).map((c) => [c.quantity, c.equipped?.slotId])).toEqual([[4, undefined], [1, 'hand']]);
    const hand = within(carried()).getByRole('listitem', { name: 'Hand' });
    expect(within(hand).getByText('Dagger')).toBeInTheDocument();
    expect(within(hand).getByText('1 of 2')).toBeInTheDocument();
    expect(within(carried()).getByText('×4')).toBeInTheDocument();
  });

  it('swaps out the helm equipped longest when the slot is full', async () => {
    const h = renderRightPanel({}, stage([copy('old', 'helm', { equipped: { slotId: 'head', order: 1 } }), copy('new', 'helm')]));
    const [equip] = await screen.findAllByRole('button', { name: 'Equip Iron Helm' });
    await userEvent.click(equip);
    expect(mine(h.gameplay()).map((c) => [c.id, !!c.equipped])).toEqual([['old', false], ['new', true]]);
  });

  it('unequips an item into the carried list', async () => {
    const h = renderRightPanel({}, stage([copy('h', 'helm', { equipped: { slotId: 'head', order: 1 } })]));
    await userEvent.click(await screen.findByRole('button', { name: 'Unequip Iron Helm' }));
    expect(mine(h.gameplay())[0].equipped).toBeUndefined();
    expect(within(within(carried()).getByRole('listitem', { name: 'Head' })).getByText('Empty')).toBeInTheDocument();
  });

  it('gives only to the entities at the location, and a count of the stack', async () => {
    const h = renderRightPanel({}, stage([copy('c', 'coin', { quantity: 5 })]));
    await userEvent.click(await screen.findByRole('button', { name: 'Give Coin' }));
    const list = await screen.findByRole('list', { name: 'Give to' });
    expect(within(list).getAllByRole('button').map((b) => b.textContent)).toEqual(['Bram']);
    const count = screen.getByRole('spinbutton', { name: 'Quantity' });
    await userEvent.clear(count);
    await userEvent.type(count, '2');
    await userEvent.click(within(list).getByRole('button', { name: 'Bram' }));
    expect(h.gameplay().itemCopies.map((c) => [c.where, c.quantity])).toEqual([[you, 3], [{ kind: 'entity', id: 'bram' }, 2]]);
  });

  it('gives a whole stack with All', async () => {
    const h = renderRightPanel({}, stage([copy('c', 'coin', { quantity: 5 })]));
    await userEvent.click(await screen.findByRole('button', { name: 'Give Coin' }));
    await userEvent.click(screen.getByRole('button', { name: 'All' }));
    await userEvent.click(screen.getByRole('button', { name: 'Bram' }));
    expect(h.gameplay().itemCopies).toEqual([copy('c', 'coin', { quantity: 5, where: { kind: 'entity', id: 'bram' } })]);
  });

  it('drops a single Item Copy at the location at once', async () => {
    const h = renderRightPanel({}, stage([copy('h', 'helm')]));
    await userEvent.click(await screen.findByRole('button', { name: 'Drop Iron Helm' }));
    expect(h.gameplay().itemCopies).toEqual([copy('h', 'helm', { where: { kind: 'location', id: 'yard' } })]);
    expect(within(carried()).getByText('You carry nothing.')).toBeInTheDocument();
  });

  it('drops one of a stack by default through its count', async () => {
    const h = renderRightPanel({}, stage([copy('c', 'coin', { quantity: 3 })]));
    await userEvent.click(await screen.findByRole('button', { name: 'Drop Coin' }));
    await userEvent.click(screen.getByRole('button', { name: 'Drop' }));
    expect(h.gameplay().itemCopies.map((c) => [c.where.kind, c.quantity])).toEqual([['you', 2], ['location', 1]]);
  });

  it('shows Drop and Give as unavailable on a Bound Item Copy', async () => {
    const h = renderRightPanel({}, stage([copy('k', 'crown')]));
    expect(await screen.findByRole('button', { name: 'Drop Old Crown: Bound' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Give Old Crown: Bound' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Equip Old Crown' })).toBeEnabled();
    expect(h.gameplay().itemCopies).toHaveLength(1);
  });

  it('turns every button off while a turn runs', async () => {
    const h = renderRightPanel({}, stage([copy('c', 'coin', { quantity: 2 }), copy('h', 'helm', { equipped: { slotId: 'head', order: 1 } })]));
    await screen.findByRole('button', { name: 'Give Coin' });
    act(() => h.gameplay().setIsWaitingForAI(true));
    const buttons = within(carried()).getAllByRole('button').filter((b) => b.getAttribute('aria-expanded') === null);
    expect(buttons.length).toBeGreaterThan(0);
    for (const button of buttons) expect(button).toBeDisabled();
    act(() => h.gameplay().setIsWaitingForAI(false));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Give Coin' })).toBeEnabled());
  });

  it('closes an open Give popover when a turn starts, so it cannot write mid-turn', async () => {
    const h = renderRightPanel({}, stage([copy('c', 'coin', { quantity: 2 })]));
    await userEvent.click(await screen.findByRole('button', { name: 'Give Coin' }));
    await screen.findByRole('list', { name: 'Give to' });
    act(() => h.gameplay().setIsWaitingForAI(true));
    await waitFor(() => expect(screen.queryByRole('list', { name: 'Give to' })).not.toBeInTheDocument());
    expect(h.gameplay().itemCopies).toEqual([copy('c', 'coin', { quantity: 2 })]);
  });

  it('leaves a hidden equipped item out of its slot display and count (Q112)', async () => {
    renderRightPanel({}, stage([
      copy('x', 'dagger', { visibility: 'hidden', equipped: { slotId: 'hand', order: 1 } }),
      copy('y', 'dagger', { equipped: { slotId: 'hand', order: 2 } }),
    ]));
    const hand = within(await screen.findByRole('region', { name: 'Your inventory' })).getByRole('listitem', { name: 'Hand' });
    expect(within(hand).getByText('1 of 2')).toBeInTheDocument();
    expect(within(hand).getAllByText('Dagger')).toHaveLength(1);
  });

  it('turns every button off on a past page', async () => {
    renderRightPanel({}, stage([copy('c', 'coin')], { page: 1 }));
    expect(await screen.findByRole('button', { name: 'Drop Coin' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Give Coin' })).toBeDisabled();
  });

  it('never shows a hidden Item Copy', async () => {
    renderRightPanel({}, stage([copy('c', 'coin'), copy('x', 'helm', { visibility: 'hidden' })]));
    await screen.findByRole('button', { name: 'Drop Coin' });
    expect(within(carried()).queryByText('Iron Helm')).not.toBeInTheDocument();
  });

  it('uses one Tonic from a stack of three, and sends the dose to the settle', async () => {
    const commit = vi.fn();
    renderRightPanel({ inventorySettle: { requirement: () => null, commit } }, stage([copy('t', 'tonic', { quantity: 3 })]));
    await userEvent.click(await screen.findByRole('button', { name: 'Use Tonic' }));
    const [copies, , , doses] = commit.mock.calls[0];
    expect(copies.map((c: ItemCopy) => c.quantity)).toEqual([2]);
    expect(doses).toEqual([{ itemId: 'tonic', where: you, hidden: false }]);
  });

  it('spends a charge on an equipped wand, and turns Use off at zero charges', async () => {
    const h = renderRightPanel({}, stage([copy('w', 'wand', { state: { charges: 1 }, equipped: { slotId: 'hand', order: 1 } })]));
    expect(await screen.findByText('1 of 3 charges')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Use Ash Wand' }));
    expect(mine(h.gameplay())[0].state).toEqual({ charges: 0 });
    expect(await screen.findByRole('button', { name: 'Use Ash Wand: no charges left' })).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Use Coin' })).not.toBeInTheDocument();
  });

  it('lists the running timed effects with the time left', async () => {
    renderRightPanel({
      inventorySettle: {
        requirement: () => null, commit: vi.fn(),
        timed: [{ key: 'k', itemName: 'Tonic', effect: 'Strength +2', hoursLeft: 4 / 3 }, { key: 'h', itemName: null, effect: 'Warded', hoursLeft: 26 }],
      },
    }, stage([copy('c', 'coin')]));
    const effects = await screen.findByRole('list', { name: 'Effects' });
    expect(within(effects).getAllByRole('listitem').map((li) => li.textContent)).toEqual([
      'TonicStrength +21 h 20 min left', 'An itemWarded1 d 2 h left',
    ]);
  });

  it('lists a runtime item by name and uses one from its stack (Q56)', async () => {
    const runtime: ItemCopy = { id: 'k', item: { kind: 'runtime', runtimeItemId: 'r1' }, where: you, quantity: 2, visibility: 'visible' };
    const h = renderRightPanel({}, {
      ...stage([runtime]),
      seed: (g: Gameplay) => {
        g.setCurrentLocation(yard);
        g.setRuntimeItems([{ id: 'r1', name: 'Moonleaf' }]);
        g.setItemCopies([runtime]);
        g.setActiveTab('inventory');
      },
    });
    expect(within(carried()).getByText('Moonleaf')).toBeInTheDocument();
    await userEvent.click(await screen.findByRole('button', { name: 'Use Moonleaf' }));
    expect(mine(h.gameplay()).map((c) => c.quantity)).toEqual([1]);
  });

  it('has no Inventory tab in a world without items', async () => {
    renderRightPanel({}, { world: { entities, locations: [yard] }, turns });
    await screen.findByRole('tab', { name: 'Traits' });
    expect(screen.queryByRole('tab', { name: 'Inventory' })).not.toBeInTheDocument();
  });
});
