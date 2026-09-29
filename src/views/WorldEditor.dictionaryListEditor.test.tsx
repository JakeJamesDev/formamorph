import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, within } from '@testing-library/react';
import { benchEditorWorld, openEditorTab, renderWorldEditorBench } from '@/test/worldEditorBench';
import type { World } from '@/types';

/** The top-level Dictionary tab on the List Editor: the book tree, a flat search over books and entries. */

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

/** Two books share an entry name, so a search row that dropped its book would read alike. */
const WORLD: World = benchEditorWorld({
  dictionaries: [
    {
      id: 'b1', name: 'Fen Lore', enabled: true,
      entries: [
        { id: 'e1', name: 'Hostile Forces', key: ['dragon'], value: 'A big lizard.' },
        { id: 'e2', name: 'Lamp Oil', key: ['reed'], value: 'Smells of the marsh.' },
      ],
    },
    {
      id: 'b2', name: 'Harbor Lore', enabled: true,
      entries: [{ id: 'e3', name: 'Lamp Oil', key: ['lamp'], value: 'Burns blue.' }],
    },
  ],
} as Partial<World>);

const box = () => screen.getByPlaceholderText('Search or add new dictionaries') as HTMLInputElement;
const search = (term: string) => fireEvent.change(box(), { target: { value: term } });
/** The tree's fold buttons, one per book in order: Fen Lore, then Harbor Lore. */
const folds = (name: 'Collapse dictionary' | 'Expand dictionary') => screen.getAllByRole('button', { name });
const row = (label: string) => screen.getByRole('button', { name: `Select ${label}` }).parentElement as HTMLElement;

beforeEach(() => { localStorage.clear(); });

describe('the Dictionary tab search', () => {
  it('lists matching books and entries flat, each entry under its book', () => {
    renderWorldEditorBench(WORLD, 'advanced');
    openEditorTab(/Dictionary/);

    search('lamp');
    expect(screen.getByRole('button', { name: 'Select Fen Lore › Lamp Oil' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Select Harbor Lore › Lamp Oil' })).toBeInTheDocument();
    expect(screen.queryByText('Hostile Forces')).toBeNull();

    search('harbor');
    expect(screen.getByRole('button', { name: 'Select Harbor Lore' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Select Fen Lore' })).toBeNull();

    search('zzz');
    expect(screen.getByText('No dictionaries match “zzz”.')).toBeInTheDocument();
  });

  it('opens the entry a search row selects', () => {
    renderWorldEditorBench(WORLD, 'advanced');
    openEditorTab(/Dictionary/);

    search('lamp');
    fireEvent.click(screen.getByRole('button', { name: 'Select Harbor Lore › Lamp Oil' }));
    expect(screen.getByText('Burns blue.')).toBeInTheDocument();
  });

  it('adds an entry to a book from its search row and opens it', () => {
    const { ctx } = renderWorldEditorBench(WORLD, 'advanced');
    openEditorTab(/Dictionary/);

    search('Harbor');
    fireEvent.click(within(row('Harbor Lore')).getByRole('button', { name: 'Add entry' }));
    const harbor = ctx().dictionaries.find((b) => b.id === 'b2')!;
    expect(harbor.entries).toHaveLength(2);
    expect(screen.getByRole('tab', { name: 'Details' })).toHaveAttribute('aria-selected', 'true');
  });

  it('asks before it deletes a book from its search row', () => {
    const { ctx } = renderWorldEditorBench(WORLD, 'advanced');
    openEditorTab(/Dictionary/);

    search('Harbor');
    fireEvent.click(within(row('Harbor Lore')).getByRole('button', { name: 'Delete dictionary' }));
    expect(ctx().dictionaries.some((b) => b.id === 'b2')).toBe(true);
    fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Confirm' }));
    expect(ctx().dictionaries.some((b) => b.id === 'b2')).toBe(false);
  });

  it('duplicates and deletes an entry from its search row', () => {
    const { ctx } = renderWorldEditorBench(WORLD, 'advanced');
    openEditorTab(/Dictionary/);

    search('Hostile');
    fireEvent.click(within(row('Fen Lore › Hostile Forces')).getByRole('button', { name: 'Duplicate' }));
    expect(ctx().dictionaries[0].entries.filter((e) => e.name.startsWith('Hostile Forces'))).toHaveLength(2);

    fireEvent.click(within(row('Fen Lore › Hostile Forces')).getByRole('button', { name: 'Delete' }));
    expect(ctx().dictionaries[0].entries.some((e) => e.id === 'e1')).toBe(false);
  });
});

describe('the Dictionary tab folds', () => {
  it('keeps a folded book folded through a search', () => {
    renderWorldEditorBench(WORLD, 'advanced');
    openEditorTab(/Dictionary/);
    fireEvent.click(folds('Collapse dictionary')[0]);
    expect(screen.queryByText('Hostile Forces')).toBeNull();

    search('lamp');
    search('');
    expect(screen.queryByText('Hostile Forces')).toBeNull();
    expect(folds('Expand dictionary')).toHaveLength(1);
  });

  it('unfolds a book that gets an entry from its search row', () => {
    renderWorldEditorBench(WORLD, 'advanced');
    openEditorTab(/Dictionary/);
    fireEvent.click(folds('Collapse dictionary')[1]);

    search('Harbor');
    fireEvent.click(within(row('Harbor Lore')).getByRole('button', { name: 'Add entry' }));
    search('');
    expect(folds('Collapse dictionary')).toHaveLength(2);
  });

  it('draws no grip and no enabled box on a search row', () => {
    renderWorldEditorBench(WORLD, 'advanced');
    openEditorTab(/Dictionary/);
    expect(screen.getAllByRole('checkbox').length).toBeGreaterThan(0);

    search('Lore');
    expect(within(row('Fen Lore')).queryByRole('checkbox')).toBeNull();
    expect(within(row('Fen Lore')).queryByLabelText(/^Drag/)).toBeNull();
  });
});

describe('the Dictionary tab selection', () => {
  it('reopens the entry after a trip to another tab', () => {
    renderWorldEditorBench(WORLD, 'advanced');
    openEditorTab(/Dictionary/);
    fireEvent.click(screen.getByText('Hostile Forces'));

    openEditorTab(/Stats/);
    openEditorTab(/Dictionary/);
    expect(screen.getByText('A big lizard.')).toBeInTheDocument();
  });
});
