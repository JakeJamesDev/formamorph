import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { EditTextModal } from './EditTextModal';

// The editing surface is a Lexical field whose caret jsdom cannot drive; these cases are about the modal's
// own contract (seed, save, cancel, reseed), so it stands in as a textarea that records its props. The
// field itself: prompt/PromptField.markdown.test.tsx.
const fieldProps = vi.hoisted(() => ({ current: null as Record<string, unknown> | null }));
vi.mock('@/components/prompt/PromptField', () => ({
  default: (props: { value: string; onChange: (v: string) => void; ariaLabel?: string }) => {
    fieldProps.current = props;
    return <textarea aria-label={props.ariaLabel} value={props.value} onChange={(e) => props.onChange(e.target.value)} />;
  },
}));

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

  it('asks for the markdown editor, and for a vocabulary that chips nothing', () => {
    // Narration is prose: a brace the AI wrote must stay text rather than becoming a variable chip.
    render(<EditTextModal isOpen text="a {thing} b" onOpenChange={() => {}} onSave={() => {}} />);

    expect(fieldProps.current?.markdown).toBe(true);
    const parse = (fieldProps.current?.vocabulary as { parse: (v: string) => { type: string }[] }).parse;
    expect(parse('a {thing} b').every((s) => s.type === 'text')).toBe(true);
  });

  it('opens at one size whatever the turn is, and lets the editor scroll inside it', () => {
    // A `max-h` would size the window to the text, so a long turn and a short one opened different boxes.
    // Pinning the height and giving the field a `min-h-0` growth slot is what pushes the overflow into the
    // editor's own scroller instead.
    render(<EditTextModal isOpen text="a" onOpenChange={() => {}} onSave={() => {}} />);

    expect(screen.getByRole('dialog').className).toContain('h-[85dvh]');
    expect(screen.getByRole('dialog').className).not.toContain('max-h-');
    expect(fieldProps.current?.className).toBe('flex-grow min-h-0');
  });

  it('grows the dialog itself for fullscreen instead of raising a second overlay', () => {
    // A field-owned overlay would sit on top of Save and Cancel.
    render(<EditTextModal isOpen text="a" onOpenChange={() => {}} onSave={() => {}} />);
    const dialog = () => screen.getByRole('dialog');
    expect(dialog().className).toContain('sm:max-w-[760px]');

    act(() => { (fieldProps.current?.onRequestFullscreen as () => void)(); });
    expect(dialog().className).toContain('w-screen');
    expect(fieldProps.current?.fullscreen).toBe(true);
    expect(screen.getByRole('button', { name: 'Save' })).toBeVisible();
  });
});
