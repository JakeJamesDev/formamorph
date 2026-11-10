// Must load before the services: their constructors open IndexedDB.
import 'fake-indexeddb/auto';
import { useEffect, useState } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { GameDataProvider, useGameData } from '@/contexts/GameDataContext';
import { useWorldHistory } from '@/contexts/worldRecorder';
import { EditorModeContext } from '@/lib/editorMode';
import { daypartEnd, daypartStart } from '@/lib/routineTime';
import type { Entity, EntityStart, GameLocation, World } from '@/types';
import LocationManager from './LocationManager';

/** The Entities picker on a location's Presence tab, over the real provider and its history. */

vi.mock('@/components/ui/multi-select', () => ({
  MultiSelect: ({ options, defaultValue, onValueChange }: {
    options: { label: string; value: string }[]; defaultValue: string[]; onValueChange: (v: string[]) => void;
  }) => {
    const [picked, setPicked] = useState(defaultValue);
    return (
      <div role="group" aria-label="Entities picker">
        {options.map((o) => (
          <label key={o.value}>
            <input
              type="checkbox" checked={picked.includes(o.value)}
              onChange={() => {
                const next = picked.includes(o.value) ? picked.filter((v) => v !== o.value) : [...picked, o.value];
                setPicked(next);
                onValueChange(next);
              }}
            />
            {o.label}
          </label>
        ))}
        <button type="button" onClick={() => { setPicked([]); onValueChange([]); }}>Clear All</button>
      </div>
    );
  },
}));
vi.mock('@/components/prompt/PlaceholderField', () => ({
  default: () => null,
  PlaceholderNameField: () => null,
}));
vi.mock('@/components/AiGenerateButton', () => ({ default: () => null }));
vi.mock('./LocationConnections', () => ({ default: () => null }));
vi.mock('./LocationKnownHere', () => ({ default: () => null }));
vi.mock('./ImageTagsField', () => ({ default: () => null }));
vi.mock('../lib/UtilityComponents', () => ({ SoundUpload: () => null }));

const place = (id: string, name: string): GameLocation => ({ id, name } as GameLocation);
const start = (id: string, at: string, schedule: EntityStart['schedule'] = []): EntityStart => ({ id, place: at, weight: 1, schedule });
const group = (id: string, starts: EntityStart[]): Entity => ({ id, name: id, kind: 'group', starts, locations: [...new Set(starts.map((s) => s.place))] });

const DAY = { start: daypartStart('morning'), end: daypartEnd('afternoon') };

const WORLD = (entities: Entity[]): World => ({
  id: 'w-picker', version: '3.0.0',
  worldOverview: { name: 'Sedge Landing', description: '', author: '', thumbnail: null, bgm: null, systemPrompt: '', tags: [] },
  stats: [], traits: [], statUpdates: [],
  locations: [place('tavern', 'Tavern'), place('market', 'Market'), place('yard', 'Yard')],
  entities,
} as unknown as World);

type Handle = ReturnType<typeof useGameData>;
type HistoryView = ReturnType<typeof useWorldHistory>;

const Panel = ({ locationId }: { locationId: string }) => {
  const { locations } = useGameData();
  const [tab, setTab] = useState<'presence'>('presence');
  const found = locations.find((l) => l.id === locationId);
  return found ? <LocationManager location={found} tab={tab} onTabChange={() => setTab('presence')} /> : null;
};

const Reader = ({ initial, locationId, onReady }: { initial: World; locationId: string; onReady: (c: Handle, h: HistoryView) => void }) => {
  const ctx = useGameData();
  const history = useWorldHistory();
  useEffect(() => { ctx.loadWorldData(initial); /* once */ }, []); // eslint-disable-line react-hooks/exhaustive-deps
  onReady(ctx, history);
  return ctx.worldLoaded ? <Panel locationId={locationId} /> : null;
};

const open = async (entities: Entity[], locationId = 'tavern') => {
  let ctx!: Handle;
  let history!: HistoryView;
  render(
    <EditorModeContext.Provider value={{ mode: 'advanced', advanced: true, setMode: () => {} }}>
      <GameDataProvider>
        <Reader initial={WORLD(entities)} locationId={locationId} onReady={(c, h) => { ctx = c; history = h; }} />
      </GameDataProvider>
    </EditorModeContext.Provider>,
  );
  await waitFor(() => expect(ctx.worldLoaded).toBe(true));
  return { ctx: () => ctx, history: () => history };
};

const starts = (ctx: Handle, id: string) => ctx.entities.find((e) => e.id === id)!.starts!;
const box = (name: string) => screen.getByRole('checkbox', { name });

describe('the location Entities picker, for a Group', () => {
  it('adds a Start with no rows here when a Group is picked', async () => {
    const { ctx } = await open([group('Crowd', [start('c1', 'market')])]);
    await userEvent.click(await screen.findByRole('checkbox', { name: 'Crowd' }));
    const added = starts(ctx(), 'Crowd').find((s) => s.place === 'tavern');
    expect(added).toMatchObject({ place: 'tavern', schedule: [] });
    expect(starts(ctx(), 'Crowd')).toHaveLength(2);
  });

  it('removes every Start of the Group that begins here with its rows, keeps the others, and undoes in one step', async () => {
    const stay = { id: 'r1', time: DAY, action: { kind: 'stay', place: 'tavern' } } as const;
    const crowd = group('Crowd', [start('c1', 'tavern', [stay]), start('c2', 'tavern'), start('c3', 'market')]);
    const { ctx, history } = await open([crowd]);
    await userEvent.click(await screen.findByRole('checkbox', { name: 'Crowd' }));
    expect(starts(ctx(), 'Crowd').map((s) => s.id)).toEqual(['c3']);
    await act(async () => { history().undo(); });
    await waitFor(() => expect(starts(ctx(), 'Crowd').map((s) => s.id)).toEqual(['c1', 'c2', 'c3']));
    expect(starts(ctx(), 'Crowd')[0].schedule).toEqual([stay]);
  });

  it('refuses to remove the last Start, keeps the Group ticked and says why', async () => {
    const { ctx } = await open([group('Crowd', [start('c1', 'tavern')]), group('Moths', [start('m1', 'tavern'), start('m2', 'market')])]);
    await userEvent.click(await screen.findByRole('checkbox', { name: 'Crowd' }));
    expect(starts(ctx(), 'Crowd').map((s) => s.id)).toEqual(['c1']);
    await waitFor(() => expect(box('Crowd')).toBeChecked());
    expect(screen.getByTestId('entities-refusal')).toHaveTextContent("Crowd can't be removed here. It begins at no other location.");
    expect(box('Moths')).toBeChecked();
  });

  it('names every refused Group and still removes the Group that has another place', async () => {
    const { ctx } = await open([
      group('Crowd', [start('c1', 'tavern')]), group('Moths', [start('m1', 'tavern')]), group('Rats', [start('r1', 'tavern'), start('r2', 'market')]),
    ]);
    await userEvent.click(await screen.findByRole('button', { name: 'Clear All' }));
    expect(starts(ctx(), 'Rats').map((s) => s.id)).toEqual(['r2']);
    expect(starts(ctx(), 'Crowd').map((s) => s.id)).toEqual(['c1']);
    expect(await screen.findByTestId('entities-refusal')).toHaveTextContent("Crowd and Moths can't be removed here. Each begins at no other location.");
  });

  it('clears the refusal on the next pick that is not refused', async () => {
    await open([group('Crowd', [start('c1', 'tavern')]), group('Moths', [start('m1', 'market')])]);
    await userEvent.click(await screen.findByRole('checkbox', { name: 'Crowd' }));
    expect(await screen.findByTestId('entities-refusal')).toBeInTheDocument();
    await userEvent.click(box('Moths'));
    await waitFor(() => expect(screen.queryByTestId('entities-refusal')).toBeNull());
  });
});
