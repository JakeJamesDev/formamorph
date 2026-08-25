import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { toast } from 'react-toastify';
import { ReportDialog } from './ReportDialog';
import ReportService, { AlreadyReportedError } from '@/services/ReportService';

vi.mock('react-toastify', () => ({ toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() } }));

const filed = {
  id: 'r1',
  status: 'open',
  category: 'spam',
  createdAt: '2026-08-01T12:00:00.000Z',
};

const listing = { kind: 'listing' as const, id: 'w1', name: 'Sedge Landing' };

/** Pick a reason. All six are on screen, so this is one click on the one meant. */
const pickCategory = async (label: string) => {
  fireEvent.click(screen.getByRole('radio', { name: label }));
};

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('filing a report', () => {
  it('sends the category and the details the reporter picked', async () => {
    const file = vi.spyOn(ReportService, 'file').mockResolvedValue(filed);

    render(<ReportDialog open onOpenChange={vi.fn()} target={listing} />);

    await pickCategory('Stolen content');
    fireEvent.change(screen.getByLabelText(/anything else/i), {
      target: { value: 'This is my world, reposted.' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Send Report' }));

    await waitFor(() => expect(file).toHaveBeenCalledWith({
      targetKind: 'listing',
      targetId: 'w1',
      category: 'stolen',
      details: 'This is my world, reposted.',
    }));
  });

  it('sends a category on its own — the details are optional', async () => {
    const file = vi.spyOn(ReportService, 'file').mockResolvedValue(filed);

    render(<ReportDialog open onOpenChange={vi.fn()} target={listing} />);

    await pickCategory('Spam or scam');
    fireEvent.click(screen.getByRole('button', { name: 'Send Report' }));

    await waitFor(() => expect(file).toHaveBeenCalledWith(
      expect.objectContaining({ category: 'spam', details: undefined }),
    ));
  });

  it('will not send without a reason', async () => {
    const file = vi.spyOn(ReportService, 'file').mockResolvedValue(filed);

    render(<ReportDialog open onOpenChange={vi.fn()} target={listing} />);

    // Disabled rather than refused after a round trip: the category is the whole triage signal.
    expect(screen.getByRole('button', { name: 'Send Report' })).toHaveProperty('disabled', true);
    expect(file).not.toHaveBeenCalled();
  });

  it('closes and says where the answer will arrive', async () => {
    vi.spyOn(ReportService, 'file').mockResolvedValue(filed);
    const onOpenChange = vi.fn();

    render(<ReportDialog open onOpenChange={onOpenChange} target={listing} />);

    await pickCategory('Spam or scam');
    fireEvent.click(screen.getByRole('button', { name: 'Send Report' }));

    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(vi.mocked(toast.success).mock.calls[0][0]).toMatch(/messages/i);
  });

  it('calls the thing what the surface that opened it calls it', async () => {
    // A listing is a World, an Entity or a Dictionary depending on where you are. A dialog saying
    // "Listing" over a button that said "World" reads as two different things.
    render(<ReportDialog open onOpenChange={vi.fn()} target={{ ...listing, noun: 'Entity' }} />);

    expect(screen.getByRole('heading', { name: /Report This Entity/ })).toBeTruthy();
    expect(screen.getByText(/Reporting the Entity/)).toBeTruthy();
  });

  it('falls back to the kind when the caller offers no word of its own', async () => {
    render(<ReportDialog open onOpenChange={vi.fn()} target={listing} />);

    expect(screen.getByRole('heading', { name: /Report This Listing/ })).toBeTruthy();
  });

  it('names the commenter and the listing when reporting a comment', async () => {
    // A comment has no name of its own; showing the listing's name alone reads as the comment's title.
    render(<ReportDialog open onOpenChange={vi.fn()} target={{
      kind: 'comment', id: 'c1', name: 'Sedge Landing', author: 'benny',
    }} />);

    const line = screen.getByText(/Reporting/).closest('p');
    expect(line?.textContent).toBe('Reporting benny’s comment on Sedge Landing');
  });

  it('still points at the listing when the commenter has no name', async () => {
    render(<ReportDialog open onOpenChange={vi.fn()} target={{
      kind: 'comment', id: 'c1', name: 'Sedge Landing',
    }} />);

    const line = screen.getByText(/Reporting/).closest('p');
    expect(line?.textContent).toBe('Reporting a comment on Sedge Landing');
  });

  it('says up front that the author never learns who reported them', async () => {
    // The question that decides whether somebody reports at all, so it is answered before they start.
    render(<ReportDialog open onOpenChange={vi.fn()} target={listing} />);

    expect(screen.getByText(/never learns who reported them/i)).toBeTruthy();
  });
});

describe('reporting the same thing twice', () => {
  it('says it is already with staff instead of reporting a failure', async () => {
    vi.spyOn(ReportService, 'file')
      .mockRejectedValue(new AlreadyReportedError('You have already reported this — staff are reviewing it.'));

    render(<ReportDialog open onOpenChange={vi.fn()} target={listing} />);

    await pickCategory('Spam or scam');
    fireEvent.click(screen.getByRole('button', { name: 'Send Report' }));

    expect(await screen.findByText(/already reported this/i)).toBeTruthy();
    // A state, not an error — the reporter did nothing wrong and there is nothing to retry.
    expect(toast.error).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: 'Send Report' })).toBeNull();
  });

  it('still reports a real failure as one', async () => {
    vi.spyOn(ReportService, 'file').mockRejectedValue(new Error('Network down'));

    render(<ReportDialog open onOpenChange={vi.fn()} target={listing} />);

    await pickCategory('Spam or scam');
    fireEvent.click(screen.getByRole('button', { name: 'Send Report' }));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Network down'));
    // Still on the form, with the draft intact, because the send is worth retrying.
    expect(screen.getByRole('button', { name: 'Send Report' })).toBeTruthy();
  });
});

describe('reopening the dialog', () => {
  it('starts blank rather than on the last thing reported', async () => {
    const { rerender } = render(<ReportDialog open onOpenChange={vi.fn()} target={listing} />);

    fireEvent.change(screen.getByLabelText(/anything else/i), { target: { value: 'left over' } });

    rerender(<ReportDialog open={false} onOpenChange={vi.fn()} target={listing} />);
    rerender(<ReportDialog open onOpenChange={vi.fn()} target={listing} />);

    expect(screen.getByLabelText(/anything else/i)).toHaveProperty('value', '');
    expect(screen.getByRole('button', { name: 'Send Report' })).toHaveProperty('disabled', true);
  });
});
