import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SelectOptions, type SelectOption } from './SelectOptions';

const itemRenders = vi.hoisted(() => ({ byValue: new Map<string, number>() }));

// Radix mounts items only inside an open listbox in jsdom; a plain element counts each item's render.
vi.mock('@/components/ui/select', () => ({
  SelectItem: ({ value, children }: { value: string; children: React.ReactNode }) => {
    itemRenders.byValue.set(value, (itemRenders.byValue.get(value) ?? 0) + 1);
    return <li data-value={value}>{children}</li>;
  },
}));

const rendersOf = (value: string) => itemRenders.byValue.get(value) ?? 0;
const options = (labels: Record<string, string>): SelectOption[] => Object.entries(labels).map(([value, label]) => ({ value, label }));

beforeEach(() => itemRenders.byValue.clear());

describe('SelectOptions', () => {
  it('lists every option in order with its label', () => {
    render(<ul><SelectOptions options={options({ a: 'Cave', b: 'Ledge', c: 'Pool' })} /></ul>);
    expect(screen.getAllByRole('listitem').map((li) => [li.dataset.value, li.textContent])).toEqual([
      ['a', 'Cave'], ['b', 'Ledge'], ['c', 'Pool'],
    ]);
  });

  it('does not render an item again when a parent renders with the same options', () => {
    const list = options({ a: 'Cave', b: 'Ledge' });
    const { rerender } = render(<ul><SelectOptions options={list} /></ul>);
    rerender(<ul><SelectOptions options={list} /></ul>);
    expect([rendersOf('a'), rendersOf('b')]).toEqual([1, 1]);
  });

  it('does not render an unchanged item when the list is a new array holding equal options', () => {
    const { rerender } = render(<ul><SelectOptions options={options({ a: 'Cave', b: 'Ledge' })} /></ul>);
    rerender(<ul><SelectOptions options={options({ a: 'Cave', b: 'Ledge' })} /></ul>);
    expect([rendersOf('a'), rendersOf('b')]).toEqual([1, 1]);
  });

  it('renders only the item whose label changed, and keeps showing the new label', () => {
    const { rerender } = render(<ul><SelectOptions options={options({ a: 'Cave', b: 'Ledge' })} /></ul>);
    rerender(<ul><SelectOptions options={options({ a: 'Cave', b: 'Ledge Two' })} /></ul>);
    expect([rendersOf('a'), rendersOf('b')]).toEqual([1, 2]);
    expect(screen.getByText('Ledge Two')).toBeInTheDocument();
  });

  it('drops an item that leaves the list', () => {
    const { rerender } = render(<ul><SelectOptions options={options({ a: 'Cave', b: 'Ledge' })} /></ul>);
    rerender(<ul><SelectOptions options={options({ a: 'Cave' })} /></ul>);
    expect(screen.queryByText('Ledge')).not.toBeInTheDocument();
  });
});
