import { useState } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PromptField from './PromptField';
import { plainVocabulary } from '@/lib/chipVocabulary';

vi.mock('@/components/game/MarkdownRenderer', () => ({
  MarkdownRenderer: ({ text }: { text: string }) => <div data-testid="md">{text}</div>,
}));

/** The parent owns the value, and "generate" replaces it wholesale — the shape of an AI fill, a Reset,
 *  or a template swap, all of which reach the editor as an external value change. */
function Harness({ initial }: { initial: string }) {
  const [value, setValue] = useState(initial);
  return (
    <>
      <button type="button" onClick={() => setValue('a generated summary')}>Generate</button>
      <div data-testid="value">{value}</div>
      <PromptField value={value} onChange={setValue} vocabulary={plainVocabulary()} />
    </>
  );
}

describe('PromptField history', () => {
  it.each([['an untouched empty field', ''], ['an untouched prefilled field', 'the original description']])(
    'undoes a whole-value replace on %s in one press',
    async (_name, initial) => {
      const user = userEvent.setup();
      render(<Harness initial={initial} />);

      await user.click(screen.getByText('Generate'));
      expect(screen.getByTestId('value')).toHaveTextContent('a generated summary');

      const undo = screen.getByLabelText('Undo');
      expect(undo).toBeEnabled();
      await user.click(undo);
      expect(screen.getByTestId('value').textContent).toBe(initial);
    },
  );

  it('still undoes typing', async () => {
    // The seeded baseline must not swallow ordinary edits: an empty field typed into and undone comes
    // back empty. How many keystrokes make one step is Lexical's coalescing to decide, not ours.
    const user = userEvent.setup();
    render(<Harness initial="ab" />);

    await user.click(document.querySelector('[contenteditable="true"]') as HTMLElement);
    await user.keyboard('c');
    expect(screen.getByTestId('value')).toHaveTextContent('cab');

    await user.click(screen.getByLabelText('Undo'));
    expect(screen.getByTestId('value').textContent).toBe('ab');
  });
});
