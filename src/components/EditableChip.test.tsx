import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, createEvent } from '@testing-library/react';
import { DndContext } from '@dnd-kit/core';
import { SortableContext } from '@dnd-kit/sortable';
import { EditableChip } from './EditableChip';

// EditableChip calls useSortable, so render it inside a dnd-kit context.
function wrap(ui: React.ReactNode) {
  return render(<DndContext><SortableContext items={['red ribbon']}>{ui}</SortableContext></DndContext>);
}

const dbl = (el: HTMLElement) => fireEvent.doubleClick(el);

describe('EditableChip', () => {
  it('double-click opens an input seeded with the value; Enter commits the edit', () => {
    const onCommit = vi.fn();
    const onRemove = vi.fn();
    wrap(<EditableChip value="red ribbon" onCommit={onCommit} onRemove={onRemove} sortable />);

    dbl(screen.getByText('red ribbon'));
    const input = screen.getByLabelText('Edit red ribbon') as HTMLInputElement;
    expect(input.value).toBe('red ribbon');

    fireEvent.change(input, { target: { value: 'red rose' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onCommit).toHaveBeenCalledWith('red rose');
    expect(onRemove).not.toHaveBeenCalled();
  });

  // jsdom has no PointerEvent, so `pointerType` has to be attached to the event by hand.
  const tapWith = (el: HTMLElement, pointerType: string) => {
    for (const make of [createEvent.pointerDown, createEvent.click]) {
      const ev = make(el);
      Object.defineProperty(ev, 'pointerType', { value: pointerType });
      fireEvent(el, ev);
    }
  };

  it('a touch tap opens the editor (touch has no double-click)', () => {
    wrap(<EditableChip value="cat" onCommit={vi.fn()} onRemove={vi.fn()} sortable />);
    tapWith(screen.getByText('cat'), 'touch');
    expect(screen.getByLabelText('Edit cat')).toBeInTheDocument();
  });

  it('a mouse click does not open the editor (it would fight drag-to-reorder)', () => {
    wrap(<EditableChip value="cat" onCommit={vi.fn()} onRemove={vi.fn()} sortable />);
    tapWith(screen.getByText('cat'), 'mouse');
    expect(screen.queryByLabelText('Edit cat')).not.toBeInTheDocument();
  });

  it('Escape cancels without committing', () => {
    const onCommit = vi.fn();
    wrap(<EditableChip value="cat" onCommit={onCommit} onRemove={() => {}} sortable />);
    dbl(screen.getByText('cat'));
    const input = screen.getByLabelText('Edit cat');
    fireEvent.change(input, { target: { value: 'dog' } });
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(onCommit).not.toHaveBeenCalled();
    expect(screen.getByText('cat')).toBeInTheDocument(); // back to display
  });

  it('clearing the text and committing removes the chip', () => {
    const onRemove = vi.fn();
    const onCommit = vi.fn();
    wrap(<EditableChip value="cat" onCommit={onCommit} onRemove={onRemove} sortable />);
    dbl(screen.getByText('cat'));
    const input = screen.getByLabelText('Edit cat');
    fireEvent.change(input, { target: { value: '  ' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onRemove).toHaveBeenCalledWith('cat');
    expect(onCommit).not.toHaveBeenCalled();
  });

  it('shows suggestions while editing and picking one commits it', () => {
    const onCommit = vi.fn();
    const getSuggestions = (q: string) => ['blonde hair', 'blue eyes'].filter((t) => t.includes(q));
    wrap(<EditableChip value="blond" onCommit={onCommit} onRemove={() => {}} sortable getSuggestions={getSuggestions} />);
    dbl(screen.getByText('blond'));
    const input = screen.getByLabelText('Edit blond');
    fireEvent.change(input, { target: { value: 'blo' } });
    fireEvent.mouseDown(screen.getByText('blonde hair'));
    expect(onCommit).toHaveBeenCalledWith('blonde hair');
  });
});
