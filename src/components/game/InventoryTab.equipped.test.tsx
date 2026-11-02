import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TOOLTIP_DELAY_MS, TooltipProvider } from '@/components/ui/tooltip';
import { dollColumnWidth } from '@/lib/bodyLayout';
import { onFakeClock } from '@/test/fakeClock';
import { InventoryTab, type InventoryTabProps } from './InventoryTab';
import type { Body, Item, ItemCopy, Slot } from '@/types';

const LONG = 'Greatsword of the Very Long Name That Never Fits';
const slots: Slot[] = [{ id: 'hand', name: 'Hand' }, { id: 'head', name: 'Head' }];
const body = (aspect: number): Body => ({
  id: 'b', name: 'B', backdrop: { kind: 'plain' }, aspect,
  entries: [{ slotId: 'hand', boxes: [{ x: 0, y: 0, w: 0.5, h: 0.5 }] }, { slotId: 'head', boxes: [{ x: 0.5, y: 0, w: 0.5, h: 0.25 }] }],
});
const item = (id: string, name: string, over: Partial<Item> = {}): Item =>
  ({ id, name, stackable: false, statEffects: [], traitEffects: [], equipRequires: [], ...over });
const items = [
  item('sword', LONG, { slotRule: { mode: 'either', slotIds: ['hand'] } }),
  item('halberd', 'Halberd', { slotRule: { mode: 'all', slotIds: ['hand', 'head'] } }),
  item('wand', 'Ash Wand', { uses: 3, whenEmpty: { kind: 'stays' }, slotRule: { mode: 'either', slotIds: ['hand'] } }),
];
const worn = (id: string, itemId: string, slotId = 'hand', over: Partial<ItemCopy> = {}): ItemCopy =>
  ({ id, item: { kind: 'item', itemId }, where: { kind: 'you' }, quantity: 1, visibility: 'visible', equipped: { slotId, order: 1 }, ...over });
const props = (over: Partial<InventoryTabProps>): InventoryTabProps => ({
  ownerName: null, copies: [], lying: [], items, body: body(0.5), slots: slots.map((slot) => ({ slot, capacity: 1 })), worldSlots: slots, present: [], locationId: 'yard',
  disabled: false, resolveText: (text) => text, onOps: vi.fn(), ...over,
});

const list = () => screen.getByRole('list', { name: 'Equipped Items' });
const layout = () => screen.getByRole('group', { name: 'Equipped' }).closest('[data-doll-layout]')?.getAttribute('data-doll-layout');
const buttonNames = (el: HTMLElement) => within(el).getAllByRole('button').map((b) => b.getAttribute('aria-label') ?? b.textContent);

/** Stub: jsdom has no layout, so each test sets the box and content widths a browser would report. */
const setWidths = (scroll: number, client: number) => {
  Object.defineProperty(Element.prototype, 'scrollWidth', { configurable: true, get: () => scroll });
  Object.defineProperty(Element.prototype, 'clientWidth', { configurable: true, get: () => client });
};

afterEach(() => {
  vi.useRealTimers();
  delete (Element.prototype as { scrollWidth?: number }).scrollWidth;
  delete (Element.prototype as { clientWidth?: number }).clientWidth;
});

describe('doll and Equipped layout', () => {
  it.each([[0.5, 'columns'], [1, 'columns'], [1.01, 'stacked'], [1.6, 'stacked']])('a Body of aspect %s lays out as %s', (aspect, expected) => {
    render(<InventoryTab {...props({ body: body(aspect) })} />);
    expect(layout()).toBe(expected);
  });

  it('keeps the doll a third wide, from 120px up to its full width', () => {
    expect(dollColumnWidth(0.5)).toBe('clamp(120px, 33%, 160px)');
  });

  it('lets a Body too narrow for 120px stop at its full width', () => {
    expect(dollColumnWidth(0.3)).toBe('clamp(96px, 33%, 96px)');
  });
});

describe('Equipped rows', () => {
  it('shows an All of item once, with both slot names', () => {
    render(<InventoryTab {...props({ copies: [worn('a', 'halberd')] })} />);
    expect(within(list()).getAllByRole('listitem')).toHaveLength(1);
    expect(within(list()).getByText('Hand, Head')).toBeInTheDocument();
  });

  it('shows the slot names instead of the uses line, and the popup keeps the uses line', async () => {
    render(<InventoryTab {...props({ copies: [worn('w', 'wand')] })} />);
    expect(within(list()).getByText('Hand')).toBeInTheDocument();
    expect(within(list()).queryByText('3 of 3 uses')).toBeNull();
    await userEvent.click(within(list()).getByRole('button', { name: 'Ash Wand' }));
    expect(within(await screen.findByRole('dialog')).getByText('3 of 3 uses')).toBeInTheDocument();
  });

  it('unequips in one click, with no popover', async () => {
    const onOps = vi.fn();
    render(<InventoryTab {...props({ copies: [worn('s', 'sword')], onOps })} />);
    await userEvent.click(within(list()).getByRole('button', { name: `Unequip ${LONG}` }));
    expect(onOps).toHaveBeenCalledExactlyOnceWith([{ kind: 'unequip', copyId: 's' }]);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('opens the item popup from the row name in one press', async () => {
    render(<InventoryTab {...props({ copies: [worn('s', 'sword')] })} />);
    await userEvent.click(within(list()).getByRole('button', { name: LONG }));
    const popup = await screen.findByRole('dialog');
    expect(within(popup).getByRole('heading', { name: LONG })).toBeInTheDocument();
    expect(within(popup).queryByRole('button', { name: `Unequip ${LONG}` })).toBeNull();
  });

  it('keeps the row in the Slot Box popover, with Unequip', async () => {
    render(<InventoryTab {...props({ copies: [worn('s', 'sword')] })} />);
    await userEvent.click(screen.getByRole('button', { name: `Hand: ${LONG}` }));
    expect(buttonNames(await screen.findByRole('dialog'))).toContain(`Unequip ${LONG}`);
  });

  it('shows the full name unclipped in the Slot Box popover', async () => {
    render(<InventoryTab {...props({ copies: [worn('s', 'sword')] })} />);
    await userEvent.click(screen.getByRole('button', { name: `Hand: ${LONG}` }));
    const name = within(await screen.findByRole('dialog')).getByRole('button', { name: LONG });
    expect(name).not.toHaveClass('truncate');
    expect(name).toHaveTextContent(LONG);
  });

  it('opens the item popup from the name inside the Slot Box popover', async () => {
    render(<InventoryTab {...props({ copies: [worn('s', 'sword')] })} />);
    await userEvent.click(screen.getByRole('button', { name: `Hand: ${LONG}` }));
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: LONG }));
    expect(await screen.findByRole('heading', { name: LONG })).toBeInTheDocument();
  });

  it('shows a cut name in full in a tooltip', async () => {
    setWidths(300, 120);
    render(<TooltipProvider><InventoryTab {...props({ copies: [worn('s', 'sword')] })} /></TooltipProvider>);
    await userEvent.hover(within(list()).getByRole('button', { name: LONG }));
    expect(await screen.findByText(LONG, { selector: 'div' })).toBeVisible();
  });

  it('shows no tooltip for a name that fits', async () => {
    setWidths(120, 120);
    render(<TooltipProvider><InventoryTab {...props({ copies: [worn('s', 'sword')] })} /></TooltipProvider>);
    vi.useFakeTimers();
    await onFakeClock((user) => user.hover(within(list()).getByRole('button', { name: LONG })));
    await act(() => vi.advanceTimersByTimeAsync(TOOLTIP_DELAY_MS));
    expect(screen.queryByText(LONG, { selector: 'div' })).toBeNull();
  });

  it('leaves a copy with no box out of the list, under Carried', () => {
    render(<InventoryTab {...props({ copies: [worn('a', 'sword'), worn('b', 'wand')] })} />);
    expect(within(list()).getAllByRole('listitem')).toHaveLength(1);
    expect(within(list()).queryByText('Ash Wand')).toBeNull();
    expect(screen.getByRole('button', { name: 'Unequip Ash Wand' })).toBeInTheDocument();
  });

  it('shows the empty state with nothing equipped', () => {
    render(<InventoryTab {...props({})} />);
    expect(screen.queryByRole('list', { name: 'Equipped Items' })).toBeNull();
    expect(screen.getByText('Nothing is equipped.')).toHaveAttribute('role', 'status');
  });
});
