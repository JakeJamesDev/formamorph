import { describe, it, expect, beforeEach } from 'vitest';
import { useState } from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CodeArea } from './CodeArea';

/** The field is controlled by its parent everywhere it's used, so the harness owns the value too —
 *  testing it uncontrolled would exercise a wiring nothing ships. */
function Harness({ slots = false, preview = false, onValue }: {
  slots?: boolean; preview?: boolean; onValue?: (v: string) => void;
}) {
  const [value, setValue] = useState('');
  return (
    <CodeArea
      value={value}
      onChange={(next) => { setValue(next); onValue?.(next); }}
      ariaLabel="Stat code"
      slots={slots}
      preview={preview ? <p>what this makes</p> : undefined}
    />
  );
}

const area = () => screen.getByLabelText('Stat code') as HTMLTextAreaElement;

describe('CodeArea', () => {
  // The split preference is shared and persisted, so one test's toggle would otherwise decide the next.
  beforeEach(() => localStorage.clear());

  it('undoes a word at a time rather than the whole line', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(area());
    await user.keyboard('return one two');

    expect(area().value).toBe('return one two');
    // A step opens at each space, so one undo takes back the whole word just typed — and the space
    // that preceded it — rather than a single letter or the entire line.
    await user.click(screen.getByLabelText('Undo'));
    expect(area().value).toBe('return one');
    await user.click(screen.getByLabelText('Undo'));
    expect(area().value).toBe('return');
  });

  it('redoes what it undid, and stops offering redo once typing resumes', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(area());
    await user.keyboard('alpha beta');

    await user.click(screen.getByLabelText('Undo'));
    expect(area().value).toBe('alpha');
    await user.click(screen.getByLabelText('Redo'));
    expect(area().value).toBe('alpha beta');

    await user.click(screen.getByLabelText('Undo'));
    await user.click(area());
    await user.keyboard('x');
    expect(screen.getByLabelText('Redo')).toBeDisabled();
  });

  it('disables undo and redo when there is nothing to step back to', () => {
    render(<Harness />);
    expect(screen.getByLabelText('Undo')).toBeDisabled();
    expect(screen.getByLabelText('Redo')).toBeDisabled();
  });

  it('inserts a variable at the caret, not at the end', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(area());
    await user.keyboard('return  + 1;');
    // Put the caret in the gap the snippet belongs in.
    area().setSelectionRange(7, 7);

    await user.click(screen.getByLabelText('Variable'));
    await user.click(screen.getByText('elapsedHours — hours so far'));

    expect(area().value).toBe('return elapsedHours + 1;');
  });

  it('selects the part of a slot the author should rename', async () => {
    const user = userEvent.setup();
    render(<Harness slots />);
    await user.click(screen.getByLabelText('Slot'));
    await user.click(screen.getByText('Number'));

    expect(area().value).toBe('{{name:number=0}}');
    // `name` is what varies, so it is left selected to be typed over.
    expect(area().value.slice(area().selectionStart, area().selectionEnd)).toBe('name');
  });

  it('makes an insert one undo step, separate from the typing around it', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(area());
    await user.keyboard('return ');
    await user.click(screen.getByLabelText('Variable'));
    await user.click(screen.getByText('day — day at end of turn'));
    expect(area().value).toBe('return day');

    await user.click(screen.getByLabelText('Undo'));
    expect(area().value).toBe('return ');
  });

  it('offers slot inserts only where slots mean something', () => {
    const { unmount } = render(<Harness />);
    expect(screen.queryByLabelText('Slot')).toBeNull();
    unmount();

    render(<Harness slots />);
    expect(screen.getByLabelText('Slot')).toBeInTheDocument();
  });

  // The field is a flex child of a height-pinned dialog. With the on-screen keyboard eating most of
  // `--app-h` there is almost no height to share out, and a zero minimum collapses the field to nothing.
  it('keeps a height floor so the keyboard cannot crush it to nothing', () => {
    render(<Harness />);
    const classes = area().className;
    expect(classes).not.toMatch(/\bmin-h-0\b/);
    expect(classes).toMatch(/\bmin-h-\[/);
  });

  it('lifts only the editor into an overlay, carrying the text with it', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(area());
    await user.keyboard('return 1;');
    expect(screen.queryByRole('dialog')).toBeNull();

    await user.click(screen.getByLabelText('Edit full screen'));
    const overlay = screen.getByRole('dialog');
    // The overlay holds a code field of its own, on the same text — not the panel that hosted it.
    const fields = (screen.getAllByLabelText('Stat code') as HTMLElement[])
      .filter((element): element is HTMLTextAreaElement => element.tagName === 'TEXTAREA');
    expect(fields).toHaveLength(2);
    expect(fields.every(field => field.value === 'return 1;')).toBe(true);
    expect(overlay).toContainElement(fields[1]);

    await user.click(screen.getByLabelText('Exit full screen'));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('grows the Edit | Preview pair only when there is something to preview', () => {
    const { unmount } = render(<Harness />);
    expect(screen.queryByRole('tab', { name: 'Preview' })).toBeNull();
    unmount();

    render(<Harness preview />);
    expect(screen.getByRole('tab', { name: 'Edit' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Preview' })).toBeInTheDocument();
    expect(screen.queryByText('what this makes')).toBeNull();
  });

  it('shows the preview on its tab', async () => {
    const user = userEvent.setup();
    render(<Harness preview />);
    await user.click(screen.getByRole('tab', { name: 'Preview' }));
    expect(screen.getByText('what this makes')).toBeInTheDocument();
  });

  it('carries the pair into full screen as a split, and back to one pane on request', async () => {
    const user = userEvent.setup();
    render(<Harness preview />);
    await user.click(screen.getByLabelText('Edit full screen'));

    // Wide enough to halve, so the split is what opens — both panes readable without a tab click.
    const overlay = screen.getByRole('dialog');
    expect(overlay).toHaveTextContent('what this makes');
    expect(within(overlay).queryByRole('tab', { name: 'Preview' })).toBeNull();

    await user.click(within(overlay).getByLabelText('Show one pane at a time'));
    expect(within(overlay).getByRole('tab', { name: 'Preview' })).toBeInTheDocument();
    expect(within(overlay).queryByText('what this makes')).toBeNull();
  });

  it('puts history and the view control together on the right, after what gets inserted', () => {
    render(<Harness slots />);
    const labels = [...document.querySelectorAll('button[aria-label]')]
      .map(button => button.getAttribute('aria-label'));
    // Matches PromptField's chrome: inserts lead, then undo/redo, then full screen last.
    expect(labels).toEqual(['Slot', 'Variable', 'Undo', 'Redo', 'Edit full screen']);
  });
});
