import { describe, expect, it, vi } from 'vitest';
import { act, waitFor } from '@testing-library/react';
import { bodyFixture } from '@/test/bodyFixture';
import { renderInGame, type Gameplay, type TurnFixture } from '@/test/gamePanels';
import { useGameplay } from '@/contexts/GameplayContext';
import type { ActionSnapshot, ListedActionFacts } from '@/lib/actionList';
import type { InventoryOp } from '@/lib/inventory';
import { useInventoryPanel, type InventoryPanelSettle, type PanelActionList } from './useInventoryPanel';
import type { InventoryTabProps } from './InventoryTab';
import type { Entity, GameLocation, Item, ItemInstance } from '@/types';

vi.mock('@/views/VRMViewer', () => import('@/test/stubs/vrmViewer'));
vi.mock('@/lib/useTtsPlayback', () => import('@/test/stubs/ttsPlayback'));

/** Each Inventory tab action reaches the Action List as facts, after it runs (ticket 01). */

const item = (id: string, name: string, over: Partial<Item> = {}): Item => ({ id, name, statEffects: [], traitEffects: [], equipRequires: [], ...over });
const items = [
  item('tonic', 'Tonic', { uses: 1 }),
  item('coin', 'Coin'),
  item('dagger', 'Dagger', { slotRule: { mode: 'either', slotIds: ['hand'] } }),
  item('ring', 'Ring of Curses', { unidentifiedName: 'Plain Ring', uses: 2 }),
];
const yard = { id: 'yard', name: 'Yard' } as GameLocation;
const entities = [{ id: 'bram', name: 'Bram', locations: ['yard'] }] as Entity[];
const you = { kind: 'you' } as const;
const instance = (id: string, itemId: string, over: Partial<ItemInstance> = {}): ItemInstance =>
  ({ id, item: { kind: 'item', itemId }, where: you, quantity: 1, visibility: 'visible', ...over });
const turns: TurnFixture[] = [{ narration: 'One.', turnId: 't1' }, { narration: 'Two.', turnId: 't2', entities: ['Bram'] }];

/** The panel over `instances`, its settle committing what each op leaves and listing into a recorder. */
function panelOver(instances: ItemInstance[], reverse: (facts: ListedActionFacts) => boolean = () => false) {
  const added: { facts: ListedActionFacts; snapshot: ActionSnapshot }[] = [];
  const snapshot = { state: { marker: 'before' }, persona: null } as unknown as ActionSnapshot;
  const actions: PanelActionList = { reverse: vi.fn(reverse), snapshot: () => snapshot, add: (facts, before) => added.push({ facts, snapshot: before }) };
  let panel!: InventoryTabProps;
  const Probe = () => {
    const { setItemInstances } = useGameplay();
    const settle: InventoryPanelSettle = { requirement: () => null, commit: (next) => setItemInstances([...next]), actions };
    panel = useInventoryPanel(settle);
    return null;
  };
  const h = renderInGame(<Probe />, {
    world: { items, slots: [{ id: 'hand', name: 'Hand' }], bodies: [bodyFixture({ id: 'h', name: 'Humanoid', entries: [{ slotId: 'hand' }] })], entities, locations: [yard] },
    turns,
    seed: (g: Gameplay) => {
      g.setCurrentLocation(yard);
      g.setMetEntities(['bram']);
      g.setItemInstances(instances);
    },
  });
  const run = (op: InventoryOp) => act(() => panel.onOps([op]));
  return { h, run, added, actions, snapshot };
}

describe('the Inventory tab lists its actions', () => {
  it('lists a use with the item and its display name, and the state from before it', async () => {
    const { h, run, added, snapshot } = panelOver([instance('t', 'tonic', { quantity: 3 })]);
    await waitFor(() => expect(h.gameplay().itemInstances).toHaveLength(1));
    run({ kind: 'use', instanceId: 't' });
    expect(h.gameplay().itemInstances[0].quantity).toBe(2);
    expect(added).toEqual([{ facts: { kind: 'use', item: { key: 'item:tonic', name: 'Tonic' }, instanceId: 't' }, snapshot }]);
  });

  it('names an unidentified instance by its unidentified face', async () => {
    const { h, run, added } = panelOver([instance('r', 'ring', { state: { unidentified: true } })]);
    await waitFor(() => expect(h.gameplay().itemInstances).toHaveLength(1));
    run({ kind: 'use', instanceId: 'r' });
    expect(added[0].facts).toMatchObject({ item: { name: 'Plain Ring' } });
  });

  it('lists an equip with the instance it left, and an unequip with the row it left', async () => {
    const { h, run, added } = panelOver([instance('d', 'dagger', { quantity: 2 })]);
    await waitFor(() => expect(h.gameplay().itemInstances).toHaveLength(1));
    run({ kind: 'equip', instanceId: 'd' });
    const worn = h.gameplay().itemInstances.find((c) => c.equipped);
    expect(worn && worn.id).not.toBe('d');
    expect(added[0].facts).toEqual({ kind: 'equip', item: { key: 'item:dagger', name: 'Dagger' }, instanceId: 'd', resultId: worn?.id });
    run({ kind: 'unequip', instanceId: worn?.id ?? '' });
    // The unequipped dagger merges back into the stack it split from.
    expect(added[1].facts).toEqual({ kind: 'unequip', item: { key: 'item:dagger', name: 'Dagger' }, instanceId: worn?.id, resultId: 'd' });
  });

  it('lists a give with the receiving entity, and a drop and a pick up with the place and quantity', async () => {
    const { h, run, added } = panelOver([instance('c', 'coin', { quantity: 5 }), instance('l', 'coin', { where: { kind: 'location', id: 'yard' }, quantity: 4 })]);
    await waitFor(() => expect(h.gameplay().itemInstances).toHaveLength(2));
    run({ kind: 'transfer', instanceId: 'c', to: { kind: 'entity', id: 'bram' }, quantity: 1 });
    run({ kind: 'transfer', instanceId: 'c', to: { kind: 'location', id: 'yard' }, quantity: 2 });
    run({ kind: 'transfer', instanceId: 'l', to: you, quantity: 3 });
    const coin = { key: 'item:coin', name: 'Coin' };
    expect(added.map((a) => a.facts)).toEqual([
      { kind: 'give', item: coin, quantity: 1, to: { id: 'bram', name: 'Bram' } },
      { kind: 'drop', item: coin, quantity: 2, place: 'yard' },
      { kind: 'pickup', item: coin, quantity: 3, place: 'yard' },
    ]);
  });

  it('lists nothing for an action the module skips', async () => {
    const { h, run, added } = panelOver([instance('c', 'coin')]);
    await waitFor(() => expect(h.gameplay().itemInstances).toHaveLength(1));
    run({ kind: 'equip', instanceId: 'c' });
    expect(added).toEqual([]);
  });

  it('runs nothing when the action reverses the newest entry', async () => {
    const { h, run, added, actions } = panelOver([instance('c', 'coin')], () => true);
    await waitFor(() => expect(h.gameplay().itemInstances).toHaveLength(1));
    run({ kind: 'transfer', instanceId: 'c', to: { kind: 'location', id: 'yard' }, quantity: 1 });
    expect(actions.reverse).toHaveBeenCalledWith({ kind: 'drop', item: { key: 'item:coin', name: 'Coin' }, quantity: 1, place: 'yard' });
    expect(h.gameplay().itemInstances.map((c) => c.where)).toEqual([you]);
    expect(added).toEqual([]);
  });
});
