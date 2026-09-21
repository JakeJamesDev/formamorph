import { useState } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import PromptField from './PromptField';
import { promptVocabulary, type ChipVocabulary } from '@/lib/chipVocabulary';
import { PROMPT_KIND_VARIABLES } from '@/lib/promptVariables';
import { CHIP_DRAG_MIME } from './chipDragSource';

vi.mock('@/components/game/MarkdownRenderer', () => ({
  MarkdownRenderer: ({ text }: { text: string }) => <div>{text}</div>,
}));

function Harness({
  initial,
  vocabulary = promptVocabulary(PROMPT_KIND_VARIABLES.narration),
  readOnly = false,
}: {
  initial: string;
  vocabulary?: ChipVocabulary;
  readOnly?: boolean;
}) {
  const [value, setValue] = useState(initial);
  return (
    <>
      <PromptField
        value={value}
        onChange={setValue}
        vocabulary={vocabulary}
        insertTrigger="<"
        readOnly={readOnly}
      />
      <output data-testid="value">{value}</output>
    </>
  );
}

function editor(): HTMLElement {
  return document.querySelector('[contenteditable="true"]') as HTMLElement;
}

function textNode(text: string): Text {
  const walker = document.createTreeWalker(editor(), NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (node.textContent?.includes(text)) return node as Text;
  }
  throw new Error(`Text not found: ${text}`);
}

function aimAfter(text: string): void {
  Object.defineProperty(document, 'caretRangeFromPoint', {
    configurable: true,
    value: () => {
      const node = textNode(text);
      const range = document.createRange();
      range.setStart(node, (node.textContent?.indexOf(text) ?? 0) + text.length);
      range.collapse(true);
      return range;
    },
  });
}

function transfer(payload: Record<string, string> = {}) {
  const data = new Map(Object.entries(payload));
  return {
    types: [...data.keys()],
    effectAllowed: 'none',
    dropEffect: 'none',
    getData: (type: string) => data.get(type) ?? '',
    setData(type: string, value: string) {
      data.set(type, value);
      if (!this.types.includes(type)) this.types.push(type);
    },
    setDragImage: vi.fn(),
  };
}

afterEach(() => {
  Reflect.deleteProperty(document, 'caretRangeFromPoint');
});

describe('ChipDragPlugin', () => {
  it('copies a palette payload at the browser caret', async () => {
    render(<Harness initial="Before" />);
    aimAfter('Before');
    const dataTransfer = transfer({ [CHIP_DRAG_MIME]: '<PERSONA>' });

    fireEvent.dragOver(editor(), { clientX: 1, clientY: 1, dataTransfer });
    fireEvent.drop(editor(), { clientX: 1, clientY: 1, dataTransfer });

    await waitFor(() => expect(screen.getByTestId('value')).toHaveTextContent('Before<PERSONA>'));
    expect(editor().querySelectorAll('[data-chip-token]')).toHaveLength(1);
  });

  it('moves the parked placement without changing its token', async () => {
    render(<Harness initial="<PERSONA>Before" />);
    aimAfter('Before');
    const source = editor().querySelector('[draggable="true"]') as HTMLElement;
    const dataTransfer = transfer();

    fireEvent.dragStart(source, { dataTransfer });
    fireEvent.dragOver(editor(), { clientX: 1, clientY: 1, dataTransfer });
    fireEvent.drop(editor(), { clientX: 1, clientY: 1, dataTransfer });

    await waitFor(() => expect(screen.getByTestId('value')).toHaveTextContent('Before<PERSONA>'));
    expect(editor().querySelectorAll('[data-chip-token]')).toHaveLength(1);
    expect(editor().querySelector('[data-chip-token]')).toHaveAttribute('data-chip-token', '<PERSONA>');
  });

  it('rejects a palette token the destination vocabulary refuses', async () => {
    const vocabulary: ChipVocabulary = {
      ...promptVocabulary(PROMPT_KIND_VARIABLES.narration),
      acceptsPaletteToken: () => false,
    };
    render(<Harness initial="Before" vocabulary={vocabulary} />);
    aimAfter('Before');
    const dataTransfer = transfer({ [CHIP_DRAG_MIME]: '<PERSONA>' });

    fireEvent.dragOver(editor(), { clientX: 1, clientY: 1, dataTransfer });
    fireEvent.drop(editor(), { clientX: 1, clientY: 1, dataTransfer });

    await waitFor(() => expect(screen.getByTestId('value')).toHaveTextContent('Before'));
    expect(editor().querySelectorAll('[data-chip-token]')).toHaveLength(0);
  });

  it('does not dispatch a palette drop through a read-only Lexical editor', () => {
    render(<Harness initial="Before" readOnly />);
    const root = document.querySelector('[contenteditable="false"]') as HTMLElement;
    const dataTransfer = transfer({ [CHIP_DRAG_MIME]: '<PERSONA>' });

    fireEvent.dragOver(root, { clientX: 1, clientY: 1, dataTransfer });
    fireEvent.drop(root, { clientX: 1, clientY: 1, dataTransfer });

    expect(screen.getByTestId('value')).toHaveTextContent('Before');
    expect(root.querySelectorAll('[data-chip-token]')).toHaveLength(0);
  });
});
