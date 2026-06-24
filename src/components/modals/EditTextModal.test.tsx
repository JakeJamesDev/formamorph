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

  it('resets the field when the text prop changes', () => {
    const { rerender } = render(
      <EditTextModal isOpen text="a" onOpenChange={() => {}} onSave={() => {}} />,
    );
    expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toBe('a');

    rerender(<EditTextModal isOpen text="b" onOpenChange={() => {}} onSave={() => {}} />);
    expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toBe('b');
  });
});
