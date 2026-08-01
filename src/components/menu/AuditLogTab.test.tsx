import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AuditLogTab } from './AuditLogTab';
import AuditService from '@/services/AuditService';
import { describeAuditEntry, actionFilterValue, ANY_ACTION } from '@/lib/auditPresentation';
import type { AuditEntry } from '@/types';

vi.mock('react-toastify', () => ({ toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() } }));

const entry = (over: Partial<AuditEntry> = {}): AuditEntry => ({
  id: 1,
  action: 'user_suspended',
  actor: { id: 'a1', username: 'root-admin', wasAdmin: true },
  targetUser: { id: 'u1', username: 'trouble' },
  target: { kind: 'account', name: 'trouble' },
  snippet: null,
  createdAt: '2026-07-31 12:00:00',
  ...over,
});

const stubLog = (entries: AuditEntry[], total = entries.length) =>
  vi.spyOn(AuditService, 'list').mockResolvedValue({ entries, total });

/** What the log was asked for on its most recent fetch. */
const lastQuery = () => {
  const calls = vi.mocked(AuditService.list).mock.calls;
  return calls[calls.length - 1][0];
};

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('reading the log', () => {
  it('says what happened in a sentence', async () => {
    stubLog([entry()]);

    render(<AuditLogTab active />);

    expect(await screen.findByText('root-admin suspended trouble')).toBeTruthy();
  });

  it('shows what was removed, when the entry kept it', async () => {
    // The log exists to be read after its subject is gone, so the snippet is the answer to "what was it".
    stubLog([entry({ action: 'comment_deleted', snippet: 'Something worth a record.' })]);

    render(<AuditLogTab active />);

    expect(await screen.findByText('Something worth a record.')).toBeTruthy();
  });

  it('fetches nothing while the tab is off screen', async () => {
    const list = stubLog([entry()]);

    render(<AuditLogTab active={false} />);

    await waitFor(() => expect(list).not.toHaveBeenCalled());
  });

  it('says so when the log is empty', async () => {
    stubLog([]);

    render(<AuditLogTab active />);

    expect(await screen.findByText('Nothing has been recorded yet.')).toBeTruthy();
  });

  it('distinguishes an empty log from an empty filter', async () => {
    // "Nothing has been recorded" over a filtered view would read as the log being blank.
    stubLog([]);

    render(<AuditLogTab active />);
    await screen.findByText('Nothing has been recorded yet.');
    fireEvent.change(screen.getByLabelText('Search the log'), { target: { value: 'nobody' } });
    fireEvent.click(screen.getByRole('button', { name: 'Search' }));

    expect(await screen.findByText('Nothing matches this filter.')).toBeTruthy();
  });

  it('offers nothing that edits or clears an entry', async () => {
    // A record somebody can rewrite is not a record — the surface has to be read-only too.
    stubLog([entry()]);

    render(<AuditLogTab active />);
    await screen.findByText('root-admin suspended trouble');

    for (const name of [/delete/i, /clear/i, /edit/i, /remove/i]) {
      expect(screen.queryByRole('button', { name })).toBeNull();
    }
  });
});

describe('narrowing the log', () => {
  it('searches only once the search is submitted', async () => {
    // Fetching per keystroke would be one request per letter typed.
    stubLog([entry()]);

    render(<AuditLogTab active />);
    await screen.findByText('root-admin suspended trouble');
    fireEvent.change(screen.getByLabelText('Search the log'), { target: { value: 'trouble' } });

    expect(vi.mocked(AuditService.list)).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: 'Search' }));

    await waitFor(() => expect(lastQuery()).toMatchObject({ search: 'trouble' }));
  });

  it('goes back to the first page when the search changes', async () => {
    // A filter change would otherwise land on whatever page the previous list was showing.
    stubLog([entry()], 60);

    render(<AuditLogTab active />);
    fireEvent.click(await screen.findByRole('button', { name: 'Next' }));
    await waitFor(() => expect(lastQuery()).toMatchObject({ page: 2 }));

    fireEvent.change(screen.getByLabelText('Search the log'), { target: { value: 'trouble' } });
    fireEvent.click(screen.getByRole('button', { name: 'Search' }));

    await waitFor(() => expect(lastQuery()).toMatchObject({ page: 1, search: 'trouble' }));
  });

  // Radix's Select cannot be opened in jsdom, so the mapping it drives is asserted directly; the wiring
  // from the dropdown to the list is one expression on each side of `actionFilterValue`.
  it('maps the filter to what the list asks the server for', () => {
    expect(actionFilterValue(ANY_ACTION)).toBeUndefined();
    expect(actionFilterValue('listing_deleted')).toBe('listing_deleted');
  });
});

describe('what each entry reads as', () => {
  const line = (over: Partial<AuditEntry>) => describeAuditEntry(entry(over));

  it('names both people on a suspension', () => {
    expect(line({ action: 'user_suspended' })).toBe('root-admin suspended trouble');
    expect(line({ action: 'user_unsuspended' })).toBe('root-admin reinstated trouble');
  });

  it('never puts a username in the possessive, since so many end in “s”', () => {
    // `tam_reads’s comment` is a stumble in the middle of every line it appears in.
    const lines = [
      line({ action: 'listing_deleted', target: { kind: 'world', name: 'Sedge Landing' } }),
      line({ action: 'listing_deleted', target: { kind: 'world', name: null } }),
      line({ action: 'comment_deleted', target: { kind: 'comment', name: 'Sedge Landing' } }),
      line({ action: 'feedback_deleted', target: { kind: 'bug', name: 'Save button spins' } }),
      line({ action: 'listing_quarantined', target: { kind: 'world', name: 'Sedge Landing' } }),
      line({ action: 'quarantine_released', target: { kind: 'world', name: 'Sedge Landing' } }),
      line({ action: 'quarantine_expired', target: { kind: 'world', name: 'Sedge Landing' } }),
    ];

    for (const text of lines) expect(text).not.toContain('’s ');
  });

  it('says whose picture was cleared', () => {
    expect(line({ action: 'avatar_removed', target: { kind: 'account', name: 'trouble' } }))
      .toBe('root-admin removed the profile image of trouble');
  });

  it('names nobody twice when an admin clears their own picture', () => {
    // The actor already reads as the person; naming them again would say it twice in one sentence.
    expect(line({ action: 'avatar_removed', targetUser: null, target: { kind: 'account', name: 'root-admin' } }))
      .toBe('root-admin removed their own profile image');
  });

  it('separates a takedown from somebody deleting their own', () => {
    // Same disappearance to anyone asking where it went; the log says which it was.
    expect(line({
      action: 'listing_deleted',
      target: { kind: 'world', name: 'Sedge Landing' },
    })).toBe('root-admin deleted the world “Sedge Landing” by trouble');

    expect(line({
      action: 'listing_deleted',
      targetUser: null,
      target: { kind: 'world', name: 'Sedge Landing' },
    })).toBe('root-admin deleted their own world “Sedge Landing”');
  });

  it('calls an entity a character, the way the rest of the app does', () => {
    expect(line({
      action: 'listing_deleted',
      target: { kind: 'entity', name: 'Ilsa' },
    })).toContain('character “Ilsa”');
  });

  it('names the listing a deleted comment was on', () => {
    expect(line({
      action: 'comment_deleted',
      target: { kind: 'comment', name: 'Sedge Landing' },
    })).toBe('root-admin deleted a comment by trouble on “Sedge Landing”');
  });

  it('names the branch a deleted thread was on', () => {
    // A deleted bug report and a deleted suggestion are different disappearances.
    expect(line({
      action: 'feedback_deleted',
      target: { kind: 'bug', name: 'Save button spins' },
    })).toBe('root-admin deleted the bug report “Save button spins” by trouble');

    expect(line({
      action: 'feedback_deleted',
      target: { kind: 'suggestion', name: 'Let me rename a save' },
    })).toBe('root-admin deleted the suggestion “Let me rename a save” by trouble');
  });

  it('reads the whole arc of a quarantine', () => {
    expect(line({
      action: 'listing_quarantined',
      target: { kind: 'world', name: 'Sedge Landing' },
    })).toBe('root-admin quarantined the world “Sedge Landing” by trouble');

    expect(line({
      action: 'quarantine_released',
      target: { kind: 'world', name: 'Sedge Landing' },
    })).toBe('root-admin released the world “Sedge Landing” by trouble');
  });

  it('names the author as the one who updated their quarantined listing', () => {
    // The actor here is the author answering the notice, not an admin doing something to them.
    expect(line({
      action: 'quarantine_updated',
      actor: { id: 'u1', username: 'wren_hallow', wasAdmin: false },
      targetUser: null,
      target: { kind: 'world', name: 'Sedge Landing' },
    })).toBe('wren_hallow updated their quarantined world “Sedge Landing”');
  });

  it('blames nobody for an expiry, because nobody chose it', () => {
    // The server deleted it when the clock ran out; naming an actor would invent a decision.
    expect(line({
      action: 'quarantine_expired',
      actor: { id: null, username: null, wasAdmin: false },
      target: { kind: 'world', name: 'Sedge Landing' },
    })).toBe('The quarantine ran out on the world “Sedge Landing” by trouble, and it was deleted');
  });

  it('reads a reset of everyone as one event, not one per account', () => {
    expect(line({ action: 'terms_reset_all', targetUser: null, target: null }))
      .toBe('root-admin asked everyone to accept the terms again');
  });

  it('still reads when the actor’s account is gone', () => {
    // The names are snapshots for exactly this: the entry outlives whoever it names.
    expect(line({ actor: { id: null, username: null, wasAdmin: true } }))
      .toBe('Someone suspended trouble');
  });

  it('does not invent a name for a listing that had none', () => {
    expect(line({ action: 'listing_deleted', target: { kind: 'world', name: null } }))
      .toBe('root-admin deleted a world by trouble');
  });
});
