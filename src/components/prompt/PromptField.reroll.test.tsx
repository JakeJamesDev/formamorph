import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PromptField from './PromptField';
import { placeholderVocabulary } from '@/lib/chipVocabulary';
import { encodePlaceholderToken } from '@/lib/placeholders';
import { phValues } from '@/test/placeholderValues';
import type { Placeholder } from '@/types';

vi.mock('@/components/game/MarkdownRenderer', () => ({
  MarkdownRenderer: ({ text }: { text: string }) => <div data-testid="md">{text}</div>,
}));

const town: Placeholder = { id: 'town', name: 'Town', values: phValues(['Sedge', 'Marrow']) };
const chip = encodePlaceholderToken({ id: 'town', mode: 'world', placementId: 'p1' });
const vocab = placeholderVocabulary([town]);

const reroll = () => screen.queryByLabelText('Reroll placeholders');

describe('PromptField reroll', () => {
  it('offers Reroll only while the text holds a placeholder', () => {
    const { rerender } = render(
      <PromptField value="plain text" onChange={() => {}} vocabulary={vocab} previewValues={{}} onReroll={() => {}} />,
    );
    expect(reroll()).toBeNull();
    rerender(
      <PromptField value={`Welcome to ${chip}`} onChange={() => {}} vocabulary={vocab} previewValues={{}} onReroll={() => {}} />,
    );
    expect(reroll()).toBeInTheDocument();
  });

  it('is absent from a field with nothing to redraw, chip or no chip', () => {
    render(<PromptField value={`Welcome to ${chip}`} onChange={() => {}} vocabulary={vocab} previewValues={{}} />);
    expect(reroll()).toBeNull();
  });

  it('calls the reroll, and sits left of undo behind its own separator', async () => {
    const onReroll = vi.fn();
    render(<PromptField value={chip} onChange={() => {}} vocabulary={vocab} previewValues={{}} onReroll={onReroll} />);
    const button = reroll() as HTMLElement;
    await userEvent.click(button);
    expect(onReroll).toHaveBeenCalledTimes(1);
    const undo = screen.getByLabelText('Undo');
    expect(button.compareDocumentPosition(undo) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    // A hairline rule stands between the two groups.
    const between = button.nextElementSibling as HTMLElement;
    expect(between.className).toContain('w-hairline');
  });
});
