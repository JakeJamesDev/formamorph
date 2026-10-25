import { describe, expect, it, vi } from 'vitest';
import { useState } from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';
import { BreadcrumbPicker, type BreadcrumbPickerNode, type BreadcrumbPickerRow, type BreadcrumbPickerSection } from './breadcrumb-picker';

// Ash and Mira both hold Brave, so two rows pick the same value.
const SECTIONS: BreadcrumbPickerSection<string>[] = [
  {
    heading: 'Traits',
    rows: [
      { key: 'w:steady', value: 'Steady', name: 'Steady', breadcrumb: ['World'] },
      { key: 'ash:brave', value: 'Brave', name: 'Brave', breadcrumb: ['Ash', 'Bond'] },
      { key: 'ash:storm', value: 'Storm Touched', name: 'Storm Touched', breadcrumb: ['Ash', 'Lineage and Bloodlines', 'Storms', 'Sky'] },
      { key: 'mira:brave', value: 'Brave', name: 'Brave', breadcrumb: ['Mira', 'Heart', 'Courage'] },
      { key: 'w:locked', value: 'Locked', name: 'Locked', breadcrumb: ['World'], disabled: true },
    ],
  },
  { heading: 'Stats', rows: [{ key: 's:health', value: 'Health', name: 'Health' }] },
];

/** A field-trigger picker whose picks land, so a test reads what the author would see next. */
function Field({ sections = SECTIONS, initial = '', onPick = () => {} }: {
  sections?: BreadcrumbPickerSection<string>[];
  initial?: string;
  onPick?: (value: string) => void;
}) {
  const [value, setValue] = useState(initial);
  return (
    <TooltipProvider>
      <BreadcrumbPicker
        sections={sections}
        value={value}
        onPick={(v) => { setValue(v); onPick(v); }}
        placeholder="Pick a trait…"
        searchPlaceholder="Search traits"
        ariaLabel="Trait"
      />
    </TooltipProvider>
  );
}

const trigger = () => screen.getByRole('combobox', { name: 'Trait' });
const rows = () => screen.getAllByRole('option').map((o) => o.textContent);
const row = (name: RegExp) => screen.getByRole('option', { name });

describe('BreadcrumbPicker rows', () => {
  it('lists rows in the given order under their headings, collapsing a path of three or more segments', async () => {
    const user = userEvent.setup();
    render(<Field />);
    await user.click(trigger());
    expect(rows()).toEqual([
      'SteadyWorld',
      'BraveAsh › Bond',
      'Storm TouchedAsh › … › Sky',
      'BraveMira › … › Courage',
      'LockedWorld',
      'Health',
    ]);
    expect(within(screen.getByRole('group', { name: 'Stats' })).getAllByRole('option')).toHaveLength(1);
  });

  it('shows the full path in a hover tooltip, and no tooltip on a row with no breadcrumb', async () => {
    const user = userEvent.setup();
    render(<Field />);
    await user.click(trigger());
    await user.hover(row(/^Storm Touched/));
    expect(await screen.findByText('Ash › Lineage and Bloodlines › Storms › Sky')).toBeVisible();
    // The tip spells out the path; the row keeps its own name.
    expect(row(/^Storm Touched/)).toHaveAccessibleName('Storm Touched Ash › … › Sky');

    await user.hover(row(/^Health/));
    await waitFor(() => expect(screen.queryByText('Ash › Lineage and Bloodlines › Storms › Sky')).toBeNull());
    expect(row(/^Health/)).not.toHaveAttribute('data-base-ui-tooltip-trigger');
    expect(row(/^Steady/)).toHaveAttribute('data-base-ui-tooltip-trigger');
  });

  it('checks every row that holds the current value, and only those', async () => {
    const user = userEvent.setup();
    render(<Field initial="Brave" />);
    expect(trigger()).toHaveTextContent('Brave');
    await user.click(trigger());
    const checked = screen.getAllByRole('option').filter((o) => o.getAttribute('data-state') === 'checked');
    expect(checked.map((o) => o.textContent)).toEqual(['BraveAsh › Bond', 'BraveMira › … › Courage']);
  });

  it('shows the prompt on the trigger until a row is picked', async () => {
    const user = userEvent.setup();
    render(<Field />);
    expect(trigger()).toHaveTextContent('Pick a trait…');
    await user.click(trigger());
    await user.click(row(/^Storm Touched/));
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(trigger()).toHaveTextContent('Storm Touched');
  });
});

describe('BreadcrumbPicker search', () => {
  it('shows the search field on a one-row list', async () => {
    const user = userEvent.setup();
    render(<Field sections={[{ rows: [SECTIONS[1].rows[0]] }]} />);
    await user.click(trigger());
    expect(screen.getByPlaceholderText('Search traits')).toBeInTheDocument();
  });

  it('narrows to the rows under a hidden middle segment, in the given order', async () => {
    const user = userEvent.setup();
    render(<Field />);
    await user.click(trigger());
    await user.type(screen.getByPlaceholderText('Search traits'), 'LINEAGE');
    expect(rows()).toEqual(['Storm TouchedAsh › … › Sky']);
    await user.clear(screen.getByPlaceholderText('Search traits'));
    await user.type(screen.getByPlaceholderText('Search traits'), 'brave');
    expect(rows()).toEqual(['BraveAsh › Bond', 'BraveMira › … › Courage']);
  });

  it('says No matches when the search finds nothing, and Nothing to pick when there are no rows', async () => {
    const user = userEvent.setup();
    const { unmount } = render(<Field />);
    await user.click(trigger());
    await user.type(screen.getByPlaceholderText('Search traits'), 'zzz');
    expect(screen.getByText('No matches')).toBeInTheDocument();
    unmount();

    render(<Field sections={[{ heading: 'Traits', rows: [] }]} />);
    await user.click(trigger());
    expect(screen.getByText('Nothing to pick')).toBeInTheDocument();
    expect(screen.queryByText('No matches')).toBeNull();
  });

  it('clears the search with the Clear Search X, which shows only while the search holds text', async () => {
    const user = userEvent.setup();
    render(<Field />);
    await user.click(trigger());
    const search = screen.getByPlaceholderText('Search traits');
    expect(screen.queryByRole('button', { name: 'Clear Search' })).toBeNull();

    await user.type(search, 'brave');
    expect(rows()).toHaveLength(2);
    await user.click(screen.getByRole('button', { name: 'Clear Search' }));

    expect(search).toHaveValue('');
    expect(rows()).toHaveLength(6);
    expect(search).toHaveFocus();
    expect(screen.queryByRole('button', { name: 'Clear Search' })).toBeNull();
    // user-event keeps stale typed text across the native clear; fireEvent types as a browser does.
    fireEvent.change(search, { target: { value: 'health' } });
    expect(rows()).toEqual(['Health']);
  });

  it('picks the highlighted row on Enter while the Clear Search X shows', async () => {
    const user = userEvent.setup();
    const onPick = vi.fn();
    render(<Field onPick={onPick} />);
    await user.click(trigger());
    await user.type(screen.getByPlaceholderText('Search traits'), 'storm');
    expect(screen.getByRole('button', { name: 'Clear Search' })).toBeInTheDocument();
    await user.keyboard('{Enter}');
    expect(onPick).toHaveBeenCalledWith('Storm Touched');
    expect(trigger()).toHaveTextContent('Storm Touched');
  });

  it('keeps the Clear Search X out of the Tab order, since Enter on it would pick a row', async () => {
    const user = userEvent.setup();
    render(<Field />);
    await user.click(trigger());
    const search = screen.getByPlaceholderText('Search traits');
    await user.type(search, 'brave');
    await user.tab();
    expect(screen.getByRole('button', { name: 'Clear Search' })).not.toHaveFocus();
    expect(search).toHaveFocus();
  });
});

describe('BreadcrumbPicker keyboard', () => {
  it('picks with the arrow keys and Enter, skipping a disabled row', async () => {
    const user = userEvent.setup();
    const onPick = vi.fn();
    render(<Field onPick={onPick} />);
    await user.click(trigger());
    // From Steady, four steps pass Ash's Brave, Storm Touched and Mira's Brave, then skip Locked.
    await user.keyboard('{ArrowDown}{ArrowDown}{ArrowDown}{ArrowDown}{Enter}');
    expect(onPick).toHaveBeenCalledWith('Health');
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('closes on Escape with no pick', async () => {
    const user = userEvent.setup();
    const onPick = vi.fn();
    render(<Field initial="Steady" onPick={onPick} />);
    await user.click(trigger());
    await user.keyboard('{ArrowDown}');
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(onPick).not.toHaveBeenCalled();
    expect(trigger()).toHaveTextContent('Steady');
  });

  it('never picks a disabled row', async () => {
    const user = userEvent.setup();
    const onPick = vi.fn();
    render(<Field onPick={onPick} />);
    await user.click(trigger());
    await user.click(row(/^Locked/));
    expect(onPick).not.toHaveBeenCalled();
  });
});

describe('BreadcrumbPicker trigger and page', () => {
  it('opens from a caller-supplied trigger, and a caller page replaces the list', async () => {
    const user = userEvent.setup();
    function Custom() {
      const [open, setOpen] = useState(false);
      const [page, setPage] = useState<string | null>(null);
      return (
        <TooltipProvider>
          <BreadcrumbPicker
            sections={SECTIONS}
            onPick={setPage}
            open={open}
            onOpenChange={(next) => { setOpen(next); if (!next) setPage(null); }}
            closeOnPick={false}
            searchPlaceholder="Search traits"
            trigger={<Button type="button">Add</Button>}
            page={page && <p>Page for {page}</p>}
          />
        </TooltipProvider>
      );
    }
    render(<Custom />);
    await user.click(screen.getByRole('button', { name: 'Add' }));
    await user.click(row(/^Health/));
    expect(screen.getByText('Page for Health')).toBeInTheDocument();
    expect(screen.queryByPlaceholderText('Search traits')).toBeNull();
  });
});

const rowOf = (key: string, name: string, breadcrumb?: string[], disabled?: boolean): BreadcrumbPickerRow<string> =>
  ({ key, value: key, name, breadcrumb, disabled });
const section = (rows: BreadcrumbPickerRow<string>[], heading?: string): BreadcrumbPickerNode<string> => ({ kind: 'section', heading, rows });
const page = (key: string, heading: string, children: BreadcrumbPickerNode<string>[]): BreadcrumbPickerNode<string> =>
  ({ kind: 'page', key, heading, children });

// Mira holds one trait, so it reads as a row on the Traits page.
const TRAITS = page('traits', 'Traits', [
  page('t:world', 'World', [section([rowOf('steady', 'Steady', ['World']), rowOf('calm', 'Calm', ['World']), rowOf('locked', 'Locked', ['World'], true)])]),
  page('t:ash', 'Ash', [section([
    rowOf('brave', 'Brave', ['Ash', 'Bond']), rowOf('bold', 'Bold', ['Ash', 'Bond']), rowOf('storm', 'Storm Touched', ['Ash', 'Lineage', 'Storms', 'Sky']),
  ])]),
  page('t:mira', 'Mira', [section([rowOf('kind', 'Kind', ['Mira', 'Heart'])])]),
]);
// One owner, every row already added.
const GROUPS = page('groups', 'Any Trait in a Group', [
  page('g:world', 'World', [section([rowOf('habits', 'Habits', ['World'], true), rowOf('moods', 'Moods', ['World'], true)])]),
]);
const STATS = page('stats', 'Stats', [
  page('s:ash', 'Ash', [section([rowOf('hunger', 'Hunger'), rowOf('thirst', 'Thirst'), rowOf('rage', 'Rage'), rowOf('gold', 'Gold')], 'Ash Stats')]),
  page('s:mira', 'Mira', [section([rowOf('hope', 'Hope'), rowOf('fear', 'Fear')], 'Mira Stats')]),
  page('s:ghost', 'Ghost', [section([], 'Ghost Stats')]),
]);
const TIME = page('time', 'Time of Day', [section([rowOf('time', 'Time of Day')])]);
const PERSONAS = page('personas', 'Playing As', [section([rowOf('rook', 'Rook', undefined, true), rowOf('vale', 'Vale')])]);
// 15 leaf rows, then 16, then 18.
const AT_CUTOFF = [TRAITS, GROUPS, STATS];
const OVER_CUTOFF = [TRAITS, GROUPS, STATS, TIME];
const TREE = [TRAITS, GROUPS, STATS, TIME, PERSONAS];

/** A tree picker whose picks land, with an optional caller page for a picked row. */
function TreeField({ tree = TREE, onPick = () => {}, closeOnPick, withPage }: {
  tree?: BreadcrumbPickerNode<string>[];
  onPick?: (value: string) => void;
  closeOnPick?: boolean;
  withPage?: boolean;
}) {
  const [value, setValue] = useState('');
  const [picked, setPicked] = useState<string | null>(null);
  return (
    <TooltipProvider>
      <BreadcrumbPicker
        tree={tree}
        value={value}
        onPick={(v) => { setValue(v); onPick(v); if (withPage) setPicked(v); }}
        closeOnPick={closeOnPick}
        page={picked && <Button type="button" onClick={() => setPicked(null)}>Done With {picked}</Button>}
        placeholder="Pick a target…"
        searchPlaceholder="Search targets"
        ariaLabel="Target"
      />
    </TooltipProvider>
  );
}

const target = () => screen.getByRole('combobox', { name: 'Target' });
const search = () => screen.getByPlaceholderText('Search targets');
// A page row reads by its accessible name; a target row by its text.
const items = () => screen.getAllByRole('option').map((o) => o.getAttribute('aria-label') ?? o.textContent);
const opens = (name: string, count: number) => `${name}, ${count} available, opens a page`;
const pageRow = (name: string) => screen.getByRole('option', { name: new RegExp(`^${name}, \\d+ available, opens a page$`) });
const header = (path: string) => screen.getByText(path);

const ROOT_ITEMS = [opens('Traits', 6), opens('Any Trait in a Group', 0), opens('Stats', 6), 'Time of Day', opens('Playing As', 1)];

describe('BreadcrumbPicker drill-down', () => {
  it('shows the flat list from the tree at 15 rows, grouped as the sections were', async () => {
    const user = userEvent.setup();
    render(<TreeField tree={AT_CUTOFF} />);
    await user.click(target());
    expect(screen.queryByRole('option', { name: /opens a page/ })).toBeNull();
    expect(items()).toHaveLength(15);
    expect(screen.getAllByRole('group').map((g) => within(g).getAllByRole('option').length)).toEqual([7, 2, 4, 2]);
    expect(screen.getByRole('group', { name: 'Any Trait in a Group' })).toBeInTheDocument();
    expect(within(screen.getByRole('group', { name: 'Traits' })).getAllByRole('option').map((o) => o.textContent))
      .toEqual(['SteadyWorld', 'CalmWorld', 'LockedWorld', 'BraveAsh › Bond', 'BoldAsh › Bond', 'Storm TouchedAsh › … › Sky', 'KindMira › Heart']);
    expect(screen.getByRole('group', { name: 'Ash Stats' })).toBeInTheDocument();
  });

  it('opens on the root page above 15 rows, with counts that leave out disabled rows', async () => {
    const user = userEvent.setup();
    const { unmount } = render(<TreeField tree={OVER_CUTOFF} />);
    await user.click(target());
    expect(items()).toEqual(ROOT_ITEMS.slice(0, 4));
    unmount();

    render(<TreeField />);
    await user.click(target());
    expect(items()).toEqual(ROOT_ITEMS);
  });

  it('opens a page on click, under a header naming it, and drops the path from row breadcrumbs', async () => {
    const user = userEvent.setup();
    render(<TreeField />);
    await user.click(target());
    await user.click(pageRow('Traits'));
    expect(header('Traits')).toBeInTheDocument();
    // Mira's lone trait is a row here, keeping Mira since the path doesn't name it; the empty owner shows nothing.
    expect(items()).toEqual([opens('World', 2), opens('Ash', 3), 'KindMira › Heart']);

    await user.click(pageRow('Ash'));
    expect(header('Traits › Ash')).toBeInTheDocument();
    expect(items()).toEqual(['BraveBond', 'BoldBond', 'Storm TouchedLineage › … › Sky']);
    expect(search()).toHaveFocus();
  });

  it('hides an empty page and shows a lone section without its heading', async () => {
    const user = userEvent.setup();
    render(<TreeField />);
    await user.click(target());
    await user.click(pageRow('Stats'));
    expect(items()).toEqual([opens('Ash', 4), opens('Mira', 2)]);
    await user.click(pageRow('Ash'));
    expect(items()).toEqual(['Hunger', 'Thirst', 'Rage', 'Gold']);
    expect(screen.queryByRole('group', { name: 'Ash Stats' })).toBeNull();
  });

  it('opens straight through a page with one choice, and its header names the skipped page', async () => {
    const user = userEvent.setup();
    render(<TreeField />);
    await user.click(target());
    await user.click(pageRow('Any Trait in a Group'));
    expect(header('Any Trait in a Group › World')).toBeInTheDocument();
    expect(items()).toEqual(['Habits', 'Moods']);
    // Back skips the passed-through page too.
    await user.click(screen.getByRole('button', { name: 'Back' }));
    expect(items()).toEqual(ROOT_ITEMS);
  });

  it('leads a lifted lone row’s breadcrumb with the page it skipped, unless it already starts there', async () => {
    const user = userEvent.setup();
    const many = Array.from({ length: 14 }, (_, i) => rowOf(`n${i}`, `Note ${i}`));
    const tree = [
      page('notes', 'Notes', [section(many)]),
      page('stats', 'Stats', [
        page('s:you', 'Persona', [section([rowOf('mood-you', 'Mood')], 'Persona Stats')]),
        page('s:mira', 'Mira', [section([rowOf('mood-mira', 'Mood')], 'Mira Stats')]),
        page('s:ash', 'Ash', [section([rowOf('kind', 'Kind', ['Ash', 'Heart'])], 'Ash Stats')]),
      ]),
    ];
    render(<TreeField tree={tree} />);
    await user.click(target());
    await user.click(pageRow('Stats'));
    expect(items()).toEqual(['MoodPersona', 'MoodMira', 'KindAsh › Heart']);
  });

  it('opens straight into a lone root category, with no way back', async () => {
    const user = userEvent.setup();
    const many = Array.from({ length: 16 }, (_, i) => rowOf(`n${i}`, `Note ${i}`));
    render(<TreeField tree={[page('notes', 'Notes', [section(many)])]} />);
    await user.click(target());
    expect(header('Notes')).toBeInTheDocument();
    expect(items()).toHaveLength(16);
    expect(screen.queryByRole('button', { name: 'Back' })).toBeNull();
    await user.keyboard('{Backspace}');
    expect(items()).toHaveLength(16);
  });

  it('picks a one-row category at the root without opening a page', async () => {
    const user = userEvent.setup();
    const onPick = vi.fn();
    render(<TreeField onPick={onPick} />);
    await user.click(target());
    await user.click(screen.getByRole('option', { name: 'Time of Day' }));
    expect(onPick).toHaveBeenCalledWith('time');
    expect(target()).toHaveTextContent('Time of Day');
  });

  it('goes back one level by the arrow', async () => {
    const user = userEvent.setup();
    render(<TreeField />);
    await user.click(target());
    await user.click(pageRow('Traits'));
    await user.click(pageRow('Ash'));
    await user.click(screen.getByRole('button', { name: 'Back' }));
    expect(header('Traits')).toBeInTheDocument();
    expect(items()).toEqual([opens('World', 2), opens('Ash', 3), 'KindMira › Heart']);
    await user.click(screen.getByRole('button', { name: 'Back' }));
    expect(items()).toEqual(ROOT_ITEMS);
    expect(screen.queryByRole('button', { name: 'Back' })).toBeNull();
  });

  it('drills with Enter and goes back with Backspace in an empty search', async () => {
    const user = userEvent.setup();
    render(<TreeField />);
    await user.click(target());
    await user.keyboard('{Enter}');
    expect(header('Traits')).toBeInTheDocument();
    await user.keyboard('{ArrowDown}{Enter}');
    expect(header('Traits › Ash')).toBeInTheDocument();

    // Backspace edits a search that holds text.
    await user.keyboard('b{Backspace}');
    expect(header('Traits › Ash')).toBeInTheDocument();
    expect(search()).toHaveValue('');
    await user.keyboard('{Backspace}');
    expect(header('Traits')).toBeInTheDocument();
    await user.keyboard('{Backspace}');
    expect(items()).toEqual(ROOT_ITEMS);
    expect(search()).toHaveFocus();
  });

  it('searches every page from the root, with full breadcrumbs under the section headings', async () => {
    const user = userEvent.setup();
    render(<TreeField />);
    await user.click(target());
    await user.type(search(), 'old');
    expect(items()).toEqual(['BoldAsh › Bond', 'Gold']);
    expect(within(screen.getByRole('group', { name: 'Traits' })).getByRole('option')).toHaveTextContent('Bold');
    expect(within(screen.getByRole('group', { name: 'Ash Stats' })).getByRole('option')).toHaveTextContent('Gold');
  });

  it('searches only the open page, from an empty search', async () => {
    const user = userEvent.setup();
    render(<TreeField />);
    await user.click(target());
    await user.click(pageRow('Traits'));
    expect(search()).toHaveValue('');
    await user.type(search(), 'old');
    expect(items()).toEqual(['BoldAsh › Bond']);

    // Owners split no group on the page: their names already show in the breadcrumbs.
    fireEvent.change(search(), { target: { value: 'l' } });
    expect(items()).toEqual(['SteadyWorld', 'CalmWorld', 'LockedWorld', 'BoldAsh › Bond', 'Storm TouchedAsh › … › Sky']);
    expect(screen.queryByRole('group', { name: 'World' })).toBeNull();
    expect(screen.queryByRole('group', { name: 'Ash' })).toBeNull();

    await user.clear(search());
    await user.click(pageRow('Ash'));
    await user.type(search(), 'bo');
    expect(items()).toEqual(['BraveBond', 'BoldBond']);
  });

  it('stays on the open page after a pick that leaves the popover open', async () => {
    const user = userEvent.setup();
    const onPick = vi.fn();
    render(<TreeField closeOnPick={false} onPick={onPick} />);
    await user.click(target());
    await user.click(pageRow('Traits'));
    await user.click(pageRow('Ash'));
    await user.click(screen.getByRole('option', { name: /^Bold/ }));
    expect(onPick).toHaveBeenCalledWith('bold');
    expect(header('Traits › Ash')).toBeInTheDocument();
    expect(items()).toEqual(['BraveBond', 'BoldBond', 'Storm TouchedLineage › … › Sky']);
  });

  it('returns to the open page and its search when a caller page closes', async () => {
    const user = userEvent.setup();
    render(<TreeField closeOnPick={false} withPage />);
    await user.click(target());
    await user.click(pageRow('Traits'));
    await user.click(pageRow('Ash'));
    await user.type(search(), 'bo');
    await user.click(screen.getByRole('option', { name: /^Bold/ }));
    expect(screen.queryByPlaceholderText('Search targets')).toBeNull();

    await user.click(screen.getByRole('button', { name: 'Done With bold' }));
    expect(header('Traits › Ash')).toBeInTheDocument();
    expect(search()).toHaveValue('bo');
    expect(items()).toEqual(['BraveBond', 'BoldBond']);
  });

  it('opens at the root every time', async () => {
    const user = userEvent.setup();
    render(<TreeField />);
    await user.click(target());
    await user.click(pageRow('Stats'));
    await user.click(pageRow('Mira'));
    await user.click(screen.getByRole('option', { name: 'Hope' }));
    expect(screen.queryByRole('listbox')).toBeNull();
    await user.click(target());
    expect(items()).toEqual(ROOT_ITEMS);

    await user.click(pageRow('Traits'));
    await user.keyboard('{Escape}');
    await user.click(target());
    expect(items()).toEqual(ROOT_ITEMS);
  });
});

describe('BreadcrumbPicker search cost', () => {
  it('renders no row again while the search narrows, since the list filters rows it already holds', async () => {
    const user = userEvent.setup();
    const renderText = vi.fn((text: string) => text);
    render(
      <TooltipProvider>
        <BreadcrumbPicker tree={TREE} onPick={() => {}} renderText={renderText} searchPlaceholder="Search targets" ariaLabel="Target" />
      </TooltipProvider>,
    );
    await user.click(target());
    await user.type(search(), 'bo');
    expect(items()).toEqual(['BraveAsh › Bond', 'BoldAsh › Bond']);
    renderText.mockClear();

    await user.type(search(), 'ld');
    expect(items()).toEqual(['BoldAsh › Bond']);
    expect(renderText).not.toHaveBeenCalled();
  });
});
