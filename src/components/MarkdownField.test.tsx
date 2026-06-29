import { useState } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import MarkdownField from './MarkdownField';

// Keep Streamdown out of jsdom — the preview tab isn't exercised here.
vi.mock('@/components/game/GameText', () => ({
  GameText: ({ text }: { text: string }) => <div>{text}</div>,
}));

// Controlled wrapper, mirroring how WorldDetailsManager drives the field.
function Harness({ initial = '' }: { initial?: string }) {
  const [value, setValue] = useState(initial);
  return <MarkdownField value={value} onChange={setValue} />;
}

const textarea = () => screen.getByRole('textbox') as HTMLTextAreaElement;

describe('MarkdownField', () => {
  it('disables undo/redo until there is history', () => {
    render(<Harness />);
    expect(screen.getByLabelText('Undo')).toBeDisabled();
    expect(screen.getByLabelText('Redo')).toBeDisabled();
  });

  it('wraps the selection when a toolbar action is clicked', () => {
    render(<Harness />);
    const ta = textarea();
    fireEvent.change(ta, { target: { value: 'brave hero' } });
    ta.setSelectionRange(0, 5);
    fireEvent.click(screen.getByLabelText('Bold'));
    expect(ta.value).toBe('**brave** hero');
  });

  it('undoes and redoes a toolbar edit', () => {
    render(<Harness />);
    const ta = textarea();
    fireEvent.change(ta, { target: { value: 'brave hero' } });
    ta.setSelectionRange(0, 5);
    fireEvent.click(screen.getByLabelText('Bold'));
    expect(ta.value).toBe('**brave** hero');

    fireEvent.click(screen.getByLabelText('Undo'));
    expect(ta.value).toBe('brave hero');

    fireEvent.click(screen.getByLabelText('Redo'));
    expect(ta.value).toBe('**brave** hero');
  });

  it('undoes via the keyboard shortcut', () => {
    render(<Harness />);
    const ta = textarea();
    fireEvent.change(ta, { target: { value: 'hello' } });
    fireEvent.keyDown(ta, { key: 'z', ctrlKey: true });
    expect(ta.value).toBe('');
  });

  it('renders with an undefined value without crashing', () => {
    // value is typed string, but a migrated world can carry undefined at runtime.
    render(<MarkdownField value={undefined as unknown as string} onChange={() => {}} />);
    expect(textarea().value).toBe('');
  });
});
