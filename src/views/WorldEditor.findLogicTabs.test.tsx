import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { benchEditorWorld, renderWorldEditorBench, searchWorldField } from '@/test/worldEditorBench';
import { blankItem } from '@/lib/items';
import { blankTool } from '@/lib/tools/toolDraft';

/** Guards Search World on the Items, Scripts and Tools tabs: a hit opens its tab with its row selected. */

const getWorldMetadata = vi.fn();

vi.mock('../services/WorldStorageService', () => ({
  default: {
    initialize: vi.fn(),
    getWorldMetadata: () => getWorldMetadata(),
    storeWorld: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('@/lib/jsonFileWorkerUtils', () => ({
  serializeJsonBlob: vi.fn(),
  parseJsonText: vi.fn(),
  terminateWorker: vi.fn(),
}));

vi.mock('react-toastify', () => ({
  toast: { info: vi.fn(), success: vi.fn(), error: vi.fn() },
  ToastContainer: () => null,
}));

const WORLD = benchEditorWorld({
  items: [{
    ...blankItem('key', 'Brass Key'),
    unidentifiedDescription: 'It hums near bells.',
    scripts: [{ id: 'is1', name: 'Ring', timing: 'used', code: 'stats.Chime = 1;' }],
  }],
  scripts: [{ id: 'ws1', name: 'Dusk Toll', timing: 'before', code: 'narration.say("the bells toll");' }],
  tools: [{ ...blankTool('tool'), name: 'find_bell', description: 'Looks up a bell by its tower.' }],
});

/** The match counter's text, once the debounced search has run. */
const counter = () => screen.getByText(/^\d+ \/ \d+$/).textContent;
const selectedRow = () => document.querySelector('[data-editor-row-selected]');
const search = (query: string) => fireEvent.change(searchWorldField(), { target: { value: query } });

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  getWorldMetadata.mockResolvedValue([]);
});

describe('Search World on the Items, Scripts and Tools tabs', () => {
  it('opens the Items tab on the hit item, on the panel tab that holds the field', async () => {
    renderWorldEditorBench(WORLD, 'advanced');
    search('hums near');
    await waitFor(() => expect(screen.getByRole('tab', { name: /^Items/, selected: true })).toBeInTheDocument());
    await waitFor(() => expect(selectedRow()).toHaveTextContent('Brass Key'));
    await waitFor(() => expect(screen.getByRole('tab', { name: /Descriptions/, selected: true })).toBeInTheDocument());
  });

  it('opens an item script on the item panel’s Scripts tab', async () => {
    renderWorldEditorBench(WORLD, 'advanced');
    search('stats.Chime');
    await waitFor(() => expect(selectedRow()).toHaveTextContent('Brass Key'));
    await waitFor(() => expect(screen.getByRole('tab', { name: /^Scripts/, selected: true })).toBeInTheDocument());
    expect(screen.getByRole('tab', { name: /^Items/, selected: true })).toBeInTheDocument();
  });

  it('opens the Scripts tab on the hit script', async () => {
    renderWorldEditorBench(WORLD, 'advanced');
    search('bells toll');
    await waitFor(() => expect(screen.getByRole('tab', { name: /^Scripts/, selected: true })).toBeInTheDocument());
    await waitFor(() => expect(selectedRow()).toHaveTextContent('Dusk Toll'));
  });

  it('opens the Tools tab on the hit Tool', async () => {
    renderWorldEditorBench(WORLD, 'advanced');
    search('by its tower');
    await waitFor(() => expect(screen.getByRole('tab', { name: /^Tools/, selected: true })).toBeInTheDocument());
    await waitFor(() => expect(selectedRow()).toHaveTextContent('find_bell'));
  });

  it('counts the item, script and Tool hits in Advanced mode', async () => {
    renderWorldEditorBench(WORLD, 'advanced');
    search('bell');
    await waitFor(() => expect(counter()).toBe('1 / 4'));
  });

  it('opens the item on a tab Simple mode shows when the hit sits in its hidden Scripts tab', async () => {
    renderWorldEditorBench(WORLD, 'simple');
    search('stats.Chime');
    await waitFor(() => expect(selectedRow()).toHaveTextContent('Brass Key'));
    await waitFor(() => expect(screen.getByRole('tab', { name: /Profile/, selected: true })).toBeInTheDocument());
  });

  it('finds only the item in Simple mode, which hides the Scripts and Tools tabs', async () => {
    renderWorldEditorBench(WORLD, 'simple');
    search('bell');
    await waitFor(() => expect(counter()).toBe('1 / 1'));
    await waitFor(() => expect(selectedRow()).toHaveTextContent('Brass Key'));
  });
});
