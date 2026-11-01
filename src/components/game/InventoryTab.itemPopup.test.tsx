import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { bodyFixture } from '@/test/bodyFixture';
import { bodySlots } from '@/lib/bodies';
import { InventoryTab, type InventoryTabProps } from './InventoryTab';
import type { Item, ItemCopy, Slot } from '@/types';

const IMAGE = 'data:image/webp;base64,AAAA';
const item = (id: string, name: string, over: Partial<Item> = {}): Item =>
  ({ id, name, statEffects: [], traitEffects: [], equipRequires: [], ...over });
const items = [
  item('wand', 'Ash Wand', { playerDescription: 'A wand of pale ash wood.', uses: 3, whenEmpty: { kind: 'stays' }, bound: true }),
  item('coin', 'Coin', { playerDescription: 'A worn coin.' }),
  item('ring', 'Ring of Curses', { playerDescription: 'It binds the wearer.', unidentifiedName: 'Plain Ring', unidentifiedDescription: 'A dull band.' }),
  item('sword', 'Greatsword', { playerDescription: 'A long blade.', slotRule: { mode: 'either', slotIds: ['hand'] } }),
];
const copy = (id: string, itemId: string, over: Partial<ItemCopy> = {}): ItemCopy =>
  ({ id, item: { kind: 'item', itemId }, where: { kind: 'you' }, quantity: 1, visibility: 'visible', ...over });

const props = (over: Partial<InventoryTabProps> = {}): InventoryTabProps => ({
  ownerName: null, copies: [], lying: [], items, slots: [], present: [], locationId: 'yard', disabled: false,
  resolveText: (text) => text, onOps: vi.fn(), ...over,
});
const popup = () => screen.queryByRole('dialog');

describe('InventoryTab item popup', () => {
  it('shows a carried item’s description, image, uses and Bound when its row is selected', async () => {
    render(<InventoryTab {...props({ copies: [copy('w', 'wand')], imageOf: () => IMAGE })} />);
    expect(popup()).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Ash Wand' }));
    const dialog = within(screen.getByRole('dialog'));
    expect(dialog.getByRole('heading', { name: 'Ash Wand' })).toBeInTheDocument();
    expect(dialog.getByText('A wand of pale ash wood.')).toBeInTheDocument();
    expect(dialog.getByAltText('Ash Wand')).toHaveAttribute('src', IMAGE);
    expect(dialog.getByText('3 of 3 uses')).toBeInTheDocument();
    expect(dialog.getByText("Bound: you can't drop or give it")).toBeInTheDocument();
  });

  it('draws no picture for an item with no image', async () => {
    render(<InventoryTab {...props({ copies: [copy('c', 'coin', { quantity: 4 })] })} />);
    await userEvent.click(screen.getByRole('button', { name: 'Coin' }));
    const dialog = within(screen.getByRole('dialog'));
    expect(dialog.getByText('A worn coin.')).toBeInTheDocument();
    expect(dialog.getByText('×4')).toBeInTheDocument();
    expect(dialog.queryByRole('img')).toBeNull();
  });

  it('keeps an unidentified copy on its unidentified face', async () => {
    render(<InventoryTab {...props({ copies: [copy('r', 'ring', { state: { unidentified: true } })] })} />);
    await userEvent.click(screen.getByRole('button', { name: 'Plain Ring' }));
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText('A dull band.')).toBeInTheDocument();
    expect(dialog.textContent).not.toContain('Ring of Curses');
    expect(dialog.textContent).not.toContain('It binds the wearer.');
  });

  it('shows a runtime item’s own description', async () => {
    const runtimeItems = [{ id: 'rt', name: 'Bent Key', description: 'It opens something.' }] as InventoryTabProps['runtimeItems'];
    render(<InventoryTab {...props({ runtimeItems, copies: [copy('k', 'x', { item: { kind: 'runtime', runtimeItemId: 'rt' } })] })} />);
    await userEvent.click(screen.getByRole('button', { name: 'Bent Key' }));
    expect(within(screen.getByRole('dialog')).getByText('It opens something.')).toBeInTheDocument();
  });

  it('opens for an item lying here, and while the row’s buttons are off', async () => {
    render(<InventoryTab {...props({ lying: [copy('c', 'coin', { where: { kind: 'location', id: 'yard' } })], disabled: true })} />);
    await userEvent.click(screen.getByRole('button', { name: 'Coin' }));
    expect(within(screen.getByRole('dialog')).getByText('A worn coin.')).toBeInTheDocument();
  });

  it('opens from the row a filled box on the figure shows', async () => {
    const slots: Slot[] = [{ id: 'hand', name: 'Hand' }];
    const body = bodyFixture({ id: 'b', name: 'Body', entries: [{ slotId: 'hand' }] });
    const worn = copy('s', 'sword', { equipped: { slotId: 'hand', order: 1 } });
    render(<InventoryTab {...props({ copies: [worn], body, slots: bodySlots(body, slots) })} />);
    await userEvent.click(within(screen.getByRole('group', { name: 'Equipped' })).getByRole('button'));
    await userEvent.click(await screen.findByRole('button', { name: 'Greatsword' }));
    expect(within(await screen.findByRole('dialog')).getByText('A long blade.')).toBeInTheDocument();
  });

  it('leaves the popup closed when a row’s own button is used', async () => {
    const onOps = vi.fn();
    render(<InventoryTab {...props({ copies: [copy('c', 'coin')], onOps })} />);
    await userEvent.click(screen.getByRole('button', { name: 'Drop Coin' }));
    expect(onOps).toHaveBeenCalledOnce();
    expect(popup()).toBeNull();
  });

  it('closes when the copy leaves the panel', async () => {
    const { rerender } = render(<InventoryTab {...props({ copies: [copy('c', 'coin')] })} />);
    await userEvent.click(screen.getByRole('button', { name: 'Coin' }));
    expect(popup()).not.toBeNull();
    rerender(<InventoryTab {...props({ copies: [] })} />);
    expect(popup()).toBeNull();
  });
});
