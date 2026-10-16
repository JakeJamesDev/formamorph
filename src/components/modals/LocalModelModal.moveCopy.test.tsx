import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { toast } from 'react-toastify';
import { MoveModelsDialog, type MoveFlow } from './LocalModelModal';

vi.mock('react-toastify', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const flow: MoveFlow = {
  phase: 'result',
  from: 'C:\\old',
  result: { moved: [], skipped: [{ file: 'a.gguf', reason: 'in use' }], canceled: false },
};

const open = (writeText: () => Promise<void>) => {
  vi.stubGlobal('navigator', { clipboard: { writeText } });
  render(<MoveModelsDialog flow={flow} onMove={() => {}} onSkip={() => {}} onCancel={() => {}} onDone={() => {}} />);
  fireEvent.click(screen.getByRole('button', { name: 'Copy Paths' }));
};

describe('MoveModelsDialog: Copy Paths', () => {
  beforeEach(() => { vi.clearAllMocks(); vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

  it('shows Copied, then resets the label after its timeout', async () => {
    open(() => Promise.resolve());
    await act(async () => { await Promise.resolve(); });
    expect(screen.getByRole('button', { name: 'Copied' })).toBeTruthy();

    act(() => { vi.advanceTimersByTime(5000); });
    expect(screen.getByRole('button', { name: 'Copy Paths' })).toBeTruthy();
  });

  it('keeps the label and shows a failure toast when the write is refused', async () => {
    open(() => Promise.reject(new Error('denied')));
    await act(async () => { await Promise.resolve(); });
    expect(toast.error).toHaveBeenCalledWith("Couldn't copy the text");
    expect(screen.getByRole('button', { name: 'Copy Paths' })).toBeTruthy();
  });
});
