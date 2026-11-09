import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, within } from '@testing-library/react';
import type { World } from '@/types';
import { renderEntitiesTab } from '@/test/entitiesTabBench';
import { panelWorld, entityFieldsTab } from '@/test/panelBench';

/** The toolbar on an entity's Openings tab. */

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

const WORLD: World = panelWorld({
  worldOverview: {
    name: 'Sedge Landing', description: '', author: '', thumbnail: null, bgm: null,
    systemPrompt: 'Narrate the fen.', readme: 'A fen primer.', tags: [],
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

const openEntityOpenings = () => {
  fireEvent.click(screen.getByText('Odd Wick'));
  fireEvent.mouseDown(entityFieldsTab('Openings'));
};

beforeEach(() => { localStorage.clear(); });

describe('the entity Openings tab toolbar', () => {
  it('filters the entity’s cards and shows a no-match line', () => {
    renderEntitiesTab(WORLD, 'advanced');
    openEntityOpenings();
    expect(cards()).toEqual(['Opening 1', 'Opening 2']);

    search('Search openings', 'GULL');
    expect(cards()).toEqual(['Opening 2']);

    search('Search openings', 'lantern');
    expect(cards()).toEqual([]);
    expect(screen.getByText('No openings match “lantern”.')).toBeInTheDocument();
  });

  it('adds to the entity with the + and clears the box', () => {
    const { ctx } = renderEntitiesTab(WORLD, 'advanced');
    openEntityOpenings();

    search('Search openings', 'gull');
    fireEvent.click(screen.getByRole('button', { name: 'Add Opening' }));
    expect(ctx().entities[0].openings?.map((o) => o.id)).toEqual(['e1', 'e2', expect.any(String)]);
    expect(screen.getByPlaceholderText('Search openings')).toHaveValue('');
    expect(cards()).toEqual(['Opening 1', 'Opening 2', 'Opening 3']);
  });
});
