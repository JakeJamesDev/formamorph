// Real in-memory storage for saves; must load before anything touches `indexedDB`.
import 'fake-indexeddb/auto';
import { describe, it, expect, vi } from 'vitest';
import { render, act } from '@testing-library/react';
import { GameplayProvider, useGameplay } from './GameplayContext';
import { GameDataProvider } from './GameDataContext';
import { PlaceholderSessionProvider } from './PlaceholderSessionContext';
import { getAllSaveRecords, getSaveRecord, putSaveRecord } from '@/components/modals/dbUtils';
import type { ActionSnapshot, ListedAction, ListedActionFacts } from '@/lib/actionList';
import type { ChatMessage, PlayerStat, SaveRecord } from '@/types';

vi.mock('@/lib/useTtsPlayback', () => import('@/test/stubs/ttsPlayback'));

const Expose = ({ expose }: { expose: (g: ReturnType<typeof useGameplay>) => void }) => {
  expose(useGameplay());
  return null;
};

const mount = () => {
  let live: ReturnType<typeof useGameplay> | null = null;
  render(
    <GameDataProvider>
      <PlaceholderSessionProvider>
        <GameplayProvider>
          <Expose expose={(g) => { live = g; }} />
        </GameplayProvider>
      </PlaceholderSessionProvider>
    </GameDataProvider>,
  );
  return () => {
    if (!live) throw new Error('contexts not available (did the render throw?)');
    return live;
  };
};

const tonicUse: ListedActionFacts = { kind: 'use', item: { key: 'tonic', name: 'Tonic' }, copyId: 'c1' };
const history: ChatMessage[] = [{ role: 'user', content: 'Look around.' }, { role: 'assistant', content: 'A quiet harbor.' }];

/** A live list whose snapshots carry the history, as `saveCurrentGameState` returns it. */
function liveList(live: () => ReturnType<typeof useGameplay>): ListedAction<ActionSnapshot>[] {
  const snapshot: ActionSnapshot = { state: { ...live().saveCurrentGameState(), fullMessageHistory: history }, persona: null };
  return [
    { id: 'a', facts: tonicUse, count: 2, hidden: false, snapshots: [snapshot, snapshot] },
    { id: 'b', facts: { kind: 'stat', stat: { id: 'calm', name: 'Calm' }, from: 50, to: 70 }, count: 1, hidden: true, snapshots: [snapshot] },
  ];
}

const snapshotHistories = (record: SaveRecord) => [
  ...(record.actionList ?? []).flatMap((entry) => entry.snapshots),
  ...Object.values(record.sentActions ?? {}).flatMap((sent) => sent.entries.flatMap((entry) => entry.snapshots ?? [])),
].map((snapshot) => snapshot.state.fullMessageHistory);

describe('the live Action List across a save/load round trip', () => {
  it('saves the list and the newest sent snapshots without their history copies, and loads the list back', async () => {
    const live = mount();
    const list = liveList(live);
    await act(async () => {
      live().setActionList(list);
      live().setSentActions({ t1: { told: true, entries: list } });
    });
    await act(async () => { await live().saveGame('slot', 'World', 'w1', 'list-save'); });

    const record = await getSaveRecord('list-save') as SaveRecord;
    expect(record.actionList?.map((e) => [e.id, e.count, e.hidden, e.snapshots.length])).toEqual([['a', 2, false, 2], ['b', 1, true, 1]]);
    expect(snapshotHistories(record)).toEqual([undefined, undefined, undefined, undefined, undefined, undefined]);

    await act(async () => { live().setActionList([]); });
    await act(async () => { await live().loadGame('list-save', []); });
    expect(live().actionList.map((e) => [e.id, e.facts, e.count, e.hidden, e.snapshots.length]))
      .toEqual([['a', tonicUse, 2, false, 2], ['b', list[1].facts, 1, true, 1]]);
    expect(Object.values(live().sentActions).map((s) => s.entries.length)).toEqual([2]);
  });

  it('writes the list in an autosave too', async () => {
    const live = mount();
    await act(async () => { live().setActionList(liveList(live)); });
    await act(async () => { await live().autosaveGame('World', 'w1', 3); });
    const saved = (await getAllSaveRecords() as SaveRecord[]).find((r) => r.isAutosave);
    expect(saved?.actionList?.map((e) => e.id)).toEqual(['a', 'b']);
  });

  it('writes no field for an empty list, and loads a save without it with an empty list', async () => {
    const live = mount();
    await act(async () => { await live().saveGame('slot', 'World', 'w1', 'list-absent'); });
    expect('actionList' in (await getSaveRecord('list-absent') as SaveRecord)).toBe(false);

    await act(async () => { live().setActionList(liveList(live)); });
    await act(async () => { await live().loadGame('list-absent', []); });
    expect(live().actionList).toEqual([]);
  });

  it('keeps the owned state of the persona a snapshot was taken under', async () => {
    const live = mount();
    const grit: PlayerStat = { id: 'grit', name: 'Grit', type: 'number', description: '', min: 0, max: 100, value: 40, regen: 0, descriptors: [] };
    // Before a switch away from library persona Wren; the save itself has no persona.
    const snapshot: ActionSnapshot = {
      state: { ...live().saveCurrentGameState(), entityStats: { wren: [grit] } },
      persona: { source: 'library', entityId: 'wren' },
    };
    const facts: ListedActionFacts = { kind: 'persona', from: { id: 'library:wren', name: 'Wren' }, to: { id: 'none', name: null } };
    await act(async () => { live().setActionList([{ id: 'p', facts, count: 1, hidden: false, snapshots: [snapshot] }]); });
    await act(async () => { await live().saveGame('slot', 'World', 'w1', 'list-persona'); });

    await act(async () => { live().setActionList([]); });
    await act(async () => { await live().loadGame('list-persona', [], [], []); });
    expect(live().actionList[0].snapshots[0].state.entityStats?.wren?.map((s) => s.value)).toEqual([40]);
  });

  it('loads an empty list when one entry is malformed', async () => {
    const live = mount();
    await act(async () => { live().setActionList(liveList(live)); });
    await act(async () => { await live().saveGame('slot', 'World', 'w1', 'list-bad'); });
    const record = await getSaveRecord('list-bad') as SaveRecord;
    // The first entry claims two repeats but keeps one snapshot.
    await putSaveRecord({ ...record, actionList: [{ ...record.actionList![0], snapshots: [record.actionList![0].snapshots[0]] }, record.actionList![1]] });

    await act(async () => { await live().loadGame('list-bad', []); });
    expect(live().actionList).toEqual([]);
  });
});
