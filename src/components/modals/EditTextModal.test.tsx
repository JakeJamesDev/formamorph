import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { EditTextModal } from './EditTextModal';

describe('EditTextModal', () => {
  it('shows the current text and saves edits, then closes', () => {
    const onSave = vi.fn();
    const onOpenChange = vi.fn();
    render(<EditTextModal isOpen text="hello" onOpenChange={onOpenChange} onSave={onSave} />);

    const box = screen.getByRole('textbox') as HTMLTextAreaElement;
    expect(box.value).toBe('hello');

    fireEvent.change(box, { target: { value: 'hello world' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(onSave).toHaveBeenCalledWith('hello world');
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('cancel closes without saving', () => {
    const onSave = vi.fn();
    const onOpenChange = vi.fn();
    render(<EditTextModal isOpen text="hi" onOpenChange={onOpenChange} onSave={onSave} />);

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onSave).not.toHaveBeenCalled();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('reseeds from text on each open, discarding edits abandoned on a prior open', () => {
    // Cancel + reopen the SAME text (prop unchanged) must clear the abandoned edit — the bug was reseeding
    // only when `text` changed, so a same-text reopen kept the discarded draft.
    const { rerender } = render(
      <EditTextModal isOpen text="a" onOpenChange={() => {}} onSave={() => {}} />,
    );
    const box = () => screen.getByRole('textbox') as HTMLTextAreaElement;
    fireEvent.change(box(), { target: { value: 'abandoned edit' } });

    rerender(<EditTextModal isOpen={false} text="a" onOpenChange={() => {}} onSave={() => {}} />); // close
    rerender(<EditTextModal isOpen text="a" onOpenChange={() => {}} onSave={() => {}} />); // reopen, same text
    expect(box().value).toBe('a'); // reseeded, not the abandoned edit
  });
});
