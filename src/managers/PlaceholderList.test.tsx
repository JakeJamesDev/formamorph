import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useMemo, useState } from 'react';
import { act, render, screen, fireEvent, within } from '@testing-library/react';
import { encodePlaceholderToken } from '@/lib/placeholders';
import { PlaceholderStoreProvider, placeholderStore } from '@/contexts/PlaceholderStoreContext';
import { phValues } from '@/test/placeholderValues';
import type { Placeholder } from '@/types';
import PlaceholderList from './PlaceholderList';
import type { SortableTreeAdapter } from './SortableTree';
import type { PlaceholderTreeRow } from '@/lib/placeholderTree';

// The real tree, with the adapter it hands the scaffold tapped. dnd-kit's pointer path needs layout jsdom
// does not have, so a drag is played by calling that seam directly — the tree still renders, so everything
// else here is the component's own output.
let adapter: SortableTreeAdapter<PlaceholderTreeRow> | null = null;
vi.mock('./SortableTree', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./SortableTree')>();
  return {
    ...actual,
    SortableTree: (props: Parameters<typeof actual.SortableTree<PlaceholderTreeRow>>[0]) => {
      adapter = props.adapter;
      return <actual.SortableTree {...props} />;
    },
  };
});

// Through the real codec, never a hand-written token: a test that spells the wire format itself keeps
// passing after that format moves.
const chip = (id: string, at = '1') => encodePlaceholderToken({ id, mode: 'world', placementId: `v-${id}-${at}` });

const P = (id: string, name: string, values: string[] = [], ownerId?: string): Placeholder => ({
  id, name, values: phValues(values), ...(ownerId ? { ownerId } : {}),
});

/** Molly owns two variants; both hold the one shared Hair, which stays at the top level. */
const WORLD: Placeholder[] = [
  P('molly', 'Molly', [chip('northern'), chip('southern')]),
  P('northern', 'Northern', [chip('hair')], 'molly'),
  P('southern', 'Southern', [chip('hair')], 'molly'),
  P('hair', 'Hair', ['brown', 'black']),
  P('town', 'Town', ['Sedge Landing', 'Milbrook']),
];

let stored: Placeholder[] = [];
const select = vi.fn();

/** The list as the editor mounts it: a real store, so what a gesture writes is readable afterwards. */
function Harness({ initial, selectedId = null }: { initial: Placeholder[]; selectedId?: string | null }) {
  const [placeholders, setPlaceholders] = useState(initial);
  stored = placeholders;
  const store = useMemo(
    () => ({ ...placeholderStore(placeholders, setPlaceholders), placedIds: () => new Set<string>() }),
    [placeholders],
  );
  return (
    <PlaceholderStoreProvider value={store}>
      <PlaceholderList selectedId={selectedId} onSelect={select} />
    </PlaceholderStoreProvider>
  );
}

/** The rendered rows in list order, anchored on the duplicate action every row carries — the delete action
 *  is named for what that row's X actually does, so it is not the stable anchor. */
const rows = () => screen.getAllByRole('button', { name: 'Duplicate' }).map((b) => b.parentElement as HTMLElement);
/** A row's name — the truncating label slot `EditorRow` gives every list in the editor. */
const rowNames = () => rows().map((r) => r.querySelector('span.flex-grow')?.textContent);
const row = (name: string) => rows()[rowNames().indexOf(name)];
/** Nesting as the row draws it: `EditorRow` turns depth into left padding. */
const indent = (r: HTMLElement) => r.style.paddingLeft;

beforeEach(() => {
  adapter = null;
  select.mockClear();
});

/**
 * The placeholder list is a tree now. The wiring under test is what the component adds over the pure
 * module: the rows it draws, the icon on a shared one, the count on an original, and the two gestures that
 * write — promote, and a delete that says what it is about to take.
 */
describe('PlaceholderList — the tree', () => {
  it('draws every nested row under its holder, indented', () => {
    render(<Harness initial={WORLD} />);
    expect(rowNames()).toEqual(['Molly', 'Northern', 'Hair', 'Southern', 'Hair', 'Hair', 'Town']);
    expect(indent(row('Molly'))).toBe('');
    expect(indent(rows()[1])).toBe('32px');
    expect(indent(rows()[2])).toBe('56px');
  });

  it('offers a shared row a way to its original, and an owned row none', () => {
    render(<Harness initial={WORLD} />);
    // Both variants reference the one Hair, so both rows point at it; Northern belongs to Molly and does not.
    expect(screen.getAllByRole('button', { name: 'Open Hair' })).toHaveLength(2);
    expect(screen.queryByRole('button', { name: 'Open Northern' })).not.toBeInTheDocument();
  });

  it('opens the original when the shared icon is clicked', () => {
    render(<Harness initial={WORLD} />);
    fireEvent.click(screen.getAllByRole('button', { name: 'Open Hair' })[0]);
    expect(select).toHaveBeenCalledWith('hair');
  });

  it('counts holders on the original only', () => {
    render(<Harness initial={WORLD} />);
    // Hair's top-level row is the last one; the two nested rows are the same placeholder elsewhere.
    expect(within(rows()[5]).getByText('Used by 2')).toBeInTheDocument();
    expect(within(rows()[2]).queryByText(/Used by/)).not.toBeInTheDocument();
    expect(within(row('Molly')).queryByText(/Used by/)).not.toBeInTheDocument();
  });

  it('offers promote on an owned row only', () => {
    render(<Harness initial={WORLD} />);
    expect(screen.getAllByRole('button', { name: 'Promote To Top Level' })).toHaveLength(2);
    expect(within(row('Molly')).queryByRole('button', { name: 'Promote To Top Level' })).not.toBeInTheDocument();
  });

  it('sends a promoted row back to the top level and leaves it in place as shared', () => {
    render(<Harness initial={WORLD} />);
    fireEvent.click(screen.getAllByRole('button', { name: 'Promote To Top Level' })[0]);
    expect(stored.find((p) => p.id === 'northern')?.ownerId).toBeUndefined();
    // The value that held it stays, so the row does not move — it only changes what it means.
    expect(rowNames()).toEqual(['Molly', 'Northern', 'Hair', 'Southern', 'Hair', 'Northern', 'Hair', 'Hair', 'Town']);
    expect(screen.getAllByRole('button', { name: 'Open Northern' })).toHaveLength(1);
  });

  it('asks before a delete that takes others with it, and names them', () => {
    render(<Harness initial={WORLD} />);
    fireEvent.click(within(row('Molly')).getByRole('button', { name: 'Delete' }));
    expect(screen.getByText('Delete Molly?')).toBeInTheDocument();
    expect(screen.getByText(/Northern, Southern/)).toBeInTheDocument();
    // Nothing goes until the author says so.
    expect(stored.map((p) => p.id)).toContain('molly');
  });

  it('takes what it owns once confirmed', () => {
    render(<Harness initial={WORLD} />);
    fireEvent.click(within(row('Molly')).getByRole('button', { name: 'Delete' }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));
    expect(stored.map((p) => p.name)).toEqual(['Hair', 'Town']);
  });

  it('deletes a placeholder that owns nothing without asking', () => {
    render(<Harness initial={WORLD} />);
    fireEvent.click(within(row('Town')).getByRole('button', { name: 'Delete' }));
    expect(screen.queryByText('Delete Town?')).not.toBeInTheDocument();
    expect(stored.map((p) => p.name)).not.toContain('Town');
  });

  it('unhooks a shared row rather than deleting the original everyone else uses', () => {
    render(<Harness initial={WORLD} />);
    // Row 2 is Northern's *reference* to Hair. Removing it must leave Hair standing for Southern, and must
    // not leave Southern holding a value pointing at nothing.
    expect(within(rows()[2]).getByRole('button', { name: 'Remove Reference' })).toBeInTheDocument();
    fireEvent.click(within(rows()[2]).getByRole('button', { name: 'Remove Reference' }));
    expect(stored.map((p) => p.name)).toEqual(['Molly', 'Northern', 'Southern', 'Hair', 'Town']);
    expect(rowNames()).toEqual(['Molly', 'Northern', 'Southern', 'Hair', 'Hair', 'Town']);
  });

  it('deletes the original from its own top-level row', () => {
    render(<Harness initial={WORLD} />);
    // The last Hair row is the original. That X is a delete, and the values pointing at it are left
    // dangling for the existing red-`?` treatment — a reference is never cascaded.
    fireEvent.click(within(rows()[5]).getByRole('button', { name: 'Delete' }));
    expect(stored.map((p) => p.name)).toEqual(['Molly', 'Northern', 'Southern', 'Town']);
    expect(stored.find((p) => p.id === 'northern')?.values).toHaveLength(1);
  });

  it('takes an owned row’s value with it, so the owner is not left pointing at nothing', () => {
    render(<Harness initial={WORLD} />);
    // Northern is Molly's own. Deleting it must not leave Molly holding a chip of something gone.
    fireEvent.click(within(rows()[1]).getByRole('button', { name: 'Delete' }));
    expect(stored.map((p) => p.name)).toEqual(['Molly', 'Southern', 'Hair', 'Town']);
    expect(stored.find((p) => p.id === 'molly')?.values).toHaveLength(1);
  });

  it('writes the drop the pure module resolved', () => {
    render(<Harness initial={WORLD} />);
    // Town onto Molly's first nested row, dragged one indent right — the gesture that nests it under Molly.
    act(() => adapter!.onDrop('town', 'molly/northern', 24, new Set()));
    expect(stored.find((p) => p.id === 'town')?.ownerId).toBe('molly');
  });

  it('says the tab is empty rather than drawing an empty tree', () => {
    render(<Harness initial={[]} />);
    expect(screen.queryByRole('button', { name: 'Duplicate' })).not.toBeInTheDocument();
    expect(screen.getByText(/placeholders/i)).toBeInTheDocument();
  });
});
