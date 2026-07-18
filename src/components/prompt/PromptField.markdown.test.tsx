import { useState } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
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
    expect(screen.getByLabelText('Heading 2')).toBeInTheDocument();
    unmount();
    render(<Harness />);
    expect(screen.queryByLabelText('Bold')).not.toBeInTheDocument();
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
});
