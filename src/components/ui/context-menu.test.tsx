import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuTrigger } from './context-menu';

// jsdom has no PointerEvent, so testing-library falls back to a plain Event and drops the pointer fields.
// A MouseEvent carries the coordinates; the pointer type rides on top of it.
function pointer(type: string, init: { pointerType: string; clientX: number; clientY: number; button?: number }) {
  const event = new MouseEvent(type, {
    bubbles: true, cancelable: true, clientX: init.clientX, clientY: init.clientY, button: init.button ?? 0,
  });
  Object.defineProperty(event, 'pointerType', { value: init.pointerType });
  return event;
}

function Menu({ onOutsideClick, onSelect }: { onOutsideClick?: () => void; onSelect?: () => void } = {}) {
  return (
    <>
    <button onClick={onOutsideClick}>Elsewhere</button>
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div>Tile</div>
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem onSelect={onSelect}>Rename</ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
    </>
  );
}

/** Hold a finger on the trigger until Radix's long press opens the menu. */
function longPress(trigger: HTMLElement, pointerType = 'touch') {
  fireEvent(trigger, pointer('pointerdown', { pointerType, clientX: 100, clientY: 100 }));
  act(() => vi.advanceTimersByTime(700));
  settle();
}

/** Radix registers its outside-tap listener in a zero-delay timeout, which fake timers hold back. */
const settle = () => act(() => vi.advanceTimersByTime(1));

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('ContextMenu on touch', () => {
  it('opens on a long press', () => {
    render(<Menu />);
    longPress(screen.getByText('Tile'));
    expect(screen.getByRole('menu')).toBeInTheDocument();
  });

  it('closes when the finger that opened it moves on, so the hold becomes a drag', () => {
    render(<Menu />);
    const trigger = screen.getByText('Tile');
    longPress(trigger);

    fireEvent(trigger, pointer('pointermove', { pointerType: 'touch', clientX: 100, clientY: 130 }));

    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('stays open through the jitter of a finger held still', () => {
    render(<Menu />);
    const trigger = screen.getByText('Tile');
    longPress(trigger);

    fireEvent(trigger, pointer('pointermove', { pointerType: 'touch', clientX: 103, clientY: 102 }));

    expect(screen.getByRole('menu')).toBeInTheDocument();
  });

  it('ignores the mouse, which opens the menu with a click and never a hold', () => {
    render(<Menu />);
    const trigger = screen.getByText('Tile');
    fireEvent.contextMenu(trigger, { clientX: 100, clientY: 100 });
    expect(screen.getByRole('menu')).toBeInTheDocument();

    fireEvent(trigger, pointer('pointermove', { pointerType: 'mouse', clientX: 300, clientY: 300 }));

    expect(screen.getByRole('menu')).toBeInTheDocument();
  });

  it('survives the small drift of a real finger during the hold', () => {
    render(<Menu />);
    const trigger = screen.getByText('Tile');
    fireEvent(trigger, pointer('pointerdown', { pointerType: 'touch', clientX: 100, clientY: 100 }));
    act(() => vi.advanceTimersByTime(150));
    fireEvent(trigger, pointer('pointermove', { pointerType: 'touch', clientX: 102, clientY: 103 }));
    act(() => vi.advanceTimersByTime(150));
    fireEvent(trigger, pointer('pointermove', { pointerType: 'touch', clientX: 104, clientY: 101 }));
    act(() => vi.advanceTimersByTime(500));

    expect(screen.getByRole('menu')).toBeInTheDocument();
  });

  it('still lets a real move during the hold cancel it', () => {
    render(<Menu />);
    const trigger = screen.getByText('Tile');
    fireEvent(trigger, pointer('pointerdown', { pointerType: 'touch', clientX: 100, clientY: 100 }));
    act(() => vi.advanceTimersByTime(150));
    fireEvent(trigger, pointer('pointermove', { pointerType: 'touch', clientX: 100, clientY: 140 }));
    act(() => vi.advanceTimersByTime(700));

    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('closes on a tap outside and swallows that tap, so nothing under the finger reacts', () => {
    const onOutsideClick = vi.fn();
    render(<Menu onOutsideClick={onOutsideClick} />);
    longPress(screen.getByText('Tile'));
    const elsewhere = screen.getByText('Elsewhere');

    fireEvent(elsewhere, pointer('pointerdown', { pointerType: 'touch', clientX: 300, clientY: 300 }));
    fireEvent(elsewhere, pointer('pointerup', { pointerType: 'touch', clientX: 300, clientY: 300 }));
    fireEvent.click(elsewhere);

    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(onOutsideClick).not.toHaveBeenCalled();

    // The next, separate tap goes through as normal.
    fireEvent(elsewhere, pointer('pointerdown', { pointerType: 'touch', clientX: 300, clientY: 300 }));
    fireEvent.click(elsewhere);
    expect(onOutsideClick).toHaveBeenCalledTimes(1);
  });

  it('swallows a mouse click outside as well, as native desktop menus do', () => {
    const onOutsideClick = vi.fn();
    render(<Menu onOutsideClick={onOutsideClick} />);
    fireEvent.contextMenu(screen.getByText('Tile'), { clientX: 100, clientY: 100 });
    settle();
    expect(screen.getByRole('menu')).toBeInTheDocument();
    const elsewhere = screen.getByText('Elsewhere');

    fireEvent(elsewhere, pointer('pointerdown', { pointerType: 'mouse', clientX: 300, clientY: 300 }));
    fireEvent.click(elsewhere);

    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(onOutsideClick).not.toHaveBeenCalled();

    fireEvent(elsewhere, pointer('pointerdown', { pointerType: 'mouse', clientX: 300, clientY: 300 }));
    fireEvent.click(elsewhere);
    expect(onOutsideClick).toHaveBeenCalledTimes(1);
  });

  it('lets a right-click elsewhere move the menu, and the first pick from the moved menu lands', () => {
    const onSelect = vi.fn();
    render(<Menu onSelect={onSelect} />);
    const tile = screen.getByText('Tile');
    fireEvent.contextMenu(tile, { clientX: 100, clientY: 100 });
    settle();
    expect(screen.getByRole('menu')).toBeInTheDocument();

    // The right button's press closes the menu; its contextmenu opens the next one. No click follows a
    // right button, so there is nothing of this press left to swallow.
    fireEvent(tile, pointer('pointerdown', { pointerType: 'mouse', clientX: 300, clientY: 300, button: 2 }));
    fireEvent.contextMenu(tile, { clientX: 300, clientY: 300 });
    settle();
    expect(screen.getByRole('menu')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Rename'));
    expect(onSelect).toHaveBeenCalledTimes(1);
  });
});
