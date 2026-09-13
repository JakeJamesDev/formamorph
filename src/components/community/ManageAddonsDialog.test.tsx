import { render, screen, cleanup, fireEvent, waitFor, within } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi, type MockInstance } from 'vitest';
import { ManageAddonsDialog } from './ManageAddonsDialog';
import WorldStorageService from '@/services/WorldStorageService';
import type { AddonRow } from '@/lib/worldDependencies';

vi.mock('react-toastify', () => ({ toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() } }));

const DAY = 86_400_000;
const daysAgo = (days: number) => new Date(Date.now() - days * DAY).toISOString();

const world = { id: 'w1', name: 'Sedge Landing' };

/** One offering as the add-on route answers it. */
const offer = (over: Partial<AddonRow> & { _id: string; name: string }): AddonRow => ({
  kind: 'entity',
  author: { username: 'quill' },
  reviewState: 'unreviewed',
  updatedSinceReview: false,
  offeredAt: daysAgo(6),
  updated_at: daysAgo(6),
  ...over,
});

const OFFERS: AddonRow[] = [
  offer({ _id: 'fresh', name: 'Marsh Warden', offeredAt: daysAgo(3) }),
  offer({ _id: 'stale', name: 'Reed Cutter', offeredAt: daysAgo(12) }),
  offer({
    _id: 'moved', name: 'Fen Lantern', reviewState: 'approved', updatedSinceReview: true,
    reviewedAt: daysAgo(9), updated_at: daysAgo(2),
  }),
  offer({ _id: 'settled', name: 'Bog Myrtle', reviewState: 'approved', reviewedAt: daysAgo(4) }),
  offer({ _id: 'refused', name: 'Silt Charm', reviewState: 'declined', reviewedAt: daysAgo(5) }),
];

/** The <li> a named offering is drawn in, so a control can be found within its own row. */
const rowFor = (name: string): HTMLElement => screen.getByText(name).closest('li')!;

/** The segment control's option inside one row. Both the segments and the narrow-screen select render in
 *  jsdom, which has no CSS to hide either, so a plain name lookup would find two controls. */
const segment = (name: string, label: string) =>
  within(within(rowFor(name)).getByRole('radiogroup')).getByRole('radio', { name: label });

/** Wait for the list to replace the loading skeletons. */
const listed = async (name: string) => {
  await waitFor(() => expect(screen.getByText(name)).toBeTruthy());
};

let fetchAddons: MockInstance<typeof WorldStorageService.fetchAddons>;
let setReview: MockInstance<typeof WorldStorageService.setAddonReview>;

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  fetchAddons = vi.spyOn(WorldStorageService, 'fetchAddons').mockResolvedValue(OFFERS);
  setReview = vi.spyOn(WorldStorageService, 'setAddonReview').mockResolvedValue(undefined);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('the review list', () => {
  it('shows the unreviewed and the changed, oldest waiting first', async () => {
    render(<ManageAddonsDialog open onOpenChange={vi.fn()} world={world} />);
    await listed('Reed Cutter');

    // Reed Cutter has waited 12 days, Marsh Warden 3, and Fen Lantern 2 since it changed under its answer.
    const names = screen.getAllByRole('radiogroup')
      .map((group) => group.closest('li')!.querySelector('p')!.textContent);

    expect(names).toEqual(['Reed Cutter', 'Marsh Warden', 'Fen Lantern']);
    // Answered and unchanged, so neither belongs in the attention list.
    expect(screen.queryByText('Bog Myrtle')).toBeNull();
    expect(screen.queryByText('Silt Charm')).toBeNull();
  });

  it('offers the three states with Unreviewed between them, one selected', async () => {
    render(<ManageAddonsDialog open onOpenChange={vi.fn()} world={world} />);
    await listed('Marsh Warden');

    const group = within(rowFor('Marsh Warden')).getByRole('radiogroup');
    const labels = within(group).getAllByRole('radio').map((item) => item.textContent);

    expect(labels).toEqual(['Approved', 'Unreviewed', 'Declined']);
    expect(within(group).getAllByRole('radio').filter((item) => item.dataset.state === 'on'))
      .toHaveLength(1);
    expect(segment('Marsh Warden', 'Unreviewed').dataset.state).toBe('on');
  });

  it('says how long each row has waited, and when a settled one was answered', async () => {
    render(<ManageAddonsDialog open onOpenChange={vi.fn()} world={world} />);
    await listed('Reed Cutter');

    expect(rowFor('Reed Cutter').textContent).toContain('Waiting 12 days');
    // The changed row waits from the change, not from the offer it made nine days before the answer.
    expect(rowFor('Fen Lantern').textContent).toContain('Waiting 2 days');
  });

  it('marks a changed source and keeps its decision', async () => {
    render(<ManageAddonsDialog open onOpenChange={vi.fn()} world={world} />);
    await listed('Fen Lantern');

    expect(rowFor('Fen Lantern').textContent).toContain('Updated since review');
    expect(segment('Fen Lantern', 'Approved').dataset.state).toBe('on');
  });
});

describe('staging a change', () => {
  it('keeps the row on screen with Pending change, and Discard puts it back', async () => {
    render(<ManageAddonsDialog open onOpenChange={vi.fn()} world={world} />);
    await listed('Reed Cutter');

    fireEvent.click(segment('Reed Cutter', 'Approved'));

    // Approved is out of the attention list, so a row that filtered on the staged state would vanish here.
    expect(rowFor('Reed Cutter').textContent).toContain('Pending change');
    expect(segment('Reed Cutter', 'Approved').dataset.state).toBe('on');

    fireEvent.click(screen.getByRole('button', { name: 'Discard Changes' }));

    expect(rowFor('Reed Cutter').textContent).not.toContain('Pending change');
    expect(segment('Reed Cutter', 'Unreviewed').dataset.state).toBe('on');
    expect(setReview).not.toHaveBeenCalled();
  });

  it('stages Mark Reviewed without changing the decision', async () => {
    render(<ManageAddonsDialog open onOpenChange={vi.fn()} world={world} />);
    await listed('Fen Lantern');

    fireEvent.click(within(rowFor('Fen Lantern')).getByRole('button', { name: 'Mark Reviewed' }));

    expect(rowFor('Fen Lantern').textContent).toContain('Pending change');
    expect(rowFor('Fen Lantern').textContent).not.toContain('Updated since review');
    expect(segment('Fen Lantern', 'Approved').dataset.state).toBe('on');
  });

  it('leaves Save and Discard off until something is staged', async () => {
    render(<ManageAddonsDialog open onOpenChange={vi.fn()} world={world} />);
    await listed('Reed Cutter');

    expect((screen.getByRole('button', { name: /Save Changes/ }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole('button', { name: 'Discard Changes' }) as HTMLButtonElement).disabled).toBe(true);

    fireEvent.click(segment('Reed Cutter', 'Declined'));

    expect((screen.getByRole('button', { name: /Save Changes/ }) as HTMLButtonElement).disabled).toBe(false);
  });

  it('asks before closing on an unsaved review, and closes once confirmed', async () => {
    const onOpenChange = vi.fn();
    render(<ManageAddonsDialog open onOpenChange={onOpenChange} world={world} />);
    await listed('Reed Cutter');

    fireEvent.click(segment('Reed Cutter', 'Declined'));
    fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape', code: 'Escape' });

    await waitFor(() => expect(screen.getByText('Close without saving?')).toBeTruthy());
    expect(onOpenChange).not.toHaveBeenCalledWith(false);

    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('closes without asking when nothing is staged', async () => {
    const onOpenChange = vi.fn();
    render(<ManageAddonsDialog open onOpenChange={onOpenChange} world={world} />);
    await listed('Reed Cutter');

    fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape', code: 'Escape' });

    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(screen.queryByText('Close without saving?')).toBeNull();
  });

  it('puts Discard Changes before Save Changes in the footer', async () => {
    render(<ManageAddonsDialog open onOpenChange={vi.fn()} world={world} />);
    await listed('Reed Cutter');

    const discard = screen.getByRole('button', { name: 'Discard Changes' });
    const save = screen.getByRole('button', { name: /Save Changes/ });

    expect(discard.compareDocumentPosition(save) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});

describe('saving', () => {
  it('writes every staged decision and reads the list back', async () => {
    render(<ManageAddonsDialog open onOpenChange={vi.fn()} world={world} />);
    await listed('Reed Cutter');

    fireEvent.click(segment('Reed Cutter', 'Declined'));
    fireEvent.click(within(rowFor('Fen Lantern')).getByRole('button', { name: 'Mark Reviewed' }));
    fireEvent.click(screen.getByRole('button', { name: /Save Changes/ }));

    await waitFor(() => expect(setReview).toHaveBeenCalledTimes(2));
    expect(setReview).toHaveBeenCalledWith('w1', 'stale', 'declined');
    // The acknowledgment is the standing decision sent again, which is what moves the reviewed revision.
    expect(setReview).toHaveBeenCalledWith('w1', 'moved', 'approved');
    await waitFor(() => expect(fetchAddons).toHaveBeenCalledTimes(2));
  });

  it('clears the stage once the decisions land', async () => {
    render(<ManageAddonsDialog open onOpenChange={vi.fn()} world={world} />);
    await listed('Reed Cutter');

    fireEvent.click(segment('Reed Cutter', 'Declined'));
    fireEvent.click(screen.getByRole('button', { name: /Save Changes/ }));

    await waitFor(() => {
      expect((screen.getByRole('button', { name: /Save Changes/ }) as HTMLButtonElement).disabled).toBe(true);
    });
  });

  it('keeps a refused decision staged rather than reporting it saved', async () => {
    setReview.mockRejectedValue(new Error('Only the world author can review an add-on'));
    render(<ManageAddonsDialog open onOpenChange={vi.fn()} world={world} />);
    await listed('Reed Cutter');

    fireEvent.click(segment('Reed Cutter', 'Declined'));
    fireEvent.click(screen.getByRole('button', { name: /Save Changes/ }));

    await waitFor(() => expect(setReview).toHaveBeenCalled());
    await waitFor(() => expect(rowFor('Reed Cutter').textContent).toContain('Pending change'));
    expect((screen.getByRole('button', { name: /Save Changes/ }) as HTMLButtonElement).disabled).toBe(false);
  });

  it('keeps a decision staged that the author made while the writes were in flight', async () => {
    let finish: () => void = () => {};
    setReview.mockImplementation(() => new Promise<void>((resolve) => { finish = resolve; }));
    render(<ManageAddonsDialog open onOpenChange={vi.fn()} world={world} />);
    await listed('Reed Cutter');

    fireEvent.click(segment('Reed Cutter', 'Declined'));
    fireEvent.click(screen.getByRole('button', { name: /Save Changes/ }));
    await waitFor(() => expect(setReview).toHaveBeenCalled());

    // Answered again before the write came back. Replacing the whole stage would lose this.
    fireEvent.click(segment('Reed Cutter', 'Approved'));
    finish();

    await waitFor(() => expect(rowFor('Reed Cutter').textContent).toContain('Pending change'));
    expect(segment('Reed Cutter', 'Approved').dataset.state).toBe('on');
    expect((screen.getByRole('button', { name: /Save Changes/ }) as HTMLButtonElement).disabled).toBe(false);
  });

  it('reports a list it could not read, and reads it again on Try Again', async () => {
    fetchAddons.mockRejectedValueOnce(new Error('Failed to read this world\'s add-ons'));
    render(<ManageAddonsDialog open onOpenChange={vi.fn()} world={world} />);

    await waitFor(() => expect(screen.getByText(/Failed to read/)).toBeTruthy());

    fireEvent.click(screen.getByRole('button', { name: 'Try Again' }));

    await listed('Reed Cutter');
  });
});
