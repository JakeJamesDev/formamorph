import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { FeedbackEditDialog } from './FeedbackEditDialog';
import FeedbackService from '@/services/FeedbackService';
import type { FeedbackThread } from '@/types';

vi.mock('react-toastify', () => ({ toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() } }));

const thread = (over: Partial<FeedbackThread> = {}): FeedbackThread => ({
  id: 'f1',
  type: 'bug',
  title: 'IT BROKE',
  category: 'crash',
  body: 'doesnt work',
  status: 'open',
  reporter: { id: 'u1', username: 'tam_reads' },
  diagnostics: {},
  locked: false,
  votes: 0,
  voted: false,
  createdAt: '2026-08-01T00:00:00.000Z',
  updatedAt: '2026-08-01T00:00:00.000Z',
  unread: false,
  ...over,
}) as FeedbackThread;

const show = (props: Record<string, unknown> = {}) =>
  render(
    <FeedbackEditDialog
      open
      onOpenChange={() => {}}
      thread={thread()}
      mayEditProse
      mayRefile
      onSaved={() => {}}
      {...props}
    />
  );

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('what the dialog offers', () => {
  it('shows the words to whoever owns them', () => {
    show({ mayRefile: false });

    expect(screen.getByLabelText('Description')).toBeTruthy();
    expect(screen.queryByLabelText('Category')).toBeNull();
    expect(screen.queryByLabelText('Kind')).toBeNull();
  });

  it('shows the filing to the team', () => {
    show({ mayEditProse: false });

    expect(screen.getByLabelText('Category')).toBeTruthy();
    expect(screen.getByLabelText('Kind')).toBeTruthy();
    expect(screen.queryByLabelText('Description')).toBeNull();
  });

  it('shows both on a bug the team is handling', () => {
    // Nothing on screen that pressing would have refused.
    show();

    expect(screen.getByLabelText('Description')).toBeTruthy();
    expect(screen.getByLabelText('Category')).toBeTruthy();
  });

  it('opens on what is already there rather than empty', () => {
    show();

    expect((screen.getByLabelText('Title') as HTMLInputElement).value).toBe('IT BROKE');
  });
});

describe('saving', () => {
  it('sends only what changed', async () => {
    // The server writes exactly what it is given, so an untouched field would mark the thread edited.
    const update = vi.spyOn(FeedbackService, 'update').mockResolvedValue(thread());
    show();

    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Save button spins forever' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(update).toHaveBeenCalledWith('f1', { title: 'Save button spins forever' }));
  });

  it('has nothing to save until something moves', () => {
    show();

    expect((screen.getByRole('button', { name: 'Save' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('refuses to save a blanked title', () => {
    // The server rejects it too; the button says so before the round trip.
    show();

    fireEvent.change(screen.getByLabelText('Title'), { target: { value: '   ' } });

    expect((screen.getByRole('button', { name: 'Save' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('hands the caller the thread as it now reads', async () => {
    const saved = thread({ title: 'Save button spins forever', editedAt: '2026-08-02T00:00:00.000Z' });
    vi.spyOn(FeedbackService, 'update').mockResolvedValue(saved);
    const onSaved = vi.fn();
    show({ onSaved });

    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Save button spins forever' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(onSaved).toHaveBeenCalledWith(saved));
  });

  it('stays open when the server refuses', async () => {
    // Closing would throw away what they had typed over a failure they can retry.
    vi.spyOn(FeedbackService, 'update').mockRejectedValue(new Error('You cannot rewrite this'));
    const onOpenChange = vi.fn();
    show({ onOpenChange });

    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Save button spins forever' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(FeedbackService.update).toHaveBeenCalled());
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });
});

describe('moving between the branches', () => {
  it('says nothing about a move nobody is making', () => {
    show();

    expect(screen.queryByText(/sets its status/)).toBeNull();
  });

  it('offers the branch control to whoever may move it', () => {
    // Radix's Select cannot be opened in jsdom, so what a move *does* is covered in `feedbackEditing`;
    // this is the wiring that puts the control on screen at all.
    show({ mayEditProse: false });

    expect(screen.getByLabelText('Kind')).toBeTruthy();
  });
});
