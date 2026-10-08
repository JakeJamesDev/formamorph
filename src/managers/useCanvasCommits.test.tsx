// Must load before the services: their constructors open IndexedDB.
import 'fake-indexeddb/auto';
import { afterEach, describe, it, expect, vi } from 'vitest';
import { act, render, waitFor } from '@testing-library/react';
import { useEffect } from 'react';
import { GameDataProvider, useGameData } from '@/contexts/GameDataContext';
import { useWorldHistory } from '@/contexts/worldRecorder';
import { stepLabel } from '@/lib/editorHistoryLabels';
import {
  applyCanvasDrops, applyCanvasIntent, connectIntent, deleteIntent, directionIntent, hintKey, multiDropIntents,
  nudgeKey, updateIntent,
} from '@/lib/locationCanvas';
import { autoArrangeAll } from '@/lib/locationArrange';
import { nudgeLocations } from '@/lib/locationAlign';
import { withHint } from '@/lib/connectionEditing';
import { useCanvasCommits } from './useCanvasCommits';
import type { Connection, GameLocation, World } from '@/types';

/** The canvas writes the world through these commits; the world's history records them like any other write. */

const village: GameLocation = { id: 'village', name: 'Village', isStarting: true };
const tavern: GameLocation = { id: 'tavern', name: 'Tavern', parentId: 'village', canvasPosition: { x: 20, y: 60 } };
const house: GameLocation = { id: 'house', name: 'House', parentId: 'village', canvasPosition: { x: 24, y: 64 } };
const shore: GameLocation = { id: 'shore', name: 'Shore', canvasPosition: { x: 400, y: 40 } };
const road: Connection = { id: 'road', a: 'village', b: 'shore', aToB: {}, bToA: {} };

// A world with only the slices the canvas writes; loadWorldData fills the rest.
const world = (): World => ({
  id: 'w-canvas', version: '3.0.0',
  worldOverview: {
    name: 'Sedge Landing', description: '', author: '', thumbnail: null, bgm: null, systemPrompt: '', use3DModel: true, tags: [],
  },
  stats: [], locations: [village, tavern, house, shore], connections: [road], entities: [], traits: [], statUpdates: [],
} as unknown as World);

type Data = ReturnType<typeof useGameData>;
type Handle = { data: Data; history: ReturnType<typeof useWorldHistory>; commits: ReturnType<typeof useCanvasCommits> };

const Canvas = ({ onReady }: { onReady: (handle: Handle) => void }) => {
  const data = useGameData();
  const history = useWorldHistory();
  const commits = useCanvasCommits(data);
  useEffect(() => { data.loadWorldData(world()); /* once */ }, []); // eslint-disable-line react-hooks/exhaustive-deps
  onReady({ data, history, commits });
  return null;
};

const open = async () => {
  let handle!: Handle;
  render(<GameDataProvider><Canvas onReady={(h) => { handle = h; }} /></GameDataProvider>);
  await waitFor(() => expect(handle.data.worldLoaded).toBe(true));
  return () => handle;
};

/** One author action: the writes run together, then the event loop moves on as it does between two actions. */
const act1 = (writes: () => void) => act(async () => { writes(); });

const position = (data: Data, id: string) => data.locations.find((l) => l.id === id)!.canvasPosition;
const labels = (handle: Handle) => handle.history.steps.map(stepLabel);

afterEach(() => vi.restoreAllMocks());

describe('the canvas commits into the world history', () => {
  it('undoes a multi-location drag in one press and shows the earlier positions to every reader', async () => {
    const handle = await open();
    const before = handle().data.locations;
    const drops = multiDropIntents(before, [
      { id: 'shore', position: { x: 520, y: 180 } },
      { id: 'house', position: { x: 90, y: 130 } },
    ]);
    await act1(() => handle().commits.commitLocations(applyCanvasDrops(before, drops)));
    expect(position(handle().data, 'shore')).toEqual({ x: 520, y: 180 });
    expect(handle().history.steps).toHaveLength(1);

    await act1(() => handle().history.undo());
    expect(handle().data.locations).toEqual(before);
    expect(handle().history.canUndo).toBe(false);

    await act1(() => handle().history.redo());
    expect(position(handle().data, 'shore')).toEqual({ x: 520, y: 180 });
  });

  it('puts a reparent back, holder and all', async () => {
    const handle = await open();
    const before = handle().data.locations;
    const drops = multiDropIntents(before, [{ id: 'shore', position: { x: 24, y: 8 } }]);
    await act1(() => handle().commits.commitLocations(applyCanvasDrops(before, drops)));
    expect(handle().data.locations.find((l) => l.id === 'shore')!.parentId).toBe('village');

    await act1(() => handle().history.undo());
    expect(handle().data.locations.find((l) => l.id === 'shore')!.parentId).toBeUndefined();
  });

  it('undoes an Auto Arrange of several locations in one press', async () => {
    const handle = await open();
    const before = handle().data.locations;
    const arranged = autoArrangeAll(before, handle().data.connections);
    expect(arranged.filter((l, i) => l.canvasPosition?.x !== before[i].canvasPosition?.x).length).toBeGreaterThan(1);
    await act1(() => handle().commits.commitLocations(arranged));
    await act1(() => handle().history.undo());
    expect(handle().data.locations).toEqual(before);
    expect(handle().history.canUndo).toBe(false);
  });

  it.each([
    ['creating', (c: Connection[]) => connectIntent('tavern', 'shore', c)!],
    ['editing the direction of', (c: Connection[]) => directionIntent(c[0], 'outgoing')],
    ['deleting', (c: Connection[]) => deleteIntent(c[0])],
  ])('puts a Connection back after %s one', async (_label, intent) => {
    const handle = await open();
    const before = handle().data.connections;
    const after = applyCanvasIntent(before, intent(before));
    expect(after).not.toEqual(before);
    await act1(() => handle().commits.commitConnections(after));
    expect(handle().data.connections).toEqual(after);

    await act1(() => handle().history.undo());
    expect(handle().data.connections).toEqual(before);
    await act1(() => handle().history.redo());
    expect(handle().data.connections).toEqual(after);
  });

  it('orders a list-panel edit and a canvas Step on the one stack, newest first', async () => {
    const handle = await open();
    const before = handle().data.locations;
    const drops = multiDropIntents(before, [{ id: 'shore', position: { x: 520, y: 180 } }]);
    await act1(() => handle().commits.commitLocations(applyCanvasDrops(before, drops)));
    await act1(() => handle().data.updateLocation({ ...handle().data.locations.find((l) => l.id === 'tavern')!, name: 'The Bell' }));
    expect(handle().history.steps).toHaveLength(2);

    await act1(() => handle().history.undo());
    expect(handle().data.locations.find((l) => l.id === 'tavern')!.name).toBe('Tavern');
    expect(position(handle().data, 'shore')).toEqual({ x: 520, y: 180 });

    await act1(() => handle().history.undo());
    expect(position(handle().data, 'shore')).toEqual(shore.canvasPosition);
  });
});

describe('a keyed run of canvas writes', () => {
  const hint = (connection: Connection, text: string) => applyCanvasIntent(
    [connection], updateIntent(withHint(connection, 'aToB', text)),
  )[0];

  it('is one Step for a typed Travel Hint, and a different leg or Connection starts its own', async () => {
    const handle = await open();
    let current = handle().data.connections[0];
    for (const text of ['t', 'th', 'thr']) {
      current = hint(current, text);
      const next = [current];
      await act1(() => handle().commits.commitConnections(next, hintKey('road', 'aToB')));
    }
    expect(handle().history.steps).toHaveLength(1);
    expect(labels(handle())).toEqual(['Edit Connection: Travel Hint']);

    await act1(() => handle().history.undo());
    expect(handle().data.connections).toEqual([road]);
    await act1(() => handle().history.redo());
    expect(handle().data.connections[0].aToB?.hint).toBe('thr');

    const other = [withHint(handle().data.connections[0], 'bToA', 'back')];
    await act1(() => handle().commits.commitConnections(other, hintKey('road', 'bToA')));
    expect(handle().history.steps).toHaveLength(2);
  });

  it('is one Step for keyboard nudges of one selection within the pause, and a new one for another', async () => {
    const handle = await open();
    const nudge = (ids: string[]) => handle().commits.commitLocations(
      nudgeLocations(handle().data.locations, ids, { x: 20, y: 0 }), nudgeKey(ids),
    );
    const was = handle().data.locations;
    for (let i = 0; i < 3; i += 1) await act1(() => nudge(['tavern']));
    expect(position(handle().data, 'tavern')).toEqual({ x: 80, y: 60 });
    expect(handle().history.steps).toHaveLength(1);
    expect(labels(handle())).toEqual(['Edit Location Tavern: Position']);

    await act1(() => nudge(['shore']));
    expect(handle().history.steps).toHaveLength(2);

    await act1(() => handle().history.jump(0));
    expect(handle().data.locations).toEqual(was);
  });

  it('starts a new Step for a nudge after the pause', async () => {
    const handle = await open();
    const now = vi.spyOn(Date, 'now');
    const nudge = () => handle().commits.commitLocations(
      nudgeLocations(handle().data.locations, ['tavern'], { x: 20, y: 0 }), nudgeKey(['tavern']),
    );
    now.mockReturnValue(10_000);
    await act1(nudge);
    now.mockReturnValue(10_500);
    await act1(nudge);
    expect(handle().history.steps).toHaveLength(1);
    now.mockReturnValue(12_000);
    await act1(nudge);
    expect(handle().history.steps).toHaveLength(2);
  });

  it('is one Step per press without a key', async () => {
    const handle = await open();
    for (let i = 0; i < 3; i += 1) {
      await act1(() => handle().commits.commitLocations(nudgeLocations(handle().data.locations, ['tavern'], { x: 20, y: 0 })));
    }
    expect(handle().history.steps).toHaveLength(3);
  });

  it('ignores a key for a slice the write did not change', async () => {
    const handle = await open();
    await act1(() => {
      handle().history.keyNext(hintKey('road', 'aToB'));
      handle().data.updateLocation({ ...handle().data.locations.find((l) => l.id === 'house')!, name: 'Cottage' });
    });
    expect(handle().history.steps).toHaveLength(1);
    expect(handle().history.steps[0].key).toBeUndefined();
  });

  it('does not leave its key for a later write when the keyed write changed nothing', async () => {
    const handle = await open();
    await act1(() => handle().commits.commitLocations(nudgeLocations(handle().data.locations, ['tavern'], { x: 20, y: 0 }), nudgeKey(['tavern'])));
    // The same array again: nothing changes, so no commit consumes the key.
    await act1(() => handle().commits.commitLocations(handle().data.locations, nudgeKey(['tavern'])));
    await act1(() => handle().data.updateLocation({ ...handle().data.locations.find((l) => l.id === 'house')!, name: 'Cottage' }));
    expect(handle().history.steps).toHaveLength(2);
    expect(labels(handle())[1]).not.toMatch(/Position/);
  });
});
