import { describe, expect, it, vi } from 'vitest';
import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderInGame, renderRightPanel, type Gameplay, type TurnFixture } from '@/test/gamePanels';
import { useInventoryPanel } from './useInventoryPanel';
import type { InventoryTabProps } from './InventoryTab';
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
  item('tonic', 'Tonic', { uses: 1 }),
  item('wand', 'Ash Wand', { uses: 3, whenEmpty: { kind: 'stays' }, stackable: false, slotId: 'hand' }),
  item('horn', 'War Horn', { statEffects: [{ id: 'h', statId: 'nerve', facet: 'value', timing: 'used', amount: 1, op: 'add' }] }),
  item('lamp', 'Oil Lamp', { uses: 1, whenEmpty: { kind: 'stays' } }),
  item('ring', 'Ring of Curses', { unidentifiedName: 'Plain Ring', slotId: 'hand', statEffects: [{ id: 'r', statId: 'nerve', facet: 'value', timing: 'used', amount: -1, op: 'add' }] }),
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
/** `inScene` names who took part in the latest turn, which puts them In Scene when they stand here. */
const stage = (copies: ItemCopy[], over: { page?: number; inScene?: string[]; met?: string[] } = {}) => ({
  world: { items, slots, entities, locations: [yard, hall] },
  turns: over.inScene ? [turns[0], { ...turns[1], entities: over.inScene }] : turns,
  ...(over.page !== undefined && { page: over.page }),
  seed: (g: Gameplay) => {
    g.setCurrentLocation(yard);
    g.setItemCopies(copies);
    g.setActiveTab('inventory');
    if (over.met) g.setMetEntities(over.met);
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

  it('gives a count of the stack to an entity in scene', async () => {
    const h = renderRightPanel({}, stage([copy('c', 'coin', { quantity: 5 })], { inScene: ['Bram'] }));
    await userEvent.click(await screen.findByRole('button', { name: 'Give Coin' }));
    const list = await screen.findByRole('list', { name: 'Give to' });
    expect(within(list).getAllByRole('button').map((b) => b.textContent)).toEqual(['Bram']);
    const count = screen.getByRole('spinbutton', { name: 'Quantity' });
    await userEvent.clear(count);
    await userEvent.type(count, '2');
    await userEvent.click(within(list).getByRole('button', { name: 'Bram' }));
    expect(h.gameplay().itemCopies.map((c) => [c.where, c.quantity])).toEqual([[you, 3], [{ kind: 'entity', id: 'bram' }, 2]]);
  });

  it('offers only the entities in scene, never a quiet one here or one named from the hall', async () => {
    const crowd = [...entities, { id: 'ilsa', name: 'Ilsa', locations: ['yard'] }, { id: 'odo', name: 'Odo', locations: ['hall'] }] as Entity[];
    renderRightPanel(
      {},
      { ...stage([copy('c', 'coin')], { inScene: ['Ilsa', 'Odo'] }), world: { items, slots, entities: crowd, locations: [yard, hall] } },
    );
    await userEvent.click(await screen.findByRole('button', { name: 'Give Coin' }));
    const list = await screen.findByRole('list', { name: 'Give to' });
    // Bram stands here but took no part; Odo took part but stands in the hall.
    expect(within(list).getAllByRole('button').map((b) => b.textContent)).toEqual(['Ilsa']);
  });

  it('says nobody is in the scene when people stand here but none took part', async () => {
    renderRightPanel({}, stage([copy('c', 'coin')]));
    await userEvent.click(await screen.findByRole('button', { name: 'Give Coin' }));
    expect(await screen.findByText('Nobody is in the scene.')).toBeInTheDocument();
    expect(screen.queryByRole('list', { name: 'Give to' })).toBeNull();
  });

  describe('the panel write guard', () => {
    const crowd = [...entities, { id: 'ilsa', name: 'Ilsa', locations: ['yard'] }] as Entity[];
    const give = (to: string) => [{ kind: 'transfer' as const, copyId: 'c', to: { kind: 'entity' as const, id: to }, quantity: 1 }];
    const probe = () => {
      let panel!: InventoryTabProps;
      const Probe = () => { panel = useInventoryPanel(); return null; };
      const h = renderInGame(<Probe />, { ...stage([copy('c', 'coin')], { inScene: ['Ilsa'] }), world: { items, slots, entities: crowd, locations: [yard, hall] } });
      return { h, ops: (to: string) => act(() => panel.onOps(give(to))) };
    };

    it('refuses a give to a quiet entity that stands here', async () => {
      const { h, ops } = probe();
      await waitFor(() => expect(h.gameplay().itemCopies).toHaveLength(1));
      ops('bram');
      expect(h.gameplay().itemCopies.map((c) => c.where)).toEqual([you]);
    });

    it('applies a give to an entity in scene', async () => {
      const { h, ops } = probe();
      await waitFor(() => expect(h.gameplay().itemCopies).toHaveLength(1));
      ops('ilsa');
      expect(h.gameplay().itemCopies.map((c) => c.where)).toEqual([{ kind: 'entity', id: 'ilsa' }]);
    });
  });

  describe('a stranger', () => {
    const withStranger = (strangerName: string | undefined, over: Partial<Entity> = {}) => ({
      ...stage([copy('c', 'coin')], { inScene: ['Sylvie Thornwhistle'] }),
      world: {
        items, slots, locations: [yard, hall],
        entities: [{ id: 'sylvie', name: 'Sylvie Thornwhistle', locations: ['yard'], ...(strangerName !== undefined && { strangerName }), ...over }] as Entity[],
      },
    });

    it('is offered by the Stranger Name and never by the true name', async () => {
      const h = renderRightPanel({}, withStranger('a hooded figure'));
      await userEvent.click(await screen.findByRole('button', { name: 'Give Coin' }));
      const list = await screen.findByRole('list', { name: 'Give to' });
      expect(within(list).getAllByRole('button').map((b) => b.textContent)).toEqual(['a hooded figure']);
      expect(screen.queryByText('Sylvie Thornwhistle')).toBeNull();
      await userEvent.click(within(list).getByRole('button', { name: 'a hooded figure' }));
      expect(h.gameplay().itemCopies[0].where).toEqual({ kind: 'entity', id: 'sylvie' });
    });

    it('is offered under its true name once met', async () => {
      renderRightPanel({}, {
        ...withStranger('a hooded figure'),
        ...stage([copy('c', 'coin')], { inScene: ['Sylvie Thornwhistle'], met: ['sylvie'] }),
        world: withStranger('a hooded figure').world,
      });
      await userEvent.click(await screen.findByRole('button', { name: 'Give Coin' }));
      expect(within(await screen.findByRole('list', { name: 'Give to' })).getAllByRole('button').map((b) => b.textContent)).toEqual(['Sylvie Thornwhistle']);
    });

    it('is not offered with no label', async () => {
      renderRightPanel({}, withStranger(' '));
      await userEvent.click(await screen.findByRole('button', { name: 'Give Coin' }));
      expect(await screen.findByText('Nobody is in the scene.')).toBeInTheDocument();
    });
  });

  it('gives a whole stack with All', async () => {
    const h = renderRightPanel({}, stage([copy('c', 'coin', { quantity: 5 })], { inScene: ['Bram'] }));
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
    const h = renderRightPanel({}, stage([copy('c', 'coin', { quantity: 2 })], { inScene: ['Bram'] }));
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

  it('uses one Tonic from a stack of three, and sends the use to the settle', async () => {
    const commit = vi.fn();
    renderRightPanel({ inventorySettle: { requirement: () => null, commit } }, stage([copy('t', 'tonic', { quantity: 3 })]));
    await userEvent.click(await screen.findByRole('button', { name: 'Use Tonic' }));
    const [copies, , , itemUses] = commit.mock.calls[0];
    expect(copies.map((c: ItemCopy) => c.quantity)).toEqual([2]);
    expect(itemUses).toEqual([{ itemId: 'tonic', where: you, hidden: false }]);
  });

  it('spends a use on an equipped wand, and turns Use off at zero uses', async () => {
    const h = renderRightPanel({}, stage([copy('w', 'wand', { state: { uses: 1 }, equipped: { slotId: 'hand', order: 1 } })]));
    expect(await screen.findByText('1 of 3 uses')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Use Ash Wand' }));
    expect(mine(h.gameplay())[0].state).toEqual({ uses: 0 });
    expect(await screen.findByRole('button', { name: 'Use Ash Wand: no uses left' })).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Use Coin' })).not.toBeInTheDocument();
  });

  it('shows Use on an item with After Use effects and no Uses, with no uses line (Q20)', async () => {
    renderRightPanel({}, stage([copy('h', 'horn')]));
    expect(await screen.findByRole('button', { name: 'Use War Horn' })).toBeEnabled();
    expect(within(carried()).queryByText(/uses/)).not.toBeInTheDocument();
  });

  it('shows an unidentified copy by its unidentified name everywhere in the tab, and sends the use unidentified (Q17)', async () => {
    const commit = vi.fn();
    renderRightPanel({ inventorySettle: { requirement: () => null, commit } }, stage([copy('r', 'ring', { state: { unidentified: true } })]));
    expect(await within(carried()).findByText('Plain Ring')).toBeInTheDocument();
    expect(screen.queryByText(/Ring of Curses/)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Ring of Curses/ })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Use Plain Ring' }));
    expect(commit.mock.calls[0][3]).toEqual([{ itemId: 'ring', where: you, hidden: false, unidentified: true }]);
  });

  it('shows no uses line on a full Uses 1 stack, and No uses left on a spent copy (Q30)', async () => {
    renderRightPanel({}, stage([copy('l', 'lamp', { quantity: 2 }), copy('s', 'lamp', { state: { uses: 0 } })]));
    expect(await screen.findByText('No uses left')).toBeInTheDocument();
    expect(within(carried()).getAllByText(/uses/)).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'Use Oil Lamp: no uses left' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Use Oil Lamp' })).toBeEnabled();
  });

  it('shows each copy’s State beside its name, with no control to change it (Q3, Q13)', async () => {
    renderRightPanel({}, stage([copy('l', 'lamp', { state: { state: 'lit' } }), copy('u', 'lamp', { quantity: 2, state: { state: 'unlit' } })]));
    const rows = within(await screen.findByRole('region', { name: 'Your inventory' })).getAllByRole('listitem')
      .filter((li) => li.textContent?.includes('Oil Lamp'));
    expect(rows.map((li) => within(li).getByText(/^(lit|unlit)$/).textContent)).toEqual(['lit', 'unlit']);
    expect(within(carried()).queryByRole('textbox')).not.toBeInTheDocument();
    expect(within(carried()).queryByRole('button', { name: /state/i })).not.toBeInTheDocument();
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

  it('shows a runtime item’s description under its name (Q146)', async () => {
    const runtime: ItemCopy = { id: 'k', item: { kind: 'runtime', runtimeItemId: 'r1' }, where: you, quantity: 1, visibility: 'visible' };
    renderRightPanel({}, {
      ...stage([runtime]),
      seed: (g: Gameplay) => {
        g.setCurrentLocation(yard);
        g.setRuntimeItems([{ id: 'r1', name: 'Moonleaf', description: 'A pale leaf.' }]);
        g.setItemCopies([runtime]);
        g.setActiveTab('inventory');
      },
    });
    expect(await within(carried()).findByText('A pale leaf.')).toBeInTheDocument();
  });

  it('has no Inventory tab in a world without items', async () => {
    renderRightPanel({}, { world: { entities, locations: [yard] }, turns });
    await screen.findByRole('tab', { name: 'Traits' });
    expect(screen.queryByRole('tab', { name: 'Inventory' })).not.toBeInTheDocument();
  });
});
