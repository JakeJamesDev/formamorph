import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { OnDemandSelect } from './OnDemandSelect';
import type { SelectOption } from './SelectOptions';

const OPTIONS: SelectOption[] = ['Amber', 'Basalt', 'Cinder', 'Dune', 'Ember'].map((label) => ({ value: label.toLowerCase(), label }));

// Inside a form, Radix mirrors every mounted item as an option of a hidden native select: the one place a
// closed picker's items show in the document.
const mounted = () => Array.from(document.querySelectorAll('select[aria-hidden] option')).map((o) => o.textContent);

const renderPicker = (over: Partial<Parameters<typeof OnDemandSelect>[0]> = {}) => {
  const onValueChange = vi.fn();
  render(
    <form>
      <OnDemandSelect aria-label="Rock" value="cinder" onValueChange={onValueChange} options={() => OPTIONS} {...over} />
      <button type="button">Elsewhere</button>
    </form>,
  );
  return { onValueChange, trigger: screen.getByRole('combobox', { name: 'Rock' }) };
};

describe('OnDemandSelect', () => {
  it('mounts only the picked item while closed and unfocused, and shows its text', () => {
    const { trigger } = renderPicker();
    expect(mounted()).toEqual(['Cinder']);
    expect(trigger).toHaveTextContent('Cinder');
  });

  it('shows the given display in place of the picked item’s text, and mounts no item for it', () => {
    const { trigger } = renderPicker({ display: 'Rock: Cinder' });
    expect(trigger).toHaveTextContent('Rock: Cinder');
    expect(mounted()).toEqual([]);
  });

  it('with a display, still picks by typeahead and opens on the picked item', async () => {
    const user = userEvent.setup();
    const { onValueChange, trigger } = renderPicker({ display: 'Rock: Cinder' });
    await user.tab();
    await user.keyboard('b');
    expect(onValueChange).toHaveBeenCalledWith('basalt');
    await user.click(trigger);
    await screen.findByRole('listbox');
    expect(screen.getByRole('option', { name: 'Cinder' })).toHaveFocus();
  });

  it('shows the placeholder and mounts nothing when nothing is picked', () => {
    const { trigger } = renderPicker({ value: '', placeholder: 'Pick a rock' });
    expect(mounted()).toEqual([]);
    expect(trigger).toHaveTextContent('Pick a rock');
  });

  it('mounts every item while the trigger has focus, and drops them on blur', async () => {
    const user = userEvent.setup();
    renderPicker();
    await user.tab();
    // The mirror lists items in mount order; the open list's order is checked below.
    expect(mounted().sort()).toEqual(['Amber', 'Basalt', 'Cinder', 'Dune', 'Ember']);
    await user.tab();
    expect(screen.getByRole('button', { name: 'Elsewhere' })).toHaveFocus();
    expect(mounted()).toEqual(['Cinder']);
  });

  it('picks by typeahead on a focused, closed trigger', async () => {
    const user = userEvent.setup();
    const { onValueChange } = renderPicker();
    await user.tab();
    await user.keyboard('e');
    expect(onValueChange).toHaveBeenCalledWith('ember');
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('opens on the picked item with every option listed', async () => {
    const user = userEvent.setup();
    const { trigger } = renderPicker();
    await user.click(trigger);
    const listbox = await screen.findByRole('listbox');
    expect(Array.from(listbox.querySelectorAll('[role="option"]')).map((o) => o.textContent)).toEqual(OPTIONS.map((o) => o.label));
    expect(screen.getByRole('option', { name: 'Cinder' })).toHaveFocus();
  });

  it('picks by keyboard from the open list', async () => {
    const user = userEvent.setup();
    const { onValueChange } = renderPicker();
    await user.tab();
    await user.keyboard('{Enter}');
    await screen.findByRole('listbox');
    await user.keyboard('{ArrowDown}{Enter}');
    expect(onValueChange).toHaveBeenCalledWith('dune');
  });

  it('does not open while disabled', async () => {
    const user = userEvent.setup();
    const { trigger } = renderPicker({ disabled: true });
    await user.click(trigger);
    expect(screen.queryByRole('listbox')).toBeNull();
  });
});
