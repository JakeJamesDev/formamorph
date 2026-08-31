import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { encodePlaceholderToken } from '@/lib/placeholders';
import type { Placeholder } from '@/types';
import PlaceholderList from './PlaceholderList';

const setPlaceholders = vi.fn();
const removePlaceholder = vi.fn();
let stored: Placeholder[] = [];
vi.mock('@/contexts/PlaceholderStoreContext', () => ({
  usePlaceholderStore: () => ({
    placeholders: stored,
    setPlaceholders,
    addPlaceholder: vi.fn(),
    updatePlaceholder: vi.fn(),
    removePlaceholder,
  }),
  usePlaceholderStoreOptional: () => null,
}));

// The real list, with the drop it hands back tapped. dnd-kit's pointer path needs layout jsdom does not
// have, so a drag is played by calling that seam directly — the list still renders, so everything else
// here is the component's own output.
let drop: ((next: Placeholder[]) => void) | null = null;
vi.mock('@/components/SortableList', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/components/SortableList')>();
  return {
    ...actual,
    SortableList: (props: Parameters<typeof actual.SortableList<Placeholder>>[0]) => {
      drop = props.onReorder;
      return <actual.SortableList {...props} />;
    },
  };
});

// Through the real codec, never a hand-written token: a test that spells the wire format itself keeps
// passing after that format moves.
/** A value that is exactly one chip — the shape that makes its target a part of the placeholder holding it.
 *  `at` distinguishes two placements of the same target, which are two different value strings. */
const chip = (id: string, at = '1') => encodePlaceholderToken({ id, mode: 'world', placementId: `v-${id}-${at}` });

const P = (id: string, name: string, values: string[] = []): Placeholder => ({ id, name, values });

// Molly holds two variants, each variant holds Hair, and Town is only ever named inside prose. So Molly,
// Town and Intro are the placeholders an author places, and everything else is a part of something.
const WORLD: Placeholder[] = [
  P('molly', 'Molly', [chip('iswhite'), chip('isasian')]),
  P('iswhite', 'isWhite', [chip('hair')]),
  P('isasian', 'isAsian', [chip('hair'), 'dark brown eyes']),
  P('hair', 'Hair', ['brown', 'black']),
  P('town', 'Town', ['Sedge Landing', 'Milbrook']),
  P('intro', 'Intro', [`A traveler from ${chip('town')} waves you over.`]),
];

/** The rendered rows in list order, anchored on the delete action every row carries. */
const rows = () => screen.getAllByRole('button', { name: 'Delete' }).map((b) => b.parentElement as HTMLElement);
/** A row's name — the truncating label slot `EditorRow` gives every list in the editor. */
const rowNames = () => rows().map((r) => r.querySelector('span.truncate')?.textContent);
const row = (name: string) => rows()[rowNames().indexOf(name)];
const filter = () => screen.getByRole('button', { name: 'Hide Parts' });

beforeEach(() => {
  setPlaceholders.mockClear();
  removePlaceholder.mockClear();
  drop = null;
  stored = WORLD;
});

/**
 * The placeholder list stays flat however deep the structure under it goes. What it adds is a way to read
 * that structure: a filter that leaves only the placeholders nothing else holds, and a count on each one
 * something does — the two things an author wants before deleting anything.
 */
describe('PlaceholderList — parts', () => {
  describe('the filter', () => {
    it('shows every placeholder until it is pressed', () => {
      render(<PlaceholderList selectedId={null} onSelect={vi.fn()} />);
      expect(rowNames()).toEqual(['Molly', 'isWhite', 'isAsian', 'Hair', 'Town', 'Intro']);
      expect(filter()).toHaveAttribute('aria-pressed', 'false');
    });

    it('leaves exactly the placeholders nothing holds', () => {
      render(<PlaceholderList selectedId={null} onSelect={vi.fn()} />);
      fireEvent.click(filter());
      expect(rowNames()).toEqual(['Molly', 'Town', 'Intro']);
      expect(filter()).toHaveAttribute('aria-pressed', 'true');
    });

    it('keeps a placeholder whose chip only sits inside a longer value', () => {
      // Intro names Town in prose. That composes into Intro's own value; it does not make Town a part of it.
      render(<PlaceholderList selectedId={null} onSelect={vi.fn()} />);
      fireEvent.click(filter());
      expect(rowNames()).toContain('Town');
    });

    it('puts every part back when it is pressed again', () => {
      render(<PlaceholderList selectedId={null} onSelect={vi.fn()} />);
      fireEvent.click(filter());
      fireEvent.click(filter());
      expect(rowNames()).toEqual(['Molly', 'isWhite', 'isAsian', 'Hair', 'Town', 'Intro']);
    });

    it('is not offered in a world with no parts at all', () => {
      stored = [P('town', 'Town', ['Sedge Landing']), P('mood', 'Mood', ['tense', 'calm'])];
      render(<PlaceholderList selectedId={null} onSelect={vi.fn()} />);
      expect(screen.queryByRole('button', { name: 'Hide Parts' })).not.toBeInTheDocument();
      expect(rowNames()).toEqual(['Town', 'Mood']);
    });

    it('is not offered when the only chip value points at a placeholder that is gone', () => {
      // A deleted target leaves the token behind. It names a part nobody can see, so a filter offered for
      // it would visibly do nothing when pressed.
      stored = [P('a', 'A', [chip('deleted')]), P('mood', 'Mood', ['tense', 'calm'])];
      render(<PlaceholderList selectedId={null} onSelect={vi.fn()} />);
      expect(screen.queryByRole('button', { name: 'Hide Parts' })).not.toBeInTheDocument();
      expect(rowNames()).toEqual(['A', 'Mood']);
    });

    it('spaces itself off the rows with a gap the drag wrapper cannot swallow', () => {
      // The drag context between this list and its rows draws no box, and a margin on a `display: contents`
      // element is never painted — a `space-y` here reads as zero gap on screen.
      const { container } = render(<PlaceholderList selectedId={null} onSelect={vi.fn()} />);
      const wrapper = container.firstElementChild as HTMLElement;
      expect(wrapper.className).toContain('flex-col');
      expect(wrapper.className).toContain('gap-1');
      expect(wrapper.className).not.toContain('space-y');
    });

    it('says so rather than reading empty when every placeholder is a part', () => {
      stored = [P('a', 'A', [chip('b')]), P('b', 'B', [chip('a')])];
      render(<PlaceholderList selectedId={null} onSelect={vi.fn()} />);
      fireEvent.click(filter());
      expect(screen.getByText('Every placeholder here is a part of another one.')).toBeInTheDocument();
      // The way back out has to survive the empty list, or the filter is a trap.
      expect(filter()).toHaveAttribute('aria-pressed', 'true');
    });

    it('keeps the parts it hid when a visible row is dragged past them', () => {
      // The store is written back whole. Handing it the three rows the filter left would delete the other
      // three placeholders, and an author reordering their top-level list would never see it happen.
      render(<PlaceholderList selectedId={null} onSelect={vi.fn()} />);
      fireEvent.click(filter());
      const [molly, town, intro] = WORLD.filter((p) => ['molly', 'town', 'intro'].includes(p.id));
      drop!([intro, molly, town]);

      const write = setPlaceholders.mock.calls.at(-1)?.at(0) as (prev: Placeholder[]) => Placeholder[];
      expect(write(WORLD).map((p) => p.name)).toEqual(['Intro', 'isWhite', 'isAsian', 'Hair', 'Molly', 'Town']);
    });
  });

  describe('the used-by hint', () => {
    it('counts the placeholders holding each part, and says nothing on the rest', () => {
      render(<PlaceholderList selectedId={null} onSelect={vi.fn()} />);
      expect(within(row('Hair')).getByText('Used by 2')).toBeInTheDocument();
      expect(within(row('isWhite')).getByText('Used by 1')).toBeInTheDocument();
      expect(within(row('Molly')).queryByText(/Used by/)).not.toBeInTheDocument();
      expect(within(row('Town')).queryByText(/Used by/)).not.toBeInTheDocument();
    });

    it('counts a holder once however many of its values point at the same part', () => {
      stored = [P('variant', 'Variant', [chip('hair'), chip('hair', '2')]), P('hair', 'Hair', ['brown'])];
      render(<PlaceholderList selectedId={null} onSelect={vi.fn()} />);
      expect(within(row('Hair')).getByText('Used by 1')).toBeInTheDocument();
    });

    it('stays on a part while the filter is switched around it', () => {
      render(<PlaceholderList selectedId={null} onSelect={vi.fn()} />);
      fireEvent.click(filter());
      fireEvent.click(filter());
      expect(within(row('Hair')).getByText('Used by 2')).toBeInTheDocument();
    });
  });
});
