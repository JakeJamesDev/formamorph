import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, within, act } from '@testing-library/react';
import { benchEditorWorld, openEditorTab, renderWorldEditorBench } from '@/test/worldEditorBench';
import { $createParagraphNode, $createTextNode, $getRoot, getNearestEditorFromDOMNode } from 'lexical';
import { blankItem } from '@/lib/items';
import type { Item, Slot, World } from '@/types';

/** The item panel's Icon field: Auto's preview, the three choices, search, and undo. */

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

const SLOTS: Slot[] = [{ id: 'finger', name: 'Finger' }];
const ITEMS: Item[] = [
  blankItem('blade', 'Iron Sword'),
  { ...blankItem('plain', 'Zzzz'), slotRule: { mode: 'either', slotIds: ['finger'] } },
  { ...blankItem('stale', 'Old Axe'), icon: 'retired-icon' },
  { ...blankItem('lit', 'Old Lamp'), icon: 'lantern' },
];
const WORLD: World = benchEditorWorld({ items: ITEMS, slots: SLOTS } as Partial<World>);

const render = (name: string) => {
  const bench = renderWorldEditorBench(WORLD, 'simple');
  openEditorTab(/Items/);
  fireEvent.click(screen.getByText(name));
  const id = ITEMS.find((i) => i.name === name)?.id;
  return { ...bench, stored: () => bench.ctx().items.find((i) => i.id === id) as Item };
};

const field = () => screen.getByText('Icon', { selector: 'label' }).closest('[data-history-field]') as HTMLElement;
const trigger = () => within(field()).getByRole('button', { name: 'Icon' });
const shownIcon = () => trigger().querySelector('[data-item-icon]')?.getAttribute('data-item-icon');
const shownChoice = () => trigger().textContent;
const openGrid = () => fireEvent.click(trigger());
const tile = (name: string) => screen.getByRole('button', { name });
const grid = () => within(screen.getByRole('searchbox', { name: 'Search Icons' }).closest('[role="dialog"]') as HTMLElement);

beforeEach(() => { localStorage.clear(); });

describe('Icon field', () => {
  it('reads Auto on a new item and writes no icon value', () => {
    const { stored } = render('Iron Sword');
    expect(shownChoice()).toBe('Auto');
    expect(stored()).not.toHaveProperty('icon');
  });

  it('shows the derived icon and follows the name', async () => {
    render('Iron Sword');
    expect(shownIcon()).toBe('sword');
    const editor = getNearestEditorFromDOMNode(screen.getByRole('textbox', { name: 'Name' }));
    await act(async () => {
      editor?.update(() => { $getRoot().clear().append($createParagraphNode().append($createTextNode('Iron Axe'))); }, { discrete: true });
    });
    expect(shownIcon()).toBe('axe');
  });

  it('derives from the slot when the name matches no word', () => {
    render('Zzzz');
    expect(shownIcon()).toBe('ring');
  });

  it('reads an unknown id as Auto', () => {
    render('Old Axe');
    expect(shownChoice()).toBe('Auto');
    expect(shownIcon()).toBe('axe');
  });

  it('writes the id for an icon, none for None, and removes the value for Auto', () => {
    const { stored } = render('Iron Sword');
    openGrid();
    fireEvent.click(tile('Lantern'));
    expect(stored().icon).toBe('lantern');
    expect(shownChoice()).toBe('Lantern');
    expect(shownIcon()).toBe('lantern');

    openGrid();
    expect(tile('Lantern').getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(tile('None'));
    expect(stored().icon).toBe('none');
    expect(shownChoice()).toBe('None');
    expect(shownIcon()).toBeUndefined();

    openGrid();
    fireEvent.click(tile('Auto'));
    expect(JSON.parse(JSON.stringify(stored()))).not.toHaveProperty('icon');
    expect(shownChoice()).toBe('Auto');
  });

  it('finds an icon by a catalog word, and says so when nothing matches', () => {
    render('Iron Sword');
    openGrid();
    const box = screen.getByRole('searchbox', { name: 'Search Icons' });
    fireEvent.change(box, { target: { value: 'scimitar' } });
    expect(tile('Sword')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Dagger' })).toBeNull();
    expect(grid().queryByRole('status')).toBeNull();

    fireEvent.change(box, { target: { value: 'zzzzz' } });
    expect(grid().getByRole('status').textContent).toBe('No matches');
    expect(tile('Auto')).toBeTruthy();
    expect(tile('None')).toBeTruthy();
  });

  it('starts each opening with an empty search', () => {
    render('Iron Sword');
    openGrid();
    fireEvent.change(screen.getByRole('searchbox', { name: 'Search Icons' }), { target: { value: 'scimitar' } });
    fireEvent.click(tile('Sword'));
    openGrid();
    expect((screen.getByRole('searchbox', { name: 'Search Icons' }) as HTMLInputElement).value).toBe('');
  });

  it('undoes a pick back to Auto', () => {
    const bench = render('Iron Sword');
    openGrid();
    fireEvent.click(tile('Lantern'));
    act(() => bench.history().undo());
    expect(bench.stored().icon).toBeUndefined();
    expect(shownChoice()).toBe('Auto');
  });

  it('undoes a pick back to the previous icon', () => {
    const bench = render('Old Lamp');
    openGrid();
    fireEvent.click(tile('None'));
    expect(bench.stored().icon).toBe('none');
    act(() => bench.history().undo());
    expect(bench.stored().icon).toBe('lantern');
    expect(shownChoice()).toBe('Lantern');
  });
});
