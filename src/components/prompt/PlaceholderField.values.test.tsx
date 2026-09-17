import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PlaceholderField from './PlaceholderField';
import PromptField from './PromptField';
import { anchorElements, PROMPT_ANCHORS } from './previewScrollSync';
import { EditorPreviewRollsProvider } from '@/contexts/EditorPreviewRollsContext';
import { PlaceholderStoreProvider, placeholderStore } from '@/contexts/PlaceholderStoreContext';
import { placeholderVocabulary } from '@/lib/chipVocabulary';
import { encodePlaceholderToken } from '@/lib/placeholders';
import { phValues } from '@/test/placeholderValues';
import type { Placeholder } from '@/types';

vi.mock('@/components/game/MarkdownRenderer', () => ({
  MarkdownRenderer: ({ text }: { text: string }) => <div data-testid="md">{text}</div>,
}));

const mobile = vi.hoisted(() => ({ value: false }));
vi.mock('@/lib/useIsMobile', () => ({ useIsMobile: () => mobile.value }));

const tok = (id: string, placementId: string) => encodePlaceholderToken({ id, mode: 'world', placementId });

const town: Placeholder = { id: 'town', name: 'Town', values: phValues(['Sedge Landing', 'Marrow', 'Harrow Point']) };
const hair: Placeholder = { id: 'hair', name: 'Hair', values: phValues(['silver']) };
// A value holding a chip: the Values tab shows the chip, not the text it resolves to.
const look: Placeholder = { id: 'look', name: 'Look', values: phValues([`${tok('hair', 'n1')} braids`]) };
const WORLD = [town, hair, look];

const tab = (name: string) => screen.queryByRole('tab', { name });
const openValues = () => Array.from(document.querySelectorAll<HTMLElement>('[data-open-value]'));
// Lexical sets the value island's property, which jsdom does not reflect to the attribute.
const slotEditable = () => openValues()[0].querySelector<HTMLElement>('[data-lexical-slot]')?.contentEditable;
const valueText = (el: HTMLElement) => el.querySelector('[data-open-value-text]')?.textContent ?? '';

function field(value: string, props: { placeholders?: Placeholder[]; onChange?: (v: string) => void } = {}) {
  return (
    <EditorPreviewRollsProvider>
      <PlaceholderField value={value} onChange={props.onChange ?? (() => {})} placeholders={props.placeholders ?? WORLD} />
    </EditorPreviewRollsProvider>
  );
}

beforeEach(() => {
  mobile.value = false;
  localStorage.clear();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('the Values tab gates', () => {
  it('sits between Edit and Preview, disabled until the text holds a chip', () => {
    const { rerender } = render(field('no chips yet'));
    expect(screen.getAllByRole('tab').map((t) => t.textContent)).toEqual(['Edit', 'Values', 'Preview']);
    expect(tab('Values')).toBeDisabled();
    rerender(field(`Welcome to ${tok('town', 'p1')}.`));
    expect(tab('Values')).toBeEnabled();
  });

  it('is absent when the world has no placeholders', () => {
    render(field(`Welcome to ${tok('town', 'p1')}.`, { placeholders: [] }));
    expect(tab('Values')).toBeNull();
  });

  it('is absent on a prompt field', () => {
    render(<PromptField value="<LOCATION>" onChange={() => {}} previewValues={{ '<LOCATION>': 'here' }} />);
    expect(tab('Preview')).toBeInTheDocument();
    expect(tab('Values')).toBeNull();
  });

  it('lands on Edit when the last chip leaves the text', async () => {
    const { rerender } = render(field(`Welcome to ${tok('town', 'p1')}.`));
    await userEvent.click(tab('Values')!);
    expect(tab('Values')).toHaveAttribute('data-state', 'active');
    rerender(field('Welcome.'));
    expect(tab('Values')).toBeDisabled();
    expect(tab('Edit')).toHaveAttribute('data-state', 'active');
    expect(openValues()).toEqual([]);
  });
});

describe('the Values tab content', () => {
  it('opens every chip on the value the Preview shows, between the field text', async () => {
    const text = `Welcome to ${tok('town', 'p1')}, said ${tok('hair', 'p2')}.`;
    render(field(text));
    await userEvent.click(tab('Preview')!);
    const shown = Array.from(screen.getByTestId('prompt-preview').querySelectorAll('mark')).map((m) => m.textContent);

    await userEvent.click(tab('Values')!);
    const open = openValues();
    expect(open.map(valueText)).toEqual(shown);
    expect(within(open[0]).getByText(/Town/)).toBeInTheDocument();
    const editor = screen.getByRole('textbox');
    expect(editor.textContent).toMatch(/^Welcome to .*, said .*\.$/);
  });

  it('shows a chip inside a value as a chip', async () => {
    render(field(`She has ${tok('look', 'p1')}.`));
    await userEvent.click(tab('Values')!);
    const [open] = openValues();
    expect(valueText(open)).toBe('Hair braids');
    expect(open.querySelector('[data-open-value-text] [data-lexical-decorator]')).not.toBeNull();
    // The split's scroll sync pairs field chips with preview marks; the nested chip has no mark.
    expect(anchorElements(screen.getByRole('textbox'), PROMPT_ANCHORS.edit)).toHaveLength(1);
  });

  it('never changes the stored text, and a round trip ends where it began', async () => {
    const onChange = vi.fn();
    const text = `Welcome to ${tok('town', 'p1')}.`;
    render(field(text, { onChange }));
    await userEvent.click(tab('Values')!);
    await userEvent.click(tab('Preview')!);
    await userEvent.click(tab('Values')!);
    await userEvent.click(tab('Edit')!);
    expect(onChange).not.toHaveBeenCalled();
    expect(openValues()).toEqual([]);
    expect(screen.getByRole('textbox').textContent).toBe('Welcome to Town.');
  });

  it('takes typing in the field text and in each open value', async () => {
    // A value takes typing only where a store can take its edit, as the World Editor's does.
    render(
      <PlaceholderStoreProvider value={placeholderStore(WORLD, () => {})}>
        {field(`Welcome to ${tok('town', 'p1')}.`)}
      </PlaceholderStoreProvider>,
    );
    await userEvent.click(tab('Values')!);
    expect(screen.getByRole('textbox')).toHaveAttribute('contenteditable', 'true');
    expect(slotEditable()).toBe('true');
  });

  it('takes no typing anywhere on a read-only field', async () => {
    render(
      <EditorPreviewRollsProvider>
        <PlaceholderField value={`Welcome to ${tok('town', 'p1')}.`} onChange={() => {}} placeholders={WORLD} readOnly />
      </EditorPreviewRollsProvider>,
    );
    await userEvent.click(tab('Values')!);
    expect(screen.getByRole('textbox')).toHaveAttribute('contenteditable', 'false');
    expect(slotEditable()).toBe('false');
  });
});

describe('the Values tab in split and swipe layouts', () => {
  const vocab = placeholderVocabulary(WORLD);
  const chip = tok('town', 'p1');
  const fullscreenField = () => (
    <PromptField
      value={`Welcome to ${chip}.`}
      onChange={() => {}}
      vocabulary={vocab}
      previewValues={{ [chip]: 'Marrow' }}
      openValues={{ [chip]: { text: 'Marrow', label: 'Value 2' } }}
      fullscreen
      onRequestFullscreen={() => {}}
    />
  );

  it('lets Values take the Edit seat beside Preview', async () => {
    localStorage.setItem('FORMAMORPH_promptSplitMode', 'split');
    render(fullscreenField());
    expect(screen.getByTestId('prompt-preview')).toBeInTheDocument();
    expect(tab('Preview')).toBeNull();
    await userEvent.click(tab('Values')!);
    expect(openValues().map(valueText)).toEqual(['Marrow']);
    expect(screen.getByTestId('prompt-preview')).toBeInTheDocument();
  });

  it('swipes through Edit, Values and Preview with three dots', () => {
    mobile.value = true;
    vi.stubGlobal('innerWidth', 375);
    render(fullscreenField());
    expect(document.querySelectorAll('[data-swipe-dot]')).toHaveLength(3);
    const pane = () => screen.getByRole('tabpanel');
    const swipe = (from: number, to: number) => {
      fireEvent.touchStart(pane(), { touches: [{ clientX: from }] });
      fireEvent.touchEnd(pane(), { changedTouches: [{ clientX: to }] });
    };
    swipe(300, 100);
    expect(openValues()).toHaveLength(1);
    swipe(300, 100);
    expect(screen.getByTestId('prompt-preview')).toBeInTheDocument();
    swipe(100, 300);
    expect(openValues()).toHaveLength(1);
    swipe(100, 300);
    expect(openValues()).toEqual([]);
    expect(screen.queryByTestId('prompt-preview')).toBeNull();
  });
});
