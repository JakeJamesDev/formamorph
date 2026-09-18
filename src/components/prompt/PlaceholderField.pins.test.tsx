import { useState } from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  $getRoot, $getSlot, $isElementNode, $isTextNode,
  getNearestEditorFromDOMNode, REDO_COMMAND, UNDO_COMMAND, type LexicalEditor, type TextNode,
} from 'lexical';
import PlaceholderField from './PlaceholderField';
import { $isVariableNode } from './VariableNode';
import { VALUE_SLOT } from './openValueContext';
import { EditorPreviewRollsProvider } from '@/contexts/EditorPreviewRollsContext';
import { PlaceholderStoreProvider, placeholderStore } from '@/contexts/PlaceholderStoreContext';
import { encodePlaceholderToken } from '@/lib/placeholders';
import { phValues } from '@/test/placeholderValues';
import type { Placeholder } from '@/types';

/**
 * Editing a pin from the Values tab. A pin whose text is on no value list belongs to the value that laid it,
 * so the edit goes there and the pinned placeholder's own list never grows.
 */

vi.mock('@/components/game/MarkdownRenderer', () => ({
  MarkdownRenderer: ({ text }: { text: string }) => <div data-testid="md">{text}</div>,
}));

const world = (id: string, placementId: string) => encodePlaceholderToken({ id, mode: 'world', placementId });

const town: Placeholder = { id: 'town', name: 'Town', values: phValues(['Sedge Landing', 'Marrow']) };
// A placeholder with no values of its own: whatever a pin says is the only text it has.
const ghost: Placeholder = { id: 'ghost', name: 'Ghost', values: [] };
/**
 * Lord's one value lays three pins: Ghost at text no list carries, Town at text off Town's list, and
 * Steed at one of its own values.
 */
const steed: Placeholder = { id: 'steed', name: 'Steed', values: phValues(['Dapple', 'Ember']) };
const lord: Placeholder = {
  id: 'lord',
  name: 'Lord',
  values: [{
    id: 'v:Ash',
    text: 'Ash',
    pins: [
      { placeholderId: 'ghost', value: 'Wisp' },
      { placeholderId: 'town', value: 'Anywhere' },
      { placeholderId: 'steed', value: 'Ember', valueId: 'v:Ember' },
    ],
  }],
};
const WORLD = [town, ghost, steed, lord];

const updates = vi.fn<(p: Placeholder) => void>();

function Field({ text }: { text: string }) {
  const [placeholders, setPlaceholders] = useState(WORLD);
  const base = placeholderStore(placeholders, setPlaceholders);
  const store = { ...base, updatePlaceholder: (p: Placeholder) => { updates(p); base.updatePlaceholder(p); } };
  const by = (id: string) => placeholders.find((p) => p.id === id)!;
  return (
    <PlaceholderStoreProvider value={store}>
      <EditorPreviewRollsProvider>
        <PlaceholderField value={text} onChange={() => {}} placeholders={placeholders} />
        <div data-testid="ghost-values">{by('ghost').values.map((v) => v.text).join('|')}</div>
        <div data-testid="town-values">{by('town').values.map((v) => v.text).join('|')}</div>
        <div data-testid="lord-pins">{(by('lord').values[0].pins ?? []).map((p) => `${p.placeholderId}=${p.value}`).join('|')}</div>
      </EditorPreviewRollsProvider>
    </PlaceholderStoreProvider>
  );
}

const openValues = () => Array.from(document.querySelectorAll<HTMLElement>('[data-open-value]'));
const valueText = (el: HTMLElement) => el.querySelector('[data-open-value-text]')?.textContent ?? '';
const slotEditable = (el: HTMLElement) => el.querySelector<HTMLElement>('[data-lexical-slot]')?.contentEditable;
const shown = (id: string) => screen.getByTestId(id).textContent;

const openValuesTab = () => userEvent.click(screen.getByRole('tab', { name: 'Values' }));

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
const typeInValue = (nth: number, text: string) => act(async () => {
  editor().update(() => {
    const node = $valueTextNode(nth).setTextContent(text);
    node.select(text.length, text.length);
  }, { discrete: true });
});

const command = (cmd: typeof UNDO_COMMAND | typeof REDO_COMMAND) =>
  act(async () => { editor().dispatchCommand(cmd, undefined); });

const random = vi.spyOn(Math, 'random');
beforeEach(() => {
  localStorage.clear();
  random.mockReturnValue(0);
  updates.mockReset();
});
afterEach(() => random.mockReset());

describe('a pin on a placeholder that has no values of its own', () => {
  const TEXT = `${world('lord', 'l1')} calls ${world('ghost', 'g1')}.`;

  it('opens editable rather than locked', async () => {
    render(<Field text={TEXT} />);
    await openValuesTab();
    const [, pinned] = openValues();
    expect(valueText(pinned)).toBe('Wisp');
    expect(slotEditable(pinned)).toBe('true');
    expect(pinned).not.toHaveAttribute('data-read-only');
  });

  it('writes the pin on the value that laid it, and gives the placeholder no value', async () => {
    render(<Field text={TEXT} />);
    await openValuesTab();
    await typeInValue(1, 'Wisp of Ash');
    expect(shown('lord-pins')).toBe('ghost=Wisp of Ash|town=Anywhere|steed=Ember');
    expect(shown('ghost-values')).toBe('');
    expect(updates).toHaveBeenCalledTimes(1);
    expect(updates.mock.calls[0][0].id).toBe('lord');
  });

  it('stays an empty pin when the author clears it', async () => {
    render(<Field text={TEXT} />);
    await openValuesTab();
    await typeInValue(1, '');
    expect(shown('lord-pins')).toBe('ghost=|town=Anywhere|steed=Ember');
  });

  it('restores the pin text on undo', async () => {
    render(<Field text={TEXT} />);
    await openValuesTab();
    await typeInValue(1, 'Wisp of Ash');
    await command(UNDO_COMMAND);
    expect(shown('lord-pins')).toBe('ghost=Wisp|town=Anywhere|steed=Ember');
    expect(valueText(openValues()[1])).toBe('Wisp');
  });

  it('reaches every chip that reads the pin, opening one copy and mirroring the other', async () => {
    render(<Field text={`${world('lord', 'l1')} calls ${world('ghost', 'g1')} and ${world('ghost', 'g2')}.`} />);
    await openValuesTab();
    const [, editable, mirror] = openValues();
    expect(slotEditable(editable)).toBe('true');
    expect(slotEditable(mirror)).toBe('false');
    expect(mirror).toHaveAttribute('data-read-only');

    await typeInValue(1, 'Wisp of Ash');
    expect(openValues().map(valueText)).toEqual(['Ash', 'Wisp of Ash', 'Wisp of Ash']);
  });
});

describe('a pin that names a value the placeholder carries', () => {
  it('still writes that value, not the pin', async () => {
    render(<Field text={`${world('lord', 'l1')} rides ${world('steed', 's1')}.`} />);
    await openValuesTab();
    const [, pinned] = openValues();
    expect(valueText(pinned)).toBe('Ember');
    await typeInValue(1, 'Emberfall');
    expect(updates.mock.calls[0][0]).toEqual({ ...steed, values: [{ id: 'v:Dapple', text: 'Dapple' }, { id: 'v:Ember', text: 'Emberfall' }] });
    expect(shown('lord-pins')).toBe('ghost=Wisp|town=Anywhere|steed=Ember');
  });
});

describe('a pin off the list of a placeholder that has values', () => {
  it('opens editable and writes the pin, leaving the value list alone', async () => {
    render(<Field text={`${world('lord', 'l1')} of ${world('town', 'p1')}.`} />);
    await openValuesTab();
    const [, pinned] = openValues();
    expect(valueText(pinned)).toBe('Anywhere');
    expect(within(pinned).getByText(/· Pinned/)).toBeInTheDocument();

    await typeInValue(1, 'Anywhere Else');
    expect(shown('lord-pins')).toBe('ghost=Wisp|town=Anywhere Else|steed=Ember');
    expect(shown('town-values')).toBe('Sedge Landing|Marrow');
  });
});
