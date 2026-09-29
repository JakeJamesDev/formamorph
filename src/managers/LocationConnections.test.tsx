import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useSyncExternalStore } from 'react';
import { act, render, screen, fireEvent, within } from '@testing-library/react';
import LocationConnections from './LocationConnections';
import type { Connection, GameLocation } from '@/types';

const addConnection = vi.fn();
const updateConnection = vi.fn();
const removeConnection = vi.fn();

const locations = [
  { id: 'cave', name: 'Cave' },
  { id: 'ledge', name: 'Ledge' },
  { id: 'pool', name: 'Pool' },
] as GameLocation[];

let connections: Connection[] = [];
const listeners = new Set<() => void>();
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
};
/** Replaces the world's Connections the way any editor write does, so the panel re-renders from the new data. */
const setConnections = (next: Connection[]) => {
  connections = next;
  listeners.forEach((listener) => listener());
};

// Radix Select never opens its listbox in jsdom, so the target picker stands in as a real native select —
// same value, same onValueChange, and the options stay genuinely under test.
vi.mock('@/components/ui/select', () => ({
  Select: ({ value, onValueChange, children }: {
    value: string; onValueChange: (v: string) => void; children: React.ReactNode;
  }) => (
    <select aria-label="Connect To" value={value} onChange={(e) => onValueChange(e.target.value)}>
      <option value="" />
      {children}
    </select>
  ),
  SelectTrigger: () => null,
  SelectValue: () => null,
  SelectContent: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SelectItem: ({ value, children }: { value: string; children: React.ReactNode }) => (
    <option value={value}>{children}</option>
  ),
}));

vi.mock('@/contexts/GameDataContext', () => ({
  useGameData: () => ({
    locations,
    connections: useSyncExternalStore(subscribe, () => connections),
    addConnection,
    updateConnection,
    removeConnection,
    placeholders: [],
  }),
}));

const at = (id: string) => locations.find((l) => l.id === id)!;
const lastUpdate = () => updateConnection.mock.calls.at(-1)?.at(0) as Connection;

beforeEach(() => {
  connections = [{ id: 'c1', a: 'ledge', b: 'cave', aToB: { hint: 'over the lip' } }];
  addConnection.mockClear();
  updateConnection.mockReset();
  // Writes land in the world, as the editor's own path does, so the next render reads them back.
  updateConnection.mockImplementation((next: Connection) => {
    setConnections(connections.map((c) => (c.id === next.id ? next : c)));
  });
  removeConnection.mockClear();
});

describe('LocationConnections', () => {
  it('shows the partner and the direction from the end being edited', () => {
    render(<LocationConnections location={at('ledge')} />);
    expect(screen.getByText('Cave')).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Outgoing' })).toHaveAttribute('data-state', 'on');
  });

  it('shows the same record mirrored from the other end', () => {
    render(<LocationConnections location={at('cave')} />);
    expect(screen.getByText('Ledge')).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Incoming' })).toHaveAttribute('data-state', 'on');
    expect(screen.getByLabelText('Travel Hint from Ledge')).toHaveValue('over the lip');
    expect(screen.queryByLabelText('Travel Hint to Ledge')).not.toBeInTheDocument();
  });

  it('makes the Connection two-way from either end without touching its endpoints', () => {
    render(<LocationConnections location={at('cave')} />);
    fireEvent.click(screen.getByRole('radio', { name: 'Two-Way' }));
    expect(lastUpdate()).toEqual({ id: 'c1', a: 'ledge', b: 'cave', aToB: { hint: 'over the lip' }, bToA: { hint: 'over the lip' } });
  });

  it('flips a one-way Connection to run the other way, taking its hint along', () => {
    render(<LocationConnections location={at('ledge')} />);
    fireEvent.click(screen.getByRole('radio', { name: 'Incoming' }));
    expect(lastUpdate()).toEqual({ id: 'c1', a: 'ledge', b: 'cave', bToA: { hint: 'over the lip' } });
  });

  it('writes the travel hint through to the record', () => {
    render(<LocationConnections location={at('ledge')} />);
    fireEvent.change(screen.getByLabelText('Travel Hint to Cave'), {
      target: { value: 'down the chute' },
    });
    expect(lastUpdate()).toEqual({ id: 'c1', a: 'ledge', b: 'cave', aToB: { hint: 'down the chute' } });
  });

  it('drops the hint field when the author clears it, rather than storing an empty one', () => {
    render(<LocationConnections location={at('ledge')} />);
    fireEvent.change(screen.getByLabelText('Travel Hint to Cave'), {
      target: { value: '' },
    });
    expect(lastUpdate().aToB).toEqual({});
  });

  it('shows a two-way Connection as a To box and a From box, each with its own hint', () => {
    connections = [{ id: 'c1', a: 'ledge', b: 'cave', aToB: { hint: 'down the chute' }, bToA: { hint: 'up the rope' } }];
    render(<LocationConnections location={at('cave')} />);
    expect(screen.getByText('To Ledge')).toBeInTheDocument();
    expect(screen.getByLabelText('Travel Hint to Ledge')).toHaveValue('up the rope');
    expect(screen.getByLabelText('Travel Hint from Ledge')).toHaveValue('down the chute');
    fireEvent.change(screen.getByLabelText('Travel Hint to Ledge'), { target: { value: 'up the ladder' } });
    expect(lastUpdate()).toEqual({
      id: 'c1', a: 'ledge', b: 'cave', aToB: { hint: 'down the chute' }, bToA: { hint: 'up the ladder' },
    });
  });

  it('deletes the Connection', () => {
    render(<LocationConnections location={at('ledge')} />);
    fireEvent.click(screen.getByRole('button', { name: 'Delete Connection to Cave' }));
    expect(removeConnection).toHaveBeenCalledWith('c1');
  });

  it('adds a two-way Connection out of the location being edited', () => {
    render(<LocationConnections location={at('ledge')} />);
    fireEvent.change(screen.getByLabelText('Connect To'), { target: { value: 'pool' } });
    fireEvent.click(screen.getByRole('button', { name: /Add Connection/ }));
    expect(addConnection).toHaveBeenCalledWith(expect.objectContaining({ a: 'ledge', b: 'pool', aToB: {}, bToA: {} }));
  });

  it('does not offer a partner that already has a Connection', () => {
    render(<LocationConnections location={at('ledge')} />);
    const options = within(screen.getByLabelText('Connect To')).getAllByRole('option');
    // Cave already has one; a second record for the same pair would claim to be its whole travel rule too.
    expect(options.map((o) => o.textContent).filter(Boolean)).toEqual(['Pool']);
  });
});

describe('Travel Hint link toggle', () => {
  const toggle = () => screen.getByRole('button', { name: 'Link Travel Hints' });
  const toBox = () => screen.getByLabelText('Travel Hint to Cave');
  const fromBox = () => screen.getByLabelText('Travel Hint from Cave');

  it('opens a new two-way Connection linked, the second box showing the first box text', () => {
    connections = [{ id: 'c1', a: 'ledge', b: 'cave', aToB: {}, bToA: {} }];
    render(<LocationConnections location={at('ledge')} />);
    expect(toggle()).toHaveAttribute('aria-pressed', 'true');
    expect(toBox()).not.toHaveAttribute('readonly');
    expect(fromBox()).toHaveAttribute('readonly');
    expect(fromBox()).toHaveAccessibleDescription('Copies the first Travel Hint');
    fireEvent.change(toBox(), { target: { value: 'down the chute' } });
    expect(lastUpdate()).toEqual({
      id: 'c1', a: 'ledge', b: 'cave', aToB: { hint: 'down the chute' }, bToA: { hint: 'down the chute' },
    });
    expect(fromBox()).toHaveValue('down the chute');
  });

  it('opens linked when both hints are equal, and links from the first box of the end being edited', () => {
    connections = [{ id: 'c1', a: 'ledge', b: 'cave', aToB: { hint: 'along the rope' }, bToA: { hint: 'along the rope' } }];
    render(<LocationConnections location={at('cave')} />);
    expect(toggle()).toHaveAttribute('aria-pressed', 'true');
    // From the cave, the first box is the trip to the ledge: the record's bToA leg.
    fireEvent.change(screen.getByLabelText('Travel Hint to Ledge'), { target: { value: 'up the rope' } });
    expect(lastUpdate()).toEqual({
      id: 'c1', a: 'ledge', b: 'cave', aToB: { hint: 'up the rope' }, bToA: { hint: 'up the rope' },
    });
    expect(screen.getByLabelText('Travel Hint from Ledge')).toHaveAttribute('readonly');
  });

  it('opens unlinked when the hints differ, with both boxes editable', () => {
    connections = [{ id: 'c1', a: 'ledge', b: 'cave', aToB: { hint: 'down the chute' }, bToA: { hint: 'up the rope' } }];
    render(<LocationConnections location={at('ledge')} />);
    expect(toggle()).toHaveAttribute('aria-pressed', 'false');
    expect(fromBox()).not.toHaveAttribute('readonly');
    expect(fromBox()).not.toHaveAccessibleDescription();
    fireEvent.change(fromBox(), { target: { value: 'up the ladder' } });
    expect(lastUpdate()).toEqual({
      id: 'c1', a: 'ledge', b: 'cave', aToB: { hint: 'down the chute' }, bToA: { hint: 'up the ladder' },
    });
  });

  it('links by copying the first hint, and unlinking gives back the text the second box held', () => {
    connections = [{ id: 'c1', a: 'ledge', b: 'cave', aToB: { hint: 'down the chute' }, bToA: { hint: 'up the rope' } }];
    render(<LocationConnections location={at('ledge')} />);
    fireEvent.click(toggle());
    expect(toggle()).toHaveAttribute('aria-pressed', 'true');
    expect(lastUpdate()).toEqual({
      id: 'c1', a: 'ledge', b: 'cave', aToB: { hint: 'down the chute' }, bToA: { hint: 'down the chute' },
    });
    expect(fromBox()).toHaveValue('down the chute');
    expect(fromBox()).toHaveAttribute('readonly');

    fireEvent.click(toggle());
    expect(toggle()).toHaveAttribute('aria-pressed', 'false');
    expect(lastUpdate()).toEqual({
      id: 'c1', a: 'ledge', b: 'cave', aToB: { hint: 'down the chute' }, bToA: { hint: 'up the rope' },
    });
    expect(fromBox()).toHaveValue('up the rope');
    expect(fromBox()).not.toHaveAttribute('readonly');
  });

  it('keeps the copied text on an unlink when nothing was held before the link', () => {
    connections = [{ id: 'c1', a: 'ledge', b: 'cave', aToB: { hint: 'down the chute' }, bToA: { hint: 'down the chute' } }];
    render(<LocationConnections location={at('ledge')} />);
    fireEvent.click(toggle());
    expect(toggle()).toHaveAttribute('aria-pressed', 'false');
    expect(fromBox()).toHaveValue('down the chute');
  });

  it('stays unlinked while the author types the second hint into a match with the first', () => {
    connections = [{ id: 'c1', a: 'ledge', b: 'cave', aToB: { hint: 'down' }, bToA: { hint: 'up' } }];
    render(<LocationConnections location={at('ledge')} />);
    fireEvent.change(fromBox(), { target: { value: 'down' } });
    expect(toggle()).toHaveAttribute('aria-pressed', 'false');
    expect(fromBox()).not.toHaveAttribute('readonly');
  });

  it('reads the link again when the hints change somewhere else, such as an undo', () => {
    const before: Connection = { id: 'c1', a: 'ledge', b: 'cave', aToB: { hint: 'down' }, bToA: { hint: 'up' } };
    connections = [before];
    render(<LocationConnections location={at('ledge')} />);
    fireEvent.click(toggle());
    expect(toggle()).toHaveAttribute('aria-pressed', 'true');
    // An undo writes the earlier record back.
    act(() => setConnections([before]));
    expect(toggle()).toHaveAttribute('aria-pressed', 'false');
    expect(fromBox()).toHaveValue('up');
    expect(fromBox()).not.toHaveAttribute('readonly');
  });

  it('shows one box and no toggle for a one-way Connection', () => {
    render(<LocationConnections location={at('ledge')} />);
    expect(toBox()).toBeInTheDocument();
    expect(screen.queryByLabelText('Travel Hint from Cave')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Link Travel Hints' })).not.toBeInTheDocument();
  });

  it('shows the second box linked when a one-way Connection turns two-way', () => {
    render(<LocationConnections location={at('ledge')} />);
    fireEvent.click(screen.getByRole('radio', { name: 'Two-Way' }));
    expect(toggle()).toHaveAttribute('aria-pressed', 'true');
    expect(fromBox()).toHaveValue('over the lip');
    expect(fromBox()).toHaveAttribute('readonly');
  });
});
