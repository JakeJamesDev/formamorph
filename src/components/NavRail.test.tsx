import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { BookOpen, Braces, ChartColumn, Globe, MapPin, Users } from 'lucide-react';
import { Tabs } from '@/components/ui/tabs';
import { TooltipProvider } from '@/components/ui/tooltip';
import { stubReducedMotion } from '@/test/reducedMotion';
import { NavRail, type NavRailGroup } from './NavRail';

const GROUPS: NavRailGroup[] = [
  { id: 'lead', tabs: [{ value: 'overview', label: 'Overview', icon: Globe }] },
  {
    id: 'content',
    tabs: [
      { value: 'stats', label: 'Stats', icon: ChartColumn },
      { value: 'entities', label: 'Entities', icon: Users },
      { value: 'locations', label: 'Locations', icon: MapPin },
    ],
  },
  { id: 'logic', tabs: [] },
  {
    id: 'vocabulary',
    tabs: [
      { value: 'dictionary', label: 'Dictionary', icon: BookOpen },
      { value: 'placeholders', label: 'Placeholders', icon: Braces },
    ],
  },
];

const KEY = 'test.navRail';

function Host({ initial = 'overview', storageKey = KEY, disabled, autoCollapsed, onChange }: {
  initial?: string;
  storageKey?: string;
  disabled?: boolean;
  autoCollapsed?: boolean;
  onChange?: (value: string) => void;
}) {
  const [value, setValue] = useState(initial);
  return (
    <TooltipProvider>
      <Tabs value={value} onValueChange={(v) => { setValue(v); onChange?.(v); }} orientation="vertical">
        <NavRail
          groups={GROUPS}
          value={value}
          label="Sections"
          storageKey={storageKey}
          disabled={disabled}
          autoCollapsed={autoCollapsed}
        />
      </Tabs>
    </TooltipProvider>
  );
}

const rail = () => screen.getByRole('tablist', { name: 'Sections' });
const toggle = () => screen.getByRole('button', { name: /^(Collapse|Expand)$/ });
/** The rail's width as drawn: its column carries the inline width. */
const width = () => rail().parentElement?.style.width;
/** The open flyout naming `text`, or null. The row's own label is a span; the flyout is a div. */
const flyout = (text: string) => screen.queryByText(text, { selector: 'div' });
/** Waits out the shared tooltip delay, so an absent flyout is absent for good. */
const pastTipDelay = () => new Promise((resolve) => { setTimeout(resolve, 600); });
/** The rail's children in order, read as tab names and separators. */
const railSequence = () => Array.from(rail().children).map((child) =>
  (child.getAttribute('role') === 'tab' ? child.textContent : child.hasAttribute('data-rail-separator') ? '|' : '?'));

beforeEach(() => localStorage.clear());
afterEach(() => vi.unstubAllGlobals());

describe('NavRail', () => {
  it('draws one tab per item in order, a line between groups, and nothing for an empty group', () => {
    render(<Host />);
    expect(railSequence()).toEqual(['Overview', '|', 'Stats', 'Entities', 'Locations', '|', 'Dictionary', 'Placeholders']);
    expect(within(rail()).getByRole('tab', { name: 'Locations' })).toBeInTheDocument();
  });

  it('draws no captions', () => {
    render(<Host />);
    expect(screen.queryByText(/content|vocabulary|logic|lead/i)).toBeNull();
  });

  it('marks the active tab as selected and gives it the accent bar alone', () => {
    render(<Host initial="entities" />);
    const active = within(rail()).getByRole('tab', { selected: true });
    expect(active).toHaveAccessibleName('Entities');
    expect(active.querySelector('[data-rail-accent]')).not.toBeNull();
    expect(rail().querySelectorAll('[data-rail-accent]')).toHaveLength(1);
  });

  it('switches tabs on a click and moves along the rail with the arrow keys', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<Host onChange={onChange} />);
    await user.click(within(rail()).getByRole('tab', { name: 'Locations' }));
    expect(onChange).toHaveBeenLastCalledWith('locations');
    await user.keyboard('{ArrowDown}');
    expect(onChange).toHaveBeenLastCalledWith('dictionary');
    await user.keyboard('{ArrowUp}{ArrowUp}');
    expect(within(rail()).getByRole('tab', { selected: true })).toHaveAccessibleName('Entities');
  });

  it('disables every tab and keeps the selection when disabled', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<Host initial="stats" disabled onChange={onChange} />);
    const tabs = within(rail()).getAllByRole('tab');
    expect(tabs).toHaveLength(6);
    tabs.forEach((tab) => expect(tab).toBeDisabled());
    await user.click(within(rail()).getByRole('tab', { name: 'Dictionary' }));
    expect(onChange).not.toHaveBeenCalled();
    expect(within(rail()).getByRole('tab', { selected: true })).toHaveAccessibleName('Stats');
  });

  it('starts expanded, and the toggle collapses and expands it', async () => {
    const user = userEvent.setup();
    render(<Host />);
    expect(width()).toBe('192px');
    expect(toggle()).toHaveAccessibleName('Collapse');
    expect(toggle()).toHaveAttribute('aria-expanded', 'true');
    await user.click(toggle());
    expect(width()).toBe('52px');
    expect(toggle()).toHaveAccessibleName('Expand');
    expect(toggle()).toHaveAttribute('aria-expanded', 'false');
    await user.click(toggle());
    expect(width()).toBe('192px');
  });

  it('keeps the choice across a remount for the same storage key, and not across keys', async () => {
    const user = userEvent.setup();
    const first = render(<Host />);
    await user.click(toggle());
    first.unmount();

    const same = render(<Host />);
    expect(width()).toBe('52px');
    same.unmount();

    render(<Host storageKey="test.otherRail" />);
    expect(width()).toBe('192px');
  });

  it('falls back to expanded when the stored value is unreadable or storage throws', () => {
    localStorage.setItem(KEY, '{not json');
    const corrupt = render(<Host />);
    expect(width()).toBe('192px');
    corrupt.unmount();

    const getItem = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('full'); });
    try {
      render(<Host />);
      expect(width()).toBe('192px');
      fireEvent.click(toggle());
      expect(width()).toBe('52px');
    } finally {
      getItem.mockRestore();
      setItem.mockRestore();
    }
  });

  it('draws collapsed while auto-collapsed without changing the stored choice', () => {
    const view = render(<Host autoCollapsed />);
    expect(width()).toBe('52px');
    expect(toggle()).toHaveAccessibleName('Expand');
    expect(toggle()).toBeDisabled();

    view.rerender(<Host autoCollapsed={false} />);
    expect(width()).toBe('192px');
    view.unmount();

    // The stored choice is still the default: a fresh rail with room starts expanded.
    render(<Host />);
    expect(width()).toBe('192px');
  });

  it('keeps a stored collapse through auto-collapse and back', async () => {
    const user = userEvent.setup();
    const view = render(<Host />);
    await user.click(toggle());
    view.rerender(<Host autoCollapsed />);
    view.rerender(<Host autoCollapsed={false} />);
    expect(width()).toBe('52px');
  });

  it('shows no flyout while expanded', async () => {
    const user = userEvent.setup();
    render(<Host />);
    await user.hover(within(rail()).getByRole('tab', { name: 'Entities' }));
    await pastTipDelay();
    expect(flyout('Entities')).toBeNull();
  });

  it('names a collapsed tab in a flyout on hover, and hides it when the pointer leaves', async () => {
    const user = userEvent.setup();
    render(<Host />);
    await user.click(toggle());
    const entities = within(rail()).getByRole('tab', { name: 'Entities' });
    await user.hover(entities);
    expect(await screen.findByText('Entities', { selector: 'div' })).toBeVisible();
    await user.unhover(entities);
    await waitFor(() => expect(flyout('Entities')).toBeNull());
  });

  it('names a collapsed tab in a flyout on keyboard focus, and keeps its accessible name the label', async () => {
    const user = userEvent.setup();
    render(<Host autoCollapsed />);
    await user.tab();
    expect(within(rail()).getByRole('tab', { name: 'Overview' })).toHaveFocus();
    expect(flyout('Overview')).toBeVisible();
    await user.keyboard('{ArrowDown}');
    expect(flyout('Stats')).toBeVisible();
    expect(within(rail()).getByRole('tab', { name: 'Stats' })).toHaveAccessibleName('Stats');
  });

  it('shows no flyout for focus that a click brought', async () => {
    const user = userEvent.setup();
    render(<Host autoCollapsed />);
    await user.click(within(rail()).getByRole('tab', { name: 'Stats' }));
    expect(within(rail()).getByRole('tab', { name: 'Stats' })).toHaveFocus();
    await pastTipDelay();
    expect(flyout('Stats')).toBeNull();
  });

  it('keeps focus on the toggle as the rail collapses and expands', async () => {
    const user = userEvent.setup();
    render(<Host />);
    await user.click(toggle());
    expect(toggle()).toHaveFocus();
    await user.click(toggle());
    expect(toggle()).toHaveFocus();
  });

  it('names the disabled toggle "Expand" in a flyout while auto-collapsed', async () => {
    const user = userEvent.setup();
    render(<Host autoCollapsed />);
    await user.hover(toggle().parentElement as HTMLElement);
    expect(await screen.findByText('Expand', { selector: 'div' })).toBeVisible();
  });

  it('animates the width and the labels, and skips both with reduced motion', () => {
    const animated = render(<Host />);
    expect(rail().parentElement?.style.transition).toBe('width 200ms cubic-bezier(0.2, 0, 0, 1)');
    expect(screen.getByText('Stats').style.transition).toBe('opacity 200ms cubic-bezier(0.2, 0, 0, 1)');
    animated.unmount();

    stubReducedMotion();
    render(<Host />);
    expect(rail().parentElement?.style.transition).toBe('none');
    expect(screen.getByText('Stats').style.transition).toBe('none');
    fireEvent.click(toggle());
    expect(width()).toBe('52px');
  });
});
