import { useMemo } from 'react';
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

function Harness({ world = lists }: { world?: typeof lists }) {
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
      onClose={() => {}}
    />
  );
}

const rowNames = () => screen.getAllByTestId('placeholder-section-row').map((r) => r.textContent ?? '');

/** Into placeholder mode, then open the picker. */
const openPicker = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(screen.getByRole('button', { name: 'Replace with a placeholder instead' }));
  await user.click(screen.getByRole('button', { name: 'Choose Placeholder' }));
};

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
