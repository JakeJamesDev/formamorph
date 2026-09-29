import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, within } from '@testing-library/react';
import { benchEditorWorld, entityFieldsTab, openEditorTab, renderWorldEditorBench } from '@/test/worldEditorBench';
import type { World } from '@/types';

/** The Openings panels on the List Editor's toolbar: a search over the cards and a + that adds one (Q20, Q40). */

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
  worldOverview: {
    name: 'Sedge Landing', description: '', author: '', thumbnail: null, bgm: null,
    systemPrompt: 'Narrate the fen.', readme: 'A fen primer.', use3DModel: true, tags: [],
    openings: [
      { id: 'w1', text: 'You wake in the reed-beds.', kind: 'narration' },
      { id: 'w2', text: 'The ferry bell rings.', kind: 'narration' },
    ],
    openingWeights: { w2: 3 },
  },
  entities: [{
    id: 'resident', name: 'Odd Wick', locations: ['harbor'],
    openings: [
      { id: 'e1', text: 'Odd Wick trims the lamp.', kind: 'narration' },
      { id: 'e2', text: 'A gull steals your bread.', kind: 'action' },
    ],
  }],
} as unknown as Partial<World>);

const search = (placeholder: string, term: string) =>
  fireEvent.change(screen.getByPlaceholderText(placeholder), { target: { value: term } });

const cards = () => screen.queryAllByTestId('opening-row').map((row) => within(row).getAllByText(/^Opening \d+$/)[0].textContent);

const openWorldOpenings = () => fireEvent.click(screen.getByRole('radio', { name: 'Openings' }));

const openEntityOpenings = () => {
  openEditorTab(/Entities/);
  fireEvent.click(screen.getByText('Odd Wick'));
  fireEvent.mouseDown(entityFieldsTab('Openings'));
};

beforeEach(() => { localStorage.clear(); });

describe('the world Openings panel toolbar', () => {
  it('filters every group by card text and hides a group with no match', async () => {
    renderWorldEditorBench(WORLD, 'advanced');
    await screen.findByLabelText('World Name');
    openWorldOpenings();
    expect(cards()).toEqual(['Opening 1', 'Opening 2', 'Opening 1', 'Opening 2']);

    search('Search openings', 'ferry');
    expect(cards()).toEqual(['Opening 2']);
    expect(screen.getByLabelText('Draw weight for Opening 2')).toHaveValue(3);
    expect(screen.queryByRole('region', { name: 'Odd Wick' })).toBeNull();

    search('Search openings', 'gull');
    expect(cards()).toEqual(['Opening 2']);
    expect(screen.queryByRole('region', { name: 'This World' })).toBeNull();
    expect(screen.getByRole('region', { name: 'Odd Wick' })).toBeInTheDocument();
  });

  it('shows a no-match line when no card matches', async () => {
    renderWorldEditorBench(WORLD, 'advanced');
    await screen.findByLabelText('World Name');
    openWorldOpenings();

    search('Search openings', 'lantern');
    expect(cards()).toEqual([]);
    expect(screen.getByText('No openings match “lantern”.')).toBeInTheDocument();
  });

  it('adds a world opening with the +, clears the box, and keeps the chances', async () => {
    const { ctx } = renderWorldEditorBench(WORLD, 'advanced');
    await screen.findByLabelText('World Name');
    openWorldOpenings();

    search('Search openings', 'ferry');
    fireEvent.click(screen.getByRole('button', { name: 'Add Opening' }));
    expect(ctx().worldOverview.openings?.map((o) => o.id)).toEqual(['w1', 'w2', expect.any(String)]);
    expect(ctx().worldOverview.openings?.[2]).toMatchObject({ text: '', kind: 'action' });
    expect(ctx().worldOverview.openingWeights).toEqual({ w2: 3 });
    expect(screen.getByPlaceholderText('Search openings')).toHaveValue('');
    expect(ctx().entities[0].openings).toHaveLength(2);
  });

  it('keeps each entity group’s own add button', async () => {
    const { ctx } = renderWorldEditorBench(WORLD, 'advanced');
    await screen.findByLabelText('World Name');
    openWorldOpenings();

    fireEvent.click(screen.getByRole('button', { name: 'Add Opening to Odd Wick' }));
    expect(ctx().entities[0].openings).toHaveLength(3);
    expect(ctx().worldOverview.openings).toHaveLength(2);
  });
});

describe('the entity Openings tab toolbar', () => {
  it('filters the entity’s cards and shows a no-match line', () => {
    renderWorldEditorBench(WORLD, 'advanced');
    openEntityOpenings();
    expect(cards()).toEqual(['Opening 1', 'Opening 2']);

    search('Search openings', 'GULL');
    expect(cards()).toEqual(['Opening 2']);

    search('Search openings', 'lantern');
    expect(cards()).toEqual([]);
    expect(screen.getByText('No openings match “lantern”.')).toBeInTheDocument();
  });

  it('adds to the entity with the + and clears the box', () => {
    const { ctx } = renderWorldEditorBench(WORLD, 'advanced');
    openEntityOpenings();

    search('Search openings', 'gull');
    fireEvent.click(screen.getByRole('button', { name: 'Add Opening' }));
    expect(ctx().entities[0].openings?.map((o) => o.id)).toEqual(['e1', 'e2', expect.any(String)]);
    expect(screen.getByPlaceholderText('Search openings')).toHaveValue('');
    expect(cards()).toEqual(['Opening 1', 'Opening 2', 'Opening 3']);
  });
});
