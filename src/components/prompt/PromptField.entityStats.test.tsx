import { useState } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PromptField from './PromptField';
import { promptVocabulary } from '@/lib/chipVocabulary';

function Field({ initial, onChange }: { initial: string; onChange: (value: string) => void }) {
  const [value, setValue] = useState(initial);
  return <PromptField value={value} onChange={(next) => { setValue(next); onChange(next); }} vocabulary={promptVocabulary([])} />;
}

// Stats appears under Only With and Include; the Include one writes the stats pieces.
const statsBox = () => within(screen.getByRole('group', { name: 'Include' })).getByRole('checkbox', { name: 'Stats' });

describe('the Entities chip’s Stats checkbox', () => {
  it('is checked on a bare token and writes `nostats` when cleared', async () => {
    const onChange = vi.fn();
    const { container } = render(<Field initial="<ENTITIES>" onChange={onChange} />);
    await userEvent.click(container.querySelector('[data-chip-token]')!);
    const box = statsBox();
    expect(box).toBeChecked();
    expect(box).toBeEnabled();
    await userEvent.click(box);
    await waitFor(() => expect(onChange).toHaveBeenLastCalledWith('<ENTITIES|nostats>'));
    await waitFor(() => expect(statsBox()).not.toBeChecked());
  });

  it('reads as cleared on a `nostats` token and drops the id when checked again', async () => {
    const onChange = vi.fn();
    const { container } = render(<Field initial="<ENTITIES|inscene.nostats.markdown>" onChange={onChange} />);
    await userEvent.click(container.querySelector('[data-chip-token]')!);
    const box = statsBox();
    expect(box).not.toBeChecked();
    await userEvent.click(box);
    await waitFor(() => expect(onChange).toHaveBeenLastCalledWith('<ENTITIES|inscene.markdown>'));
  });

  it('does not count toward the Stats chip’s last-piece lock', async () => {
    const { container } = render(<Field initial="<STATS DESCRIPTION|numbers>" onChange={() => {}} />);
    await userEvent.click(container.querySelector('[data-chip-token]')!);
    expect(screen.getByRole('checkbox', { name: /Range/ })).toBeDisabled();
  });
});

describe('the Persona chip’s Stats checkbox', () => {
  it('is checked on a saved token and writes `nostats` when cleared', async () => {
    const onChange = vi.fn();
    const { container } = render(<Field initial={'<PERSONA|summary.markdown|header="{{user}} (Player Character)">'} onChange={onChange} />);
    await userEvent.click(container.querySelector('[data-chip-token]')!);
    const box = statsBox();
    expect(box).toBeChecked();
    await userEvent.click(box);
    await waitFor(() => expect(onChange).toHaveBeenLastCalledWith('<PERSONA|summary.nostats.markdown|header="{{user}} (Player Character)">'));
  });
});
