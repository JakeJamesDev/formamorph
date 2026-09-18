import { useState } from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  $getRoot, $getSelection, $isElementNode, $isRangeSelection,
  getNearestEditorFromDOMNode, type LexicalEditor,
} from 'lexical';
import PlaceholderField from './PlaceholderField';
import { $isVariableNode, type VariableNode } from './VariableNode';
import { $valueOffset } from './openValueNodes';
import { EditorPreviewRollsProvider } from '@/contexts/EditorPreviewRollsContext';
import { PlaceholderStoreProvider, placeholderStore } from '@/contexts/PlaceholderStoreContext';
import { encodePlaceholderToken } from '@/lib/placeholders';
import { phValues } from '@/test/placeholderValues';
import type { Placeholder } from '@/types';

/**
 * An open value's header: a pager whose controls hold their place, and the active form that follows the
 * author. Which value is active is the claim here; where the header sits on screen is the browser suite's.
 */

vi.mock('@/components/game/MarkdownRenderer', () => ({
  MarkdownRenderer: ({ text }: { text: string }) => <div data-testid="md">{text}</div>,
}));

const world = (id: string, placementId: string) => encodePlaceholderToken({ id, mode: 'world', placementId });

const town: Placeholder = { id: 'town', name: 'Town', values: phValues(['Sedge Landing', 'Marrow', 'Harrow Point']) };
const hair: Placeholder = { id: 'hair', name: 'Hair', values: phValues(['silver']) };
const ghost: Placeholder = { id: 'ghost', name: 'Ghost', values: [] };
// Its first value pins Town to one of Town's own values, so the pinned chip shows a listed value and no pager.
const lord: Placeholder = {
  id: 'lord',
  name: 'Lord',
  values: [
    { id: 'v:Ash', text: 'Ash', pins: [{ placeholderId: 'town', value: 'Marrow', valueId: 'v:Marrow' }] },
    { id: 'v:Bram', text: 'Bram' },
  ],
};
const WORLD = [town, hair, ghost, lord];

function Field({ text, readOnly }: { text: string; readOnly?: boolean }) {
  const [placeholders, setPlaceholders] = useState(WORLD);
  return (
    <PlaceholderStoreProvider value={placeholderStore(placeholders, setPlaceholders)}>
      <EditorPreviewRollsProvider>
        <PlaceholderField value={text} onChange={() => {}} placeholders={placeholders} readOnly={readOnly} />
      </EditorPreviewRollsProvider>
    </PlaceholderStoreProvider>
  );
}

const openValues = () => Array.from(document.querySelectorAll<HTMLElement>('[data-open-value]'));
const header = (el: HTMLElement) => el.querySelector<HTMLElement>('[data-open-value-header]')!;
const headerText = (el: HTMLElement) => header(el).textContent ?? '';
/** The verbose label, and whether the header is showing it rather than keeping it back for a tip. */
const label = (el: HTMLElement) => el.querySelector<HTMLElement>('[data-open-value-label]');
const labelShown = (el: HTMLElement) => !!label(el) && !label(el)!.className.includes('sr-only');
const isActive = (el: HTMLElement) => el.hasAttribute('data-active');
const pagerButtons = (el: HTMLElement) => within(el).queryAllByRole('button').map((b) => b.getAttribute('aria-label'));

const openTab = (name: string) => userEvent.click(screen.getByRole('tab', { name }));
const press = (el: HTMLElement) => userEvent.click(header(el));
const step = (el: HTMLElement, dir: 'Previous' | 'Next') =>
  userEvent.click(within(el).getByRole('button', { name: `${dir} Value` }));

function editor(): LexicalEditor {
  const found = getNearestEditorFromDOMNode(screen.getByRole('textbox'));
  if (!found) throw new Error('no editor');
  return found;
}

function $fieldChips(): VariableNode[] {
  const para = $getRoot().getFirstChild();
  return $isElementNode(para) ? para.getChildren().filter($isVariableNode) : [];
}

/** Which chip's open value holds the caret, by position, and how far into that value — or null. */
function caret(): { chip: number; offset: number } | null {
  return editor().getEditorState().read(() => {
    const selection = $getSelection();
    if (!$isRangeSelection(selection)) return null;
    for (const [chip, node] of $fieldChips().entries()) {
      const offset = $valueOffset(node, selection.anchor);
      if (offset !== null) return { chip, offset };
    }
    return null;
  });
}

/** Puts the caret in the field's own text, past the last chip. */
const caretToFieldText = () => act(async () => {
  editor().update(() => { $getRoot().selectEnd(); }, { discrete: true });
});

// Every draw lands on the first value.
const random = vi.spyOn(Math, 'random');
beforeEach(() => {
  localStorage.clear();
  random.mockReturnValue(0);
});
afterEach(() => random.mockReset());

describe('a press on an open value header', () => {
  it('makes that value active and lands the caret at its end', async () => {
    render(<Field text={`From ${world('town', 'p1')} to ${world('hair', 'p2')}.`} />);
    await openTab('Values');
    const [town1, hair1] = openValues();
    expect([isActive(town1), isActive(hair1)]).toEqual([false, false]);

    await press(town1);
    expect(isActive(openValues()[0])).toBe(true);
    expect(caret()).toEqual({ chip: 0, offset: 'Sedge Landing'.length });
  });

  it('moves the active mark from one header to the next, leaving only one', async () => {
    render(<Field text={`From ${world('town', 'p1')} to ${world('hair', 'p2')}.`} />);
    await openTab('Values');
    await press(openValues()[0]);
    await press(openValues()[1]);
    expect(openValues().map(isActive)).toEqual([false, true]);
  });

  it('marks a value that can take no caret, in a read-only field', async () => {
    render(<Field text={`From ${world('town', 'p1')}.`} readOnly />);
    await openTab('Values');
    await press(openValues()[0]);
    expect(isActive(openValues()[0])).toBe(true);
    expect(caret()).toBeNull();
  });

  it('marks a mirror, which has no caret of its own to take', async () => {
    render(<Field text={`${world('town', 'p1')} and ${world('town', 'p2')}.`} />);
    await openTab('Values');
    const mirror = openValues()[1];
    expect(mirror).toHaveAttribute('data-read-only');
    await press(mirror);
    expect(openValues().map(isActive)).toEqual([false, true]);
    expect(caret()).toBeNull();
  });

  it('moves no caret when the value it names can take none', async () => {
    render(<Field text={`${world('town', 'p1')} and ${world('town', 'p2')}.`} />);
    await openTab('Values');
    await press(openValues()[0]);
    expect(caret()).toEqual({ chip: 0, offset: 'Sedge Landing'.length });

    // Which of the two then reads as active is `activeValueKey`'s call, tested where its focus branch runs.
    await press(openValues()[1]);
    expect(caret()).toEqual({ chip: 0, offset: 'Sedge Landing'.length });
  });

  it('gives the mark up once the caret lands in the field text', async () => {
    render(<Field text={`From ${world('town', 'p1')}.`} readOnly />);
    await openTab('Values');
    await press(openValues()[0]);
    await caretToFieldText();
    expect(openValues().map(isActive)).toEqual([false]);
  });

});

describe('a chevron step', () => {
  it('leaves the stepped value active with the caret inside it', async () => {
    render(<Field text={`From ${world('town', 'p1')}.`} />);
    await openTab('Values');
    await step(openValues()[0], 'Next');
    const [open] = openValues();
    expect(open.querySelector('[data-open-value-text]')?.textContent).toBe('Marrow');
    expect(isActive(open)).toBe(true);
    expect(caret()).toEqual({ chip: 0, offset: 'Marrow'.length });
  });
});

describe('the header reads', () => {
  it('name and pager when compact, and adds the verbose label when active', async () => {
    render(<Field text={`From ${world('town', 'p1')}.`} />);
    await openTab('Values');
    let [open] = openValues();
    expect(headerText(open)).toContain('Town');
    expect(pagerButtons(open)).toEqual(['Previous Value', 'Next Value']);
    expect(labelShown(open)).toBe(false);

    await press(open);
    [open] = openValues();
    expect(labelShown(open)).toBe(true);
    expect(label(open)?.textContent).toMatch(/Value 1/);
  });

  it('the position as X of Y for assistive technology', async () => {
    render(<Field text={`From ${world('town', 'p1')}.`} />);
    await openTab('Values');
    expect(within(openValues()[0]).getByText('Value 1 of 3')).toBeInTheDocument();
    await step(openValues()[0], 'Next');
    expect(within(openValues()[0]).getByText('Value 2 of 3')).toBeInTheDocument();
  });

  it('no pager on a Variable, a pinned chip or a placeholder with no values', async () => {
    render(<Field text={`${world('hair', 'h1')} of ${world('lord', 'l1')} of ${world('town', 'p1')} and ${world('ghost', 'g1')}`} />);
    await openTab('Values');
    const [variable, lordValue, pinned, empty] = openValues();
    expect(pagerButtons(variable)).toEqual([]);
    expect(pagerButtons(pinned)).toEqual([]);
    expect(pagerButtons(empty)).toEqual([]);
    // The one chip that can step still does, so the absences above are the placeholder's kind, not the tab.
    expect(pagerButtons(lordValue)).toEqual(['Previous Value', 'Next Value']);
  });

  it('the lock mark on a value that takes no typing, in both forms', async () => {
    // A mirror is the locked one: the field takes typing, this copy of the value does not.
    render(<Field text={`${world('town', 'p1')} and ${world('town', 'p2')}.`} />);
    await openTab('Values');
    const lockMark = () => within(openValues()[1]).queryByRole('img', { name: 'Read-Only' });
    expect(openValues().map(isActive)).toEqual([false, false]);
    expect(lockMark()).toBeInTheDocument();
    expect(within(openValues()[0]).queryByRole('img', { name: 'Read-Only' })).toBeNull();

    await press(openValues()[1]);
    expect(isActive(openValues()[1])).toBe(true);
    expect(lockMark()).toBeInTheDocument();
  });

  it('the mark for a pinned chip and for a placeholder with no values, in both forms', async () => {
    render(<Field text={`${world('lord', 'l1')} of ${world('town', 'p1')} and ${world('ghost', 'g1')}`} />);
    await openTab('Values');
    const [, pinned, empty] = openValues();
    expect(headerText(pinned)).toContain('Town · Pinned');
    expect(headerText(empty)).toContain('Ghost · No Values');
    // An empty placeholder has nothing to type into, marked or not.
    expect(empty).toHaveAttribute('data-read-only');

    await press(pinned);
    expect(headerText(openValues()[1])).toContain('Town · Pinned');
  });
});
