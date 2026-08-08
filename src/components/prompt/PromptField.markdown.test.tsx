import { useState } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PromptField from './PromptField';
import { plainVocabulary } from '@/lib/chipVocabulary';

// Keep Streamdown out of jsdom — the preview's text mapping is covered in promptFieldState.test.ts.
vi.mock('@/components/game/MarkdownRenderer', () => ({
  MarkdownRenderer: ({ text }: { text: string }) => <div data-testid="md">{text}</div>,
}));

// The markdown transforms themselves are unit-tested against a headless editor in promptFieldState.test.ts
// (jsdom can't drive a real Lexical selection). These cover the wiring the `markdown` prop turns on.
function Harness({ markdown }: { markdown?: boolean }) {
  const [value, setValue] = useState('');
  return <PromptField value={value} onChange={setValue} vocabulary={plainVocabulary()} markdown={markdown} />;
}

describe('PromptField (markdown wiring)', () => {
  it('shows the formatting toolbar only when markdown is on', () => {
    const { unmount } = render(<Harness markdown />);
    expect(screen.getByLabelText('Bold')).toBeInTheDocument();
    // Headings/lists/inserts sit behind split buttons: the face is the group's default action.
    expect(screen.getByLabelText('Heading 1')).toBeInTheDocument();
    expect(screen.getByLabelText('Heading level')).toBeInTheDocument();
    expect(screen.queryByLabelText('Heading 2')).not.toBeInTheDocument();
    unmount();
    render(<Harness />);
    expect(screen.queryByLabelText('Bold')).not.toBeInTheDocument();
  });

  it('opens a split-button menu on click and keeps it open after the press ends', async () => {
    // It used to toggle on mousedown as well as the trigger's own click, so it opened on press and
    // closed on release — a menu that only exists while a finger is held down.
    const user = userEvent.setup();
    render(<Harness markdown />);
    const chevron = screen.getByLabelText('Heading level');

    await user.click(chevron);
    expect(await screen.findByText('Heading 3')).toBeInTheDocument();

    await user.click(chevron);
    await waitFor(() => expect(screen.queryByText('Heading 3')).not.toBeInTheDocument());
  });

  it('offers a Preview tab even with no placeholders to resolve', () => {
    // A markdown field always has something to preview (the rendered prose), unlike a plain chip field.
    render(<Harness markdown />);
    expect(screen.getByRole('tab', { name: 'Preview' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Edit' })).toBeInTheDocument();
  });

  it('keeps the tabs off a non-markdown field with nothing to preview', () => {
    render(<Harness />);
    expect(screen.queryByRole('tab', { name: 'Preview' })).not.toBeInTheDocument();
  });

  it('disables undo/redo until there is history', () => {
    render(<Harness markdown />);
    expect(screen.getByLabelText('Undo')).toBeDisabled();
    expect(screen.getByLabelText('Redo')).toBeDisabled();
  });

  it('offers undo/redo on a plain prompt field too, not only a markdown one', () => {
    // The keyboard shortcuts always worked here; without buttons nothing said so.
    render(<Harness />);
    expect(screen.getByLabelText('Undo')).toBeInTheDocument();
    expect(screen.getByLabelText('Redo')).toBeInTheDocument();
    expect(screen.queryByLabelText('Bold')).not.toBeInTheDocument();
  });

  it('shows exactly one undo and one redo button on a markdown field', () => {
    // They used to live inside the markdown toolbar; moving them to the chrome row must not leave a pair.
    render(<Harness markdown />);
    expect(screen.getAllByLabelText('Undo')).toHaveLength(1);
    expect(screen.getAllByLabelText('Redo')).toHaveLength(1);
  });
});
