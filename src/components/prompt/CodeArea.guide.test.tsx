import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useState } from 'react';
import { fireEvent, render, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EditorView } from '@codemirror/view';
import { CodeArea } from './CodeArea';
import { registerDocsOpener } from '@/lib/formaquestion/docsOpener';
import { STAT_CODE_SURFACE } from '@/lib/statCodeSurface';
import { toolScriptSurface } from '@/lib/tools/toolScriptSurface';
import type { CodeSurface } from '@/lib/codeSurface';

/** A global card's Read in the Guide: a real link, opened in the reader where one is mounted. */

function Harness({ initial, surface = STAT_CODE_SURFACE }: { initial: string; surface?: CodeSurface }) {
  const [value, setValue] = useState(initial);
  return <CodeArea value={value} onChange={setValue} ariaLabel="Stat code" surface={surface} />;
}

const editor = () => waitFor(() => {
  const field = document.querySelectorAll<HTMLElement>('[aria-label="Stat code"]');
  const live = [...field].find((element) => element.closest('.cm-editor'));
  expect(live).toBeTruthy();
  return live!;
});

// jsdom lays nothing out. These stand in for layout only: a pointer's x reads as the document offset under it.
beforeEach(() => {
  vi.spyOn(EditorView.prototype, 'posAtCoords').mockImplementation(
    ((coords: { x: number }) => Math.floor(coords.x)) as EditorView['posAtCoords'],
  );
  vi.spyOn(EditorView.prototype, 'coordsAtPos').mockImplementation((pos: number) => ({ left: pos, right: pos + 1, top: 0, bottom: 10 }));
});
afterEach(() => vi.restoreAllMocks());

function hover(field: HTMLElement, text: string) {
  const at = field.textContent!.indexOf(text);
  expect(at).toBeGreaterThanOrEqual(0);
  fireEvent.mouseMove(field.querySelector('.cm-line')!, { clientX: at + 1.5, clientY: 5 });
}

const card = () => document.querySelector<HTMLElement>('[data-code-card]');
const openCard = () => waitFor(() => { expect(card()).toBeTruthy(); return card()!; });
const guideLink = (shown: HTMLElement) => within(shown).getByRole('link', { name: 'Read in the Guide', hidden: true });

describe('Read in the Guide on a code card', () => {
  it('links the wiki heading of the global', async () => {
    render(<Harness initial="return self.value;" />);
    hover(await editor(), 'self');
    expect(guideLink(await openCard()).getAttribute('href')).toBe('https://github.com/JakeJamesDev/formamorph/wiki/ScriptsGuide#self');
  });

  it('opens the heading in the reader and closes the card', async () => {
    const opener = vi.fn();
    const unregister = registerDocsOpener(opener);
    try {
      const user = userEvent.setup();
      render(<Harness initial="return self.value;" />);
      hover(await editor(), 'self');
      await user.click(guideLink(await openCard()));
      expect(opener).toHaveBeenCalledWith({ page: 'ScriptsGuide', anchor: 'self' });
      await waitFor(() => expect(card()).toBeNull());
    } finally {
      unregister();
    }
  });

  it('leaves the click to the browser where no reader is mounted, so the wiki opens', async () => {
    render(<Harness initial="return self.value;" />);
    hover(await editor(), 'self');
    const link = guideLink(await openCard());
    // A click the page cancels is one the reader took.
    expect(fireEvent.click(link)).toBe(true);
  });

  it('keeps the card open on a modified click, which opens a new tab', async () => {
    const opener = vi.fn();
    const unregister = registerDocsOpener(opener);
    try {
      render(<Harness initial="return self.value;" />);
      hover(await editor(), 'self');
      const link = guideLink(await openCard());
      expect(fireEvent.click(link, { ctrlKey: true })).toBe(true);
      expect(opener).not.toHaveBeenCalled();
      expect(card()).toBeTruthy();
    } finally {
      unregister();
    }
  });

  it('links a Tool global to the Tools doc', async () => {
    render(<Harness initial="return args;" surface={toolScriptSurface([])} />);
    hover(await editor(), 'args');
    expect(guideLink(await openCard()).getAttribute('href')).toBe('https://github.com/JakeJamesDev/formamorph/wiki/Tools#args');
  });

  it('keeps the link in the completion list’s pane, opens the heading and closes the list', async () => {
    const opener = vi.fn();
    const unregister = registerDocsOpener(opener);
    try {
      const user = userEvent.setup();
      render(<Harness initial="" />);
      const field = await editor();
      await user.click(field);
      for (const [i, key] of [...'return sel'].entries()) {
        await user.keyboard(key);
        await waitFor(() => expect(field.textContent).toBe('return sel'.slice(0, i + 1)));
      }
      await waitFor(() => expect(document.querySelector('.cm-tooltip-autocomplete [aria-selected] .cm-completionLabel')?.textContent).toBe('self'));
      const shown = await waitFor(() => {
        const found = document.querySelector<HTMLElement>('.cm-completionInfo [data-code-card]');
        expect(found).toBeTruthy();
        return found!;
      });
      expect(shown.textContent).toContain('(global) self');
      await user.click(guideLink(shown));
      expect(opener).toHaveBeenCalledWith({ page: 'ScriptsGuide', anchor: 'self' });
      await waitFor(() => expect(document.querySelector('.cm-tooltip-autocomplete')).toBeNull());
    } finally {
      unregister();
    }
  });

  it('shows no link on a member or on console', async () => {
    render(<Harness initial="self.regen = 0;" />);
    hover(await editor(), 'regen');
    expect(within(await openCard()).queryByRole('link', { hidden: true })).toBeNull();
  });
});
