import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { toast } from 'react-toastify';
import { serializeTurnContent } from '@/lib/turnDigest';
import { withoutMemoryText, type TurnTextEdits } from '@/lib/turnTextEdits';
import { MemoryManagerModal } from './MemoryManagerModal';

const turn = (id: string, summary: string) => ({
  role: 'assistant' as const,
  content: serializeTurnContent({ narration: 'Gulls wheel over the dock.', choices: [], stat_changes: [], turnId: id, summary }),
});

// The mocked context reads this holder, so a test can swap the history and read the layer the window wrote.
const ctx = vi.hoisted(() => ({
  history: [] as Array<{ role: 'user' | 'assistant'; content: string }>,
  layer: {} as TurnTextEdits,
  setLayer: undefined as unknown as (u: (prev: TurnTextEdits) => TurnTextEdits) => void,
  setPins: undefined as unknown as (u: unknown) => void,
}));

vi.mock('@/contexts/GameplayContext', () => ({
  useGameplay: () => ({
    fullMessageHistory: ctx.history,
    memoryPins: {}, setMemoryPins: ctx.setPins,
    milestoneSelection: undefined,
    turnTextEdits: ctx.layer, setTurnTextEdits: ctx.setLayer,
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

beforeEach(() => {
  ctx.history = [{ role: 'user', content: 'Go to the dock.' }, turn('t1', 'The party reached the dock.')];
  ctx.layer = {};
  ctx.setLayer = vi.fn((update) => { ctx.layer = update(ctx.layer); });
  ctx.setPins = vi.fn();
});

afterEach(() => {
  cleanup();
  vi.mocked(toast.error).mockClear();
});

const rewriteButton = () => screen.getByRole('button', { name: 'Have the Story Write This Memory Again' }) as HTMLButtonElement;
const button = (name: string) => screen.getByRole('button', { name });
const open = (onRegenerate: (id: string, signal: AbortSignal) => Promise<string | null | undefined>) =>
  render(<MemoryManagerModal isOpen onOpenChange={() => {}} onRegenerate={onRegenerate} />);

describe('regenerating a memory in the Memory Manager', () => {
  it('shows a spinner and a Cancel while the request waits, even during a turn', async () => {
    const user = userEvent.setup();
    const onRegenerate = vi.fn(() => new Promise<string>(() => {}));
    open(onRegenerate);
    expect(rewriteButton().disabled).toBe(false);
    await user.click(rewriteButton());
    expect(onRegenerate).toHaveBeenCalledWith('t1', expect.any(AbortSignal));
    expect(rewriteButton().disabled).toBe(true);
    expect(rewriteButton().querySelector('.animate-spin')).not.toBeNull();
    expect(button('Cancel Rewrite')).toBeTruthy();
  });

  it('Cancel aborts the request, returns the row to idle, shows no error and writes nothing', async () => {
    const user = userEvent.setup();
    let captured: AbortSignal | undefined;
    const onRegenerate = vi.fn((_turnId: string, signal: AbortSignal) => {
      captured = signal;
      return new Promise<null>((resolve) => signal.addEventListener('abort', () => resolve(null)));
    });
    open(onRegenerate);
    await user.click(rewriteButton());
    await user.click(button('Cancel Rewrite'));
    expect(captured!.aborted).toBe(true);
    await waitFor(() => expect(rewriteButton().disabled).toBe(false));
    expect(screen.queryByRole('button', { name: 'Cancel Rewrite' })).toBeNull();
    expect(toast.error).not.toHaveBeenCalled();
    expect(ctx.setLayer).not.toHaveBeenCalled();
  });

  it('returns to idle without an error when the queue cancels the request', async () => {
    const user = userEvent.setup();
    open(async () => undefined);
    await user.click(rewriteButton());
    await waitFor(() => expect(rewriteButton().disabled).toBe(false));
    expect(toast.error).not.toHaveBeenCalled();
  });

  it.each([['failed', null], ['empty', '']])('says so and changes nothing when the result is %s', async (_name, result) => {
    const user = userEvent.setup();
    open(async () => result as string | null);
    await user.click(rewriteButton());
    await waitFor(() => expect(toast.error).toHaveBeenCalledTimes(1));
    expect(rewriteButton().disabled).toBe(false);
    expect(screen.queryByRole('button', { name: 'Keep' })).toBeNull();
    expect(ctx.setLayer).not.toHaveBeenCalled();
  });

  it('aborts a waiting request when the game view unmounts', async () => {
    const user = userEvent.setup();
    let captured: AbortSignal | undefined;
    const { unmount } = open((_id, signal) => { captured = signal; return new Promise<string>(() => {}); });
    await user.click(rewriteButton());
    unmount();
    expect(captured!.aborted).toBe(true);
  });
});

describe('the regenerate preview', () => {
  it('shows the new text and the text it replaces, and writes nothing until Keep', async () => {
    const user = userEvent.setup();
    open(async () => 'They docked at dusk.');
    await user.click(rewriteButton());
    await screen.findByText('They docked at dusk.');
    expect(screen.getByText(/Replaces: The party reached the dock\./)).toBeTruthy();
    expect(ctx.setLayer).not.toHaveBeenCalled();
    expect(ctx.layer).toEqual({});
  });

  it('keeps the other rows from regenerating while the preview is open', async () => {
    const user = userEvent.setup();
    ctx.history = [...ctx.history, { role: 'user', content: 'Wait.' }, turn('t2', 'They waited.')];
    open(async () => 'They docked at dusk.');
    await user.click(screen.getAllByRole('button', { name: 'Have the Story Write This Memory Again' })[0]);
    await screen.findByText('They docked at dusk.');
    const left = screen.getAllByRole('button', { name: 'Have the Story Write This Memory Again' }) as HTMLButtonElement[];
    expect(left.every((b) => b.disabled)).toBe(true);
  });

  it('Keep stores a kept rewrite, and reverting returns the AI first text', async () => {
    const user = userEvent.setup();
    open(async () => 'They docked at dusk.');
    await user.click(rewriteButton());
    await user.click(await screen.findByRole('button', { name: 'Keep' }));
    expect(ctx.layer).toEqual({ t1: { memory: { text: 'They docked at dusk.', source: 'ai' } } });
    expect(screen.queryByRole('button', { name: 'Keep' })).toBeNull();
    expect(withoutMemoryText(ctx.layer, 't1')).toEqual({});
  });

  it('Keep over a player edit drops the edit’s auto-pin', async () => {
    const user = userEvent.setup();
    ctx.layer = { t1: { memory: { text: 'My own words.', source: 'player' } } };
    open(async () => 'They docked at dusk.');
    await user.click(rewriteButton());
    await user.click(await screen.findByRole('button', { name: 'Keep' }));
    expect(ctx.layer.t1.memory).toEqual({ text: 'They docked at dusk.', source: 'ai' });
    const clearPin = (ctx.setPins as ReturnType<typeof vi.fn>).mock.calls[0][0] as (p: Record<string, 'keep'>) => unknown;
    expect(clearPin({ t1: 'keep' })).toEqual({});
  });

  it('Discard leaves the memory as it was', async () => {
    const user = userEvent.setup();
    open(async () => 'They docked at dusk.');
    await user.click(rewriteButton());
    await user.click(await screen.findByRole('button', { name: 'Discard' }));
    expect(screen.queryByText('They docked at dusk.')).toBeNull();
    expect(screen.getByText('The party reached the dock.')).toBeTruthy();
    expect(ctx.setLayer).not.toHaveBeenCalled();
    expect(rewriteButton().disabled).toBe(false);
  });

  it('closes the preview and writes nothing when the turn is gone', async () => {
    const user = userEvent.setup();
    const view = open(async () => 'They docked at dusk.');
    await user.click(rewriteButton());
    await screen.findByText('They docked at dusk.');
    ctx.history = [];
    view.rerender(<MemoryManagerModal isOpen onOpenChange={() => {}} onRegenerate={async () => 'x'} />);
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Keep' })).toBeNull());
    expect(ctx.setLayer).not.toHaveBeenCalled();
    // A stale preview must not come back when the same turn id returns (a re-roll lands under the old id).
    ctx.history = [{ role: 'user', content: 'Go to the dock.' }, turn('t1', 'The party reached the dock.')];
    view.rerender(<MemoryManagerModal isOpen onOpenChange={() => {}} onRegenerate={async () => 'x'} />);
    expect(screen.queryByRole('button', { name: 'Keep' })).toBeNull();
    expect(screen.getByText('The party reached the dock.')).toBeTruthy();
  });

  it('a request that is still running when the window closes shows no preview on reopen', async () => {
    const user = userEvent.setup();
    let resolve!: (text: string) => void;
    let captured: AbortSignal | undefined;
    const onRegenerate = (_id: string, signal: AbortSignal) => {
      captured = signal;
      return new Promise<string>((r) => { resolve = r; });
    };
    const view = render(<MemoryManagerModal isOpen onOpenChange={() => {}} onRegenerate={onRegenerate} />);
    await user.click(rewriteButton());
    view.rerender(<MemoryManagerModal isOpen={false} onOpenChange={() => {}} onRegenerate={onRegenerate} />);
    expect(captured!.aborted).toBe(true);
    resolve('They docked at dusk.');
    view.rerender(<MemoryManagerModal isOpen onOpenChange={() => {}} onRegenerate={onRegenerate} />);
    await waitFor(() => expect(rewriteButton().disabled).toBe(false));
    expect(screen.queryByRole('button', { name: 'Keep' })).toBeNull();
  });

  it('a preview stays visible when a search no longer matches its row', async () => {
    const user = userEvent.setup();
    open(async () => 'They docked at dusk.');
    await user.click(rewriteButton());
    await screen.findByText('They docked at dusk.');
    await user.type(screen.getByPlaceholderText('Search memories'), 'zzz');
    expect(screen.getByRole('button', { name: 'Keep' })).toBeTruthy();
  });

  it('drops the preview when the window closes', async () => {
    const user = userEvent.setup();
    const onRegenerate = async () => 'They docked at dusk.';
    const view = render(<MemoryManagerModal isOpen onOpenChange={() => {}} onRegenerate={onRegenerate} />);
    await user.click(rewriteButton());
    await screen.findByText('They docked at dusk.');
    view.rerender(<MemoryManagerModal isOpen={false} onOpenChange={() => {}} onRegenerate={onRegenerate} />);
    view.rerender(<MemoryManagerModal isOpen onOpenChange={() => {}} onRegenerate={onRegenerate} />);
    expect(screen.queryByRole('button', { name: 'Keep' })).toBeNull();
    expect(screen.getByText('The party reached the dock.')).toBeTruthy();
  });
});
