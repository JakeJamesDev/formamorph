import { describe, it, expect, vi } from 'vitest';
import leavePrompt from './leavePrompt.cjs';

const { confirmLeave } = leavePrompt;

const run = (choice) => {
  const dialog = { showMessageBoxSync: vi.fn(() => choice) };
  const event = { preventDefault: vi.fn() };
  confirmLeave({}, dialog)(event);
  return { dialog, event };
};

describe('the window leave prompt', () => {
  it('lets the window close when the author picks Leave', () => {
    const { event } = run(0);
    // preventDefault is what overrides the page's cancel; without it the window stays open.
    expect(event.preventDefault).toHaveBeenCalledOnce();
  });

  it('keeps the window open when the author picks Stay', () => {
    const { event } = run(1);
    expect(event.preventDefault).not.toHaveBeenCalled();
  });

  it('makes Stay the default and the Esc choice', () => {
    const { dialog } = run(1);
    // A stray Enter or Esc must never throw away the edits.
    expect(dialog.showMessageBoxSync).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ defaultId: 1, cancelId: 1 }));
  });

  it('asks on the window that is closing', () => {
    const win = {};
    const dialog = { showMessageBoxSync: vi.fn(() => 1) };
    confirmLeave(win, dialog)({ preventDefault: vi.fn() });
    expect(dialog.showMessageBoxSync).toHaveBeenCalledWith(win, expect.objectContaining({ buttons: ['Leave', 'Stay'] }));
  });
});
