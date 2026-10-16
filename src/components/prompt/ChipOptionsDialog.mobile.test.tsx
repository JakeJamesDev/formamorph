import { useState } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PromptField from './PromptField';
import { promptVocabulary } from '@/lib/chipVocabulary';

vi.mock('@/lib/useIsMobile', () => ({ useIsMobile: () => true }));

const vocabulary = promptVocabulary([]);

function Field({ onRequestFullscreen }: { onRequestFullscreen: () => void }) {
  const [value, setValue] = useState('<ENTITIES>');
  return <PromptField value={value} onChange={setValue} vocabulary={vocabulary} onRequestFullscreen={onRequestFullscreen} />;
}

describe('Chip Options on a mobile inline field', () => {
  it('keeps a press inside the dialog from asking the field for full screen', async () => {
    const user = userEvent.setup();
    const onRequestFullscreen = vi.fn();
    render(<Field onRequestFullscreen={onRequestFullscreen} />);
    await user.click(document.querySelector<HTMLElement>('[data-chip]')!);
    const asked = onRequestFullscreen.mock.calls.length;
    const options = screen.getByRole('dialog', { name: 'Chip Options' });
    await user.click(within(options).getByRole('radio', { name: 'Summary' }));
    await user.click(within(options).getByRole('radio', { name: 'XML' }));
    expect(onRequestFullscreen).toHaveBeenCalledTimes(asked);
  });
});
