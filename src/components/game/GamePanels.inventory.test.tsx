import { describe, expect, it, vi } from 'vitest';
import { bodyFixture } from '@/test/bodyFixture';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderInGame, renderRightPanel, type Gameplay, type TurnFixture } from '@/test/gamePanels';
import { usePresence } from '@/lib/usePresence';
import type { Presence } from '@/lib/presence';
import { useInventoryPanel } from './useInventoryPanel';
import { InventoryTab, type InventoryTabProps } from './InventoryTab';
import type { Entity, GameLocation, Body, Item, ItemCopy, Slot } from '@/types';

vi.mock('@/views/VRMViewer', () => import('@/test/stubs/vrmViewer'));
vi.mock('@/lib/useTtsPlayback', () => import('@/test/stubs/ttsPlayback'));

const item = (id: string, name: string, over: Partial<Item> = {}): Item =>
  ({ id, name, statEffects: [], traitEffects: [], equipRequires: [], ...over });
const slots: Slot[] = [{ id: 'hand', name: 'Hand' }, { id: 'head', name: 'Head' }, { id: 'tail', name: 'Tail' }];
const bodies: Body[] = [bodyFixture({ id: 'humanoid', name: 'Humanoid', entries: [{ slotId: 'hand', capacity: 2 }, { slotId: 'head' }] })];
const items = [
  item('dagger', 'Dagger', { slotRule: { mode: 'either', slotIds: ['hand'] } }),
  item('helm', 'Iron Helm', { stackable: false, slotRule: { mode: 'either', slotIds: ['head'] } }),
  item('crown', 'Old Crown', { stackable: false, slotRule: { mode: 'either', slotIds: ['head'] }, bound: true }),
  item('coin', 'Coin'),
  item('torch', 'Torch', { stackable: false, slotRule: { mode: 'either', slotIds: ['head', 'hand'] } }),
  item('whip', 'Whip', { stackable: false, slotRule: { mode: 'either', slotIds: ['tail', 'hand'] } }),
  item('halberd', 'Halberd', { stackable: false, slotRule: { mode: 'all', slotIds: ['hand', 'head'] } }),
  item('barb', 'Barb', { stackable: false, slotRule: { mode: 'all', slotIds: ['hand', 'tail'] } }),
  item('spike', 'Spike', { stackable: false, slotRule: { mode: 'either', slotIds: ['tail'] } }),
  item('tonic', 'Tonic', { uses: 1 }),
  item('wand', 'Ash Wand', { uses: 3, whenEmpty: { kind: 'stays' }, stackable: false, slotRule: { mode: 'either', slotIds: ['hand'] } }),
  item('horn', 'War Horn', { statEffects: [{ id: 'h', statId: 'nerve', facet: 'value', timing: 'used', amount: 1, op: 'add' }] }),
  item('lamp', 'Oil Lamp', { uses: 1, whenEmpty: { kind: 'stays' } }),
  item('ring', 'Ring of Curses', { unidentifiedName: 'Plain Ring', slotRule: { mode: 'either', slotIds: ['hand'] }, statEffects: [{ id: 'r', statId: 'nerve', facet: 'value', timing: 'used', amount: -1, op: 'add' }] }),
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
  world: { items, slots, bodies, entities, locations: [yard, hall] },
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
const dollBoxes = () => within(screen.getByRole('group', { name: 'Equipped' })).getAllByRole('button').map((b) => b.getAttribute('aria-label'));

describe('RightPanel — the selected entity on the Inventory tab', () => {
  const onBram = (id: string, itemId: string, over: Partial<ItemCopy> = {}) => copy(id, itemId, { where: { kind: 'entity', id: 'bram' }, ...over });
  const picker = () => screen.queryByRole('combobox', { name: 'Selected entity' });
  const bramCard = () => screen.queryByRole('region', { name: 'Bram inventory' });
  const inScene = { inScene: ['Bram'], met: ['bram'] };

  it('lists what the entity visibly wears, between the player’s card and the location’s, with no actions', async () => {
    renderRightPanel({}, stage([
      onBram('w', 'torch', { equipped: { slotId: 'hand', order: 0 } }),
      onBram('h', 'whip', { equipped: { slotId: 'hand', order: 0 }, visibility: 'hidden' }),
      onBram('c', 'tonic'),
    ], inScene));
    const card = await screen.findByRole('region', { name: 'Bram inventory' });
    expect(within(card).getByText('Torch')).toBeInTheDocument();
    expect(within(card).queryByText('Whip')).toBeNull();
    expect(within(card).queryByText('Tonic')).toBeNull();
    expect(within(card).queryByRole('button', { name: /Equip|Give|Drop/ })).toBeNull();
    const order = screen.getAllByRole('region').map((r) => r.getAttribute('aria-label')).filter((label) => label !== 'Equipped');
    expect(order).toEqual(['Your inventory', 'Bram inventory', 'Here']);
    expect(picker()).toHaveTextContent('Bram');
  });

  it('hides the card under (None)', async () => {
    renderRightPanel({}, stage([onBram('w', 'torch', { equipped: { slotId: 'hand', order: 0 } })], inScene));
    await userEvent.click(await screen.findByRole('combobox', { name: 'Selected entity' }));
    await userEvent.click(await screen.findByRole('option', { name: '(None)' }));
    expect(bramCard()).toBeNull();
  });

  it('adds no picker and no card when no listed entity visibly wears anything', async () => {
    renderRightPanel({}, stage([onBram('c', 'tonic'), onBram('h', 'whip', { equipped: { slotId: 'hand', order: 0 }, visibility: 'hidden' })], inScene));
    await screen.findByRole('region', { name: 'Your inventory' });
    expect(picker()).toBeNull();
    expect(bramCard()).toBeNull();
  });

  it('adds no picker for an entity out of the scene', async () => {
    renderRightPanel({}, stage([onBram('w', 'torch', { equipped: { slotId: 'hand', order: 0 } })], { met: ['bram'] }));
    await screen.findByRole('region', { name: 'Your inventory' });
    expect(picker()).toBeNull();
    expect(bramCard()).toBeNull();
  });
});

describe('RightPanel — Inventory tab', () => {
  it('offers one Equip choice per allowed slot in the item order, and equips into the one picked', async () => {
    const h = renderRightPanel({}, stage([copy('t', 'torch')]));
    await userEvent.click(await screen.findByRole('button', { name: 'Equip Torch' }));
    const choices = within(await screen.findByRole('list', { name: 'Equip in' })).getAllByRole('button');
    expect(choices.map((c) => c.textContent)).toEqual(['Head', 'Hand']);
    await userEvent.click(choices[1]);
    expect(mine(h.gameplay())[0].equipped?.slotId).toBe('hand');
  });

  it('equips at once when the Body leaves one allowed slot, and for All of', async () => {
    const h = renderRightPanel({}, stage([copy('w', 'whip'), copy('a', 'halberd')]));
    await userEvent.click(await screen.findByRole('button', { name: 'Equip Whip' }));
    expect(screen.queryByRole('list', { name: 'Equip in' })).toBeNull();
    expect(mine(h.gameplay()).find((c) => c.id === 'w')?.equipped?.slotId).toBe('hand');
    await userEvent.click(await screen.findByRole('button', { name: 'Equip Halberd' }));
    expect(screen.queryByRole('list', { name: 'Equip in' })).toBeNull();
    expect(mine(h.gameplay()).find((c) => c.id === 'a')?.equipped?.slotId).toBe('hand');
  });

  it('offers Unequip and no Equip on a copy whose stored slot the Body lacks', async () => {
    renderRightPanel({}, stage([copy('w', 'whip', { equipped: { slotId: 'tail', order: 1 } })]));
    await screen.findByRole('button', { name: 'Unequip Whip' });
    expect(screen.queryByRole('button', { name: 'Equip Whip' })).toBeNull();
  });

  it("offers no Equip when the Body can't hold the rule", async () => {
    renderRightPanel({}, stage([copy('b', 'barb'), copy('s', 'spike')]));
    await screen.findByRole('button', { name: 'Drop Barb' });
    expect(screen.queryByRole('button', { name: 'Equip Barb' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Equip Spike' })).toBeNull();
  });

  it('draws an All of item in every slot it occupies, and one Unequip takes it off whole', async () => {
    const h = renderRightPanel({}, stage([copy('a', 'halberd', { equipped: { slotId: 'hand', order: 1 } })]));
    await screen.findByRole('group', { name: 'Equipped' });
    expect(dollBoxes()).toEqual(['Hand 1: Halberd', 'Hand 2: Empty', 'Head: Halberd']);
    await userEvent.click(screen.getByRole('button', { name: 'Head: Halberd' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Unequip Halberd' }));
    expect(mine(h.gameplay())[0].equipped).toBeUndefined();
    expect(dollBoxes()).toEqual(['Hand 1: Empty', 'Hand 2: Empty', 'Head: Empty']);
  });

  it('equips one dagger from a stack of five at once and leaves four carried', async () => {
    const h = renderRightPanel({}, stage([copy('d', 'dagger', { quantity: 5 })]));
    await userEvent.click(await screen.findByRole('button', { name: 'Equip Dagger' }));
    expect(mine(h.gameplay()).map((c) => [c.quantity, c.equipped?.slotId])).toEqual([[4, undefined], [1, 'hand']]);
    expect(dollBoxes()).toEqual(['Hand 1: Dagger', 'Hand 2: Empty', 'Head: Empty']);
    expect(within(carried()).getByText('×4')).toBeInTheDocument();
  });

  describe('the figure', () => {
    it('fills a slot by equip order, and reflows after an unequip with the popover closed', async () => {
      const h = renderRightPanel({}, stage([
        copy('late', 'wand', { equipped: { slotId: 'hand', order: 2 } }),
        copy('early', 'dagger', { equipped: { slotId: 'hand', order: 1 } }),
      ]));
      await screen.findByRole('group', { name: 'Equipped' });
      expect(dollBoxes()).toEqual(['Hand 1: Dagger', 'Hand 2: Ash Wand', 'Head: Empty']);
      await userEvent.click(screen.getByRole('button', { name: 'Hand 1: Dagger' }));
      await userEvent.click(await screen.findByRole('button', { name: 'Unequip Dagger' }));
      expect(mine(h.gameplay()).find((c) => c.id === 'early')?.equipped).toBeUndefined();
      expect(dollBoxes()).toEqual(['Hand 1: Ash Wand', 'Hand 2: Empty', 'Head: Empty']);
      await waitFor(() => expect(screen.queryByRole('button', { name: 'Unequip Ash Wand' })).toBeNull());
    });

    it('carries a copy with no box left, where it unequips', async () => {
      renderRightPanel({}, stage([
        copy('a', 'dagger', { equipped: { slotId: 'hand', order: 1 } }),
        copy('b', 'wand', { equipped: { slotId: 'hand', order: 2 } }),
        copy('c', 'torch', { equipped: { slotId: 'hand', order: 3 } }),
      ]));
      await screen.findByRole('group', { name: 'Equipped' });
      expect(dollBoxes()).toEqual(['Hand 1: Dagger', 'Hand 2: Ash Wand', 'Head: Empty']);
      expect(screen.getByRole('button', { name: 'Unequip Torch' })).toBeInTheDocument();
    });

    it('shows the slot name on a tap of an empty box and no text before it', async () => {
      renderRightPanel({}, stage([]));
      const doll = await screen.findByRole('group', { name: 'Equipped' });
      expect(doll).toHaveTextContent('');
      await userEvent.click(screen.getByRole('button', { name: 'Head: Empty' }));
      expect(await within(doll).findByRole('status')).toHaveTextContent('Head');
    });

    it('swaps with the Body in force', async () => {
      const worn: Body[] = [bodies[0], bodyFixture({ id: 'hound', name: 'Hound', entries: [{ slotId: 'tail' }] })];
      const world = (pick?: Entity['body']) => ({
        ...stage([]),
        world: { items, slots, bodies: worn, locations: [yard, hall], entities: [{ id: 'me', name: 'Me', locations: [], customPersona: true, ...(pick && { body: pick }) } as Entity] },
      });
      const first = renderRightPanel({}, world());
      await screen.findByRole('group', { name: 'Equipped' });
      expect(dollBoxes()).toEqual(['Hand 1: Empty', 'Hand 2: Empty', 'Head: Empty']);
      first.unmount();
      renderRightPanel({}, world({ kind: 'body', id: 'hound' }));
      await screen.findByRole('group', { name: 'Equipped' });
      expect(dollBoxes()).toEqual(['Tail: Empty']);
    });

    describe('with images', () => {
      const body: Body = { id: 'b', name: 'B', backdrop: { kind: 'plain' }, aspect: 1, entries: [{ slotId: 'hand', boxes: [{ x: 0, y: 0, w: 0.5, h: 0.5 }] }, { slotId: 'head', boxes: [{ x: 0.5, y: 0, w: 0.5, h: 0.25 }] }] };
      const tab = (imageOf: (c: ItemCopy) => string | undefined): InventoryTabProps => ({
        ownerName: null, copies: [copy('a', 'halberd', { equipped: { slotId: 'hand', order: 1 } })], lying: [], items: items.map((i) => (i.id === 'halberd' ? { ...i, icon: 'none' } : i)), body,
        slots: [{ slot: slots[0], capacity: 1 }, { slot: slots[1], capacity: 1 }], worldSlots: slots, present: [], locationId: 'yard', disabled: false, resolveText: (t) => t, imageOf, onOps: vi.fn(),
      });
      const loaded = (img: Element, width: number, height: number) => {
        Object.defineProperty(img, 'naturalWidth', { value: width });
        Object.defineProperty(img, 'naturalHeight', { value: height });
        fireEvent.load(img);
      };

      it('draws an All of image in each box, each frame at the image aspect', async () => {
        renderInGame(<InventoryTab {...tab(() => 'staff.png')} />);
        const hand = await screen.findByRole('button', { name: 'Hand: Halberd' });
        const head = screen.getByRole('button', { name: 'Head: Halberd' });
        loaded(hand.querySelector('img')!, 240, 720);
        loaded(head.querySelector('img')!, 720, 240);
        expect(parseFloat(hand.style.width)).toBeCloseTo(100 / 3);
        expect(hand.style.height).toBe('100%');
        expect(head.style.width).toBe('100%');
        // A 2:1 box holds a 3:1 image at two thirds of its height.
        expect(parseFloat(head.style.height)).toBeCloseTo(200 / 3);
        expect(hand).not.toHaveTextContent('Halberd');
      });

      it('leaves a plain filled box when the image fails', async () => {
        renderInGame(<InventoryTab {...tab(() => 'gone.png')} />);
        fireEvent.error((await screen.findByRole('button', { name: 'Hand: Halberd' })).querySelector('img')!);
        const hand = screen.getByRole('button', { name: 'Hand: Halberd' });
        expect(hand).toHaveTextContent('');
        expect(hand.querySelector('img')).toBeNull();
        expect(hand.querySelector('svg')).toBeNull();
        expect(hand.style.width).toBe('100%');
      });
    });
  });

  it('swaps out the helm equipped longest when the slot is full', async () => {
    const h = renderRightPanel({}, stage([copy('old', 'helm', { equipped: { slotId: 'head', order: 1 } }), copy('new', 'helm')]));
    const [equip] = await screen.findAllByRole('button', { name: 'Equip Iron Helm' });
    await userEvent.click(equip);
    expect(mine(h.gameplay()).map((c) => [c.id, !!c.equipped])).toEqual([['old', false], ['new', true]]);
  });

  describe("the played Persona's Body in force", () => {
    const withBody = (copies: ItemCopy[], body: Body | undefined, pick?: Entity['body']) => ({
      ...stage(copies),
      world: {
        items, slots, bodies: body ? [body] : [], locations: [yard, hall],
        entities: [...entities, { id: 'me', name: 'Me', locations: [], customPersona: true, ...(pick && { body: pick }) } as Entity],
      },
    });

    it("draws the Body's boxes in its entry order", async () => {
      const headFirst: Body = bodyFixture({ id: 'b', name: 'B', entries: [{ slotId: 'head' }, { slotId: 'hand', capacity: 2 }] });
      renderRightPanel({}, withBody([], headFirst));
      await screen.findByText('Equipped');
      expect(dollBoxes()).toEqual(['Head: Empty', 'Hand 1: Empty', 'Hand 2: Empty']);
    });

    it('draws no figure for a Body with no boxes, and carries what it wore', async () => {
      const bare: Body = bodyFixture({ id: 'b', name: 'B', entries: [] });
      renderRightPanel({}, withBody([copy('h', 'helm', { equipped: { slotId: 'head', order: 1 } })], bare));
      await within(await screen.findByRole('region', { name: /inventory$/ })).findByText('Iron Helm');
      expect(screen.queryByText('Equipped')).toBeNull();
      expect(screen.queryByRole('group', { name: 'Equipped' })).toBeNull();
    });

    it('shows no slots and offers no Equip under None', async () => {
      renderRightPanel({}, withBody([copy('h', 'helm')], bodies[0], { kind: 'none' }));
      await screen.findByText('Iron Helm');
      expect(screen.queryByText('Equipped')).toBeNull();
      expect(screen.queryByRole('button', { name: 'Equip Iron Helm' })).toBeNull();
    });

    it('shows an item equipped in a slot the Body lacks under Carried, where it unequips (Q35)', async () => {
      const handsOnly: Body = bodyFixture({ id: 'b', name: 'B', entries: [{ slotId: 'hand', capacity: 2 }] });
      const h = renderRightPanel({}, withBody([copy('h', 'helm', { equipped: { slotId: 'head', order: 1 } })], handsOnly));
      await userEvent.click(await screen.findByRole('button', { name: 'Unequip Iron Helm' }));
      expect(mine(h.gameplay())[0].equipped).toBeUndefined();
    });
  });

  it('unequips an item into the carried list', async () => {
    const h = renderRightPanel({}, stage([copy('h', 'helm', { equipped: { slotId: 'head', order: 1 } })]));
    await userEvent.click(await screen.findByRole('button', { name: 'Head: Iron Helm' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Unequip Iron Helm' }));
    expect(mine(h.gameplay())[0].equipped).toBeUndefined();
    expect(screen.getByRole('button', { name: 'Head: Empty' })).toBeInTheDocument();
    expect(within(carried()).getByRole('button', { name: 'Equip Iron Helm' })).toBeInTheDocument();
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
      { ...stage([copy('c', 'coin')], { inScene: ['Ilsa', 'Odo'] }), world: { items, slots, bodies, entities: crowd, locations: [yard, hall] } },
    );
    await userEvent.click(await screen.findByRole('button', { name: 'Give Coin' }));
    const list = await screen.findByRole('list', { name: 'Give to' });
    // Bram stands here but took no part; Odo took part but stands in the hall.
    expect(within(list).getAllByRole('button').map((b) => b.textContent)).toEqual(['Ilsa']);
  });

  it('says nobody is in the scene when people stand here but none took part', async () => {
    renderRightPanel({}, stage([copy('c', 'coin')]));
    await userEvent.click(await screen.findByRole('button', { name: 'Give Coin' }));
    expect(await screen.findByText('No entities are in the scene.')).toBeInTheDocument();
    expect(screen.queryByRole('list', { name: 'Give to' })).toBeNull();
  });

  describe('the panel write guard', () => {
    const crowd = [...entities, { id: 'ilsa', name: 'Ilsa', locations: ['yard'] }] as Entity[];
    const give = (to: string) => [{ kind: 'transfer' as const, copyId: 'c', to: { kind: 'entity' as const, id: to }, quantity: 1 }];
    const probe = () => {
      let panel!: InventoryTabProps;
      const Probe = () => { panel = useInventoryPanel(); return null; };
      const h = renderInGame(<Probe />, { ...stage([copy('c', 'coin')], { inScene: ['Ilsa'] }), world: { items, slots, bodies, entities: crowd, locations: [yard, hall] } });
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

  describe('an invented character', () => {
    const invented = { id: 'rune', name: 'Rune', description: 'A drifter.' } as Entity;
    const stageInvented = () => ({
      ...stage([copy('c', 'coin')], { inScene: ['Rune'] }),
      seed: (g: Gameplay) => {
        g.setCurrentLocation(yard);
        g.setItemCopies([copy('c', 'coin')]);
        g.setActiveTab('inventory');
        g.setDiscoveredEntities([{ entity: invented, locationId: 'yard', sourceTurnId: 't1' }]);
      },
    });

    it('stands at its recorded place, so it is in Look Around and In Scene', async () => {
      let presence!: Presence;
      const Probe = () => { presence = usePresence(); return null; };
      renderInGame(<Probe />, stageInvented());
      await waitFor(() => expect(presence.lookAround.map((r) => r.entity.id)).toContain('rune'));
      expect(presence.inScene.map((r) => r.entity.id)).toEqual(['rune']);
    });

    it('is offered in Give', async () => {
      renderRightPanel({}, stageInvented());
      await userEvent.click(await screen.findByRole('button', { name: 'Give Coin' }));
      const list = await screen.findByRole('list', { name: 'Give to' });
      expect(within(list).getAllByRole('button').map((b) => b.textContent)).toEqual(['Rune']);
    });
  });

  describe('a stranger', () => {
    const withStranger = (strangerName: string | undefined, over: Partial<Entity> = {}) => ({
      ...stage([copy('c', 'coin')], { inScene: ['Sylvie Thornwhistle'] }),
      world: {
        items, slots, bodies, locations: [yard, hall],
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
      expect(await screen.findByText('No entities are in the scene.')).toBeInTheDocument();
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
    expect(screen.getByRole('button', { name: 'Give Coin' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Drop Coin' })).toBeDisabled();
    // A figure's box only reads: its popover's actions are what turn off.
    await userEvent.click(screen.getByRole('button', { name: 'Head: Iron Helm' }));
    expect(await screen.findByRole('button', { name: 'Unequip Iron Helm' })).toBeDisabled();
    await userEvent.keyboard('{Escape}');
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

  it('draws a hidden equipped item in no box (Q112)', async () => {
    renderRightPanel({}, stage([
      copy('x', 'dagger', { visibility: 'hidden', equipped: { slotId: 'hand', order: 1 } }),
      copy('y', 'dagger', { equipped: { slotId: 'hand', order: 2 } }),
    ]));
    await screen.findByRole('group', { name: 'Equipped' });
    expect(dollBoxes()).toEqual(['Hand 1: Dagger', 'Hand 2: Empty', 'Head: Empty']);
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
    await userEvent.click(await screen.findByRole('button', { name: 'Hand 1: Ash Wand' }));
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
