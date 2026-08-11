import { describe, it, expect, beforeEach } from 'vitest';
import { useState } from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CodeArea } from './CodeArea';

/** The field is controlled by its parent everywhere it's used, so the harness owns the value too —
 *  testing it uncontrolled would exercise a wiring nothing ships. */
function Harness({ slots = false, preview = false, initial = '', statNames }: {
  slots?: boolean; preview?: boolean; initial?: string; statNames?: string[];
}) {
  const [value, setValue] = useState(initial);
  return (
    <>
      <CodeArea
        value={value}
        onChange={setValue}
        ariaLabel="Stat code"
        statNames={statNames}
        slots={slots}
        preview={preview ? <p>what this makes</p> : undefined}
      />
      {/* What the parent was told, which is the only thing the rest of the app ever sees. */}
      <output data-testid="owned">{value}</output>
    </>
  );
}

/** Every field carrying the label — the editor, its plain stand-in while the chunk loads, and (in full
 *  screen) the window named after it. */
const labeled = () => screen.getAllByLabelText('Stat code') as HTMLElement[];
const fields = () => labeled().filter(element => element.getAttribute('role') === 'textbox');

/** The editor arrives on its own chunk, so every test starts by waiting for it to land. */
async function editor(): Promise<HTMLElement> {
  await waitFor(() => expect(fields()[0]?.closest('.cm-editor')).toBeTruthy());
  return fields()[0];
}

const owned = () => screen.getByTestId('owned').textContent;

describe('CodeArea', () => {
  // The split preference is shared and persisted, so one test's toggle would otherwise decide the next.
  beforeEach(() => localStorage.clear());

  it('hands typing straight to the parent that owns the text', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(await editor());
    await user.keyboard('return 1;');

    expect(owned()).toBe('return 1;');
  });

  it('steps back and forward through the edit history from the toolbar', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(await editor());
    await user.keyboard('alpha');
    expect(owned()).toBe('alpha');

    await user.click(screen.getByLabelText('Undo'));
    expect(owned()).toBe('');
    await user.click(screen.getByLabelText('Redo'));
    expect(owned()).toBe('alpha');
  });

  it('disables undo and redo when there is nothing to step back to', async () => {
    render(<Harness />);
    await editor();
    expect(screen.getByLabelText('Undo')).toBeDisabled();
    expect(screen.getByLabelText('Redo')).toBeDisabled();
  });

  it('stops offering redo once typing resumes', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(await editor());
    await user.keyboard('alpha');
    await user.click(screen.getByLabelText('Undo'));
    expect(screen.getByLabelText('Redo')).toBeEnabled();

    await user.click(await editor());
    await user.keyboard('x');
    expect(screen.getByLabelText('Redo')).toBeDisabled();
  });

  it('inserts a variable at the caret, not at the end', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(await editor());
    await user.keyboard('return  + 1;');
    // Put the caret back in the gap the snippet belongs in.
    await user.keyboard('{ArrowLeft>5/}');

    await user.click(screen.getByLabelText('Variable'));
    await user.click(screen.getByText('This stat’s value'));

    expect(owned()).toBe('return stats.find(s => s.id === currentStatId)?.value ?? 0 + 1;');
  });

  it('leaves the part of a slot the author should rename selected, ready to type over', async () => {
    const user = userEvent.setup();
    render(<Harness slots />);
    await editor();
    await user.click(screen.getByLabelText('Slot'));
    await user.click(screen.getByText('Number'));
    expect(owned()).toBe('{{name:number=0}}');

    // `name` is what varies, so typing replaces it rather than adding to it.
    await user.keyboard('hunger');
    expect(owned()).toBe('{{hunger:number=0}}');
  });

  it('makes an insert one undo step, separate from the typing around it', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(await editor());
    await user.keyboard('return ');
    await user.click(screen.getByLabelText('Variable'));
    await user.click(screen.getByText('This stat’s value'));
    expect(owned()).toBe('return stats.find(s => s.id === currentStatId)?.value ?? 0');

    await user.click(screen.getByLabelText('Undo'));
    expect(owned()).toBe('return ');
  });

  it('offers slot inserts only where slots mean something', async () => {
    const { unmount } = render(<Harness />);
    await editor();
    expect(screen.queryByLabelText('Slot')).toBeNull();
    unmount();

    render(<Harness slots />);
    await editor();
    expect(screen.getByLabelText('Slot')).toBeInTheDocument();
  });

  it('colours JavaScript rather than showing it flat', async () => {
    render(<Harness initial='const x = "hi";' />);
    const field = await editor();
    await waitFor(() => expect(field.querySelector('.tok-keyword')).toBeTruthy());
    expect(field.querySelector('.tok-string')?.textContent).toBe('"hi"');
  });

  it('marks template slots apart from the code around them', async () => {
    render(<Harness slots initial="return {{amount:number=1}};" />);
    const field = await editor();
    await waitFor(() => expect(field.querySelector('.tok-slot')).toBeTruthy());
    expect(field.querySelector('.tok-slot')?.textContent).toBe('{{amount:number=1}}');
  });

  // The field is a flex child of a height-pinned dialog. With the on-screen keyboard eating most of
  // `--app-h` there is almost no height to share out, and a zero minimum collapses the field to nothing.
  it('keeps a height floor so the keyboard cannot crush it to nothing', async () => {
    render(<Harness />);
    const host = (await editor()).closest('.cm-editor')?.parentElement as HTMLElement;
    expect(host.className).not.toMatch(/\bmin-h-0\b/);
    expect(host.className).toMatch(/\bmin-h-\[/);
  });

  it('hands the one editor to the overlay, history and all, and takes it back', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(await editor());
    await user.keyboard('return 1;');
    expect(screen.queryByRole('dialog')).toBeNull();

    await user.click(screen.getByLabelText('Edit full screen'));
    const overlay = screen.getByRole('dialog');
    // One editor, moved — not a second copy left sharing the value with the first.
    expect(fields()).toHaveLength(1);
    expect(overlay).toContainElement(fields()[0]);

    // The history came with it: undo inside full screen steps back the typing done outside it.
    await user.click(within(overlay).getByLabelText('Undo'));
    expect(owned()).toBe('');
    await user.click(within(overlay).getByLabelText('Redo'));
    expect(owned()).toBe('return 1;');

    await user.click(within(overlay).getByLabelText('Exit full screen'));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    // And back again, still able to step back what was typed before the trip.
    await user.click(screen.getByLabelText('Undo'));
    expect(owned()).toBe('');
  });

  it('numbers the lines in both views, and spends the second gutter column only in full screen', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const field = await editor();
    const inline = field.closest('.cm-editor')!;
    // A line number is worth its width anywhere — an error's line number has to mean something. The
    // margin of lint marks is not: inline, a problem is read by hovering its squiggle.
    expect(inline.querySelector('.cm-lineNumbers')).toBeTruthy();
    expect(inline.querySelector('.cm-gutter-lint')).toBeNull();

    await user.click(screen.getByLabelText('Edit full screen'));
    await waitFor(() => expect(
      fields()[0].closest('.cm-editor')?.querySelector('.cm-gutter-lint'),
    ).toBeTruthy());
    expect(fields()[0].closest('.cm-editor')?.querySelector('.cm-lineNumbers')).toBeTruthy();
  });

  it('puts the lint marks outside the line numbers, where a digit more cannot shift them', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await editor();
    await user.click(screen.getByLabelText('Edit full screen'));

    await waitFor(() => expect(
      fields()[0].closest('.cm-editor')?.querySelector('.cm-gutter-lint'),
    ).toBeTruthy());
    const columns = [...fields()[0].closest('.cm-editor')!.querySelectorAll('.cm-gutters > .cm-gutter')]
      .map(column => (column.classList.contains('cm-gutter-lint') ? 'lint' : 'numbers'));
    expect(columns).toEqual(['lint', 'numbers']);
  });

  // Whether the rule actually reaches the bottom is a layout fact, and jsdom has no layout — that part
  // is browser-verified. What can be guarded here is which element draws it: the gutter is only ever as
  // tall as the code it holds, so a rule on its right border stops mid-box.
  it('draws the rule beside the gutter on the code area, which fills the box', async () => {
    render(<Harness initial="return 1;" />);
    const field = await editor();
    expect(getComputedStyle(field).borderLeftStyle).toBe('solid');
  });

  it('positions the completion popup against the window, so no box it sits in can clip it', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(await editor());
    await user.keyboard('return elap');

    await waitFor(() => expect(document.querySelector('.cm-tooltip-autocomplete')).toBeTruthy());
    const tooltip = document.querySelector('.cm-tooltip-autocomplete') as HTMLElement;
    expect(tooltip.style.position).toBe('fixed');
    // Parented outside the field, so the field's own `overflow-hidden` never reaches it.
    expect(tooltip.closest('.cm-editor')).toBeNull();
  });

  it('grows the Edit | Preview pair only when there is something to preview', async () => {
    const { unmount } = render(<Harness />);
    await editor();
    expect(screen.queryByRole('tab', { name: 'Preview' })).toBeNull();
    unmount();

    render(<Harness preview />);
    await editor();
    expect(screen.getByRole('tab', { name: 'Edit' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Preview' })).toBeInTheDocument();
    expect(screen.queryByText('what this makes')).toBeNull();
  });

  it('shows the preview on its tab', async () => {
    const user = userEvent.setup();
    render(<Harness preview />);
    await editor();
    await user.click(screen.getByRole('tab', { name: 'Preview' }));
    expect(screen.getByText('what this makes')).toBeInTheDocument();
  });

  // The tab primitive unmounts the pane it isn't showing, taking the box the editor lives in with it.
  it('still holds the editor after a trip to the preview and back', async () => {
    const user = userEvent.setup();
    render(<Harness preview />);
    await user.click(await editor());
    await user.keyboard('return 1;');

    await user.click(screen.getByRole('tab', { name: 'Preview' }));
    await user.click(screen.getByRole('tab', { name: 'Edit' }));

    const back = await editor();
    expect(back.textContent).toContain('return 1;');
    // Still a live editor, not a leftover rendering of the text.
    await user.click(back);
    await user.keyboard('2');
    expect(owned()).toContain('return 1;');
    expect(owned()).toHaveLength('return 1;2'.length);
  });

  it('indents with Tab, and lets Escape hand the next Tab back for moving on', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(await editor());
    await user.keyboard('return 1;');
    await user.tab();
    expect(owned()).toBe('  return 1;');

    // Escape spends the next Tab on leaving the field rather than on another indent.
    await user.keyboard('{Escape}');
    await user.tab();
    expect(owned()).toBe('  return 1;');
  });

  it('carries the pair into full screen as a split, and back to one pane on request', async () => {
    const user = userEvent.setup();
    render(<Harness preview />);
    await editor();
    await user.click(screen.getByLabelText('Edit full screen'));

    // Wide enough to halve, so the split is what opens — both panes readable without a tab click.
    const overlay = screen.getByRole('dialog');
    expect(overlay).toHaveTextContent('what this makes');
    expect(within(overlay).queryByRole('tab', { name: 'Preview' })).toBeNull();

    await user.click(within(overlay).getByLabelText('Show one pane at a time'));
    expect(within(overlay).getByRole('tab', { name: 'Preview' })).toBeInTheDocument();
    expect(within(overlay).queryByText('what this makes')).toBeNull();
  });

  /** The popup CodeMirror raises for completions, once it has one to raise. */
  const popup = () => document.querySelector('.cm-tooltip-autocomplete') as HTMLElement | null;

  it('offers the sandbox’s own names as they are typed, and applies the one picked', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(await editor());
    await user.keyboard('return elap');

    await waitFor(() => expect(popup()).toBeTruthy());
    // The matched prefix is its own span, so the entry is found by what it reads as, not by one text node.
    const option = within(popup()!).getAllByRole('option')
      .find(entry => entry.textContent?.startsWith('elapsedHours'));
    await user.click(option!);

    expect(owned()).toBe('return elapsedHours');
  });

  it('offers the world’s stat names inside a string literal', async () => {
    const user = userEvent.setup();
    render(<Harness statNames={['Health', 'Stamina']} />);
    await user.click(await editor());
    await user.keyboard('return "');

    await waitFor(() => expect(popup()).toBeTruthy());
    expect(within(popup()!).getByText('Stamina')).toBeInTheDocument();
  });

  // Story 5 of the parent spec: Escape is the way out of the field, and the popup must not spend it.
  it('closes the popup on Escape, and still hands the next Tab back after a second one', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(await editor());
    await user.keyboard('return elap');
    await waitFor(() => expect(popup()).toBeTruthy());

    await user.keyboard('{Escape}');
    await waitFor(() => expect(popup()).toBeNull());
    // That Escape went to the list, so this Tab still indents — the field is not yet being left.
    await user.tab();
    expect(owned()).toBe('  return elap');

    await user.keyboard('{Escape}');
    await user.tab();
    expect(owned()).toBe('  return elap');
  });

  it('underlines a name the sandbox does not provide', async () => {
    render(<Harness initial="return elapsedHrs;" />);
    const field = await editor();
    await waitFor(
      () => expect(field.querySelector('.cm-lintRange-error')?.textContent).toBe('elapsedHrs'),
      { timeout: 3000 },
    );
  });

  it('marks a warning as a warning, leaving the names it recognizes unflagged', async () => {
    render(<Harness initial="const total = elapsedHours * 2;" />);
    const field = await editor();
    await waitFor(
      () => expect(field.querySelector('.cm-lintRange-warning')).toBeTruthy(),
      { timeout: 3000 },
    );
    expect(field.querySelector('.cm-lintRange-error')).toBeNull();
  });

  // Two fields, so "nothing is underlined" is a finding rather than the linter not having run yet: the
  // flawed one going red is the proof that the pass happened, and the sound one is still clean after it.
  it('leaves code the sandbox can run entirely unmarked', async () => {
    render(
      <>
        <Harness initial="return elapsedHours;" />
        <Harness initial="return nope;" />
      </>,
    );
    await waitFor(() => expect(fields()).toHaveLength(2));
    const [sound, flawed] = fields();
    await waitFor(() => expect(flawed.querySelector('.cm-lintRange-error')).toBeTruthy(), { timeout: 3000 });
    expect(sound.querySelectorAll('[class*="cm-lintRange"]')).toHaveLength(0);
  });

  it('puts history and the view control together on the right, after what gets inserted', async () => {
    render(<Harness slots />);
    await editor();
    const labels = [...document.querySelectorAll('button[aria-label]')]
      .map(button => button.getAttribute('aria-label'));
    // Matches PromptField's chrome: inserts lead, then undo/redo, then full screen last.
    expect(labels).toEqual(['Slot', 'Variable', 'Undo', 'Redo', 'Edit full screen']);
  });
});
