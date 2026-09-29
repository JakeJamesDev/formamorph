import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
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
    connections,
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
  updateConnection.mockClear();
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
    expect(screen.getByLabelText('Travel Hint From Ledge')).toHaveValue('over the lip');
    expect(screen.queryByLabelText('Travel Hint To Ledge')).not.toBeInTheDocument();
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
    fireEvent.change(screen.getByLabelText('Travel Hint To Cave'), {
      target: { value: 'down the chute' },
    });
    expect(lastUpdate()).toEqual({ id: 'c1', a: 'ledge', b: 'cave', aToB: { hint: 'down the chute' } });
  });

  it('drops the hint field when the author clears it, rather than storing an empty one', () => {
    render(<LocationConnections location={at('ledge')} />);
    fireEvent.change(screen.getByLabelText('Travel Hint To Cave'), {
      target: { value: '' },
    });
    expect(lastUpdate().aToB).toEqual({});
  });

  it('shows a two-way Connection as a To box and a From box, each with its own hint', () => {
    connections = [{ id: 'c1', a: 'ledge', b: 'cave', aToB: { hint: 'down the chute' }, bToA: { hint: 'up the rope' } }];
    render(<LocationConnections location={at('cave')} />);
    expect(screen.getByText('To Ledge')).toBeInTheDocument();
    expect(screen.getByLabelText('Travel Hint To Ledge')).toHaveValue('up the rope');
    expect(screen.getByLabelText('Travel Hint From Ledge')).toHaveValue('down the chute');
    fireEvent.change(screen.getByLabelText('Travel Hint To Ledge'), { target: { value: 'up the ladder' } });
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
