import { useMemo, useState } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { allPlaceholders, placeholderOwners } from '@/lib/placeholderHomes';
import { encodePlaceholderToken } from '@/lib/placeholders';
import type { SearchTarget } from '@/lib/worldSearch';
import type { Placeholder } from '@/types';
import EditorFindBar from './EditorFindBar';

import { phValues } from '@/test/placeholderValues';

/**
 * The find bar's replacement picker — the same sectioned list every other placeholder dropdown draws, so
 * the list an author reads before pressing Replace is the list they already know from the strip.
 */

const town: Placeholder = { id: 'town', name: 'Town', values: phValues(['Sedge']) };
const weather: Placeholder = { id: 'weather', name: 'Weather', values: phValues(['fog']) };
const mood: Placeholder = { id: 'mood', name: 'Mood', values: phValues(['sour']) };

/** A world whose entity carries Mood, with Weather filed in a folder and Town loose. */
const lists = {
  placeholders: [town, { ...weather, groupId: 'looks' }],
  placeholderGroups: [{ id: 'looks', name: 'Looks', parentId: null }],
  entities: [{ id: 'keeper', name: 'Keeper', placeholders: [mood] }],
  dictionaries: [],
};

/** One field for the bar to search, so a query has somewhere to land. */
const target = (): SearchTarget => ({
  itemKey: 'entity:keeper',
  record: {},
  applyTo: (record) => record,
  commit: () => {},
  tab: 'entities',
  itemId: 'keeper',
  itemLabel: 'Keeper',
  fieldKey: 'description',
  fieldLabel: 'Description',
  chipCapable: true,
  inChipList: false,
  value: 'The ferry runs at dawn.',
  write: () => {},
});

const onAddPlaceholder = vi.fn();

/** The same world after the author files Mood inside Town's values. Mood is still a placeholder the world
 *  holds, but a chip can no longer be aimed at it from ordinary text, so the picker stops offering it. */
const moodFiledInTown = {
  ...lists,
  placeholders: [
    { ...town, values: phValues([encodePlaceholderToken({ id: 'mood', mode: 'world', placementId: 'p-mood' })]) },
    { ...weather, groupId: 'looks' },
    { ...mood, ownerId: 'town' },
  ],
  entities: [{ id: 'keeper', name: 'Keeper', placeholders: [] }],
};

function Harness({ world = lists, onClose = () => {} }: { world?: typeof lists; onClose?: () => void }) {
  const all = useMemo(() => allPlaceholders(world), [world]);
  const owners = useMemo(() => placeholderOwners(world), [world]);
  return (
    <EditorFindBar
      targets={[target()]}
      placeholders={all}
      placementLetters={new Map()}
      placeholderOwners={owners}
      placeholderGroups={world.placeholderGroups}
      allowPlaceholderReplace
      startWithReplace
      onNavigate={() => {}}
      onAddPlaceholder={onAddPlaceholder}
      onClose={onClose}
    />
  );
}

/** The desktop app bar's field, with the host's expanded state. */
function DockedHarness({ onClose }: { onClose: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const all = useMemo(() => allPlaceholders(lists), []);
  return (
    <EditorFindBar
      layout="docked"
      expanded={expanded}
      onExpandedChange={setExpanded}
      targets={[target()]}
      placeholders={all}
      placementLetters={new Map()}
      allowPlaceholderReplace
      onNavigate={() => {}}
      onAddPlaceholder={onAddPlaceholder}
      onClose={onClose}
    />
  );
}

const rowNames = () => screen.getAllByTestId('placeholder-section-row').map((r) => r.textContent ?? '');

/** Into placeholder mode, then open the picker. */
const openPicker = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(screen.getByRole('button', { name: 'Replace with a placeholder instead' }));
  await user.click(screen.getByRole('button', { name: 'Choose Placeholder' }));
};

describe('EditorFindBar Clear Search', () => {
  it('empties the floating Find box, keeps the bar open, and focuses the box', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<Harness onClose={onClose} />);
    const find = screen.getByRole('textbox', { name: 'Find' });
    expect(screen.queryByRole('button', { name: 'Clear Search' })).toBeNull();

    await user.type(find, 'ferry');
    await waitFor(() => expect(screen.getByText('1 / 1')).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: 'Clear Search' }));

    expect(find).toHaveValue('');
    expect(find).toHaveFocus();
    expect(screen.getByRole('search', { name: 'Find and replace in world' })).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: 'Clear Search' })).toBeNull();
    // The count follows the empty search, as it would for backspacing.
    await waitFor(() => expect(screen.queryByText('1 / 1')).toBeNull());
  });

  it('empties the Replace box with Clear Replace and focuses it', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const replace = screen.getByRole('textbox', { name: 'Replace with' });
    expect(screen.queryByRole('button', { name: 'Clear Replace' })).toBeNull();

    await user.type(replace, 'barge');
    await user.click(screen.getByRole('button', { name: 'Clear Replace' }));

    expect(replace).toHaveValue('');
    expect(replace).toHaveFocus();
    expect(screen.queryByRole('button', { name: 'Clear Replace' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Replace with a placeholder instead' })).toBeInTheDocument();
  });

  it('empties the collapsed Search World field and leaves it collapsed and focused', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<DockedHarness onClose={onClose} />);
    const field = screen.getByRole('textbox', { name: 'Search World' });
    await user.type(field, 'ferry');
    await waitFor(() => expect(screen.getByText('1 / 1')).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: 'Clear Search' }));

    expect(field).toHaveValue('');
    expect(field).toHaveFocus();
    expect(screen.getByRole('button', { name: 'Show options and replace' })).toHaveAttribute('aria-expanded', 'false');
    expect(onClose).not.toHaveBeenCalled();
  });

  it('empties the expanded bar\'s Find and Replace boxes and keeps it expanded', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<DockedHarness onClose={onClose} />);
    await user.type(screen.getByRole('textbox', { name: 'Search World' }), 'ferry');
    await user.click(screen.getByRole('button', { name: 'Show options and replace' }));

    const find = screen.getByRole('textbox', { name: 'Search World' });
    await user.click(screen.getByRole('button', { name: 'Clear Search' }));
    expect(find).toHaveValue('');
    expect(find).toHaveFocus();

    const replace = screen.getByRole('textbox', { name: 'Replace with' });
    await user.type(replace, 'barge');
    await user.click(screen.getByRole('button', { name: 'Clear Replace' }));
    expect(replace).toHaveValue('');
    expect(replace).toHaveFocus();

    expect(screen.getByRole('button', { name: 'Collapse to search' })).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('names the row-end button Close Find floating and Close Search docked', async () => {
    const user = userEvent.setup();
    const { unmount } = render(<Harness />);
    expect(screen.getByRole('button', { name: 'Close Find' })).toBeInTheDocument();
    unmount();
    render(<DockedHarness onClose={() => {}} />);
    await user.click(screen.getByRole('button', { name: 'Show options and replace' }));
    expect(screen.getByRole('button', { name: 'Close Search' })).toBeInTheDocument();
  });

  it('offers no Clear Replace on the placeholder picker', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.type(screen.getByRole('textbox', { name: 'Replace with' }), 'barge');
    await user.click(screen.getByRole('button', { name: 'Replace with a placeholder instead' }));
    expect(screen.queryByRole('button', { name: 'Clear Replace' })).toBeNull();
  });
});

describe('EditorFindBar placeholder picker', () => {
  it('offers the world in sections, and reads the whole path once a pick closes the list', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await openPicker(user);

    expect(rowNames()).toEqual(['Town', 'Weather', 'Mood']);
    const folder = screen.getByText('Looks');
    expect(within(folder).queryByRole('img')).toBeNull();
    expect(screen.getByRole('img', { name: 'Entity' }).parentElement).toHaveTextContent('Keeper');

    await user.click(screen.getByRole('button', { name: 'Mood' }));
    const trigger = screen.getByRole('button', { name: /Keeper/ });
    expect(trigger).toHaveTextContent('Keeper › Mood');
    expect(within(trigger).getByRole('img', { name: 'Entity' })).toBeInTheDocument();
  });

  it('still mints a placeholder from the search text', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.type(screen.getByPlaceholderText('Find'), 'ferry');
    await openPicker(user);

    await user.click(screen.getByRole('button', { name: 'Create “ferry”' }));
    expect(onAddPlaceholder).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'ferry', values: [expect.objectContaining({ text: 'ferry' })] }),
    );
    // The row settles the pick and shuts the list behind it, the way picking a row does.
    expect(screen.queryByTestId('placeholder-section-row')).toBeNull();
  });

  it('stops Replace when the placeholder it settled on leaves the picker', async () => {
    const user = userEvent.setup();
    const { rerender } = render(<Harness />);
    await user.type(screen.getByPlaceholderText('Find'), 'ferry');
    await openPicker(user);
    await user.click(screen.getByRole('button', { name: 'Mood' }));
    // A match and a pick: the button is live.
    await waitFor(() => expect(screen.getByRole('button', { name: 'Replace' })).toBeEnabled());

    rerender(<Harness world={moodFiledInTown} />);
    // The trigger has no row left to read, so the button must not still insert a chip nothing can aim.
    expect(screen.getByRole('button', { name: /Choose Placeholder/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Replace' })).toBeDisabled();
  });
});
