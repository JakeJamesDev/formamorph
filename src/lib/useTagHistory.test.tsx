import { useState } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { useTagHistory } from '@/lib/useTagHistory';
import TagHistoryButtons from '@/components/TagHistoryButtons';
import AiGenerateButton from '@/components/AiGenerateButton';

vi.mock('@/contexts/SettingsContext', () => ({
  useSettings: () => ({
    activeEndpointUrl: 'http://x', activeApiToken: '', activeModelName: 'm', imageTagPrompt: 'p',
  }),
}));
// Exercise the generate path without a network call.
vi.mock('@/lib/imagePrompt', () => ({ buildImagePrompt: vi.fn(async () => 'cat, fluffy') }));

/** Mirrors the real arrangement: a plain controlled tag input, with the history and the generate button
 *  sharing its value through the parent. */
function Harness({ initial = '' }: { initial?: string }) {
  const [value, setValue] = useState(initial);
  const history = useTagHistory(value, setValue);
  return (
    <>
      <TagHistoryButtons history={history} />
      <AiGenerateButton mode="tags" source="a cat" onChange={setValue} kind="character" />
      <textarea aria-label="field" value={value} onChange={(e) => setValue(e.target.value)} />
    </>
  );
}

const field = () => screen.getByLabelText('field') as HTMLTextAreaElement;
const type = (v: string) => fireEvent.change(field(), { target: { value: v } });

describe('useTagHistory', () => {
  it('disables undo/redo until there is history', () => {
    render(<Harness />);
    expect(screen.getByLabelText('Undo')).toBeDisabled();
    expect(screen.getByLabelText('Redo')).toBeDisabled();
  });

  it('undoes and redoes an edit linearly', () => {
    render(<Harness />);
    type('brave hero');
    expect(screen.getByLabelText('Undo')).toBeEnabled();

    fireEvent.click(screen.getByLabelText('Undo'));
    expect(field().value).toBe('');
    expect(screen.getByLabelText('Redo')).toBeEnabled();

    fireEvent.click(screen.getByLabelText('Redo'));
    expect(field().value).toBe('brave hero');
    expect(screen.getByLabelText('Redo')).toBeDisabled();
  });

  it('forgets the redo branch when an edit follows an undo', () => {
    render(<Harness />);
    type('first');
    fireEvent.click(screen.getByLabelText('Undo'));
    expect(screen.getByLabelText('Redo')).toBeEnabled();

    type('second'); // branches off the undone state
    expect(screen.getByLabelText('Redo')).toBeDisabled();
    fireEvent.click(screen.getByLabelText('Undo'));
    expect(field().value).toBe('');
  });

  it('commits a generation as one step', async () => {
    render(<Harness initial="seed" />);
    fireEvent.click(screen.getByLabelText('Generate image tags'));
    await waitFor(() => expect(field().value).toBe('cat, fluffy'));

    fireEvent.click(screen.getByLabelText('Undo'));
    expect(field().value).toBe('seed');
  });

  it('steps by tag: one undo removes the tag just added, not the letters', () => {
    render(<Harness initial="cat" />);
    type('cat, f');
    type('cat, fl');
    type('cat, fluffy'); // still one tag added, typed letter by letter

    fireEvent.click(screen.getByLabelText('Undo'));
    expect(field().value).toBe('cat');
  });

  it('treats removing a tag as its own step', () => {
    render(<Harness initial="cat, fluffy" />);
    type('cat');
    fireEvent.click(screen.getByLabelText('Undo'));
    expect(field().value).toBe('cat, fluffy');
  });

  it('does not open a step for spacing that leaves the tags unchanged', () => {
    render(<Harness initial="cat, fluffy" />);
    type('cat,fluffy');
    type('cat,  fluffy');
    expect(screen.getByLabelText('Undo')).toBeDisabled();
  });
});
