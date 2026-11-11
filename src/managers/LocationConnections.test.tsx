import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useSyncExternalStore } from 'react';
import { act, render, screen, fireEvent, within } from '@testing-library/react';
import LocationConnections from './LocationConnections';
import type { Connection, GameLocation } from '@/types';

const addConnection = vi.fn();
const updateConnection = vi.fn();
const removeConnection = vi.fn();

const BASE_LOCATIONS = [
  { id: 'cave', name: 'Cave' },
  { id: 'ledge', name: 'Ledge' },
  { id: 'pool', name: 'Pool' },
] as GameLocation[];
let locations = BASE_LOCATIONS;

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

/** Renders of the Connect To picker's items, counted in the stand-in below. */
const itemRenders = vi.hoisted(() => ({ count: 0 }));

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
  SelectItem: ({ value, children }: { value: string; children: React.ReactNode }) => {
    itemRenders.count += 1;
    return <option value={value}>{children}</option>;
  },
}));

// The hint boxes are Lexical editors, which these link-state cases do not need; they stand in as a real
// controlled input with the same props, so the typing stays genuine. TravelHintPair.test drives the real field.
vi.mock('@/components/prompt/PlaceholderField', async () => {
  const { useImperativeHandle, useRef } = await import('react');
  return {
    PlaceholderNameField: ({ value, onChange, placeholder, ariaLabel, ariaDescribedBy, readOnly, className, focusRef }: {
      value: string; onChange: (v: string) => void; placeholder?: string; ariaLabel?: string; ariaDescribedBy?: string;
      readOnly?: boolean; className?: string; focusRef?: React.Ref<{ focus: () => void }>;
    }) => {
      const input = useRef<HTMLInputElement>(null);
      useImperativeHandle(focusRef, () => ({ focus: () => input.current?.focus() }));
      return (
        <input
          ref={input}
          aria-label={ariaLabel}
          aria-describedby={ariaDescribedBy}
          readOnly={readOnly}
          className={className}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      );
    },
  };
});

const noPlaceholders: never[] = [];
let unrelated = 0;
/** A write elsewhere in the world, such as a keystroke in another field: it re-renders every reader of the context. */
const touchUnrelated = () => {
  unrelated += 1;
  listeners.forEach((listener) => listener());
};

vi.mock('@/contexts/GameDataContext', () => ({
  useGameData: () => ({
    locations,
    connections: useSyncExternalStore(subscribe, () => connections),
    entities: useSyncExternalStore(subscribe, () => unrelated),
    addConnection,
    updateConnection,
    removeConnection,
    placeholders: noPlaceholders,
  }),
}));

const at = (id: string) => locations.find((l) => l.id === id)!;
/** Every closed row's header. */
const ROW_HEADER = /, (Both Ways|To There|To Here)$/;
const closedHeaders = () => screen.queryAllByRole('button', { expanded: false, name: ROW_HEADER });
/** Renders the tab and opens every row, the way an author reaches the fields. */
const renderOpen = (id: string) => {
  const view = render(<LocationConnections location={at(id)} />);
  closedHeaders().forEach((header) => fireEvent.click(header));
  return view;
};
const lastUpdate = () => updateConnection.mock.calls.at(-1)?.at(0) as Connection;

beforeEach(() => {
  locations = BASE_LOCATIONS;
  connections = [{ id: 'c1', a: 'ledge', b: 'cave', aToB: { hint: 'over the lip' } }];
  addConnection.mockReset();
  addConnection.mockImplementation((made: Connection) => { setConnections([...connections, made]); });
  updateConnection.mockReset();
  // Writes land in the world, as the editor's own path does, so the next render reads them back.
  updateConnection.mockImplementation((next: Connection) => {
    setConnections(connections.map((c) => (c.id === next.id ? next : c)));
  });
  removeConnection.mockReset();
  removeConnection.mockImplementation((id: string) => { setConnections(connections.filter((c) => c.id !== id)); });
});

describe('LocationConnections', () => {
  it('shows the partner and the direction from the end being edited', () => {
    renderOpen('ledge');
    expect(screen.getByText('Cave')).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'To There' })).toHaveAttribute('data-state', 'on');
  });

  it('shows the same record mirrored from the other end', () => {
    renderOpen('cave');
    expect(screen.getByText('Ledge')).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'To Here' })).toHaveAttribute('data-state', 'on');
    expect(screen.getByLabelText('Travel Hint from Ledge')).toHaveValue('over the lip');
    expect(screen.queryByLabelText('Travel Hint to Ledge')).not.toBeInTheDocument();
  });

  it('makes the Connection two-way from either end without touching its endpoints', () => {
    renderOpen('cave');
    fireEvent.click(screen.getByRole('radio', { name: 'Both Ways' }));
    expect(lastUpdate()).toEqual({ id: 'c1', a: 'ledge', b: 'cave', aToB: { hint: 'over the lip' }, bToA: { hint: 'over the lip' } });
  });

  it('flips a one-way Connection to run the other way, taking its hint along', () => {
    renderOpen('ledge');
    fireEvent.click(screen.getByRole('radio', { name: 'To Here' }));
    expect(lastUpdate()).toEqual({ id: 'c1', a: 'ledge', b: 'cave', bToA: { hint: 'over the lip' } });
  });

  it('shows the Connection widget: Travel, Distance and the hint boxes', () => {
    renderOpen('ledge');
    expect(screen.getByText('Travel')).toBeInTheDocument();
    expect(screen.getByRole('radiogroup', { name: 'Travel between here and Cave' })).toBeInTheDocument();
    expect(screen.getByText('Distance')).toBeInTheDocument();
    expect(screen.getByRole('radiogroup', { name: 'Distance to Cave' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'More info' })).toBeInTheDocument();
    expect(screen.getByLabelText('Travel Hint to Cave')).toBeInTheDocument();
  });

  it('sets the distance Far and back to Nearby, storing Nearby as no field', () => {
    renderOpen('cave');
    expect(screen.getByRole('radio', { name: 'Nearby' })).toHaveAttribute('data-state', 'on');
    fireEvent.click(screen.getByRole('radio', { name: 'Far' }));
    expect(lastUpdate()).toEqual({ id: 'c1', a: 'ledge', b: 'cave', aToB: { hint: 'over the lip' }, distance: 'far' });
    fireEvent.click(screen.getByRole('radio', { name: 'Nearby' }));
    expect(lastUpdate()).toEqual({ id: 'c1', a: 'ledge', b: 'cave', aToB: { hint: 'over the lip' } });
  });

  it('changes nothing when the active Travel or Distance choice is clicked again', () => {
    renderOpen('ledge');
    fireEvent.click(screen.getByRole('radio', { name: 'To There' }));
    fireEvent.click(screen.getByRole('radio', { name: 'Nearby' }));
    expect(updateConnection).not.toHaveBeenCalled();
  });

  it('writes the travel hint through to the record', () => {
    renderOpen('ledge');
    fireEvent.change(screen.getByLabelText('Travel Hint to Cave'), {
      target: { value: 'down the chute' },
    });
    expect(lastUpdate()).toEqual({ id: 'c1', a: 'ledge', b: 'cave', aToB: { hint: 'down the chute' } });
  });

  it('drops the hint field when the author clears it, rather than storing an empty one', () => {
    renderOpen('ledge');
    fireEvent.change(screen.getByLabelText('Travel Hint to Cave'), {
      target: { value: '' },
    });
    expect(lastUpdate().aToB).toEqual({});
  });

  it('shows a two-way Connection as a To box and a From box, each with its own hint', () => {
    connections = [{ id: 'c1', a: 'ledge', b: 'cave', aToB: { hint: 'down the chute' }, bToA: { hint: 'up the rope' } }];
    renderOpen('cave');
    expect(screen.getByText('To Ledge')).toBeInTheDocument();
    expect(screen.getByLabelText('Travel Hint to Ledge')).toHaveValue('up the rope');
    expect(screen.getByLabelText('Travel Hint from Ledge')).toHaveValue('down the chute');
    fireEvent.change(screen.getByLabelText('Travel Hint to Ledge'), { target: { value: 'up the ladder' } });
    expect(lastUpdate()).toEqual({
      id: 'c1', a: 'ledge', b: 'cave', aToB: { hint: 'down the chute' }, bToA: { hint: 'up the ladder' },
    });
  });

  it('deletes the Connection', () => {
    renderOpen('ledge');
    fireEvent.click(screen.getByRole('button', { name: 'Delete Connection to Cave' }));
    expect(removeConnection).toHaveBeenCalledWith('c1');
  });

  it('adds a two-way Connection out of the location being edited', () => {
    renderOpen('ledge');
    fireEvent.change(screen.getByLabelText('Connect To'), { target: { value: 'pool' } });
    fireEvent.click(screen.getByRole('button', { name: /Add Connection/ }));
    expect(addConnection).toHaveBeenCalledWith(expect.objectContaining({ a: 'ledge', b: 'pool', aToB: {}, bToA: {} }));
  });

  it('does not offer a partner that already has a Connection', () => {
    renderOpen('ledge');
    const options = within(screen.getByLabelText('Connect To')).getAllByRole('option');
    // Cave already has one; a second record for the same pair would claim to be its whole travel rule too.
    expect(options.map((o) => o.textContent).filter(Boolean)).toEqual(['Pool']);
  });

  describe('Connect To items', () => {
    it('stay put when a write elsewhere in the world re-renders the panel', () => {
      renderOpen('ledge');
      const before = itemRenders.count;
      act(() => touchUnrelated());
      expect(itemRenders.count).toBe(before);
    });

    it('stay put while the author types a Travel Hint', () => {
      renderOpen('ledge');
      const before = itemRenders.count;
      fireEvent.change(screen.getByLabelText('Travel Hint to Cave'), { target: { value: 'down the chute' } });
      expect(lastUpdate().aToB).toEqual({ hint: 'down the chute' });
      expect(itemRenders.count).toBe(before);
    });

    it('drop a partner once a Connection to it exists', () => {
      renderOpen('cave');
      expect(within(screen.getByLabelText('Connect To')).getAllByRole('option').map((o) => o.textContent).filter(Boolean)).toEqual(['Pool']);
      act(() => setConnections([...connections, { id: 'c2', a: 'cave', b: 'pool', aToB: {} }]));
      expect(within(screen.getByLabelText('Connect To')).getAllByRole('option').map((o) => o.textContent).filter(Boolean)).toEqual([]);
    });
  });
});

describe('Travel Hint link toggle', () => {
  const toggle = () => screen.getByRole('button', { name: 'Link Travel Hints' });
  const toBox = () => screen.getByLabelText('Travel Hint to Cave');
  const fromBox = () => screen.getByLabelText('Travel Hint from Cave');

  it('opens a new two-way Connection linked, the second box showing the first box text', () => {
    connections = [{ id: 'c1', a: 'ledge', b: 'cave', aToB: {}, bToA: {} }];
    renderOpen('ledge');
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
    renderOpen('cave');
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
    renderOpen('ledge');
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
    renderOpen('ledge');
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
    renderOpen('ledge');
    fireEvent.click(toggle());
    expect(toggle()).toHaveAttribute('aria-pressed', 'false');
    expect(fromBox()).toHaveValue('down the chute');
  });

  it('stays unlinked while the author types the second hint into a match with the first', () => {
    connections = [{ id: 'c1', a: 'ledge', b: 'cave', aToB: { hint: 'down' }, bToA: { hint: 'up' } }];
    renderOpen('ledge');
    fireEvent.change(fromBox(), { target: { value: 'down' } });
    expect(toggle()).toHaveAttribute('aria-pressed', 'false');
    expect(fromBox()).not.toHaveAttribute('readonly');
  });

  it('reads the link again when the hints change somewhere else, such as an undo', () => {
    const before: Connection = { id: 'c1', a: 'ledge', b: 'cave', aToB: { hint: 'down' }, bToA: { hint: 'up' } };
    connections = [before];
    renderOpen('ledge');
    fireEvent.click(toggle());
    expect(toggle()).toHaveAttribute('aria-pressed', 'true');
    // An undo writes the earlier record back.
    act(() => setConnections([before]));
    expect(toggle()).toHaveAttribute('aria-pressed', 'false');
    expect(fromBox()).toHaveValue('up');
    expect(fromBox()).not.toHaveAttribute('readonly');
  });

  it('shows one box and no toggle for a one-way Connection', () => {
    renderOpen('ledge');
    expect(toBox()).toBeInTheDocument();
    expect(screen.queryByLabelText('Travel Hint from Cave')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Link Travel Hints' })).not.toBeInTheDocument();
  });

  it('shows the second box linked when a one-way Connection turns two-way', () => {
    renderOpen('ledge');
    fireEvent.click(screen.getByRole('radio', { name: 'Both Ways' }));
    expect(toggle()).toHaveAttribute('aria-pressed', 'true');
    expect(fromBox()).toHaveValue('over the lip');
    expect(fromBox()).toHaveAttribute('readonly');
  });
});

describe('Connection rows', () => {
  const header = (name: string) => screen.getByRole('button', { name });
  const openHeaders = () => screen.queryAllByRole('button', { expanded: true, name: ROW_HEADER });
  const openNames = () => openHeaders().map((b) => b.getAttribute('aria-label'));
  const rowOf = (partner: string) => screen.getAllByTestId('connection-row')
    .find((row) => within(row).queryByText(partner))!;
  const markOf = (partner: string) => rowOf(partner).querySelector('[data-distance-mark]');
  const five = () => {
    locations = ['hub', 'a', 'b', 'c', 'd', 'e'].map((id) => ({ id, name: id.toUpperCase() })) as GameLocation[];
    connections = ['a', 'b', 'c', 'd', 'e'].map((id) => ({ id: `c-${id}`, a: 'hub', b: id, aToB: {}, bToA: {} }));
  };

  it('starts every row closed, with one Connection', () => {
    render(<LocationConnections location={at('ledge')} />);
    expect(closedHeaders()).toHaveLength(1);
    expect(openHeaders()).toHaveLength(0);
    expect(screen.queryByText('Travel')).not.toBeInTheDocument();
  });

  it('starts every row closed, with five Connections', () => {
    five();
    render(<LocationConnections location={at('hub')} />);
    expect(closedHeaders()).toHaveLength(5);
    expect(openHeaders()).toHaveLength(0);
  });

  it('names the direction, the other location and the distance on a closed row', () => {
    connections = [
      { id: 'c1', a: 'ledge', b: 'cave', aToB: {}, bToA: {} },
      { id: 'c2', a: 'ledge', b: 'pool', aToB: { hint: 'a hidden hint' }, distance: 'far' },
    ];
    render(<LocationConnections location={at('ledge')} />);
    expect(header('Cave, Both Ways')).toHaveAttribute('aria-expanded', 'false');
    expect(header('Pool, To There')).toHaveAttribute('aria-expanded', 'false');
    expect(markOf('Cave')).toHaveAttribute('data-distance-mark', 'nearby');
    expect(markOf('Cave')).toHaveTextContent('Nearby');
    expect(markOf('Pool')).toHaveAttribute('data-distance-mark', 'far');
    expect(markOf('Pool')).toHaveTextContent('Far');
    // The mark is read-only: a closed row takes a click only on its header and on Delete.
    expect(within(rowOf('Pool')).getAllByRole('button')).toHaveLength(2);
    expect(screen.queryByText(/one way/i)).not.toBeInTheDocument();
    expect(screen.queryByText('a hidden hint')).not.toBeInTheDocument();
  });

  it('reads a one-way Connection from the end being edited', () => {
    render(<LocationConnections location={at('cave')} />);
    expect(header('Ledge, To Here')).toBeInTheDocument();
  });

  it('opens on a click, and the closed header follows an edit made in the open row', () => {
    render(<LocationConnections location={at('ledge')} />);
    fireEvent.click(header('Cave, To There'));
    expect(screen.getByRole('radiogroup', { name: 'Travel between here and Cave' })).toBeInTheDocument();
    expect(screen.getByRole('radiogroup', { name: 'Distance to Cave' })).toBeInTheDocument();
    expect(screen.getByLabelText('Travel Hint to Cave')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('radio', { name: 'Both Ways' }));
    fireEvent.click(screen.getByRole('radio', { name: 'Far' }));
    expect(connections[0]).toMatchObject({ aToB: { hint: 'over the lip' }, bToA: { hint: 'over the lip' }, distance: 'far' });
    fireEvent.click(header('Cave, Both Ways'));
    expect(header('Cave, Both Ways')).toHaveAttribute('aria-expanded', 'false');
    expect(markOf('Cave')).toHaveAttribute('data-distance-mark', 'far');
  });

  it('opens a Connection added with the picker and leaves the other rows as they were', () => {
    five();
    locations = [...locations, { id: 'f', name: 'F' } as GameLocation];
    render(<LocationConnections location={at('hub')} />);
    fireEvent.click(header('B, Both Ways'));
    fireEvent.change(screen.getByLabelText('Connect To'), { target: { value: 'f' } });
    fireEvent.click(screen.getByRole('button', { name: /Add Connection/ }));
    expect(openNames()).toEqual(['B, Both Ways', 'F, Both Ways']);
    expect(closedHeaders()).toHaveLength(4);
  });

  it('collapses every open row, and opens every row when none is open', () => {
    five();
    render(<LocationConnections location={at('hub')} />);
    fireEvent.click(header('A, Both Ways'));
    fireEvent.click(header('C, Both Ways'));
    fireEvent.click(screen.getByRole('button', { name: 'Collapse all connections' }));
    expect(openHeaders()).toHaveLength(0);
    fireEvent.click(screen.getByRole('button', { name: 'Expand all connections' }));
    expect(openHeaders()).toHaveLength(5);
  });

  it('shows no Collapse All with one row', () => {
    render(<LocationConnections location={at('ledge')} />);
    expect(screen.queryByRole('button', { name: /all connections/ })).not.toBeInTheDocument();
  });

  it('opens the row a Travel Hint search hit lands in, on mount and while mounted', () => {
    five();
    const { rerender } = render(
      <LocationConnections location={at('hub')} focusField={{ fieldKey: 'travelHint:c-b:aToB', itemId: 'hub' }} />,
    );
    expect(openNames()).toEqual(['B, Both Ways']);
    rerender(<LocationConnections location={at('hub')} focusField={{ fieldKey: 'travelHint:c-d:bToA', itemId: 'hub' }} />);
    expect(openNames()).toEqual(['B, Both Ways', 'D, Both Ways']);
  });

  it('opens no row for a search hit on another field', () => {
    render(<LocationConnections location={at('ledge')} focusField={{ fieldKey: 'name', itemId: 'ledge' }} />);
    expect(openHeaders()).toHaveLength(0);
  });

  it('opens the row a reveal asks for and reports it opened', () => {
    five();
    const onOpened = vi.fn();
    render(<LocationConnections location={at('hub')} openRequest={{ id: 'c-e' }} onOpened={onOpened} />);
    expect(openNames()).toEqual(['E, Both Ways']);
    expect(onOpened).toHaveBeenCalledTimes(1);
  });

  it('brings a deleted open row back closed, as an undo does', () => {
    render(<LocationConnections location={at('ledge')} />);
    const before = connections[0];
    fireEvent.click(header('Cave, To There'));
    fireEvent.click(screen.getByRole('button', { name: 'Delete Connection to Cave' }));
    expect(screen.queryByTestId('connection-row')).not.toBeInTheDocument();
    act(() => setConnections([before]));
    expect(header('Cave, To There')).toHaveAttribute('aria-expanded', 'false');
  });
});

describe('Free links', () => {
  const tree = () => {
    locations = [
      { id: 'town', name: 'Town' },
      { id: 'inn', name: 'Inn', parentId: 'town' },
      { id: 'shop', name: 'Shop', parentId: 'town' },
      { id: 'cellar', name: 'Cellar', parentId: 'inn' },
      { id: 'far-hill', name: 'Far Hill' },
    ] as GameLocation[];
    connections = [];
  };
  const group = () => screen.getByRole('button', { name: /^Free Links/ });
  const freeRows = () => screen.queryAllByTestId('free-link-row').map((row) => row.textContent);

  it('lists the parent, a child and a sibling with the relation of each', () => {
    tree();
    render(<LocationConnections location={at('inn')} />);
    fireEvent.click(group());
    expect(freeRows()).toEqual([
      'TownContains this location',
      'CellarInside this location',
      'ShopBeside this location',
    ]);
  });

  it('starts closed and shows the count', () => {
    tree();
    render(<LocationConnections location={at('inn')} />);
    expect(group()).toHaveAttribute('aria-expanded', 'false');
    expect(group()).toHaveTextContent('3');
    expect(freeRows()).toEqual([]);
  });

  it('leaves out a pair that has a Connection', () => {
    tree();
    connections = [{ id: 'c1', a: 'inn', b: 'shop', aToB: {} }];
    render(<LocationConnections location={at('inn')} />);
    fireEvent.click(group());
    expect(freeRows()).toEqual(['TownContains this location', 'CellarInside this location']);
  });

  it('shows no group for a top-level location with no children', () => {
    tree();
    render(<LocationConnections location={at('far-hill')} />);
    expect(screen.queryByTestId('free-links')).not.toBeInTheDocument();
  });

  it('makes a two-way Nearby Connection, opens its row and drops the free row', () => {
    tree();
    render(<LocationConnections location={at('inn')} />);
    fireEvent.click(group());
    fireEvent.click(screen.getByRole('button', { name: 'Make Connection to Shop' }));
    expect(addConnection).toHaveBeenCalledTimes(1);
    expect(addConnection.mock.calls[0][0]).toMatchObject({ a: 'inn', b: 'shop', aToB: {}, bToA: {} });
    expect(addConnection.mock.calls[0][0].distance).toBeUndefined();
    expect(screen.getByRole('button', { name: 'Shop, Both Ways' })).toHaveAttribute('aria-expanded', 'true');
    expect(freeRows().join()).not.toContain('Shop');
  });

  it('lists the pair as a free link again when its Connection is deleted', () => {
    tree();
    render(<LocationConnections location={at('inn')} />);
    fireEvent.click(group());
    fireEvent.click(screen.getByRole('button', { name: 'Make Connection to Shop' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete Connection to Shop' }));
    expect(freeRows().join()).toContain('Shop');
  });
});
