import { useState } from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  $getRoot, $getSlot, $isElementNode, $isTextNode, getNearestEditorFromDOMNode, REDO_COMMAND, UNDO_COMMAND,
  type LexicalEditor, type TextNode,
} from 'lexical';
import PlaceholderField from './PlaceholderField';
import { $createVariableNode, $isVariableNode } from './VariableNode';
import { VALUE_SLOT } from './openValueContext';
import { EditorPreviewRollsProvider } from '@/contexts/EditorPreviewRollsContext';
import { PlaceholderStoreProvider, placeholderStore } from '@/contexts/PlaceholderStoreContext';
import { encodePlaceholderToken } from '@/lib/placeholders';
import { phValues } from '@/test/placeholderValues';
import type { Placeholder } from '@/types';

vi.mock('@/components/game/MarkdownRenderer', () => ({
  MarkdownRenderer: ({ text }: { text: string }) => <div data-testid="md">{text}</div>,
}));

const world = (id: string, placementId: string) => encodePlaceholderToken({ id, mode: 'world', placementId });
const unique = (id: string, placementId: string) => encodePlaceholderToken({ id, mode: 'unique', placementId });

const town: Placeholder = { id: 'town', name: 'Town', values: phValues(['Sedge Landing', 'Marrow']), weights: { 'v:Marrow': 3 } };
const hair: Placeholder = { id: 'hair', name: 'Hair', values: phValues(['silver']) };
const WORLD = [town, hair];

const FIRST = `Welcome to ${world('town', 'p1')}, friend.`;
const SECOND = `Back in ${world('town', 'p2')} again.`;

const openValues = (root: HTMLElement) => Array.from(root.querySelectorAll<HTMLElement>('[data-open-value]'));
const valueText = (el: HTMLElement) => el.querySelector('[data-open-value-text]')?.textContent ?? '';
const openTab = (root: HTMLElement, name: string) => userEvent.click(within(root).getByRole('tab', { name }));
const first = () => screen.getByTestId('first');
const second = () => screen.getByTestId('second');

const updates = vi.fn<(p: Placeholder) => void>();
const firstChange = vi.fn<(v: string) => void>();

/** Two fields under one bound store. A button stands in for an edit made on the Placeholders tab. */
function World({ firstText = FIRST }: { firstText?: string }) {
  const [placeholders, setPlaceholders] = useState(WORLD);
  const base = placeholderStore(placeholders, setPlaceholders);
  const store = { ...base, updatePlaceholder: (p: Placeholder) => { updates(p); base.updatePlaceholder(p); } };
  const town = placeholders.find((p) => p.id === 'town')!;
  return (
    <PlaceholderStoreProvider value={store}>
      <EditorPreviewRollsProvider>
        <div data-testid="first"><PlaceholderField value={firstText} onChange={firstChange} placeholders={placeholders} /></div>
        <div data-testid="second"><PlaceholderField value={SECOND} onChange={() => {}} placeholders={placeholders} /></div>
        <button
          type="button"
          onClick={() => setPlaceholders((prev) => prev.map((p) => (p.id === 'town'
            ? { ...p, values: p.values.map((v) => (v.id === 'v:Sedge Landing' ? { ...v, text: 'Sedge Crossing' } : v)) }
            : p)))}
        >
          Rename outside
        </button>
        <div data-testid="stored">{town.values.map((v) => v.text).join('|')}</div>
      </EditorPreviewRollsProvider>
    </PlaceholderStoreProvider>
  );
}

function editorOf(root: HTMLElement): LexicalEditor {
  const editor = getNearestEditorFromDOMNode(within(root).getByRole('textbox'));
  if (!editor) throw new Error('no editor');
  return editor;
}

/** The first text node of the `nth` field chip's open value. */
function $valueTextNode(nth = 0): TextNode {
  const para = $getRoot().getFirstChild();
  const chip = $isElementNode(para) ? para.getChildren().filter($isVariableNode)[nth] : undefined;
  const box = chip && $getSlot(chip, VALUE_SLOT);
  const text = $isElementNode(box) ? box.getAllTextNodes()[0] : undefined;
  if (!$isTextNode(text)) throw new Error('no value text');
  return text;
}

/** The field text after the last chip. */
function $trailingText(): TextNode {
  const para = $getRoot().getFirstChild();
  const last = $isElementNode(para) ? para.getLastChild() : null;
  if (!$isTextNode(last)) throw new Error('no field text');
  return last;
}

/** Run one editor update and wait for the updates it sets off. */
async function edit(editor: LexicalEditor, fn: () => void) {
  await act(async () => { editor.update(fn, { discrete: true }); });
}

const command = (editor: LexicalEditor, cmd: typeof UNDO_COMMAND | typeof REDO_COMMAND) =>
  act(async () => { editor.dispatchCommand(cmd, undefined); });

const stored = () => screen.getByTestId('stored').textContent;

/** Replace the open value's text the way typing does, with the caret left inside it. */
async function typeInValue(editor: LexicalEditor, text: string) {
  // The updates the edit sets off commit on a microtask.
  await act(async () => {
    editor.update(() => {
      const node = $valueTextNode().setTextContent(text);
      node.select(text.length, text.length);
    }, { discrete: true });
  });
}

// Every draw lands on the first value.
const random = vi.spyOn(Math, 'random');
beforeEach(() => {
  localStorage.clear();
  random.mockReturnValue(0);
  updates.mockReset();
  firstChange.mockReset();
});
afterEach(() => random.mockReset());

describe('typing in an open value', () => {
  it('writes exactly one value of the placeholder, keeping its ids and weights', async () => {
    render(<World />);
    await openTab(first(), 'Values');
    await typeInValue(editorOf(first()), 'Sedge Landings');

    expect(updates).toHaveBeenCalledTimes(1);
    expect(updates.mock.calls[0][0]).toEqual({
      ...town,
      values: [{ id: 'v:Sedge Landing', text: 'Sedge Landings' }, { id: 'v:Marrow', text: 'Marrow' }],
    });
    expect(screen.getByTestId('stored').textContent).toBe('Sedge Landings|Marrow');
  });

  it('never calls the field change callback', async () => {
    render(<World />);
    await openTab(first(), 'Values');
    await typeInValue(editorOf(first()), 'Sedge Landings');
    expect(firstChange).not.toHaveBeenCalled();
  });

  it('keeps the value open on the same value through its own edit', async () => {
    render(<World />);
    await openTab(first(), 'Values');
    await typeInValue(editorOf(first()), 'Sedge Landings');
    const [open] = openValues(first());
    expect(valueText(open)).toBe('Sedge Landings');
    expect(within(open).getByText(/Value 1/)).toBeInTheDocument();
  });

  it('shows the new text in a second field on its Values and Preview tabs', async () => {
    render(<World />);
    await openTab(first(), 'Values');
    await typeInValue(editorOf(first()), 'Sedge Landings');

    await openTab(second(), 'Values');
    expect(openValues(second()).map(valueText)).toEqual(['Sedge Landings']);
    await openTab(second(), 'Preview');
    expect(within(second()).getByTestId('prompt-preview').textContent).toBe('Back in Sedge Landings again.');
  });

  it('stores the value without edge whitespace, and keeps the whitespace in the open value', async () => {
    render(<World />);
    await openTab(first(), 'Values');
    await typeInValue(editorOf(first()), '  Sedge Landings ');

    expect(updates.mock.lastCall?.[0].values[0].text).toBe('Sedge Landings');
    expect(valueText(openValues(first())[0])).toBe('  Sedge Landings ');
  });

  it('stores a chip inserted into the value as its token', async () => {
    render(<World />);
    await openTab(first(), 'Values');
    const editor = editorOf(first());
    const chip = world('hair', 'n1');
    await act(async () => {
      editor.update(() => {
        const node = $valueTextNode();
        node.setTextContent('Sedge ');
        node.select(6, 6).insertNodes([$createVariableNode(chip)]);
      }, { discrete: true });
    });
    expect(updates.mock.lastCall?.[0].values[0].text).toBe(`Sedge ${chip}`);
    expect(openValues(first())[0].querySelector('[data-open-value-text] [data-lexical-decorator]')).not.toBeNull();
  });
});

describe('typing in the field text on the Values tab', () => {
  it('calls the field change callback with the tokens intact, and writes no value', async () => {
    render(<World />);
    await openTab(first(), 'Values');
    const editor = editorOf(first());
    await edit(editor, () => { $trailingText().setTextContent(', dear friend.'); });
    expect(firstChange).toHaveBeenLastCalledWith(`Welcome to ${world('town', 'p1')}, dear friend.`);
    expect(updates).not.toHaveBeenCalled();
    expect(openValues(first()).map(valueText)).toEqual(['Sedge Landing']);
  });
});

describe('an open value and the store', () => {
  it('refills from an edit made elsewhere when it does not hold the caret', async () => {
    render(<World />);
    await openTab(first(), 'Values');
    await userEvent.click(screen.getByRole('button', { name: 'Rename outside' }));
    expect(openValues(first()).map(valueText)).toEqual(['Sedge Crossing']);
    expect(updates).not.toHaveBeenCalled();
  });

  it('undo restores the previous text in the editor and in the store', async () => {
    render(<World />);
    await openTab(first(), 'Values');
    const editor = editorOf(first());
    await typeInValue(editor, 'Sedge Landings');
    expect(screen.getByTestId('stored').textContent).toBe('Sedge Landings|Marrow');

    await command(editor, UNDO_COMMAND);
    expect(valueText(openValues(first())[0])).toBe('Sedge Landing');
    expect(stored()).toBe('Sedge Landing|Marrow');
    expect(firstChange).not.toHaveBeenCalled();

    await command(editor, REDO_COMMAND);
    expect(valueText(openValues(first())[0])).toBe('Sedge Landings');
    expect(stored()).toBe('Sedge Landings|Marrow');
  });

  it('keeps what the author typed while the caret is inside, and refills once the caret leaves', async () => {
    render(<World />);
    await openTab(first(), 'Values');
    const editor = editorOf(first());
    await typeInValue(editor, 'Sedge Landings ');
    // A click that moves no focus, so only the store changes.
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Rename outside' })); });
    expect(openValues(first()).map(valueText)).toEqual(['Sedge Landings ']);

    await edit(editor, () => { $trailingText().select(0, 0); });
    expect(openValues(first()).map(valueText)).toEqual(['Sedge Crossing']);
  });

  it('refills the value that holds the caret once focus leaves the editor', async () => {
    render(<World />);
    await openTab(first(), 'Values');
    const editor = editorOf(first());
    await typeInValue(editor, 'Sedge Landings ');
    await act(async () => { fireEvent.focusOut(within(first()).getByRole('textbox')); });
    expect(openValues(first()).map(valueText)).toEqual(['Sedge Landings']);
  });

  it('never undoes an edit made elsewhere', async () => {
    render(<World />);
    await openTab(first(), 'Values');
    const editor = editorOf(first());
    await typeInValue(editor, 'Sedge Landings');
    await edit(editor, () => { $trailingText().select(0, 0); });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Rename outside' })); });
    expect(stored()).toBe('Sedge Crossing|Marrow');

    await edit(editor, () => { $trailingText().setTextContent(', dear friend.'); });
    await command(editor, UNDO_COMMAND);
    await command(editor, UNDO_COMMAND);
    expect(stored()).toBe('Sedge Crossing|Marrow');
    expect(openValues(first()).map(valueText)).toEqual(['Sedge Crossing']);
  });

  it('keeps both of two values of one placeholder edited in one update', async () => {
    random.mockReturnValueOnce(0).mockReturnValueOnce(0.9);
    render(<World firstText={`${unique('town', 'u1')} and ${unique('town', 'u2')}.`} />);
    await openTab(first(), 'Values');
    expect(openValues(first()).map(valueText)).toEqual(['Sedge Landing', 'Marrow']);
    const editor = editorOf(first());
    await edit(editor, () => {
      $valueTextNode(0).setTextContent('Sedge Landings');
      $valueTextNode(1).setTextContent('Marrowby');
    });
    expect(stored()).toBe('Sedge Landings|Marrowby');
  });
});
