import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { Tabs } from '@/components/ui/tabs';
import { editorTabGroupsFor, type WorldEditorTabGroup } from '@/views/worldEditorTabs';
import { EdgeRail } from './EdgeRail';

function Host({ groups, initial = 'overview', disabled, onChange }: {
  groups: WorldEditorTabGroup[];
  initial?: string;
  disabled?: boolean;
  onChange?: (value: string) => void;
}) {
  const [value, setValue] = useState(initial);
  return (
    <Tabs value={value} onValueChange={(v) => { setValue(v); onChange?.(v); }} orientation="vertical">
      <EdgeRail groups={groups} value={value} disabled={disabled} />
    </Tabs>
  );
}

/** The flyout's text, or null while none shows. */
const flyout = () => document.querySelector('[data-rail-flyout]')?.textContent ?? null;
const rail = () => screen.getByRole('tablist', { name: 'Editor Sections' });
/** The rail's children in order, read as tab names and separators. */
const railSequence = () => Array.from(rail().children).map((child) =>
  (child.getAttribute('role') === 'tab' ? child.textContent : child.hasAttribute('data-rail-separator') ? '|' : '?'));

describe('EdgeRail', () => {
  it('draws Overview alone, then each group, with a separator between slots only', () => {
    render(<Host groups={editorTabGroupsFor(true)} />);
    expect(railSequence()).toEqual(
      ['Overview', '|', 'Stats', 'Entities', 'Locations', 'Traits', '|', 'Dictionary', 'Placeholders'],
    );
  });

  it('draws Vocabulary with Dictionary alone in Simple mode', () => {
    render(<Host groups={editorTabGroupsFor(false)} />);
    expect(railSequence()).toEqual(['Overview', '|', 'Stats', 'Entities', 'Locations', 'Traits', '|', 'Dictionary']);
  });

  it('draws nothing for a group with no tabs, not even its separator', () => {
    const groups = [...editorTabGroupsFor(true), { id: 'logic' as const, label: 'Logic', tabs: [] }];
    render(<Host groups={groups} />);
    expect(railSequence().at(-1)).toBe('Placeholders');
    expect(railSequence().filter((item) => item === '|')).toHaveLength(2);
  });

  it('marks the active tab as selected and gives it the accent bar alone', () => {
    render(<Host groups={editorTabGroupsFor(true)} initial="entities" />);
    const active = within(rail()).getByRole('tab', { selected: true });
    expect(active).toHaveAccessibleName('Entities');
    expect(active.querySelector('[data-rail-accent]')).not.toBeNull();
    expect(rail().querySelectorAll('[data-rail-accent]')).toHaveLength(1);
  });

  it('flies out "Group · Tab" on hover and hides it when the pointer leaves', async () => {
    const user = userEvent.setup();
    render(<Host groups={editorTabGroupsFor(true)} />);
    const entities = within(rail()).getByRole('tab', { name: 'Entities' });
    expect(flyout()).toBeNull();
    await user.hover(entities);
    expect(flyout()).toBe('Content · Entities');
    await user.unhover(entities);
    expect(flyout()).toBeNull();
  });

  it('flies out Overview with no group part', async () => {
    const user = userEvent.setup();
    render(<Host groups={editorTabGroupsFor(true)} />);
    await user.hover(within(rail()).getByRole('tab', { name: 'Overview' }));
    expect(flyout()).toBe('Overview');
  });

  it('flies out the label on keyboard focus, and keeps the accessible name the tab label', () => {
    render(<Host groups={editorTabGroupsFor(true)} />);
    const dictionary = within(rail()).getByRole('tab', { name: 'Dictionary' });
    fireEvent.focus(dictionary);
    expect(flyout()).toBe('Vocabulary · Dictionary');
    expect(dictionary).toHaveAccessibleName('Dictionary');
    fireEvent.blur(dictionary);
    expect(flyout()).toBeNull();
  });

  it('shows no flyout for focus that a click brought', () => {
    render(<Host groups={editorTabGroupsFor(true)} />);
    const stats = within(rail()).getByRole('tab', { name: 'Stats' });
    fireEvent.pointerDown(stats);
    fireEvent.focus(stats);
    expect(flyout()).toBeNull();
  });

  it('flies out on keyboard focus after a click on a tab that already had focus', () => {
    render(<Host groups={editorTabGroupsFor(true)} />);
    const stats = within(rail()).getByRole('tab', { name: 'Stats' });
    fireEvent.focus(stats);
    fireEvent.blur(stats);
    // A click on a focused tab brings no focus event; the next keyboard focus still flies out.
    fireEvent.pointerDown(stats);
    fireEvent.pointerUp(stats);
    fireEvent.focus(within(rail()).getByRole('tab', { name: 'Entities' }));
    expect(flyout()).toBe('Content · Entities');
  });

  it('calls the change handler on a click and moves along the rail with the arrow keys', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<Host groups={editorTabGroupsFor(true)} onChange={onChange} />);
    await user.click(within(rail()).getByRole('tab', { name: 'Locations' }));
    expect(onChange).toHaveBeenLastCalledWith('locations');
    await user.keyboard('{ArrowDown}');
    expect(onChange).toHaveBeenLastCalledWith('traits');
    expect(within(rail()).getByRole('tab', { selected: true })).toHaveAccessibleName('Traits');
  });

  it('disables every tab and keeps the selection when disabled', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<Host groups={editorTabGroupsFor(true)} initial="stats" disabled onChange={onChange} />);
    const tabs = within(rail()).getAllByRole('tab');
    expect(tabs).toHaveLength(7);
    tabs.forEach((tab) => expect(tab).toBeDisabled());
    await user.click(within(rail()).getByRole('tab', { name: 'Traits' }));
    expect(onChange).not.toHaveBeenCalled();
    expect(within(rail()).getByRole('tab', { selected: true })).toHaveAccessibleName('Stats');
  });
});
