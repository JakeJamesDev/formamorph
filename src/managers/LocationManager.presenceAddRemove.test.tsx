// Must load before the services: their constructors open IndexedDB.
import 'fake-indexeddb/auto';
import { useEffect, useState } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { GameDataProvider, useGameData } from '@/contexts/GameDataContext';
import { useWorldHistory } from '@/contexts/worldRecorder';
import { EditorModeContext } from '@/lib/editorMode';
import type { Entity, EntityStart, GameLocation, World } from '@/types';
import type { PickState } from './EntityPickCard';
import LocationManager from './LocationManager';

/** Add Entity and the remove button on a location's Presence tab, over the real provider and its history. */

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
const start = (id: string, at: string): EntityStart => ({ id, place: at, weight: 1, schedule: [] });
const generic = (id: string, starts: EntityStart[]): Entity => ({ id, name: id, kind: 'generic', starts, locations: [...new Set(starts.map((s) => s.place))] });
const unique = (id: string, starts: EntityStart[]): Entity => ({ id, name: id, kind: 'unique', starts, locations: [...new Set(starts.map((s) => s.place))] });
const persona: Entity = { id: 'Persona', name: 'Persona', customPersona: true };

const WORLD = (entities: Entity[]): World => ({
  id: 'w-presence', version: '3.0.0',
  worldOverview: { name: 'Sedge Landing', description: '', author: '', thumbnail: null, bgm: null, systemPrompt: '', tags: [] },
  stats: [], traits: [], statUpdates: [],
  locations: [place('tavern', 'Tavern'), place('market', 'Market'), place('yard', 'Yard')],
  entities,
} as unknown as World);

type Handle = ReturnType<typeof useGameData>;
type HistoryView = ReturnType<typeof useWorldHistory>;

const Panel = ({ locationId }: { locationId: string }) => {
  const { locations } = useGameData();
  const [pick, setPick] = useState<PickState | null>(null);
  const found = locations.find((l) => l.id === locationId);
  return found
    ? <LocationManager location={found} tab="presence" onTabChange={() => {}} entityPick={{ pick, onPickChange: setPick, shown: !!pick }} />
    : null;
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
        <Reader initial={WORLD([...entities, persona])} locationId={locationId} onReady={(c, h) => { ctx = c; history = h; }} />
      </GameDataProvider>
    </EditorModeContext.Provider>,
  );
  await waitFor(() => expect(ctx.worldLoaded).toBe(true));
  return { ctx: () => ctx, history: () => history };
};

const starts = (ctx: Handle, id: string) => ctx.entities.find((e) => e.id === id)!.starts!;
const rows = () => screen.queryAllByTestId('presence-row');
const rowOf = (name: string) => rows().find((r) => within(r).queryByText(name))!;
const addSelect = () => screen.getByRole('combobox', { name: 'Add Entity' });
const options = async () => {
  await userEvent.click(addSelect());
  return (await screen.findAllByRole('option')).map((o) => o.textContent);
};
const add = async (name: string) => {
  await userEvent.click(addSelect());
  await userEvent.click(await screen.findByRole('option', { name }));
};

describe('Add Entity on the Presence tab', () => {
  it('lists an entity with no row here, omits one with a row, and never lists the persona', async () => {
    await open([generic('Crowd', [start('c1', 'tavern')]), generic('Moths', [start('m1', 'market')]), unique('Warden', [start('w1', 'yard')])]);
    expect(await options()).toEqual(['Moths', 'Warden']);
  });

  it('is not on the tab when every entity has a row here', async () => {
    await open([generic('Crowd', [start('c1', 'tavern')])]);
    expect(await screen.findByTestId('entities-here')).toBeInTheDocument();
    expect(screen.queryByRole('combobox', { name: 'Add Entity' })).toBeNull();
  });

  it('gives a Generic entity a Start here, a row that begins here, and the selection', async () => {
    const { ctx } = await open([generic('Crowd', [start('c1', 'market')])]);
    await add('Crowd');
    expect(starts(ctx(), 'Crowd')).toHaveLength(2);
    expect(starts(ctx(), 'Crowd').find((s) => s.place === 'tavern')).toMatchObject({ weight: 1, schedule: [] });
    await waitFor(() => expect(within(rowOf('Crowd')).getByText('Begins here')).toBeInTheDocument());
    expect(within(rowOf('Crowd')).getByRole('button', { name: /^Crowd/ })).toHaveAttribute('aria-current', 'true');
    const editor = await screen.findByTestId('presence-editor');
    expect(editor).toHaveAccessibleName('Crowd');
    // The Start on show is the new one: Start 2 is pressed, Start 1 is not.
    expect(within(editor).getByRole('button', { name: /^Start 2/ })).toHaveAttribute('aria-pressed', 'true');
    expect(within(editor).getByRole('button', { name: /^Start 1/ })).toHaveAttribute('aria-pressed', 'false');
    expect(editor.textContent).toContain('Starts at Tavern.');
    expect(editor.textContent).not.toContain('Market');
  });

  it('gives a Unique entity one more Start here and keeps its other two as they were', async () => {
    const warden = unique('Warden', [start('w1', 'market'), start('w2', 'yard')]);
    const { ctx } = await open([warden]);
    await add('Warden');
    expect(starts(ctx(), 'Warden')).toHaveLength(3);
    expect(starts(ctx(), 'Warden').slice(0, 2)).toEqual(warden.starts);
    expect(starts(ctx(), 'Warden')[2]).toMatchObject({ place: 'tavern', weight: 1, schedule: [] });
  });

  it('undoes in one step: the Start and the row go', async () => {
    const { ctx, history } = await open([generic('Crowd', [start('c1', 'market')])]);
    await add('Crowd');
    await waitFor(() => expect(rows()).toHaveLength(1));
    await act(async () => { history().undo(); });
    await waitFor(() => expect(starts(ctx(), 'Crowd').map((s) => s.id)).toEqual(['c1']));
    expect(rows()).toHaveLength(0);
  });

  it('says no entity can be here on an empty location and still offers Add Entity', async () => {
    await open([generic('Crowd', [start('c1', 'market')])], 'yard');
    expect(await screen.findByText('No entity can be here')).toBeInTheDocument();
    expect(addSelect()).toBeInTheDocument();
  });

  it('has no multi-select of entities', async () => {
    await open([generic('Crowd', [start('c1', 'tavern')])]);
    await screen.findByTestId('entities-here');
    expect(screen.queryByText('Select entities')).toBeNull();
    expect(screen.queryByTestId('entities-refusal')).toBeNull();
  });
});

describe('the remove button on a Generic row', () => {
  it('removes every Start here with its rows, keeps the others, and the row goes', async () => {
    const stay = { id: 'r1', time: 'allDay', action: { kind: 'stay', place: 'tavern' } } as const;
    const crowd = generic('Crowd', [{ ...start('c1', 'tavern'), schedule: [stay] }, start('c2', 'tavern'), start('c3', 'market')]);
    const { ctx } = await open([crowd]);
    await userEvent.click(await screen.findByRole('button', { name: 'Remove Crowd from this location' }));
    expect(starts(ctx(), 'Crowd').map((s) => s.id)).toEqual(['c3']);
    await waitFor(() => expect(rows()).toHaveLength(0));
  });

  it('is disabled with the reason when the entity begins at no other location', async () => {
    const { ctx } = await open([generic('Crowd', [start('c1', 'tavern')]), generic('Moths', [start('m1', 'tavern'), start('m2', 'market')])]);
    const button = await screen.findByRole('button', { name: 'Remove Crowd from this location' });
    expect(button).toBeDisabled();
    expect(screen.getByLabelText('Crowd begins at no other location, so it stays here')).toContainElement(button);
    expect(screen.getByRole('button', { name: 'Remove Moths from this location' })).toBeEnabled();
    expect(starts(ctx(), 'Crowd').map((s) => s.id)).toEqual(['c1']);
  });

  it('is not on a Unique row', async () => {
    await open([unique('Warden', [start('w1', 'tavern'), start('w2', 'market')])]);
    await screen.findByTestId('entities-here');
    expect(within(rowOf('Warden')).queryByRole('button', { name: /^Remove/ })).toBeNull();
  });
});
