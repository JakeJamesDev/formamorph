import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { toast } from 'react-toastify';
import { serializeTurnContent } from '@/lib/turnDigest';
import { MemoryManagerModal } from './MemoryManagerModal';

const history = [
  { role: 'user' as const, content: 'Go to the dock.' },
  {
    role: 'assistant' as const,
    content: serializeTurnContent({
      narration: 'Gulls wheel over the dock.', choices: [], stat_changes: [], turnId: 't1', summary: 'The party reached the dock.',
    }),
  },
];

vi.mock('@/contexts/GameplayContext', () => ({
  useGameplay: () => ({
    fullMessageHistory: history,
    memoryPins: {}, setMemoryPins: vi.fn(),
    milestoneSelection: undefined,
    memoryEdits: {}, setMemoryEdits: vi.fn(),
    memoryDeleted: [], setMemoryDeleted: vi.fn(),
    memoryNotes: [], setMemoryNotes: vi.fn(),
    isWaitingForAI: true,
    gameTime: 0, calendar: undefined,
    contextMemoryIds: [], rehydratedMemoryIds: [],
  }),
}));
vi.mock('@/contexts/SettingsContext', () => ({
  useSettings: () => ({ memoryDigests: true, narrationVerbatimTurns: 0, aiClock: false }),
}));
vi.mock('@/components/HelpButton', () => ({ HelpButton: () => null }));
vi.mock('react-toastify', () => ({ toast: { error: vi.fn() } }));

afterEach(() => {
  cleanup();
  vi.mocked(toast.error).mockClear();
});

const rewriteButton = () => screen.getByRole('button', { name: 'Have the Story Write This Memory Again' }) as HTMLButtonElement;

describe('regenerating a memory in the Memory Manager', () => {
  it('shows a spinner and a Cancel while the request waits, even during a turn', async () => {
    const user = userEvent.setup();
    const onRegenerate = vi.fn(() => new Promise<boolean>(() => {}));
    render(<MemoryManagerModal isOpen onOpenChange={() => {}} onRegenerate={onRegenerate} />);
    expect(rewriteButton().disabled).toBe(false);
    await user.click(rewriteButton());
    expect(onRegenerate).toHaveBeenCalledWith('t1', expect.any(AbortSignal));
    expect(rewriteButton().disabled).toBe(true);
    expect(rewriteButton().querySelector('.animate-spin')).not.toBeNull();
    expect(screen.getByRole('button', { name: 'Cancel Rewrite' })).toBeTruthy();
  });

  it('Cancel aborts the request, returns the row to idle and shows no error', async () => {
    const user = userEvent.setup();
    let captured: AbortSignal | undefined;
    const onRegenerate = vi.fn((_turnId: string, signal: AbortSignal) => {
      captured = signal;
      return new Promise<boolean>((resolve) => signal.addEventListener('abort', () => resolve(false)));
    });
    render(<MemoryManagerModal isOpen onOpenChange={() => {}} onRegenerate={onRegenerate} />);
    await user.click(rewriteButton());
    await user.click(screen.getByRole('button', { name: 'Cancel Rewrite' }));
    expect(captured!.aborted).toBe(true);
    await waitFor(() => expect(rewriteButton().disabled).toBe(false));
    expect(screen.queryByRole('button', { name: 'Cancel Rewrite' })).toBeNull();
    expect(toast.error).not.toHaveBeenCalled();
  });

  it('returns to idle without an error when the queue cancels the request', async () => {
    const user = userEvent.setup();
    render(<MemoryManagerModal isOpen onOpenChange={() => {}} onRegenerate={async () => undefined} />);
    await user.click(rewriteButton());
    await waitFor(() => expect(rewriteButton().disabled).toBe(false));
    expect(toast.error).not.toHaveBeenCalled();
  });

  it('toasts when the request fails and returns to idle', async () => {
    const user = userEvent.setup();
    render(<MemoryManagerModal isOpen onOpenChange={() => {}} onRegenerate={async () => false} />);
    await user.click(rewriteButton());
    await waitFor(() => expect(toast.error).toHaveBeenCalledTimes(1));
    expect(rewriteButton().disabled).toBe(false);
  });

  it('aborts a waiting request when the game view unmounts', async () => {
    const user = userEvent.setup();
    let captured: AbortSignal | undefined;
    const onRegenerate = vi.fn((_turnId: string, signal: AbortSignal) => {
      captured = signal;
      return new Promise<boolean>(() => {});
    });
    const { unmount } = render(<MemoryManagerModal isOpen onOpenChange={() => {}} onRegenerate={onRegenerate} />);
    await user.click(rewriteButton());
    unmount();
    expect(captured!.aborted).toBe(true);
  });
});
