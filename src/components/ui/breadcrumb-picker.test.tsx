import { describe, expect, it, vi } from 'vitest';
import { useState } from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';
import { BreadcrumbPicker, type BreadcrumbPickerSection } from './breadcrumb-picker';

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
