import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import ChipInput from './ChipInput';
import { placeholderVocabulary } from '@/lib/chipVocabulary';
import { fieldUndoAt } from '@/lib/fieldUndo';

const vocabulary = placeholderVocabulary([]);

describe('ChipInput history', () => {
  it('has nothing to undo after a value that arrived on its own', async () => {
    // A world still loading hands the field its text after mount. That is not an edit, so Undo would
    // otherwise wipe the field back to the empty box it rendered for one tick.
    const { rerender } = render(<ChipInput value="" onChange={vi.fn()} vocabulary={vocabulary} ariaLabel="Alias" />);
    rerender(<ChipInput value="loaded name" onChange={vi.fn()} vocabulary={vocabulary} ariaLabel="Alias" />);

    const field = screen.getByLabelText('Alias');
    await waitFor(() => expect(field.textContent).toBe('loaded name'));
    expect(fieldUndoAt(field)?.canUndo()).toBe(false);
  });
});
