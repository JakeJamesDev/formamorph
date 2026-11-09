import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, fireEvent, screen, within } from '@testing-library/react';
import {
  asMobile, benchEditorWorld, entityFieldsTab, openEditorTab, pickEditorMode, renderWorldEditorBench, shownEditorTab,
} from '@/test/worldEditorBench';
import { reloadTourProgress } from '@/lib/authoringTour/progress';
import type { useGameData } from '@/contexts/GameDataContext';
import type { World } from '@/types';

type GameData = ReturnType<typeof useGameData>;

/** An undo returns the author to the sub-tab or view the edit was made on, not just to its tab. */

vi.mock('../services/WorldStorageService', () => ({
  default: {
    initialize: vi.fn(),
    getWorldMetadata: vi.fn().mockResolvedValue([]),
    storeWorld: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('@/lib/jsonFileWorkerUtils', () => ({
  serializeJsonBlob: vi.fn(), parseJsonText: vi.fn(), terminateWorker: vi.fn(),
}));

vi.mock('react-toastify', () => ({
  toast: { info: vi.fn(), success: vi.fn(), error: vi.fn() },
  ToastContainer: () => null,
}));

const WORLD: World = benchEditorWorld({
  locations: [
    { id: 'harbor', name: 'Harbor Steps', isStarting: true },
    { id: 'docks', name: 'Docks', placeholderPins: [{ placeholderId: 'weather', value: 'fog' }] },
  ],
  placeholders: [{ id: 'weather', name: 'Weather', values: [{ id: 'v-fog', text: 'fog' }] }],
  entities: [
    {
      id: 'resident', name: 'Odd Wick', playerDescription: 'The lamp-keeper.', aiDescription: 'Keeps the lamps.', locations: ['harbor'],
      openings: [{ id: 'o-lamp', text: 'Wick trims a lamp.', kind: 'narration' }],
    },
    { id: 'ash', name: 'Ash', playerDescription: 'A wolf.', aiDescription: 'A wolf.', locations: ['harbor'] },
  ],
} as Partial<World>);

/** One author action, then the event loop moves on as it does between two presses. */
const step = (action: () => void | Promise<void>) => act(async () => { await action(); });
const undo = () => step(() => { fireEvent.keyDown(document.body, { key: 'z', ctrlKey: true }); });
const redo = () => step(() => { fireEvent.keyDown(document.body, { key: 'y', ctrlKey: true }); });

const panelTab = (strip: string, name: string) =>
  within(screen.getByRole('tablist', { name: strip })).getByRole('tab', { name });
const openPanelTab = (strip: string, name: string) => fireEvent.mouseDown(panelTab(strip, name));
const isShown = (tab: HTMLElement) => tab.getAttribute('aria-selected') === 'true';


const viewToggle = (name: 'List' | 'Canvas') => screen.getByRole('radio', { name });
const canvasShown = () => document.querySelector('.react-flow') !== null;

beforeEach(() => {
  localStorage.clear();
  reloadTourProgress();
});

describe('an undo of an edit made on a panel sub-tab', () => {
  it('returns to that entity sub-tab after the author moved to another one', async () => {
    const { ctx } = renderWorldEditorBench(WORLD, 'advanced');
    openEditorTab(/Entities/);
    fireEvent.click(screen.getByText('Ash'));
    openPanelTab('Entity Fields', 'Descriptions');
    await step(() => ctx().updateEntity({ ...ctx().entities.find((e) => e.id === 'ash')!, aiDescription: 'A gray wolf.' }));
    openPanelTab('Entity Fields', 'Profile');
    openEditorTab(/Stats/);

    await undo();
    expect(ctx().entities.find((e) => e.id === 'ash')!.aiDescription).toBe('A wolf.');
    expect(shownEditorTab()).toMatch(/Entities/);
    expect(isShown(entityFieldsTab('Descriptions'))).toBe(true);

    openPanelTab('Entity Fields', 'Profile');
    openEditorTab(/Stats/);
    await redo();
    expect(isShown(entityFieldsTab('Descriptions'))).toBe(true);
  });

  it('returns to the Pins sub-tab of the Placeholders panel for a pin removed there', async () => {
    const { ctx } = renderWorldEditorBench(WORLD, 'advanced');
    openEditorTab(/Placeholders/);
    fireEvent.click(screen.getAllByText('Weather', { selector: 'span' }).find((el) => !el.closest('button'))!);
    openPanelTab('Placeholder Fields', 'Pins');
    fireEvent.click(screen.getByRole('button', { name: 'Remove Pin' }));
    expect(ctx().locations.find((l) => l.id === 'docks')!.placeholderPins ?? []).toHaveLength(0);
    openPanelTab('Placeholder Fields', 'Details');
    openEditorTab(/Stats/);

    await undo();
    expect(shownEditorTab()).toMatch(/Placeholders/);
    expect(isShown(panelTab('Placeholder Fields', 'Pins'))).toBe(true);
  });

  it('returns to that location sub-tab after the author moved to another one', async () => {
    const { ctx } = renderWorldEditorBench(WORLD, 'advanced');
    openEditorTab(/Locations/);
    fireEvent.click(screen.getAllByText('Docks')[0]);
    openPanelTab('Location Fields', 'Presence');
    await step(() => ctx().updateLocation({ ...ctx().locations.find((l) => l.id === 'docks')!, name: 'Wharf' }));
    openPanelTab('Location Fields', 'Details');
    openEditorTab(/Stats/);

    await undo();
    expect(shownEditorTab()).toMatch(/Locations/);
    expect(isShown(panelTab('Location Fields', 'Presence'))).toBe(true);
  });

  it('returns to the Overview Openings tab for an opening added there', async () => {
    const { ctx } = renderWorldEditorBench(WORLD, 'advanced');
    await screen.findByLabelText('World Name');
    openPanelTab('Overview Fields', 'Openings');
    fireEvent.click(screen.getByRole('button', { name: 'Add Opening to Odd Wick' }));
    expect(ctx().entities[0].openings).toHaveLength(2);
    openPanelTab('Overview Fields', 'Details');
    openEditorTab(/Stats/);

    await undo();
    expect(shownEditorTab()).toMatch(/Overview/);
    expect(isShown(panelTab('Overview Fields', 'Openings'))).toBe(true);
  });

  it('returns to the Overview Details tab for an edit made there', async () => {
    const { ctx } = renderWorldEditorBench(WORLD, 'advanced');
    await screen.findByLabelText('World Name');
    await step(() => ctx().updateWorldOverview({ systemPrompt: 'Narrate the harbor.' }));
    openPanelTab('Overview Fields', 'Custom Prompts');
    openEditorTab(/Stats/);

    await undo();
    expect(shownEditorTab()).toMatch(/Overview/);
    expect(isShown(panelTab('Overview Fields', 'Details'))).toBe(true);
  });

  it('returns to the prompt kind a custom prompt edit was made on', async () => {
    const { ctx } = renderWorldEditorBench(WORLD, 'advanced');
    await screen.findByLabelText('World Name');
    openPanelTab('Overview Fields', 'Custom Prompts');
    openPanelTab('Custom Prompt Kinds', 'Choices');
    await step(() => ctx().updateWorldOverview({ promptOverrides: { choicesPrompt: 'Offer three paths.', choicesPromptEnabled: true } }));
    openPanelTab('Custom Prompt Kinds', 'Narration');
    openPanelTab('Overview Fields', 'Details');
    openEditorTab(/Stats/);

    await undo();
    expect(shownEditorTab()).toMatch(/Overview/);
    expect(isShown(panelTab('Overview Fields', 'Custom Prompts'))).toBe(true);
    expect(isShown(panelTab('Custom Prompt Kinds', 'Choices'))).toBe(true);
  });

  it('falls back to the default sub-tab when the editor mode no longer offers it', async () => {
    const { ctx } = renderWorldEditorBench(WORLD, 'advanced');
    openEditorTab(/Entities/);
    fireEvent.click(screen.getByText('Odd Wick'));
    openPanelTab('Entity Fields', 'Openings');
    await step(() => ctx().updateEntity({
      ...ctx().entities[0], openings: [{ id: 'o-lamp', text: 'Wick snuffs a lamp.', kind: 'narration' }],
    }));
    pickEditorMode('Simple');
    openEditorTab(/Locations/);

    await undo();
    expect(shownEditorTab()).toMatch(/Entities/);
    expect(isShown(entityFieldsTab('Profile'))).toBe(true);
    // The held tab fell back too, so the author finds Profile on returning to Advanced.
    pickEditorMode('Advanced');
    expect(isShown(entityFieldsTab('Profile'))).toBe(true);
  });
});

describe('an undo of an edit made on the Locations tab', () => {
  const editDocks = (ctx: () => GameData) =>
    step(() => ctx().updateLocation({ ...ctx().locations.find((l) => l.id === 'docks')!, name: 'Wharf' }));

  it('returns to the canvas view for an edit made there', async () => {
    const { ctx } = renderWorldEditorBench(WORLD, 'advanced');
    openEditorTab(/Locations/);
    fireEvent.click(viewToggle('Canvas'));
    await editDocks(ctx);
    fireEvent.click(viewToggle('List'));
    openEditorTab(/Stats/);

    await undo();
    expect(shownEditorTab()).toMatch(/Locations/);
    expect(canvasShown()).toBe(true);
  });

  it('returns to the list view for an edit made there', async () => {
    const { ctx } = renderWorldEditorBench(WORLD, 'advanced');
    openEditorTab(/Locations/);
    await editDocks(ctx);
    fireEvent.click(viewToggle('Canvas'));
    openEditorTab(/Stats/);

    await undo();
    expect(shownEditorTab()).toMatch(/Locations/);
    expect(canvasShown()).toBe(false);
  });

  it('returns to the list view with the open location for a connection edited there', async () => {
    const { ctx } = renderWorldEditorBench({
      ...WORLD, connections: [{ id: 'c1', a: 'harbor', b: 'docks', aToB: {}, bToA: {} }],
    }, 'advanced');
    openEditorTab(/Locations/);
    fireEvent.click(screen.getAllByText('Docks')[0]);
    await step(() => ctx().updateConnection({ ...ctx().connections[0], aToB: { hint: 'by ferry' } }));
    fireEvent.click(viewToggle('Canvas'));
    openEditorTab(/Stats/);

    await undo();
    expect(shownEditorTab()).toMatch(/Locations/);
    expect(canvasShown()).toBe(false);
    expect(screen.getByRole('textbox', { name: 'Name' }).textContent).toBe('Docks');
  });

  describe('on mobile', () => {
    let restore: () => void;
    beforeEach(() => { restore = asMobile(); });
    afterEach(() => restore());

    it('pushes the detail panel of a location edited in the canvas view', async () => {
      const { ctx } = renderWorldEditorBench(WORLD, 'advanced');
      openEditorTab(/Locations/);
      fireEvent.click(viewToggle('Canvas'));
      await editDocks(ctx);
      fireEvent.click(viewToggle('List'));
      openEditorTab(/Stats/);

      await undo();
      expect(shownEditorTab()).toMatch(/Locations/);
      expect(canvasShown()).toBe(true);
      expect(screen.getByRole('tablist', { name: 'Location Fields' })).toBeInTheDocument();
      expect(screen.getByRole('textbox', { name: 'Name' }).textContent).toBe('Docks');
    });
  });
});
