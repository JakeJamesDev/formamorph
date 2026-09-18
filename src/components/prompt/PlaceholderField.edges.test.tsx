import { useState } from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  $getRoot, $getSelection, $getSlot, $isElementNode, $isRangeSelection, $isTextNode, COMMAND_PRIORITY_LOW,
  DELETE_CHARACTER_COMMAND,
  getNearestEditorFromDOMNode, KEY_ARROW_LEFT_COMMAND, KEY_ARROW_RIGHT_COMMAND, KEY_ENTER_COMMAND,
  type LexicalCommand, type LexicalEditor, type TextNode,
} from 'lexical';
import PlaceholderField from './PlaceholderField';
import { $isVariableNode, type VariableNode } from './VariableNode';
import { VALUE_SLOT } from './openValueContext';
import { $valueOffset } from './openValueNodes';
import { EditorPreviewRollsProvider } from '@/contexts/EditorPreviewRollsContext';
import { PlaceholderStoreProvider, placeholderStore } from '@/contexts/PlaceholderStoreContext';
import { encodePlaceholderToken } from '@/lib/placeholders';
import { phValues } from '@/test/placeholderValues';
import type { Placeholder } from '@/types';

vi.mock('@/components/game/MarkdownRenderer', () => ({
  MarkdownRenderer: ({ text }: { text: string }) => <div data-testid="md">{text}</div>,
}));

const TOWN = encodePlaceholderToken({ id: 'town', mode: 'world', placementId: 'p1' });
const FIELD = `Welcome to ${TOWN}, friend.`;
const town: Placeholder = { id: 'town', name: 'Town', values: phValues(['Sedge Landing', 'Marrow']) };

const change = vi.fn<(v: string) => void>();

function World({ values }: { values?: string[] }) {
  const [placeholders, setPlaceholders] = useState([values ? { ...town, values: phValues(values) } : town]);
  const [value, setValue] = useState(FIELD);
  const store = placeholderStore(placeholders, setPlaceholders);
  return (
    <PlaceholderStoreProvider value={store}>
      <EditorPreviewRollsProvider>
        <PlaceholderField
          value={value}
          onChange={(v) => { change(v); setValue(v); }}
          placeholders={placeholders}
        />
        <button type="button">Outside</button>
        <div data-testid="stored">{placeholders[0].values.map((v) => v.text).join('|')}</div>
      </EditorPreviewRollsProvider>
    </PlaceholderStoreProvider>
  );
}

const field = () => screen.getByRole('textbox');
const stored = () => screen.getByTestId('stored').textContent;
const valueText = () => document.querySelector('[data-open-value-text]')?.textContent ?? null;

function editorOf(): LexicalEditor {
  const editor = getNearestEditorFromDOMNode(field());
  if (!editor) throw new Error('no editor');
  return editor;
}

function $chip(): VariableNode {
  const para = $getRoot().getFirstChild();
  const chip = $isElementNode(para) ? para.getChildren().find($isVariableNode) : undefined;
  if (!chip) throw new Error('no chip');
  return chip;
}

function $valueNode(): TextNode {
  const box = $getSlot($chip(), VALUE_SLOT);
  const text = $isElementNode(box) ? box.getAllTextNodes()[0] : undefined;
  if (!$isTextNode(text)) throw new Error('no value text');
  return text;
}

/** The field text beside the chip. */
function $fieldText(side: 'before' | 'after'): TextNode {
  const node = side === 'before' ? $chip().getPreviousSibling() : $chip().getNextSibling();
  if (!$isTextNode(node)) throw new Error('no field text');
  return node;
}

async function edit(fn: () => void) {
  await act(async () => { editorOf().update(fn, { discrete: true }); });
}

/** Types into the value: its whole text becomes `text`, with the caret at `caret`. */
async function typeValue(text: string, caret = text.length) {
  await edit(() => { $valueNode().setTextContent(text).select(caret, caret); });
}

async function press<T>(command: LexicalCommand<T>, payload: T): Promise<boolean> {
  let handled = false;
  await act(async () => { handled = editorOf().dispatchCommand(command, payload); });
  return handled;
}

const key = (name: string) => new KeyboardEvent('keydown', { key: name, cancelable: true });

/** Where the caret is: in the value (with its offset), or in the field text (with the text node and offset). */
function caret(): { inValue: number } | { text: string; offset: number } | null {
  return editorOf().getEditorState().read(() => {
    const sel = $getSelection();
    if (!$isRangeSelection(sel)) return null;
    const inValue = $valueOffset($chip(), sel.anchor);
    if (inValue !== null) return { inValue };
    return { text: sel.anchor.getNode().getTextContent(), offset: sel.anchor.offset };
  });
}

const random = vi.spyOn(Math, 'random');
beforeEach(async () => {
  localStorage.clear();
  random.mockReturnValue(0);
  change.mockReset();
  render(<World />);
  await userEvent.click(screen.getByRole('tab', { name: 'Values' }));
  change.mockReset();
});
afterEach(() => random.mockReset());

describe('typing at the end of a value', () => {
  it('keeps "word word" in the value', async () => {
    await typeValue('Sedge Landing ');
    await edit(() => { $valueNode().select(14, 14); });
    await typeValue('Sedge Landing word');
    expect(valueText()).toBe('Sedge Landing word');
    expect(stored()).toBe('Sedge Landing word|Marrow');
    expect(change).not.toHaveBeenCalled();
  });

  it('keeps a space pending while the caret stays at the edge', async () => {
    await typeValue('Sedge Landing  ', 14);
    expect(valueText()).toBe('Sedge Landing  ');
    expect(change).not.toHaveBeenCalled();
  });

  it('drops the space after the chip on ArrowRight, with the caret after it', async () => {
    await typeValue('Sedge Landing ');
    expect(await press(KEY_ARROW_RIGHT_COMMAND, key('ArrowRight'))).toBe(true);
    expect(valueText()).toBe('Sedge Landing');
    expect(change).toHaveBeenLastCalledWith(`Welcome to ${TOWN} , friend.`);
    expect(caret()).toEqual({ text: ' , friend.', offset: 1 });
    expect(stored()).toBe('Sedge Landing|Marrow');
  });

  it('keeps a space after a period in the value while the caret is at it', async () => {
    await typeValue('Sedge Landing. ');
    expect(valueText()).toBe('Sedge Landing. ');
    await typeValue('Sedge Landing. Again');
    expect(valueText()).toBe('Sedge Landing. Again');
    expect(stored()).toBe('Sedge Landing. Again|Marrow');
    expect(change).not.toHaveBeenCalled();
  });

  it('keeps punctuation in the value on ArrowRight', async () => {
    await typeValue('Sedge Landing.');
    await press(KEY_ARROW_RIGHT_COMMAND, key('ArrowRight'));
    expect(valueText()).toBe('Sedge Landing.');
    expect(stored()).toBe('Sedge Landing.|Marrow');
    expect(caret()).toEqual({ text: ', friend.', offset: 0 });
    expect(change).not.toHaveBeenCalled();
  });
});

describe('typing at the start of a value', () => {
  it('drops the space before the chip on ArrowLeft, with the caret before it', async () => {
    await typeValue(' Sedge Landing', 1);
    expect(await press(KEY_ARROW_LEFT_COMMAND, key('ArrowLeft'))).toBe(true);
    expect(valueText()).toBe('Sedge Landing');
    expect(change).toHaveBeenLastCalledWith(`Welcome to  ${TOWN}, friend.`);
    expect(caret()).toEqual({ text: 'Welcome to  ', offset: 11 });
  });

  it('keeps "word word" in the value', async () => {
    await typeValue('word Sedge Landing', 5);
    await press(KEY_ARROW_LEFT_COMMAND, key('ArrowLeft'));
    expect(valueText()).toBe('word Sedge Landing');
    expect(change).not.toHaveBeenCalled();
  });
});

describe('an arrow in the middle of a value', () => {
  it('is left to the editor', async () => {
    await typeValue('Sedge Landing', 5);
    expect(await press(KEY_ARROW_RIGHT_COMMAND, key('ArrowRight'))).toBe(false);
    expect(await press(KEY_ARROW_LEFT_COMMAND, key('ArrowLeft'))).toBe(false);
  });
});

describe('other caret exits', () => {
  it('a click elsewhere in the field drops the space and keeps the caret where it landed', async () => {
    await typeValue('Sedge Landing ');
    await edit(() => { $fieldText('before').select(3, 3); });
    expect(valueText()).toBe('Sedge Landing');
    expect(change).toHaveBeenLastCalledWith(`Welcome to ${TOWN} , friend.`);
    expect(caret()).toEqual({ text: 'Welcome to ', offset: 3 });
  });

  it('keeps both runs pending while the caret stays in the value, and drops both when it leaves', async () => {
    await typeValue(' Sedge Landing ', 15);
    await edit(() => { $valueNode().select(3, 3); });
    expect(valueText()).toBe(' Sedge Landing ');
    expect(change).not.toHaveBeenCalled();

    await edit(() => { $fieldText('after').select(0, 0); });
    expect(valueText()).toBe('Sedge Landing');
    expect(change).toHaveBeenLastCalledWith(`Welcome to  ${TOWN} , friend.`);
  });

  it('focus leaving the editor drops the space', async () => {
    await typeValue('Sedge Landing ');
    await act(async () => { fireEvent.focusOut(field()); });
    expect(valueText()).toBe('Sedge Landing');
    expect(change).toHaveBeenLastCalledWith(`Welcome to ${TOWN} , friend.`);
  });

  it('a chevron step drops the space', async () => {
    await typeValue('Sedge Landing ');
    await userEvent.click(screen.getByRole('button', { name: 'Next Value' }));
    expect(change).toHaveBeenLastCalledWith(`Welcome to ${TOWN} , friend.`);
    expect(valueText()).toBe('Marrow');
  });

  it('a tab switch drops the space', async () => {
    await typeValue('Sedge Landing ');
    await userEvent.click(screen.getByRole('tab', { name: 'Edit' }));
    expect(change).toHaveBeenLastCalledWith(`Welcome to ${TOWN} , friend.`);
  });

  it('Reroll drops the space', async () => {
    await typeValue('Sedge Landing ');
    random.mockReturnValue(0.9);
    await userEvent.click(screen.getByRole('button', { name: /Reroll/ }));
    expect(change).toHaveBeenLastCalledWith(`Welcome to ${TOWN} , friend.`);
    expect(valueText()).toBe('Marrow');
  });
});

describe('arrow entry', () => {
  it('ArrowRight before an open value enters it at its start', async () => {
    await edit(() => { $fieldText('before').selectEnd(); });
    expect(await press(KEY_ARROW_RIGHT_COMMAND, key('ArrowRight'))).toBe(true);
    expect(caret()).toEqual({ inValue: 0 });
  });

  it('ArrowLeft after an open value enters it at its end', async () => {
    await edit(() => { $fieldText('after').select(0, 0); });
    expect(await press(KEY_ARROW_LEFT_COMMAND, key('ArrowLeft'))).toBe(true);
    expect(caret()).toEqual({ inValue: 13 });
  });

  it('leaves an arrow away from a value to the editor', async () => {
    await edit(() => { $fieldText('before').select(3, 3); });
    expect(await press(KEY_ARROW_RIGHT_COMMAND, key('ArrowRight'))).toBe(false);
  });
});

// jsdom cannot run the editor's own character delete, so these check what reaches it; e2e covers the result.
describe('deleting at a value edge', () => {
  /** Whether a delete gets past the edge guard to the editor's own handler. */
  async function reachesEditor(backward: boolean): Promise<boolean> {
    const handler = vi.fn(() => true);
    const off = editorOf().registerCommand(DELETE_CHARACTER_COMMAND, handler, COMMAND_PRIORITY_LOW);
    await press(DELETE_CHARACTER_COMMAND, backward);
    off();
    return handler.mock.calls.length > 0;
  }

  it('Backspace on an empty value changes nothing', async () => {
    await typeValue('');
    await edit(() => { $getSlot($chip(), VALUE_SLOT)?.selectStart(); });
    expect(await reachesEditor(true)).toBe(false);
  });

  it('Backspace at the start of a value changes nothing', async () => {
    await typeValue('Sedge Landing', 0);
    expect(await reachesEditor(true)).toBe(false);
  });

  it('Delete at the end of a value pulls nothing in', async () => {
    await typeValue('Sedge Landing');
    expect(await reachesEditor(false)).toBe(false);
  });

  it('passes deletes inside a value to the editor, the first character included', async () => {
    await typeValue('Sedge Landing', 1);
    expect(await reachesEditor(true)).toBe(true);
    expect(await reachesEditor(false)).toBe(true);
    await typeValue('Sedge Landing', 12);
    expect(await reachesEditor(false)).toBe(true);
  });
});

describe('Enter inside a value', () => {
  it('adds a line break and leaves the field text alone', async () => {
    await typeValue('Sedge Landing', 5);
    await press(KEY_ENTER_COMMAND, key('Enter'));
    expect(stored()).toBe('Sedge\n Landing|Marrow');
    expect(change).not.toHaveBeenCalled();
    expect(document.querySelectorAll('[data-open-value]')).toHaveLength(1);
    expect(document.querySelector('[data-open-value-text] br')).not.toBeNull();
  });
});

describe('a value the world stores with edge whitespace', () => {
  // The store's own whitespace is part of the value. Only what the author types at an edge is pending.
  beforeEach(async () => {
    cleanup();
    render(<World values={[' Sedge Landing ', 'Marrow']} />);
    await userEvent.click(screen.getByRole('tab', { name: 'Values' }));
    change.mockReset();
  });

  it('leaves the field text alone across tab switches', async () => {
    for (const name of ['Edit', 'Values', 'Preview', 'Values', 'Edit']) {
      await userEvent.click(screen.getByRole('tab', { name }));
    }
    expect(change).not.toHaveBeenCalled();
    expect(stored()).toBe(' Sedge Landing |Marrow');
  });

  it('leaves the field text alone when an arrow leaves the untouched value', async () => {
    await edit(() => { $valueNode().select(15, 15); });
    expect(await press(KEY_ARROW_RIGHT_COMMAND, key('ArrowRight'))).toBe(true);
    expect(change).not.toHaveBeenCalled();
  });

  it('still drops the edges of that value once the author edits it', async () => {
    await typeValue(' Sedge Landings ');
    await userEvent.click(screen.getByRole('tab', { name: 'Edit' }));
    expect(change).toHaveBeenLastCalledWith(`Welcome to  ${TOWN} , friend.`);
    expect(stored()).toBe('Sedge Landings|Marrow');
  });
});
