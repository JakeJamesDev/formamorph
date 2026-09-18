import { useState } from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  $getRoot, $getSelection, $getSelectionSlotFrame, $getSlot, $isElementNode, $isTextNode,
  getNearestEditorFromDOMNode, type LexicalEditor, type TextNode,
} from 'lexical';
import PlaceholderField from './PlaceholderField';
import { $isVariableNode } from './VariableNode';
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

const town: Placeholder = { id: 'town', name: 'Town', values: phValues(['Sedge Landing', 'Marrow']) };
// Its first value pins Town to a value typed off the list.
const lord: Placeholder = {
  id: 'lord',
  name: 'Lord',
  values: [{ id: 'v:Ash', text: 'Ash', pins: [{ placeholderId: 'town', value: 'Anywhere' }] }, { id: 'v:Bram', text: 'Bram' }],
};

const openValues = () => Array.from(document.querySelectorAll<HTMLElement>('[data-open-value]'));
const valueText = (el: HTMLElement) => el.querySelector('[data-open-value-text]')?.textContent ?? '';
/** The verbose label an open value's header carries — shown on the active header, kept for a tip otherwise. */
const valueLabel = (el: HTMLElement) => el.querySelector('[data-open-value-label]')?.textContent ?? '';
const slotEditable = (el: HTMLElement) => el.querySelector<HTMLElement>('[data-lexical-slot]')?.contentEditable;
const stored = () => screen.getByTestId('stored').textContent;

const updates = vi.fn<(p: Placeholder) => void>();

/** One field under a bound store. */
function Field({ text, world: initial = [town], readOnly }: { text: string; world?: Placeholder[]; readOnly?: boolean }) {
  const [placeholders, setPlaceholders] = useState(initial);
  const base = placeholderStore(placeholders, setPlaceholders);
  const store = { ...base, updatePlaceholder: (p: Placeholder) => { updates(p); base.updatePlaceholder(p); } };
  return (
    <PlaceholderStoreProvider value={store}>
      <EditorPreviewRollsProvider>
        <PlaceholderField value={text} onChange={() => {}} placeholders={placeholders} readOnly={readOnly} />
        <div data-testid="stored">{placeholders.find((p) => p.id === 'town')!.values.map((v) => v.text).join('|')}</div>
      </EditorPreviewRollsProvider>
    </PlaceholderStoreProvider>
  );
}

async function openValuesTab() {
  await userEvent.click(screen.getByRole('tab', { name: 'Values' }));
}

function editor(): LexicalEditor {
  const found = getNearestEditorFromDOMNode(screen.getByRole('textbox'));
  if (!found) throw new Error('no editor');
  return found;
}

/** The first text node of the `nth` field chip's open value. */
function $valueTextNode(nth: number): TextNode {
  const para = $getRoot().getFirstChild();
  const chip = $isElementNode(para) ? para.getChildren().filter($isVariableNode)[nth] : undefined;
  const box = chip && $getSlot(chip, VALUE_SLOT);
  const text = $isElementNode(box) ? box.getAllTextNodes()[0] : undefined;
  if (!$isTextNode(text)) throw new Error('no value text');
  return text;
}

/** Replace the `nth` open value's text the way typing does, with the caret left inside it. */
async function typeInValue(nth: number, text: string) {
  await act(async () => {
    editor().update(() => { $valueTextNode(nth).setTextContent(text).select(text.length, text.length); }, { discrete: true });
  });
}

/** Which field chip's value holds the caret, by position, or -1. */
const caretChip = () => editor().getEditorState().read(() => {
  const frame = $getSelectionSlotFrame($getSelection());
  const para = $getRoot().getFirstChild();
  const chips = $isElementNode(para) ? para.getChildren().filter($isVariableNode) : [];
  return chips.findIndex((chip) => !!frame && !!$getSlot(chip, VALUE_SLOT)?.is(frame));
});

// Every draw lands on the first value unless a test says otherwise.
const random = vi.spyOn(Math, 'random');
beforeEach(() => {
  localStorage.clear();
  random.mockReturnValue(0);
  updates.mockReset();
});
afterEach(() => random.mockReset());

describe('two World placements of one placeholder', () => {
  const TEXT = `${world('town', 'p1')} and ${world('town', 'p2')}.`;

  it('open one editable value and one read-only mirror', async () => {
    render(<Field text={TEXT} />);
    await openValuesTab();
    const [editable, mirror] = openValues();
    expect(openValues().map(valueText)).toEqual(['Sedge Landing', 'Sedge Landing']);
    expect(slotEditable(editable)).toBe('true');
    expect(editable).not.toHaveAttribute('data-read-only');
    expect(slotEditable(mirror)).toBe('false');
    expect(mirror).toHaveAttribute('data-read-only');
    expect(valueLabel(mirror)).toMatch(/Value 1/);
  });

  it('update the mirror live as the editable copy is typed in', async () => {
    render(<Field text={TEXT} />);
    await openValuesTab();
    await typeInValue(0, 'Sedge Landings');
    expect(openValues().map(valueText)).toEqual(['Sedge Landings', 'Sedge Landings']);
    await typeInValue(0, 'Sedge Landingsby ');
    expect(openValues().map(valueText)).toEqual(['Sedge Landingsby ', 'Sedge Landingsby']);
    expect(stored()).toBe('Sedge Landingsby|Marrow');
  });

  it('write nothing from an edit that reaches the mirror, and refill it', async () => {
    render(<Field text={TEXT} />);
    await openValuesTab();
    await act(async () => {
      editor().update(() => { $valueTextNode(1).setTextContent('Elsewhere'); }, { discrete: true });
    });
    expect(updates).not.toHaveBeenCalled();
    expect(openValues().map(valueText)).toEqual(['Sedge Landing', 'Sedge Landing']);
  });
});

describe('two Unique placements with different rolls', () => {
  const TEXT = `${unique('town', 'u1')} and ${unique('town', 'u2')}.`;
  const render2 = async () => {
    random.mockReturnValueOnce(0).mockReturnValueOnce(0.9);
    render(<Field text={TEXT} />);
    await openValuesTab();
  };

  it('open two editable values that write to different values', async () => {
    await render2();
    expect(openValues().map(valueText)).toEqual(['Sedge Landing', 'Marrow']);
    expect(openValues().map(slotEditable)).toEqual(['true', 'true']);

    await typeInValue(1, 'Marrowby');
    expect(stored()).toBe('Sedge Landing|Marrowby');
    await typeInValue(0, 'Sedge Landings');
    expect(stored()).toBe('Sedge Landings|Marrowby');
    expect(openValues().map(valueText)).toEqual(['Sedge Landings', 'Marrowby']);
  });

  it('turn the later one into a mirror when it steps onto the other value, keeping the caret', async () => {
    await render2();
    await typeInValue(0, 'Sedge Landings ');
    await userEvent.click(within(openValues()[1]).getByRole('button', { name: 'Previous Value' }));

    const [editable, mirror] = openValues();
    expect(caretChip()).toBe(0);
    expect(valueText(editable)).toBe('Sedge Landings ');
    expect(slotEditable(editable)).toBe('true');
    expect(valueText(mirror)).toBe('Sedge Landings');
    expect(slotEditable(mirror)).toBe('false');
    expect(mirror).toHaveAttribute('data-read-only');
  });

  it('keep the copy that holds the caret editable when the earlier one steps onto its value', async () => {
    await render2();
    await typeInValue(1, 'Marrowby ');
    await userEvent.click(within(openValues()[0]).getByRole('button', { name: 'Next Value' }));

    const [mirror, editable] = openValues();
    expect(caretChip()).toBe(1);
    expect(valueText(editable)).toBe('Marrowby ');
    expect(slotEditable(editable)).toBe('true');
    expect(valueText(mirror)).toBe('Marrowby');
    expect(slotEditable(mirror)).toBe('false');
  });
});

describe('read-only values', () => {
  it('a read-only field opens every value with no input', async () => {
    render(<Field text={`${world('town', 'p1')} and ${unique('town', 'u1')}.`} readOnly />);
    await openValuesTab();
    expect(openValues()).toHaveLength(2);
    for (const open of openValues()) {
      expect(slotEditable(open)).toBe('false');
      expect(open).toHaveAttribute('data-read-only');
    }
  });

  it('a field that turns read-only and back locks and unlocks its values', async () => {
    const { rerender } = render(<Field text={`Welcome to ${world('town', 'p1')}.`} />);
    await openValuesTab();
    await act(async () => { rerender(<Field text={`Welcome to ${world('town', 'p1')}.`} readOnly />); });
    expect(slotEditable(openValues()[0])).toBe('false');
    expect(openValues()[0]).toHaveAttribute('data-read-only', 'field');
    await act(async () => { rerender(<Field text={`Welcome to ${world('town', 'p1')}.`} />); });
    expect(slotEditable(openValues()[0])).toBe('true');
    expect(openValues()[0]).not.toHaveAttribute('data-read-only');
  });

  it('a field with no placeholder store opens its values read-only', async () => {
    render(
      <EditorPreviewRollsProvider>
        <PlaceholderField value={`Welcome to ${world('town', 'p1')}.`} onChange={() => {}} placeholders={[town]} />
      </EditorPreviewRollsProvider>,
    );
    await openValuesTab();
    expect(screen.getByRole('textbox')).toHaveAttribute('contenteditable', 'true');
    expect(slotEditable(openValues()[0])).toBe('false');
  });

  it('a pin typed off the list opens editable and writes the pin, not a value', async () => {
    render(<Field text={`${world('lord', 'p1')} of ${world('town', 'p2')}.`} world={[town, lord]} />);
    await openValuesTab();
    const [lordValue, pinned] = openValues();
    expect(slotEditable(lordValue)).toBe('true');
    expect(valueText(pinned)).toBe('Anywhere');
    expect(within(pinned).getByText(/^· Pinned$/)).toBeInTheDocument();
    expect(slotEditable(pinned)).toBe('true');
    expect(pinned).not.toHaveAttribute('data-read-only');

    await act(async () => {
      editor().update(() => { $valueTextNode(1).setTextContent('Somewhere'); }, { discrete: true });
    });
    // The pin's own text moves on the value that laid it; Town keeps the two values it had.
    expect(updates).toHaveBeenCalledTimes(1);
    expect(updates.mock.calls[0][0]).toEqual({
      ...lord,
      values: [{ id: 'v:Ash', text: 'Ash', pins: [{ placeholderId: 'town', value: 'Somewhere' }] }, { id: 'v:Bram', text: 'Bram' }],
    });
    expect(stored()).toBe('Sedge Landing|Marrow');
    expect(valueText(openValues()[1])).toBe('Somewhere');
  });
});
