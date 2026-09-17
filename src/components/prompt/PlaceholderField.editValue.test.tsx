import { useState } from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  $getRoot, $getSelection, $isElementNode, $isRangeSelection,
  getNearestEditorFromDOMNode, type LexicalEditor,
} from 'lexical';
import PlaceholderField from './PlaceholderField';
import PromptField from './PromptField';
import { $isVariableNode, type VariableNode } from './VariableNode';
import { $valueOffset } from './openValueNodes';
import { EditorPreviewRollsProvider } from '@/contexts/EditorPreviewRollsContext';
import { PlaceholderStoreProvider, placeholderStore } from '@/contexts/PlaceholderStoreContext';
import { promptVocabulary } from '@/lib/chipVocabulary';
import { encodePlaceholderToken } from '@/lib/placeholders';
import { phValues } from '@/test/placeholderValues';
import type { Placeholder } from '@/types';

/**
 * "Edit Value" in a placed chip's flyout: one click from a chip on the Edit tab to typing in its value.
 * Real focus needs a real caret, so the browser suite owns that; here the caret's landing place is the claim.
 */

vi.mock('@/components/game/MarkdownRenderer', () => ({
  MarkdownRenderer: ({ text }: { text: string }) => <div data-testid="md">{text}</div>,
}));

const world = (id: string, placementId: string) => encodePlaceholderToken({ id, mode: 'world', placementId });
const unique = (id: string, placementId: string) => encodePlaceholderToken({ id, mode: 'unique', placementId });

const town: Placeholder = { id: 'town', name: 'Town', values: phValues(['Sedge Landing', 'Marrow']) };
const inn: Placeholder = { id: 'inn', name: 'Inn', values: phValues(['The Gull']) };
// Its one value pins Town to text that is on no Town value, so Town has no value id to write to.
const lord: Placeholder = {
  id: 'lord',
  name: 'Lord',
  values: [{ id: 'v:Ash', text: 'Ash', pins: [{ placeholderId: 'town', value: 'Anywhere' }] }],
};

// Its one value holds a Town chip on the same placement the field text uses, so that token is open at
// field level while a second, nested copy of it stays a chip inside this value.
const realm: Placeholder = {
  id: 'realm',
  name: 'Realm',
  values: [{ id: 'v:shore', text: `${world('town', 'p1')} shore` }],
};

function Field({ text, readOnly }: { text: string; readOnly?: boolean }) {
  const [placeholders, setPlaceholders] = useState([town, inn, lord, realm]);
  const [value, setValue] = useState(text);
  return (
    <PlaceholderStoreProvider value={placeholderStore(placeholders, setPlaceholders)}>
      <EditorPreviewRollsProvider>
        <PlaceholderField value={value} onChange={setValue} placeholders={placeholders} readOnly={readOnly} />
      </EditorPreviewRollsProvider>
    </PlaceholderStoreProvider>
  );
}

const editValueItem = () => screen.queryByRole('button', { name: 'Edit Value' });
const activeTab = () => screen.getByRole('tab', { selected: true }).textContent;
const openValues = () => Array.from(document.querySelectorAll<HTMLElement>('[data-open-value]'));
const valueText = (el: HTMLElement) => el.querySelector('[data-open-value-text]')?.textContent ?? '';
/** The editable island an open value takes its keystrokes in. */
const island = (el: HTMLElement) => el.querySelector<HTMLElement>('[data-lexical-slot]');

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

/** Opens the flyout of the chip labeled `name`. */
const openFlyout = (name: string) => userEvent.click(screen.getByText(name));

// Every draw lands on the first value unless a test says otherwise.
const random = vi.spyOn(Math, 'random');
beforeEach(() => {
  localStorage.clear();
  random.mockReturnValue(0);
});
afterEach(() => random.mockReset());

describe('the flyout offers Edit Value', () => {
  it('on a placed chip in a field that has the Values tab', async () => {
    render(<Field text={`Welcome to ${world('town', 'p1')}.`} />);
    await openFlyout('Town');
    expect(editValueItem()).toBeInTheDocument();
  });

  it('alongside the flyout items it already had', async () => {
    render(<Field text={`Welcome to ${world('town', 'p1')}.`} />);
    await openFlyout('Town');
    expect(screen.getByRole('radio', { name: 'World' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Unique' })).toBeInTheDocument();
    expect(editValueItem()).toBeInTheDocument();
  });

  it('in place of the empty notice, on a chip whose flyout had nothing else to offer', async () => {
    // One value makes a Variable chip: no mode to switch, no value to re-pick.
    render(<Field text={`Meet at ${world('inn', 'p1')}.`} />);
    await openFlyout('Inn');
    expect(screen.queryByText('No options for this variable.')).toBeNull();
    expect(editValueItem()).toBeInTheDocument();
  });

  it('not on a read-only field', async () => {
    render(<Field text={`Welcome to ${world('town', 'p1')}.`} readOnly />);
    await openFlyout('Town');
    expect(screen.getByRole('tab', { name: 'Values' })).toBeEnabled();
    expect(editValueItem()).toBeNull();
  });

  it('not on a chip a pin holds at text that is on no value list', async () => {
    render(<Field text={`${world('lord', 'p0')} of ${world('town', 'p1')}.`} />);
    await openFlyout('Town');
    // The pin decides what Town shows, and "Anywhere" is nobody's value, so there is nothing to type into.
    expect(editValueItem()).toBeNull();
    await userEvent.keyboard('{Escape}');
    await openFlyout('Lord');
    expect(editValueItem()).toBeInTheDocument();
  });

  it('not on a chip nested inside an open value, whose own value never opens', async () => {
    render(<Field text={`${world('realm', 'r1')} holds ${world('town', 'p1')}.`} />);
    await userEvent.click(screen.getByRole('tab', { name: 'Values' }));
    // The field's two chips are open; the Town chip inside Realm's value stays a chip and keeps its flyout.
    expect(openValues().map(valueText)).toEqual(['Town shore', 'Sedge Landing']);
    const nested = openValues()[0].querySelector<HTMLElement>('[data-lexical-decorator]')!;
    await userEvent.click(within(nested).getByText('Town'));

    // Its token is open at field level, so it has a writable value — but no value of its own ever opens
    // for the caret to land in, so the item would be a button that does nothing.
    expect(screen.getByRole('radio', { name: 'World' })).toBeInTheDocument();
    expect(editValueItem()).toBeNull();
  });

  it('not on a prompt-variable chip, which has no authored value to edit', async () => {
    render(
      <PromptField
        value="at <LOCATION>."
        onChange={() => {}}
        vocabulary={promptVocabulary([])}
        previewValues={{ '<LOCATION>': "Sarah's Place" }}
      />,
    );
    await openFlyout('Location');
    expect(screen.queryByRole('tab', { name: 'Values' })).toBeNull();
    expect(editValueItem()).toBeNull();
  });
});

describe('picking Edit Value', () => {
  it('switches to the Values tab and puts the caret at the end of that chip’s value', async () => {
    render(<Field text={`${world('inn', 'p0')} in ${world('town', 'p1')}.`} />);
    await openFlyout('Town');
    await userEvent.click(editValueItem()!);

    expect(activeTab()).toBe('Values');
    expect(openValues().map(valueText)).toEqual(['The Gull', 'Sedge Landing']);
    expect(caret()).toEqual({ chip: 1, offset: 'Sedge Landing'.length });
    // jsdom will not focus a contentEditable island, so `edit-value-flyout.spec.ts` owns that half.
    expect(island(openValues()[1])).toBeInTheDocument();
  });

  it('lands in the editable copy when the chip picked is a mirror', async () => {
    render(<Field text={`${world('town', 'p1')} and ${world('town', 'p2')}.`} />);
    // Both placements share one roll, so the second copy opens as a mirror of the first.
    await userEvent.click(screen.getAllByText('Town')[1]);
    await userEvent.click(editValueItem()!);

    expect(activeTab()).toBe('Values');
    expect(openValues().map(valueText)).toEqual(['Sedge Landing', 'Sedge Landing']);
    expect(caret()).toEqual({ chip: 0, offset: 'Sedge Landing'.length });
  });

  it('leaves the field’s own text alone', async () => {
    const change = vi.fn();
    render(
      <PlaceholderStoreProvider value={placeholderStore([town], () => {})}>
        <EditorPreviewRollsProvider>
          <PlaceholderField
            value={`Welcome to ${world('town', 'p1')}.`}
            onChange={change}
            placeholders={[town]}
          />
        </EditorPreviewRollsProvider>
      </PlaceholderStoreProvider>,
    );
    await openFlyout('Town');
    await userEvent.click(editValueItem()!);
    expect(activeTab()).toBe('Values');
    expect(change).not.toHaveBeenCalled();
  });
});

describe('the gestures Edit Value sits beside', () => {
  it('leaves double-click rename working', async () => {
    render(<Field text={`Welcome to ${world('town', 'p1')}.`} />);
    await userEvent.dblClick(screen.getByText('Town'));
    expect(screen.getByRole('textbox', { name: 'Rename Town' })).toBeInTheDocument();
  });

  it('leaves a Unique chip’s own value reachable', async () => {
    render(<Field text={`Welcome to ${unique('town', 'u1')}.`} />);
    await openFlyout('Town (Unique)');
    await userEvent.click(editValueItem()!);
    expect(caret()).toEqual({ chip: 0, offset: 'Sedge Landing'.length });
  });
});
