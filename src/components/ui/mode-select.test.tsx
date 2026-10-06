import { createRef, type ComponentProps } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ModeSelect, type ModeSelectValue } from './mode-select';

const DESCRIPTIONS = { simple: 'Just a few', advanced: 'All of them' };
const HIDDEN = { label: 'Something is hidden', tip: 'Switch to Advanced to see it.' };

const renderSelect = (props: Partial<ComponentProps<typeof ModeSelect>> = {}) => {
  const onModeChange = vi.fn<(mode: ModeSelectValue) => void>();
  const view = render(
    <ModeSelect
      mode="simple"
      onModeChange={onModeChange}
      descriptions={DESCRIPTIONS}
      aria-label="Test mode"
      {...props}
    />,
  );
  return { ...view, onModeChange, trigger: screen.getByRole('combobox', { name: 'Test mode' }) };
};

describe('ModeSelect', () => {
  it('shows the current mode on the trigger, not its description', () => {
    const { trigger } = renderSelect({ mode: 'advanced' });
    expect(trigger).toHaveTextContent('Advanced');
    expect(trigger).not.toHaveTextContent('All of them');
  });

  it('lists both modes with their descriptions', async () => {
    const { trigger } = renderSelect();
    await userEvent.click(trigger);
    expect(screen.getByRole('option', { name: /Simple/ })).toHaveTextContent('Just a few');
    expect(screen.getByRole('option', { name: /Advanced/ })).toHaveTextContent('All of them');
  });

  it('reports the picked mode', async () => {
    const { trigger, onModeChange } = renderSelect();
    await userEvent.click(trigger);
    await userEvent.click(screen.getByRole('option', { name: /Advanced/ }));
    expect(onModeChange).toHaveBeenCalledWith('advanced');
  });

  it('draws the dot with its accessible name only when the caller reports a hidden setting', () => {
    const quiet = renderSelect();
    expect(quiet.trigger).not.toHaveAccessibleDescription();
    quiet.unmount();

    const loud = renderSelect({ hiddenNotice: HIDDEN });
    // The trigger's own label hides the dot's text from a screen reader, so the dot must reach it as a description.
    expect(loud.trigger).toHaveAccessibleDescription(HIDDEN.label);
  });

  it('keeps a description the caller supplies beside the dot', () => {
    const { trigger } = renderSelect({ hiddenNotice: HIDDEN, 'aria-describedby': 'caller-note' } as Partial<ComponentProps<typeof ModeSelect>>);
    expect(trigger.getAttribute('aria-describedby')).toMatch(/^caller-note /);
  });

  // A remount here would drop keyboard focus when the dot appears after the user picks Simple.
  it('keeps the same trigger, and its focus, when the dot appears', () => {
    const { trigger, rerender, onModeChange } = renderSelect();
    trigger.focus();
    rerender(
      <ModeSelect mode="simple" onModeChange={onModeChange} descriptions={DESCRIPTIONS} aria-label="Test mode" hiddenNotice={HIDDEN} />,
    );
    expect(trigger).toHaveAccessibleDescription(HIDDEN.label);
    expect(screen.getByRole('combobox', { name: 'Test mode' })).toBe(trigger);
    expect(trigger).toHaveFocus();
  });

  it('forwards its ref and attributes to the trigger', () => {
    const ref = createRef<HTMLButtonElement>();
    const { trigger } = renderSelect({ ref, 'data-target': 'here' } as Partial<ComponentProps<typeof ModeSelect>>);
    expect(ref.current).toBe(trigger);
    expect(trigger).toHaveAttribute('data-target', 'here');
  });
});
