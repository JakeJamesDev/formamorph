import { render, screen, cleanup, fireEvent, waitFor, within } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { toast } from 'react-toastify';
import { useReviewDecision } from './useReviewDecision';
import ReviewService, { ReviewConflictError, type ReviewOutcome, type ReviewRejection, type ReviewSubject } from '@/services/ReviewService';
import AuthService from '@/services/AuthService';

vi.mock('react-toastify', () => ({ toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() } }));

// The composer has its own tests; here it only has to say what it was opened with.
vi.mock('@/components/menu/MessageComposerDialog', () => ({
  MessageComposerDialog: ({ target, initialSubject, initialBody }: {
    target: { recipients: { username: string }[] }; initialSubject: string; initialBody: string;
  }) => (
    <div data-testid="composer" data-to={target.recipients[0]?.username} data-subject={initialSubject}>
      {initialBody}
    </div>
  ),
}));

const subject = (over: Partial<ReviewSubject> = {}): ReviewSubject => ({
  id: 'w1',
  kind: 'world',
  name: 'Sedge Landing',
  type: 'new',
  author: { id: 'a1', username: 'wren_hallow', role: null },
  ...over,
});

const rejection = (over: Partial<ReviewRejection> = {}): ReviewRejection => ({
  id: 'w1',
  author: { id: 'a1', username: 'wren_hallow' },
  quarantinedAt: '2026-10-25T12:00:00.000Z',
  quarantineExpiresAt: '2026-11-01T12:00:00.000Z',
  quarantineExtended: false,
  ...over,
});

const signedInAs = (accountType: string) =>
  vi.spyOn(AuthService, 'getCurrentUser').mockReturnValue({ id: 'me', username: 'me', accountType });

/** A caller with one Approve and one Reject button for each subject, the way a list or a card wires the hook. */
function Harness({ subjects, onOutcome }: {
  subjects: ReviewSubject[];
  onOutcome: (subject: ReviewSubject, outcome: ReviewOutcome, rejection?: ReviewRejection) => void;
}) {
  const { busyId, mayDecide, approve, startReject, dialogs } = useReviewDecision({ onOutcome });
  return (
    <>
      {subjects.map((s) => (
        <div key={s.id} role="group" aria-label={s.name} data-may-decide={mayDecide(s)}>
          <button type="button" disabled={busyId === s.id} onClick={() => void approve(s)}>Approve</button>
          <button type="button" disabled={busyId === s.id} onClick={() => startReject(s)}>Reject</button>
        </div>
      ))}
      {dialogs}
    </>
  );
}

const renderHarness = (subjects: ReviewSubject[]) => {
  const onOutcome = vi.fn();
  const view = render(<Harness subjects={subjects} onOutcome={onOutcome} />);
  return { ...view, onOutcome };
};

const press = (name: string, button: 'Approve' | 'Reject') =>
  fireEvent.click(within(screen.getByRole('group', { name })).getByRole('button', { name: button }));

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  signedInAs('mod');
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

describe('approving', () => {
  it('approves and reports it', async () => {
    const approve = vi.spyOn(ReviewService, 'approve').mockResolvedValue();
    const { onOutcome } = renderHarness([subject()]);

    press('Sedge Landing', 'Approve');

    await waitFor(() => expect(onOutcome).toHaveBeenCalledWith(expect.objectContaining({ id: 'w1' }), 'approved', undefined));
    expect(approve).toHaveBeenCalledWith('w1');
    expect(onOutcome).toHaveBeenCalledTimes(1);
    expect(toast.success).toHaveBeenCalledWith('World approved');
  });

  it('marks only the subject in flight as busy', async () => {
    let finish: () => void = () => {};
    vi.spyOn(ReviewService, 'approve').mockReturnValue(new Promise<void>((resolve) => { finish = resolve; }));
    renderHarness([subject(), subject({ id: 'w2', name: 'The Ferryman' })]);

    press('Sedge Landing', 'Approve');

    const busy = within(screen.getByRole('group', { name: 'Sedge Landing' }));
    await waitFor(() => expect((busy.getByRole('button', { name: 'Approve' }) as HTMLButtonElement).disabled).toBe(true));
    expect((within(screen.getByRole('group', { name: 'The Ferryman' })).getByRole('button', { name: 'Approve' }) as HTMLButtonElement).disabled).toBe(false);

    finish();
    await waitFor(() => expect((busy.getByRole('button', { name: 'Approve' }) as HTMLButtonElement).disabled).toBe(false));
  });

  it('reports nothing and toasts nothing after the caller unmounts mid-request', async () => {
    let finish: () => void = () => {};
    vi.spyOn(ReviewService, 'approve').mockReturnValue(new Promise<void>((resolve) => { finish = resolve; }));
    const { unmount, onOutcome } = renderHarness([subject()]);

    press('Sedge Landing', 'Approve');
    unmount();
    finish();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(onOutcome).not.toHaveBeenCalled();
    expect(toast.success).not.toHaveBeenCalled();
  });

  it('reports nothing when the approval fails for another reason', async () => {
    vi.spyOn(ReviewService, 'approve').mockRejectedValue(new Error('Server down'));
    const { onOutcome } = renderHarness([subject()]);

    press('Sedge Landing', 'Approve');

    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(onOutcome).not.toHaveBeenCalled();
  });
});

describe('the 409 conflicts', () => {
  it('drops an item another mod already handled', async () => {
    vi.spyOn(ReviewService, 'approve').mockRejectedValue(new ReviewConflictError('This is no longer waiting for review'));
    const { onOutcome } = renderHarness([subject()]);

    press('Sedge Landing', 'Approve');

    await waitFor(() => expect(onOutcome).toHaveBeenCalledWith(expect.objectContaining({ id: 'w1' }), 'dropped', undefined));
    expect(toast.info).toHaveBeenCalledWith('Another mod already handled this item');
    expect(toast.success).not.toHaveBeenCalled();
  });

  it('keeps an update whose contest is being judged', async () => {
    vi.spyOn(ReviewService, 'approve').mockRejectedValue(
      new ReviewConflictError('Spooky Season is being judged, so its entries cannot be changed', 'CONTEST_LOCKED'),
    );
    const { onOutcome } = renderHarness([subject({ type: 'update' })]);

    press('Sedge Landing', 'Approve');

    await waitFor(() => expect(onOutcome).toHaveBeenCalledWith(expect.objectContaining({ id: 'w1' }), 'kept', undefined));
    expect(toast.info).toHaveBeenCalledWith("This update waits for the contest results. Approve it after they're announced.");
    expect(toast.info).not.toHaveBeenCalledWith('Another mod already handled this item');
  });

  it('drops a rejected item another mod already handled, and closes the length prompt', async () => {
    vi.spyOn(ReviewService, 'reject').mockRejectedValue(new ReviewConflictError('This is no longer waiting for review'));
    const { onOutcome } = renderHarness([subject()]);

    press('Sedge Landing', 'Reject');
    fireEvent.click(await screen.findByRole('button', { name: 'Quarantine' }));

    await waitFor(() => expect(onOutcome).toHaveBeenCalledWith(expect.objectContaining({ id: 'w1' }), 'dropped', undefined));
    expect(screen.queryByTestId('composer')).toBeNull();
    await waitFor(() => expect(screen.queryByRole('combobox', { name: 'Quarantine length' })).toBeNull());
  });
});

describe('rejecting', () => {
  it('asks a new listing for its quarantine length, then opens the quarantine template', async () => {
    const reject = vi.spyOn(ReviewService, 'reject').mockResolvedValue(rejection());
    const { onOutcome } = renderHarness([subject()]);

    press('Sedge Landing', 'Reject');
    expect(screen.queryByRole('alertdialog')).toBeNull();
    fireEvent.click(await screen.findByRole('button', { name: 'Quarantine' }));

    const composer = await screen.findByTestId('composer');
    expect(reject).toHaveBeenCalledWith('w1', 7);
    expect(onOutcome).toHaveBeenCalledWith(expect.objectContaining({ id: 'w1' }), 'rejected', rejection());
    expect(composer.dataset.to).toBe('wren_hallow');
    expect(composer.dataset.subject).toBe('Your world "Sedge Landing" needs changes');
    expect(composer.textContent).toContain(new Date('2026-11-01T12:00:00.000Z').toLocaleDateString());
    expect(toast.success).toHaveBeenCalledWith('World rejected');
  });

  it('confirms an update, then opens the rejected-update template', async () => {
    const reject = vi.spyOn(ReviewService, 'reject').mockResolvedValue({ id: 'w1', author: { id: 'a1', username: 'wren_hallow' } });
    const { onOutcome } = renderHarness([subject({ type: 'update' })]);

    press('Sedge Landing', 'Reject');

    // No length to pick on an update.
    expect(screen.queryByRole('combobox', { name: 'Quarantine length' })).toBeNull();
    const confirm = await screen.findByRole('alertdialog');
    expect(reject).not.toHaveBeenCalled();
    fireEvent.click(within(confirm).getByRole('button', { name: 'Reject' }));

    const composer = await screen.findByTestId('composer');
    expect(reject).toHaveBeenCalledWith('w1', undefined);
    expect(onOutcome).toHaveBeenCalledWith(expect.objectContaining({ id: 'w1' }), 'rejected', { id: 'w1', author: { id: 'a1', username: 'wren_hallow' } });
    expect(composer.dataset.subject).toBe('Your update to the world "Sedge Landing" was not approved');
    expect(composer.textContent).toMatch(/players still see the live version/);
    expect(toast.success).toHaveBeenCalledWith('Update rejected');
  });

  it('confirms a resubmission without a length, then opens the quarantine template', async () => {
    const reject = vi.spyOn(ReviewService, 'reject').mockResolvedValue(rejection({ quarantineExtended: true }));
    renderHarness([subject({ type: 'resubmitted' })]);

    press('Sedge Landing', 'Reject');
    fireEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Reject' }));

    const composer = await screen.findByTestId('composer');
    expect(reject).toHaveBeenCalledWith('w1', undefined);
    expect(composer.dataset.subject).toBe('Your world "Sedge Landing" needs changes');
    expect(composer.textContent).not.toMatch(/another week/);
  });

  it('sends nothing when the length prompt is canceled', async () => {
    const reject = vi.spyOn(ReviewService, 'reject');
    const { onOutcome } = renderHarness([subject()]);

    press('Sedge Landing', 'Reject');
    fireEvent.click(await screen.findByRole('button', { name: 'Cancel' }));

    expect(reject).not.toHaveBeenCalled();
    expect(onOutcome).not.toHaveBeenCalled();
  });
});

describe('who may decide', () => {
  const mayDecide = (name: string) => screen.getByRole('group', { name }).dataset.mayDecide;

  it('lets a mod decide on a player’s listing', () => {
    renderHarness([subject()]);
    expect(mayDecide('Sedge Landing')).toBe('true');
  });

  it('never lets staff decide on their own listing', () => {
    signedInAs('admin');
    renderHarness([subject({ author: { id: 'me', username: 'me', role: 'admin' } })]);
    expect(mayDecide('Sedge Landing')).toBe('false');
  });

  it('follows the staff ladder against the author', () => {
    renderHarness([
      subject({ id: 'w1', name: 'Admin Work', author: { id: 'boss', username: 'root-admin', role: 'admin' } }),
      subject({ id: 'w2', name: 'Mod Work', author: { id: 'm2', username: 'a-mod', role: 'mod' } }),
    ]);
    expect(mayDecide('Admin Work')).toBe('false');
    cleanup();

    signedInAs('admin');
    renderHarness([subject({ id: 'w2', name: 'Mod Work', author: { id: 'm2', username: 'a-mod', role: 'mod' } })]);
    expect(mayDecide('Mod Work')).toBe('true');
  });
});
