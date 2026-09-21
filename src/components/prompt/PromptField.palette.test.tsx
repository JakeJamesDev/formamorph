import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import PromptField from './PromptField';
import { PROMPT_KIND_VARIABLES } from '@/lib/promptVariables';
import { CHIP_DRAG_MIME } from './chipDragSource';

vi.mock('@/components/game/MarkdownRenderer', () => ({
  MarkdownRenderer: ({ text }: { text: string }) => <div>{text}</div>,
}));

function Field({ name }: { name: string }) {
  const [value, setValue] = useState('Before');
  return <section aria-label={name}>
    <PromptField value={value} onChange={setValue} variables={PROMPT_KIND_VARIABLES.narration} ariaLabel={name} />
    <output>{value}</output>
  </section>;
}

function transfer() {
  const data = new Map<string, string>();
  return {
    get types() { return [...data.keys()]; },
    effectAllowed: 'none', dropEffect: 'none',
    setData: (type: string, value: string) => { data.set(type, value); },
    getData: (type: string) => data.get(type) ?? '',
    setDragImage: vi.fn(),
  };
}

// Geometry belongs to the browser contract; this test isolates destination eligibility.
function aimAtEnd(root: HTMLElement) {
  Object.defineProperty(document, 'caretRangeFromPoint', { configurable: true, value: () => {
    const text = root.querySelector('[data-lexical-text]')!.firstChild!;
    const range = document.createRange();
    range.setStart(text, text.textContent!.length);
    range.collapse(true);
    return range;
  } });
}

afterEach(() => { Reflect.deleteProperty(document, 'caretRangeFromPoint'); });

describe('PromptField palette ownership', () => {
  it('rejects a toolbar drag into another prompt field, then accepts it in its own field', async () => {
    render(<><Field name="First" /><Field name="Second" /></>);
    const first = screen.getByRole('region', { name: 'First' });
    const second = screen.getByRole('region', { name: 'Second' });
    const source = within(first).getByRole('button', { name: 'Persona' });
    const ownEditor = within(first).getByRole('textbox');
    const otherEditor = within(second).getByRole('textbox');
    const dataTransfer = transfer();
    fireEvent.dragStart(source, { dataTransfer });
    aimAtEnd(otherEditor);
    fireEvent.dragOver(otherEditor, { dataTransfer });
    fireEvent.drop(otherEditor, { dataTransfer });
    await waitFor(() => expect(within(second).getByRole('status').textContent).toBe('Before'));
    expect(document.querySelector('[data-chip-drop-caret][style*="display: block"]')).toBeNull();

    aimAtEnd(ownEditor);
    fireEvent.dragOver(ownEditor, { dataTransfer });
    fireEvent.drop(ownEditor, { dataTransfer });
    fireEvent.dragEnd(source, { dataTransfer });
    await waitFor(() => expect(within(first).getByRole('status').textContent).toBe('Before<PERSONA>'));
    expect(within(second).getByRole('status').textContent).toBe('Before');
  });

  it('rejects an unscoped palette even when its token belongs to the prompt family', async () => {
    render(<Field name="Prompt" />);
    const root = screen.getByRole('textbox');
    aimAtEnd(root);
    const dataTransfer = transfer();
    dataTransfer.setData(CHIP_DRAG_MIME, '<PERSONA>');
    await act(async () => {
      fireEvent.dragOver(root, { dataTransfer });
      fireEvent.drop(root, { dataTransfer });
    });
    expect(screen.getByRole('status').textContent).toBe('Before');
    expect(document.querySelector('[data-chip-drop-caret][style*="display: block"]')).toBeNull();
  });
});
