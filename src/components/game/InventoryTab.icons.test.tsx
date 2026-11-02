import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { InventoryTab, type InventoryTabProps } from './InventoryTab';
import type { Body, Item, ItemCopy, Slot } from '@/types';

const IMAGE = 'data:image/webp;base64,AAAA';
const slots: Slot[] = [{ id: 'head', name: 'Head' }, { id: 'neck', name: 'Neck' }];
const body: Body = {
  id: 'b', name: 'B', backdrop: { kind: 'plain' }, aspect: 1,
  entries: [{ slotId: 'head', boxes: [{ x: 0, y: 0, w: 0.5, h: 0.5 }] }],
};
const item = (id: string, name: string, over: Partial<Item> = {}): Item =>
  ({ id, name, stackable: false, statEffects: [], traitEffects: [], equipRequires: [], ...over });
const carried = (itemId: string, over: Partial<ItemCopy> = {}): ItemCopy =>
  ({ id: `c-${itemId}`, item: { kind: 'item', itemId }, where: { kind: 'you' }, quantity: 1, visibility: 'visible', ...over });
const worn = (itemId: string, over: Partial<ItemCopy> = {}): ItemCopy => carried(itemId, { equipped: { slotId: 'head', order: 1 }, ...over });

const head = { slotRule: { mode: 'either' as const, slotIds: ['head'] } };
const LONG = 'Helmet of the Very Long Name That Never Fits';

const props = (over: Partial<InventoryTabProps>): InventoryTabProps => ({
  ownerName: null, copies: [], lying: [], items: [], slots: [{ slot: slots[0], capacity: 1 }], worldSlots: slots, body, present: [], locationId: 'yard',
  disabled: false, resolveText: (text) => text, imageOf: () => IMAGE, onOps: vi.fn(), ...over,
});
const box = () => screen.getByRole('button', { name: /^Head: / });
const iconIn = (el: Element) => el.querySelector('[data-item-icon]')?.getAttribute('data-item-icon');
const rowOf = (name: string) => screen.getByRole('button', { name }).closest('li')!;

describe('item popup header', () => {
  const headerOf = async (name: string) => {
    await userEvent.click(screen.getByRole('button', { name }));
    return within(await screen.findByRole('dialog')).getByRole('heading', { name }).parentElement!;
  };

  it('shows the derived icon beside the name', async () => {
    render(<InventoryTab {...props({ items: [item('h', 'Iron Helmet')], copies: [carried('h')] })} />);
    expect(iconIn(await headerOf('Iron Helmet'))).toBe('helmet');
  });

  it('shows a specific icon', async () => {
    render(<InventoryTab {...props({ items: [item('h', 'Iron Helmet', { icon: 'crown' })], copies: [carried('h')] })} />);
    expect(iconIn(await headerOf('Iron Helmet'))).toBe('crown');
  });

  it('shows no icon under None', async () => {
    render(<InventoryTab {...props({ items: [item('h', 'Iron Helmet', { icon: 'none' })], copies: [carried('h')] })} />);
    expect(iconIn(await headerOf('Iron Helmet'))).toBeUndefined();
  });

  it('never shows an unidentified copy its authored icon', async () => {
    const ring = item('r', 'Crown of Curses', { icon: 'crown', unidentifiedName: 'Plain Ring' });
    render(<InventoryTab {...props({ items: [ring], copies: [carried('r', { state: { unidentified: true } })] })} />);
    expect(iconIn(await headerOf('Plain Ring'))).toBe('ring');
  });
});

describe('filled Slot Box', () => {
  it('Auto shows the derived icon, with no long text and no image', () => {
    render(<InventoryTab {...props({ items: [item('h', LONG, head)], copies: [worn('h')] })} />);
    expect(iconIn(box())).toBe('helmet');
    expect(box()).toHaveTextContent('');
    expect(box().querySelector('img')).toBeNull();
    expect(box()).toHaveAccessibleName(`Head: ${LONG}`);
  });

  it('a specific icon beats the image and the name', () => {
    render(<InventoryTab {...props({ items: [item('h', LONG, { ...head, icon: 'crown' })], copies: [worn('h')] })} />);
    expect(iconIn(box())).toBe('crown');
    expect(box().querySelector('img')).toBeNull();
  });

  it('None shows the image', () => {
    render(<InventoryTab {...props({ items: [item('h', LONG, { ...head, icon: 'none' })], copies: [worn('h')] })} />);
    expect(box().querySelector('img')).toHaveAttribute('src', IMAGE);
    expect(iconIn(box())).toBeUndefined();
  });

  it('None with no image is a plain filled box, with its name kept for the tooltip', () => {
    render(<InventoryTab {...props({ items: [item('h', LONG, { ...head, icon: 'none' })], copies: [worn('h')], imageOf: () => undefined })} />);
    expect(box()).toHaveTextContent('');
    expect(box().querySelector('img, svg')).toBeNull();
    expect(box()).toHaveAccessibleName(`Head: ${LONG}`);
  });

  it('an unidentified copy shows neither its authored icon nor its image', () => {
    const cursed = item('h', 'Crown of Curses', { ...head, icon: 'crown', unidentifiedName: 'Cloudy Vial' });
    render(<InventoryTab {...props({ items: [cursed], copies: [worn('h', { state: { unidentified: true } })] })} />);
    expect(iconIn(box())).toBe('vial');
    expect(box().querySelector('img')).toBeNull();
  });

  it('an All of item shows its icon in every box it fills', () => {
    const two: Body = { ...body, entries: [...body.entries, { slotId: 'neck', boxes: [{ x: 0.5, y: 0, w: 0.5, h: 0.5 }] }] };
    const halberd = item('h', 'Halberd', { slotRule: { mode: 'all', slotIds: ['head', 'neck'] } });
    render(<InventoryTab {...props({ body: two, slots: slots.map((slot) => ({ slot, capacity: 1 })), items: [halberd], copies: [worn('h')] })} />);
    const doll = screen.getByRole('group', { name: 'Equipped' });
    expect(within(doll).getAllByRole('button').map(iconIn)).toEqual(['spear', 'spear']);
  });
});

describe('Carried and Here rows', () => {
  it.each([
    ['Auto', {}, { icon: 'helmet', image: false }],
    ['specific', { icon: 'crown' }, { icon: 'crown', image: false }],
    ['None', { icon: 'none' }, { icon: undefined, image: true }],
  ])('%s with an image shows the same result in Carried and Here', (_label, over, want) => {
    const items = [item('a', 'Iron Helmet', over), item('b', 'Iron Helmet', over)];
    render(<InventoryTab {...props({
      body: undefined, slots: [], items, copies: [carried('a')],
      lying: [carried('b', { where: { kind: 'location', id: 'yard' } })],
    })} />);
    const rows = screen.getAllByRole('button', { name: 'Iron Helmet' }).map((b) => b.closest('li')!);
    expect(rows).toHaveLength(2);
    for (const row of rows) {
      expect(iconIn(row)).toBe(want.icon);
      expect(!!row.querySelector('img')).toBe(want.image);
    }
  });

  it('None with no image shows no icon', () => {
    render(<InventoryTab {...props({ body: undefined, slots: [], items: [item('a', 'Iron Helmet', { icon: 'none' })], copies: [carried('a')], imageOf: () => undefined })} />);
    const row = rowOf('Iron Helmet');
    expect(row.querySelector('img, [data-item-icon]')).toBeNull();
  });

  it('an unidentified row shows its face icon, never the authored icon or image', () => {
    const cursed = item('a', 'Crown of Curses', { icon: 'crown', unidentifiedName: 'Cloudy Vial' });
    render(<InventoryTab {...props({ body: undefined, slots: [], items: [cursed], copies: [carried('a', { state: { unidentified: true } })] })} />);
    const row = rowOf('Cloudy Vial');
    expect(iconIn(row)).toBe('vial');
    expect(row.querySelector('img')).toBeNull();
  });

  it('reads the slot from the world, so a slot the Body lacks still names the icon', () => {
    render(<InventoryTab {...props({ items: [item('a', 'Whisper', { slotRule: { mode: 'either', slotIds: ['neck'] } })], copies: [carried('a')] })} />);
    expect(iconIn(rowOf('Whisper'))).toBe('necklace');
  });

  it('derives from the name the player reads, after placeholders', () => {
    const resolveText = (text: string) => text.replace('{{thing}}', 'Boots');
    render(<InventoryTab {...props({ body: undefined, slots: [], items: [item('a', 'Old {{thing}}')], copies: [carried('a')], resolveText })} />);
    expect(iconIn(rowOf('Old Boots'))).toBe('boots');
  });

  it('an item the AI created takes the same path', () => {
    const copy: ItemCopy = { id: 'r', item: { kind: 'runtime', runtimeItemId: 'rt' }, where: { kind: 'you' }, quantity: 1, visibility: 'visible' };
    render(<InventoryTab {...props({ body: undefined, slots: [], copies: [copy], runtimeItems: [{ id: 'rt', name: 'Rusty Dagger' }], imageOf: undefined })} />);
    expect(iconIn(rowOf('Rusty Dagger'))).toBe('dagger');
  });

  it('an item with no name reads the generic icon', () => {
    render(<InventoryTab {...props({ body: undefined, slots: [], items: [item('a', '')], copies: [carried('a')], imageOf: undefined })} />);
    expect(iconIn(rowOf('Unknown Item'))).toBe('generic');
  });
});
