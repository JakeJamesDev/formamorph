import { useState } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import AiFieldToolbar from './AiFieldToolbar';

// The toolbar reads a few endpoint fields off the settings context; stub them out.
vi.mock('@/contexts/SettingsContext', () => ({
  useSettings: () => ({
    activeEndpointUrl: 'http://x', activeApiToken: '', activeModelName: 'm', imageTagPrompt: 'p',
  }),
}));
// Exercise the generate path without a network call.
vi.mock('@/lib/imagePrompt', () => ({ buildImagePrompt: vi.fn(async () => 'cat, fluffy') }));

// Controlled wrapper: the toolbar and a sibling textarea share one value, mirroring the managers.
function Harness({ initial = '' }: { initial?: string }) {
  const [value, setValue] = useState(initial);
  return (
    <>
      <AiFieldToolbar mode="tags" source="a cat" value={value} onChange={setValue} name="Cat" kind="character" />
      <textarea aria-label="field" value={value} onChange={(e) => setValue(e.target.value)} />
    </>
  );
}

const field = () => screen.getByLabelText('field') as HTMLTextAreaElement;
const type = (v: string) => fireEvent.change(field(), { target: { value: v } });

describe('AiFieldToolbar', () => {
  it('disables undo/redo until there is history', () => {
    render(<Harness />);
    expect(screen.getByLabelText('Undo')).toBeDisabled();
    expect(screen.getByLabelText('Redo')).toBeDisabled();
  });

  it('undoes and redoes a manual edit linearly', () => {
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

  it('forgets the redo branch when a manual edit follows an undo', () => {
    render(<Harness />);
    type('first');
    fireEvent.click(screen.getByLabelText('Undo'));
    expect(screen.getByLabelText('Redo')).toBeEnabled();

    type('second'); // branches off the undone state
    expect(screen.getByLabelText('Redo')).toBeDisabled();
    fireEvent.click(screen.getByLabelText('Undo'));
    expect(field().value).toBe('');
  });

  it('commits a generation as a discrete undoable step', async () => {
    render(<Harness initial="seed" />);
    fireEvent.click(screen.getByTitle(/Generate image tags/));
    await waitFor(() => expect(field().value).toBe('cat, fluffy'));

    fireEvent.click(screen.getByLabelText('Undo'));
    expect(field().value).toBe('seed');
  });
});
