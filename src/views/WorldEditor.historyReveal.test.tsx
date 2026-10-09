import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { benchEditorWorld, openEditorTab, renderWorldEditorBench, shownEditorTab } from '@/test/worldEditorBench';
import WorldStorageService from '../services/WorldStorageService';
import { reloadTourProgress, writeTourRecord } from '@/lib/authoringTour/progress';
import { TOUR_STEPS } from '@/lib/authoringTour/steps';
import type { Connection, World } from '@/types';

/** After an undo or redo the editor opens the tab of the record that came back and selects it. */

vi.mock('@/lib/authoringTour/tourImages', () => ({
  loadTourImage: async (name: string) => `data:image/webp;base64,${name}`,
}));

vi.mock('../services/WorldStorageService', () => ({
  default: {
    initialize: vi.fn(),
    getWorldMetadata: vi.fn().mockResolvedValue([]),
    storeWorld: vi.fn().mockResolvedValue(undefined),
  },
}));

const storeWorld = vi.mocked(WorldStorageService.storeWorld);

vi.mock('@/lib/jsonFileWorkerUtils', () => ({
  serializeJsonBlob: vi.fn(), parseJsonText: vi.fn(), terminateWorker: vi.fn(),
}));

vi.mock('react-toastify', () => ({
  toast: { info: vi.fn(), success: vi.fn(), error: vi.fn() },
  ToastContainer: () => null,
}));

const stat = (id: string, name: string) =>
  ({ id, name, type: 'number' as const, description: '', min: 0, max: 10, value: 4, regen: 0, descriptors: [] });

const WORLD: World = benchEditorWorld({
  stats: [stat('s-warmth', 'Warmth'), stat('s-damp', 'Damp')],
  locations: [
    { id: 'harbor', name: 'Harbor Steps', isStarting: true },
    { id: 'docks', name: 'Docks' },
  ],
  connections: [{ id: 'c1', a: 'harbor', b: 'docks', aToB: {}, bToA: {} }],
});

/** One author action, then the event loop moves on as it does between two presses. */
const step = (action: () => void) => act(async () => { action(); });
const undo = () => step(() => { fireEvent.keyDown(document.body, { key: 'z', ctrlKey: true }); });
const redo = () => step(() => { fireEvent.keyDown(document.body, { key: 'y', ctrlKey: true }); });

const statPanelShown = () => screen.queryByRole('tablist', { name: 'Stat Fields' }) !== null;
/** The stat the panel holds, read from its Name field. */
const openStatName = () => screen.getByRole('textbox', { name: 'Name' }).textContent;
/** The canvas's panel for the selected connection. */
const connectionPanelShown = () => screen.queryByLabelText('Direction of Travel') !== null;
const canvasShown = () => document.querySelector('.react-flow') !== null;

beforeEach(() => {
  localStorage.clear();
  reloadTourProgress();
  storeWorld.mockClear();
});

describe('revealing what an undo restored', () => {
  it('opens the Stats tab with the stat selected when a stat edit is undone from the Entities tab', async () => {
    const { ctx } = renderWorldEditorBench(WORLD, 'advanced');
    openEditorTab(/Stats/);
    await step(() => ctx().updateStat({ ...ctx().stats.find((s) => s.id === 's-damp')!, name: 'Drip' }));
    openEditorTab(/Entities/);
    expect(shownEditorTab()).toMatch(/Entities/);
    expect(statPanelShown()).toBe(false);

    await undo();
    expect(shownEditorTab()).toMatch(/Stats/);
    expect(statPanelShown()).toBe(true);
    expect(openStatName()).toBe('Damp');
  });

  it('clears the selection and shows the empty state when the selected record is undone away', async () => {
    renderWorldEditorBench(WORLD, 'advanced');
    openEditorTab(/Stats/);
    await step(() => fireEvent.click(screen.getByRole('button', { name: 'Add to Stats' })));
    expect(statPanelShown()).toBe(true);

    await undo();
    expect(shownEditorTab()).toMatch(/Stats/);
    expect(statPanelShown()).toBe(false);
    expect(screen.queryAllByRole('button', { name: /^Select / }).map((b) => b.getAttribute('aria-label')))
      .toEqual(['Select Warmth', 'Select Damp']);
  });

  it('keeps the open stat when the undo removes a different one', async () => {
    const { ctx } = renderWorldEditorBench(WORLD, 'advanced');
    openEditorTab(/Stats/);
    fireEvent.click(screen.getByRole('button', { name: 'Select Warmth' }));
    expect(openStatName()).toBe('Warmth');
    await step(() => ctx().addStat(stat('s-new', 'Chill') as never));

    await undo();
    expect(ctx().stats.map((s) => s.id)).toEqual(['s-warmth', 's-damp']);
    expect(openStatName()).toBe('Warmth');
  });

  it('opens the Stats tab with nothing selected when a redo removes the stat again', async () => {
    const { ctx } = renderWorldEditorBench(WORLD, 'advanced');
    openEditorTab(/Stats/);
    await step(() => ctx().removeStat('s-damp'));
    await undo();
    expect(openStatName()).toBe('Damp');
    openEditorTab(/Locations/);

    await redo();
    expect(shownEditorTab()).toMatch(/Stats/);
    expect(statPanelShown()).toBe(false);
  });

  it('opens the Locations Canvas with the connection selected when a connection edit is undone', async () => {
    const { ctx } = renderWorldEditorBench(WORLD, 'advanced');
    openEditorTab(/Locations/);
    await step(() => ctx().updateConnection({ ...ctx().connections[0], aToB: { hint: 'by ferry' } }));
    openEditorTab(/Stats/);
    expect(canvasShown()).toBe(false);

    await undo();
    expect(shownEditorTab()).toMatch(/Locations/);
    expect(canvasShown()).toBe(true);
    expect(connectionPanelShown()).toBe(true);
  });

  it('keeps the whole canvas selection when the location an undo reveals is part of it', async () => {
    const { ctx } = renderWorldEditorBench(WORLD, 'advanced');
    openEditorTab(/Locations/);
    fireEvent.click(screen.getByRole('radio', { name: 'Canvas' }));
    const picked = () => [...document.querySelectorAll('.react-flow__node.selected')].map((n) => n.getAttribute('data-id'));
    // The canvas answers keys only after a press on the Locations Canvas.
    fireEvent.pointerDown(document.querySelector('.react-flow')!);
    await step(() => { fireEvent.keyDown(document.body, { key: 'a', ctrlKey: true }); });
    expect(picked()).toEqual(['harbor', 'docks']);
    await step(() => ctx().updateLocation({ ...ctx().locations.find((l) => l.id === 'docks')!, name: 'Quay' }));

    await undo();
    expect(ctx().locations.find((l) => l.id === 'docks')!.name).toBe('Docks');
    expect(picked()).toEqual(['harbor', 'docks']);
    // The redo redraws the Locations Canvas from the selection it holds, so a selection lost to the reveal shows here.
    await redo();
    expect(ctx().locations.find((l) => l.id === 'docks')!.name).toBe('Quay');
    expect(picked()).toEqual(['harbor', 'docks']);
  });

  describe('when an undo removes a connection', () => {
    const addSecondConnection = (ctx: () => { addConnection: (c: never) => void }) =>
      step(() => ctx().addConnection({ id: 'c2', a: 'docks', b: 'harbor', aToB: {} } as never));
    const hintOn = (ctx: () => { connections: Connection[]; updateConnection: (c: Connection) => void }, id: string) =>
      step(() => ctx().updateConnection({ ...ctx().connections.find((c) => c.id === id)!, aToB: { hint: 'by ferry' } }));

    it('closes the panel when that connection is the open one', async () => {
      const { ctx } = renderWorldEditorBench(WORLD, 'advanced');
      openEditorTab(/Locations/);
      fireEvent.click(screen.getByRole('radio', { name: 'Canvas' }));
      await addSecondConnection(ctx);
      await hintOn(ctx, 'c2');
      // Undoing the edit opens c2's panel; undoing the add then removes the connection it shows.
      await undo();
      expect(connectionPanelShown()).toBe(true);
      await undo();
      expect(ctx().connections.map((c) => c.id)).toEqual(['c1']);
      expect(connectionPanelShown()).toBe(false);
    });

    it('keeps the panel of another connection open', async () => {
      const { ctx } = renderWorldEditorBench(WORLD, 'advanced');
      openEditorTab(/Locations/);
      fireEvent.click(screen.getByRole('radio', { name: 'Canvas' }));
      await addSecondConnection(ctx);
      await hintOn(ctx, 'c1');
      await undo();
      expect(connectionPanelShown()).toBe(true);
      await undo();
      expect(ctx().connections.map((c) => c.id)).toEqual(['c1']);
      expect(connectionPanelShown()).toBe(true);
    });
  });

  it('opens the entry a Dictionary edit changed, not its book', async () => {
    const lore: World = benchEditorWorld({
      dictionaries: [{
        id: 'b1', name: 'Fen Lore', enabled: true,
        entries: [
          { id: 'e1', name: 'Hostile Forces', key: ['dragon'], value: 'Peat-soaked lizards.' },
          { id: 'e2', name: 'Quiet Folk', key: ['folk'], value: 'They keep to the water.' },
        ],
      }],
    } as Partial<World>);
    const { ctx } = renderWorldEditorBench(lore, 'advanced');
    openEditorTab(/Dictionary/);
    await step(() => ctx().updateDictionaryEntry({ ...ctx().dictionaries[0].entries[1], value: 'They keep to the reeds.' }));
    openEditorTab(/Stats/);

    await undo();
    expect(shownEditorTab()).toMatch(/Dictionary/);
    expect(screen.getByRole('tablist', { name: 'Entry Fields' })).toBeInTheDocument();
    expect(screen.queryByRole('tablist', { name: 'Book Fields' })).toBeNull();
  });

  it('opens the Overview tab when a thumbnail change is undone', async () => {
    const { ctx } = renderWorldEditorBench(WORLD, 'advanced');
    await step(() => ctx().updateWorldOverview({ thumbnail: 'data:image/webp;base64,AAAA' }));
    openEditorTab(/Stats/);
    expect(shownEditorTab()).toMatch(/Stats/);

    await undo();
    expect(shownEditorTab()).toMatch(/Overview/);
    expect(ctx().worldOverview.thumbnail).toBeNull();
  });

  it('changes no tab or selection when the move runs through the hook during the tour', async () => {
    writeTourRecord(WORLD.id, { step: TOUR_STEPS[0].id, items: {} });
    reloadTourProgress();
    const { ctx, history } = renderWorldEditorBench(WORLD, 'advanced');
    openEditorTab(/Stats/);
    await step(() => ctx().updateWorldOverview({ thumbnail: 'data:image/webp;base64,AAAA' }));
    expect(shownEditorTab()).toMatch(/Stats/);

    await step(() => history().undo());
    expect(ctx().worldOverview.thumbnail).toBeNull();
    expect(shownEditorTab()).toMatch(/Stats/);
  });
});

describe('returning to where the edit was made', () => {
  /** One row of the Locations tree, picked as the match inside a clickable row. */
  const selectLocation = (name: string) => {
    const row = screen.getAllByText(name).map((el) => el.closest<HTMLElement>('[class*="cursor-pointer"]')).find(Boolean);
    if (!row) throw new Error(`No tree row named ${name}`);
    fireEvent.click(row);
  };
  /** The record the open panel holds, read from its Name field. */
  const openRecordName = () => screen.getByRole('textbox', { name: 'Name' }).textContent;
  const residentIn = (ctx: () => { entities: World['entities'] }, ...locations: string[]) =>
    ({ ...ctx().entities.find((e) => e.id === 'resident')!, locations });

  it('records the place as it stood at the write when a tab switch commits with it', async () => {
    const { ctx } = renderWorldEditorBench(WORLD, 'advanced');
    openEditorTab(/Locations/);
    selectLocation('Docks');
    expect(openRecordName()).toBe('Docks');
    await step(() => {
      ctx().updateEntity(residentIn(ctx, 'harbor', 'docks'));
      openEditorTab(/Stats/);
    });
    expect(shownEditorTab()).toMatch(/Stats/);
    openEditorTab(/Traits/);

    await undo();
    expect(ctx().entities.find((e) => e.id === 'resident')!.locations).toEqual(['harbor']);
    expect(shownEditorTab()).toMatch(/Locations/);
    expect(openRecordName()).toBe('Docks');
  });

  it('keeps the place out of the saved world', async () => {
    const { ctx } = renderWorldEditorBench(WORLD, 'advanced');
    openEditorTab(/Locations/);
    selectLocation('Docks');
    await step(() => ctx().updateEntity(residentIn(ctx, 'harbor', 'docks')));
    await step(() => { fireEvent.keyDown(window, { key: 's', ctrlKey: true }); });
    await waitFor(() => expect(storeWorld).toHaveBeenCalledTimes(1));

    const saved = JSON.stringify(storeWorld.mock.calls[0]);
    expect(saved).toContain('"docks"');
    expect(saved).not.toMatch(/"tab":/);
  });
});
