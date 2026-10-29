// Real in-memory storage for saves; must load before anything touches `indexedDB`.
import 'fake-indexeddb/auto';
import { describe, it, expect, vi } from 'vitest';
import { render, act } from '@testing-library/react';
import { GameplayProvider, useGameplay } from './GameplayContext';
import { GameDataProvider, useGameData } from './GameDataContext';
import { PlaceholderSessionProvider } from './PlaceholderSessionContext';
import { getSaveRecord, putSaveRecord } from '@/components/modals/dbUtils';
import { worldFixture } from '@/test/gamePanels';
import type { Entity, GameLocation, Item, ItemCopy, Placement, SaveRecord } from '@/types';

vi.mock('@/lib/useTtsPlayback', () => import('@/test/stubs/ttsPlayback'));

interface Live {
  gameplay: ReturnType<typeof useGameplay>;
  gameData: ReturnType<typeof useGameData>;
}

const Expose = ({ expose }: { expose: (l: Live) => void }) => {
  expose({ gameplay: useGameplay(), gameData: useGameData() });
  return null;
};

const mount = () => {
  let live: Live | null = null;
  render(
    <GameDataProvider>
      <PlaceholderSessionProvider>
        <GameplayProvider>
          <Expose expose={(l) => { live = l; }} />
        </GameplayProvider>
      </PlaceholderSessionProvider>
    </GameDataProvider>,
  );
  return () => {
    if (!live) throw new Error('contexts not available (did the render throw?)');
    return live as Live;
  };
};

const lamp: Item = { id: 'lamp', name: 'Lamp', statEffects: [], traitEffects: [], equipRequires: [] };
const bram: Entity = { id: 'bram', name: 'Bram', locations: ['cellar'] };
const cellar = { id: 'cellar', name: 'Cellar', description: '' } as GameLocation;
const lampOnYou: Placement = { id: 'p1', where: { kind: 'you' }, quantity: 1, source: { kind: 'item', itemId: 'lamp' } };

const copy = (id: string, over: Partial<ItemCopy> = {}): ItemCopy =>
  ({ id, item: { kind: 'item', itemId: 'lamp' }, where: { kind: 'you' }, quantity: 1, visibility: 'visible', ...over });
const held = [
  copy('a', { quantity: 3 }),
  copy('b', { where: { kind: 'entity', id: 'bram' }, equipped: { slotId: 'hand', order: 1 }, state: { charges: 2 } }),
  copy('c', { where: { kind: 'location', id: 'cellar' }, visibility: 'hidden' }),
];

const loadWorld = async (live: () => Live, placements: Placement[] = []) => {
  await act(async () => {
    live().gameData.loadWorldData(worldFixture({ items: [lamp], entities: [bram], locations: [cellar], placements }));
  });
};

const load = async (live: () => Live, saveId: string) => {
  await act(async () => { await live().gameplay.loadGame(saveId, [cellar], [], [bram], undefined, [lamp]); });
};

describe('Item Copies in a save', () => {
  it('come back from a save written to a file and read back in', async () => {
    const live = mount();
    await loadWorld(live);
    await act(async () => { live().gameplay.setItemCopies(held); });
    await act(async () => { await live().gameplay.saveGame('slot', 'World', 'w1', 'items-out'); });
    // A save file is the record as JSON.
    const file = JSON.stringify(await getSaveRecord('items-out'));
    await putSaveRecord({ ...JSON.parse(file), id: 'items-in' } as SaveRecord);

    await act(async () => { live().gameplay.setItemCopies([]); });
    await load(live, 'items-in');
    expect(live().gameplay.itemCopies).toEqual(held);
  });

  it("go back to the turn's own when a snapshot is restored, as a re-roll does", async () => {
    const live = mount();
    await loadWorld(live);
    await act(async () => { live().gameplay.setItemCopies(held); });
    const turnStart = live().gameplay.saveCurrentGameState();
    await act(async () => { live().gameplay.setItemCopies([copy('later')]); });
    await act(async () => { live().gameplay.loadGameState(turnStart, [cellar], { keepLiveHistory: true }); });
    expect(live().gameplay.itemCopies).toEqual(held);
  });

  it('never come from placements the world gained after an older save was written', async () => {
    const live = mount();
    await loadWorld(live);
    await act(async () => { await live().gameplay.saveGame('slot', 'World', 'w1', 'before-items'); });
    expect('itemCopies' in ((await getSaveRecord('before-items')) as SaveRecord).currentState).toBe(false);

    await loadWorld(live, [lampOnYou]);
    await load(live, 'before-items');
    expect(live().gameplay.itemCopies).toEqual([]);
  });

  it('drop the ones whose item, owner or location is gone, in the state and its history, with one log line', async () => {
    const live = mount();
    await loadWorld(live);
    const base = live().gameplay.saveCurrentGameState();
    const goneItem = copy('x', { item: { kind: 'item', itemId: 'gone' } });
    const goneOwner = copy('y', { where: { kind: 'entity', id: 'gone' } });
    const goneLocation = copy('z', { where: { kind: 'location', id: 'gone' } });
    await putSaveRecord({
      id: 'orphans', name: 'orphans', version: '3.0.1',
      currentState: { ...base, fullMessageHistory: undefined, itemCopies: [...held, goneItem, goneOwner] },
      stateHistory: [{ ...base, fullMessageHistory: undefined, itemCopies: [held[0], goneItem, goneLocation] }],
    } as unknown as SaveRecord);

    await load(live, 'orphans');
    expect(live().gameplay.itemCopies).toEqual(held);
    expect(live().gameplay.gameStates[0].itemCopies).toEqual([held[0]]);
    const lines = live().gameplay.logEntries.map((e) => e.text).filter((t) => t.startsWith('Removed'));
    expect(lines).toEqual(['Removed 3 items whose item, owner or location no longer exists']);
  });

  it('keep one owned by a discovered entity the world never authored', async () => {
    const live = mount();
    await loadWorld(live);
    const base = live().gameplay.saveCurrentGameState();
    const found = copy('f', { where: { kind: 'entity', id: 'runtime-wren' } });
    await putSaveRecord({
      id: 'discovered', name: 'discovered', version: '3.0.1', stateHistory: [],
      currentState: {
        ...base, fullMessageHistory: undefined, itemCopies: [found],
        discoveredEntities: [{ entity: { id: 'runtime-wren', name: 'Wren' }, locationId: 'cellar', sourceTurnId: 't1' }],
      },
    } as unknown as SaveRecord);

    await load(live, 'discovered');
    expect(live().gameplay.itemCopies).toEqual([found]);
  });
  it("reverse a dropped Item Copy's effects, in the state and its history (Q60)", async () => {
    const live = mount();
    await loadWorld(live);
    const base = live().gameplay.saveCurrentGameState();
    const vigor = { id: 'vigor', name: 'Vigor', type: 'number', description: '', descriptors: [], value: 7, min: 0, max: 10, regen: 0, baseMin: 0, baseMax: 10, baseRegen: 0, aiMaxDelta: 0 };
    const sword = copy('s', { item: { kind: 'item', itemId: 'gone' }, where: { kind: 'entity', id: 'bram' }, equipped: { slotId: 'hand', order: 1 } });
    const state = {
      ...base, fullMessageHistory: undefined, itemCopies: [sword],
      entityStats: { bram: [vigor] },
      itemEffects: { applied: { 'equipped:bram:s': { ownerId: 'bram', itemId: 'gone', timing: 'equipped', values: { vigor: 2 } } } },
    };
    await putSaveRecord({ id: 'effects', name: 'effects', version: '3.0.1', currentState: state, stateHistory: [state] } as unknown as SaveRecord);

    await act(async () => {
      await live().gameplay.loadGame('effects', [cellar], [], [{ ...bram, stats: [vigor] }] as Entity[], undefined, [lamp], () => () => []);
    });
    expect(live().gameplay.itemCopies).toEqual([]);
    expect(live().gameplay.entityStats.bram.find((s) => s.id === 'vigor')?.value).toBe(5);
    expect(live().gameplay.itemEffects).toEqual({});
    expect(live().gameplay.gameStates[0].entityStats?.bram.find((s) => s.id === 'vigor')?.value).toBe(5);
  });
});
