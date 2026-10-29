import { describe, expect, it, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderRightPanel, renderInGame, type Gameplay } from '@/test/gamePanels';
import { EntityEquipped } from './EntityEquipped';
import type { Entity, GameLocation, Item, ItemCopy, Slot } from '@/types';

vi.mock('@/views/VRMViewer', () => import('@/test/stubs/vrmViewer'));
vi.mock('@/lib/useTtsPlayback', () => import('@/test/stubs/ttsPlayback'));

const PLAIN = 'data:image/png;base64,UExBSU4=';
const CURSED = 'data:image/png;base64,Q1VSU0Vk=';
const item = (id: string, name: string, over: Partial<Item> = {}): Item =>
  ({ id, name, statEffects: [], traitEffects: [], equipRequires: [], ...over });
const slots: Slot[] = [{ id: 'hand', name: 'Hand' }];
const items = [
  item('coin', 'Coin'),
  item('dagger', 'Dagger', { slotId: 'hand', stackable: false }),
  item('crown', 'Old Crown', { stackable: false, bound: true }),
  // Shows the cursed art while the owner also owns the Coin.
  item('ring', 'Silver Ring', {
    images: [{ data: CURSED, requires: [{ all: [{ kind: 'item', id: 'coin', status: 'owned' }] }] }, { data: PLAIN }],
  }),
];
const yard = { id: 'yard', name: 'Yard' } as GameLocation;
const hall = { id: 'hall', name: 'Hall' } as GameLocation;
const bram = { id: 'bram', name: 'Bram', locations: ['yard'] } as Entity;
const you = { kind: 'you' } as const;
const at = (id: string) => ({ kind: 'location', id }) as const;
const copy = (id: string, itemId: string, over: Partial<ItemCopy> = {}): ItemCopy =>
  ({ id, item: { kind: 'item', itemId }, where: you, quantity: 1, visibility: 'visible', ...over });

const stage = (copies: ItemCopy[]) => ({
  world: { items, slots, entities: [bram], locations: [yard, hall] },
  turns: [{ narration: 'One.', turnId: 't1' }],
  seed: (g: Gameplay) => {
    g.setCurrentLocation(yard);
    g.setItemCopies(copies);
    g.setActiveTab('inventory');
  },
});

const region = () => screen.getByRole('region', { name: 'Your inventory' });

describe('Inventory tab — Here', () => {
  it('lists the visible Item Copies lying at the location and omits hidden ones and other places', async () => {
    renderRightPanel({}, stage([
      copy('a', 'coin', { where: at('yard'), quantity: 4 }),
      copy('b', 'dagger', { where: at('yard'), visibility: 'hidden' }),
      copy('c', 'dagger', { where: at('hall') }),
      copy('d', 'coin'),
    ]));
    const here = await screen.findByRole('list', { name: 'Lying here' });
    expect(within(here).getAllByRole('listitem').map((li) => li.textContent)).toEqual(['Coin×4']);
    expect(within(region()).queryByText('Dagger')).not.toBeInTheDocument();
  });

  it("draws what lies here in its own card, named for the location, outside the player's card", async () => {
    renderRightPanel({}, stage([copy('a', 'coin', { where: at('yard') })]));
    const card = await screen.findByRole('region', { name: 'Here' });
    expect(within(card).getByRole('button', { name: 'Yard' })).toBeInTheDocument();
    expect(region()).not.toContainElement(card);
    expect(within(region()).queryByText('Coin')).not.toBeInTheDocument();
  });

  it('picks up a single Item Copy at once, and one of a stack through its count', async () => {
    const h = renderRightPanel({}, stage([copy('a', 'dagger', { where: at('yard') }), copy('b', 'coin', { where: at('yard'), quantity: 3 })]));
    await userEvent.click(await screen.findByRole('button', { name: 'Pick Up Dagger' }));
    expect(h.gameplay().itemCopies.find((c) => c.id === 'a')?.where).toEqual(you);
    await userEvent.click(screen.getByRole('button', { name: 'Pick Up Coin' }));
    await userEvent.click(screen.getByRole('button', { name: 'Pick Up' }));
    expect(h.gameplay().itemCopies.filter((c) => c.item.kind === 'item' && c.item.itemId === 'coin').map((c) => [c.where.kind, c.quantity]))
      .toEqual([['location', 2], ['you', 1]]);
  });

  it('picks up a Bound Item Copy, which then cannot be dropped', async () => {
    const h = renderRightPanel({}, stage([copy('k', 'crown', { where: at('yard') })]));
    await userEvent.click(await screen.findByRole('button', { name: 'Pick Up Old Crown' }));
    expect(h.gameplay().itemCopies).toEqual([copy('k', 'crown')]);
    expect(await screen.findByRole('button', { name: 'Drop Old Crown: Bound' })).toBeDisabled();
  });

  it('says nothing lies here when only hidden Item Copies do', async () => {
    renderRightPanel({}, stage([copy('b', 'dagger', { where: at('yard'), visibility: 'hidden' })]));
    expect(await screen.findByText('Nothing lies here.')).toBeInTheDocument();
  });

  it('never shows a hidden owned Item Copy', async () => {
    renderRightPanel({}, stage([copy('x', 'dagger', { visibility: 'hidden' }), copy('c', 'coin')]));
    await screen.findByText('Coin');
    expect(screen.queryByText('Dagger')).not.toBeInTheDocument();
  });
});

describe('Inventory tab — thumbnails', () => {
  it('picks the item image through its rules for each Item Copy (Q113)', async () => {
    const withCoin = renderRightPanel({}, stage([copy('r', 'ring'), copy('c', 'coin')]));
    const row = (await screen.findByText('Silver Ring')).closest('li')!;
    expect(row.querySelector('img')).toHaveAttribute('src', CURSED);
    withCoin.unmount();
    renderRightPanel({}, stage([copy('r', 'ring')]));
    const bare = (await screen.findByText('Silver Ring')).closest('li')!;
    expect(bare.querySelector('img')).toHaveAttribute('src', PLAIN);
  });

  it('shows no thumbnail on a row whose item has no image', async () => {
    renderRightPanel({}, stage([copy('c', 'coin')]));
    expect((await screen.findByText('Coin')).closest('li')!.querySelector('img')).toBeNull();
  });
});

describe('Entity Equipped', () => {
  const show = (copies: ItemCopy[]) => renderInGame(<EntityEquipped entity={bram} />, {
    world: { items, slots, entities: [bram], locations: [yard] },
    seed: (g) => g.setItemCopies(copies),
  });
  const bramHas = (id: string, itemId: string, over: Partial<ItemCopy> = {}) =>
    copy(id, itemId, { where: { kind: 'entity', id: 'bram' }, ...over });

  it("lists an entity's equipped items with their slot and none of its carried items", async () => {
    show([bramHas('a', 'dagger', { equipped: { slotId: 'hand', order: 1 } }), bramHas('b', 'coin', { quantity: 9 })]);
    const list = await screen.findByRole('region', { name: 'Equipped' });
    expect(within(list).getAllByRole('listitem').map((li) => li.textContent)).toEqual(['DaggerHand']);
    expect(screen.queryByText('Coin')).not.toBeInTheDocument();
  });

  it('leaves out a hidden equipped item, and draws nothing when nothing visible is equipped', async () => {
    const h = show([bramHas('a', 'dagger', { visibility: 'hidden', equipped: { slotId: 'hand', order: 1 } }), bramHas('b', 'coin')]);
    await Promise.resolve();
    expect(h.container.querySelector('section')).toBeNull();
  });
});
