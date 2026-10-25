import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useState } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EditorView } from '@codemirror/view';
import { CodeArea } from './CodeArea';
import { STAT_CODE_SURFACE } from '@/lib/statCodeSurface';

const HELTH = 'return stats.Helth.value;';
const FIXED = 'return stats.Health.value;';

let current = '';

function Harness({ initial = HELTH }: { initial?: string }) {
  const [value, setValue] = useState(initial);
  current = value;
  return <CodeArea value={value} onChange={setValue} ariaLabel="Stat code" surface={STAT_CODE_SURFACE} statNames={['Health']} />;
}

/** Every live editor field, the overlay's included. */
const fields = () => screen.getAllByLabelText('Stat code').filter((element) => element.closest('.cm-editor'));

/** The live editor, once its chunk has loaded and the linter has marked the typo. */
async function linted() {
  const field = await waitFor(() => { expect(fields()).toHaveLength(1); return fields()[0]; });
  await waitFor(() => expect(field.querySelector('.cm-lintRange-error')?.textContent).toBe('Helth'));
  return field;
}

const menu = () => document.querySelector<HTMLElement>('[data-code-fixes]');

/** Puts the caret at `pos` and focuses the field, as a click there would. */
function caretAt(field: HTMLElement, pos: number) {
  const view = EditorView.findFromDOM(field)!;
  view.dispatch({ selection: { anchor: pos } });
  view.focus();
}

// jsdom lays nothing out. A pointer's x reads as the document offset under it.
beforeEach(() => {
  vi.spyOn(EditorView.prototype, 'posAtCoords').mockImplementation(
    ((coords: { x: number }) => Math.floor(coords.x)) as EditorView['posAtCoords'],
  );
  vi.spyOn(EditorView.prototype, 'coordsAtPos').mockImplementation((pos: number) => ({ left: pos, right: pos + 1, top: 0, bottom: 10 }));
});
afterEach(() => vi.restoreAllMocks());

describe('quick fixes in the code editor', () => {
  it('applies the fix from the error card’s button', async () => {
    render(<Harness />);
    const field = await linted();
    fireEvent.mouseMove(field.querySelector('.cm-line')!, { clientX: HELTH.indexOf('Helth') + 1.5, clientY: 5 });
    const button = await waitFor(() => {
      const found = document.querySelector<HTMLButtonElement>('.cm-tooltip-lint .cm-diagnosticAction');
      expect(found?.textContent).toBe('Change to Health');
      return found!;
    });
    fireEvent.click(button);
    await waitFor(() => expect(current).toBe(FIXED));
  });

  it('lists the fixes at the caret on Ctrl+. and applies one with Enter', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const field = await linted();
    caretAt(field, HELTH.indexOf('Helth') + 2);
    await user.keyboard('{Control>}.{/Control}');
    const list = await waitFor(() => { expect(menu()).toBeTruthy(); return menu()!; });
    expect([...list.querySelectorAll('[role="menuitem"]')].map((item) => item.textContent)).toEqual(['Change to Health']);
    expect(document.activeElement?.textContent).toBe('Change to Health');
    await user.keyboard('{Enter}');
    await waitFor(() => expect(current).toBe(FIXED));
    expect(menu()).toBeNull();
  });

  it('applies nothing when the flagged name changed since the lint', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const field = await linted();
    const at = HELTH.indexOf('Helth');
    const view = EditorView.findFromDOM(field)!;
    view.dispatch({ changes: { from: at + 2, to: at + 3, insert: 'x' } });
    caretAt(field, at + 1);
    await user.keyboard('{Control>}.{/Control}');
    await waitFor(() => expect(menu()).toBeTruthy());
    await user.keyboard('{Enter}');
    expect(current).toBe('return stats.Hexth.value;');
  });

  it('lists nothing on Ctrl+. away from a fixable problem', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const field = await linted();
    caretAt(field, 1);
    await user.keyboard('{Control>}.{/Control}');
    expect(menu()).toBeNull();
  });

  it('closes the list on Escape and keeps the code', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const field = await linted();
    caretAt(field, HELTH.indexOf('Helth'));
    await user.keyboard('{Control>}.{/Control}');
    await waitFor(() => expect(menu()).toBeTruthy());
    await user.keyboard('{Escape}');
    expect(menu()).toBeNull();
    expect(current).toBe(HELTH);
  });

  it('shows the lightbulb in full screen only, and its list applies the same fix', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const inline = await linted();
    expect(inline.closest('.cm-editor')!.querySelector('.cm-gutter-fixes')).toBeNull();

    await user.click(screen.getByLabelText('Edit full screen'));
    const bulb = await waitFor(() => {
      const found = fields()[0].closest('.cm-editor')!.querySelector<HTMLElement>('.cm-gutter-fixes .cm-gutterElement .cm-fixLightbulb');
      expect(found).toBeTruthy();
      return found!;
    });
    fireEvent.mouseDown(bulb);
    const list = await waitFor(() => { expect(menu()).toBeTruthy(); return menu()!; });
    await user.click(list.querySelector('[role="menuitem"]')!);
    await waitFor(() => expect(current).toBe(FIXED));
  });
});
