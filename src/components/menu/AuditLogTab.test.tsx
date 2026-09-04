import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AuditLogTab } from './AuditLogTab';
import AuditService from '@/services/AuditService';
import {
  describeAuditEntry, auditActorName, auditPredicate, actionFilterValue, ANY_ACTION,
  AUDIT_ACTION_LABELS, AUDIT_ACTION_OPTIONS, AUDIT_ACTION_STYLES,
} from '@/lib/auditPresentation';
import { RoleBadge } from '@/components/RoleBadge';
import { AUDIT_ACTIONS, type AuditEntry } from '@/types';

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

/**
 * The one entry line on screen. Matched by its container rather than by its text: the actor's name is
 * its own element now, so the sentence spans children and an exact-text query would miss it.
 */
const findEntryLine = async () => (await screen.findByText(/suspended/)).closest('p') as HTMLElement;

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

    expect((await findEntryLine()).textContent).toBe('root-admin suspended trouble');
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
    await findEntryLine();

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
    await findEntryLine();
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

  it('names whose report was rewritten', () => {
    // Only recorded when somebody other than the reporter changed it, so there is always a `by`.
    expect(line({ action: 'feedback_edited', target: { kind: 'bug', name: 'Save button spins' } }))
      .toBe('root-admin edited the bug report “Save button spins” by trouble');
  });

  it('names the role somebody was given', () => {
    expect(line({ action: 'role_changed', target: { kind: 'account', name: 'trouble' }, snippet: 'normal to mod' }))
      .toBe('root-admin made trouble a mod');
  });

  it('reads a demotion as one, rather than as being made a normal', () => {
    expect(line({ action: 'role_changed', target: { kind: 'account', name: 'trouble' }, snippet: 'mod to normal' }))
      .toBe('root-admin returned trouble to a normal account');
  });

  it('still says something when the snippet is missing', () => {
    // An entry has to read after its subject is gone, and a malformed one must not read as nonsense.
    expect(line({ action: 'role_changed', snippet: null }))
      .toBe('root-admin changed what trouble is');
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

  it('calls an entity an entity — they can be objects or plants, not only people', () => {
    expect(line({
      action: 'listing_deleted',
      target: { kind: 'entity', name: 'Ilsa' },
    })).toContain('entity “Ilsa”');
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

  it('reads the arc of an event', () => {
    const event = { targetUser: null, target: { kind: 'event', name: 'Summertime Vibes 2026' } };

    expect(line({ action: 'event_created', ...event }))
      .toBe('root-admin scheduled the event “Summertime Vibes 2026”');
    expect(line({ action: 'event_edited', ...event }))
      .toBe('root-admin edited the event “Summertime Vibes 2026”');
    expect(line({ action: 'event_cancelled', ...event }))
      .toBe('root-admin canceled the event “Summertime Vibes 2026”');
    expect(line({ action: 'event_deleted', ...event }))
      .toBe('root-admin deleted the event “Summertime Vibes 2026”');
  });

  it('names the contest a podium belongs to, and leaves the podium to the snippet', () => {
    expect(line({ action: 'results_announced', target: { kind: 'event', name: 'Summertime Vibes 2026' } }))
      .toBe('root-admin announced the results of “Summertime Vibes 2026”');
    expect(line({ action: 'podium_edited', target: { kind: 'event', name: 'Summertime Vibes 2026' } }))
      .toBe('root-admin corrected the podium of “Summertime Vibes 2026”');
  });

  it('separates pulling your own entry from having it pulled', () => {
    // Self-withdrawal names no target on the server, the delete precedent.
    expect(line({
      action: 'entry_withdrawn',
      actor: { id: 'u1', username: 'wren_hallow', wasAdmin: false },
      targetUser: null,
      target: { kind: 'world', name: 'Sedge Landing' },
      snippet: 'Summertime Vibes 2026',
    })).toBe('wren_hallow withdrew their own world “Sedge Landing” from a contest');

    expect(line({
      action: 'entry_withdrawn',
      target: { kind: 'world', name: 'Sedge Landing' },
      snippet: 'Summertime Vibes 2026',
    })).toBe('root-admin withdrew the world “Sedge Landing” by trouble from a contest');
  });

  it('says how a report group closed, and about what', () => {
    expect(line({ action: 'report_actioned', target: { kind: 'world', name: 'Sedge Landing' } }))
      .toBe('root-admin acted on the reports about “Sedge Landing” by trouble');
    expect(line({ action: 'report_dismissed', target: { kind: 'world', name: 'Sedge Landing' } }))
      .toBe('root-admin dismissed the reports about “Sedge Landing” by trouble');
  });

  it('names whose like was removed, and what it was on', () => {
    expect(line({ action: 'like_removed', target: { kind: 'world', name: 'Sedge Landing' } }))
      .toBe('root-admin removed a like by trouble on “Sedge Landing”');
  });

  it('says how many likes a clear took, from the snippet', () => {
    expect(line({ action: 'likes_cleared', snippet: '12 likes' }))
      .toBe('root-admin cleared 12 likes given by trouble');
    expect(line({ action: 'likes_cleared', snippet: '1 like' }))
      .toBe('root-admin cleared 1 like given by trouble');
  });

  it('still reads when a clear kept no count', () => {
    // An entry recorded before the snippet carried a number still has to say what happened.
    expect(line({ action: 'likes_cleared', snippet: null }))
      .toBe('root-admin cleared every like given by trouble');
  });

  it('names who looked at whose linked accounts', () => {
    // Reading linkage data is the one act in here that says where a person was. The log's job is to name
    // the pair, so the line has to be about two people even though nothing was done to either.
    expect(line({ action: 'signals_viewed', target: { kind: 'account', name: 'trouble' } }))
      .toBe('root-admin viewed the accounts linked to trouble');
  });

  it('still reads when staff looked at their own linked accounts', () => {
    // The log leaves the target off when it is the actor, as it does for a cleared like.
    expect(line({ action: 'signals_viewed', targetUser: null, target: { kind: 'account', name: 'root-admin' } }))
      .toBe('root-admin viewed the accounts linked to their own account');
  });

  it('separates a look at a listing’s likes from a look at an account', () => {
    // One action covers both reads. What was looked at is the only thing that tells them apart, so the
    // sentence turns on the target's kind rather than on a second action name.
    expect(line({ action: 'signals_viewed', target: { kind: 'world', name: 'Sedge Landing' } }))
      .toBe('root-admin audited the likes on “Sedge Landing” by trouble');
    expect(line({ action: 'signals_viewed', targetUser: null, target: { kind: 'world', name: null } }))
      .toBe('root-admin audited the likes on a world');
  });

  it('has a sentence for every action the client knows', () => {
    // The fallback exists for a server newer than this build; a listed action reaching it is drift.
    for (const action of AUDIT_ACTIONS) {
      expect(auditPredicate(entry({ action })), action).not.toContain('does not recognize');
    }
  });
});

describe('every action is presentable', () => {
  // The three tables and the filter are separate objects keyed by action; a new action added to one and
  // forgotten in another shows up as a missing label, an unstyled pill or an option nobody can pick.
  it('has a label, a pill style and a filter option for every action', () => {
    for (const action of AUDIT_ACTIONS) {
      expect(AUDIT_ACTION_LABELS[action], action).toBeTruthy();
      expect(AUDIT_ACTION_STYLES[action], action).toBeTruthy();
      expect(AUDIT_ACTION_OPTIONS.some((option) => option.value === action), action).toBe(true);
    }
  });

  it('offers the two like corrections in the filter, by their labels', () => {
    expect(AUDIT_ACTION_OPTIONS).toContainEqual({ value: 'like_removed', label: 'Like removed' });
    expect(AUDIT_ACTION_OPTIONS).toContainEqual({ value: 'likes_cleared', label: 'Likes cleared' });
  });
});

describe('who acted, and what they were', () => {
  it('names the actor apart from the sentence, so a badge can sit against the name', () => {
    expect(auditActorName(entry({ actor: { id: 'u1', username: 'wren_hallow', wasAdmin: false } })))
      .toBe('wren_hallow');
    expect(auditPredicate(entry({ action: 'terms_reset_all' })))
      .toBe('asked everyone to accept the terms again');
  });

  it('names nobody when nobody chose it', () => {
    // A quarantine deadline passing is the clock, not a person — badging one would invent an actor.
    expect(auditActorName(entry({ action: 'quarantine_expired' }))).toBeNull();
    expect(auditPredicate(entry({ action: 'quarantine_expired' }))).toMatch(/^The quarantine ran out/);
  });

  it('falls back to Someone for an entry whose actor has no name left', () => {
    expect(auditActorName(entry({ actor: { id: null, username: null, wasAdmin: false } }))).toBe('Someone');
  });

  it('still reads as one sentence when the two are joined', () => {
    // `describeAuditEntry` is the same string it always was; the split must not have moved a space.
    expect(describeAuditEntry(entry({ action: 'terms_reset_all' })))
      .toBe('root-admin asked everyone to accept the terms again');
    expect(describeAuditEntry(entry({ action: 'quarantine_expired', target: { kind: 'world', name: 'Sedge Landing' } })))
      .toBe('The quarantine ran out on the world “Sedge Landing” by trouble, and it was deleted');
  });

  it('badges the role recorded on the entry, not the one the account holds now', () => {
    const row = render(
      <p>
        {auditActorName(entry({ actor: { id: 'u1', username: 'wren_hallow', wasAdmin: false, role: 'mod' } }))}
        <RoleBadge role="mod" />
      </p>
    );

    expect(row.container.textContent).toContain('Mod');
    row.unmount();
  });

  it('badges nothing for an ordinary account', () => {
    const row = render(<RoleBadge role={null} />);

    expect(row.container.textContent).toBe('');
    row.unmount();
  });
});

describe('the rendered line', () => {
  it('reads with a single space when the actor carries no badge', async () => {
    // JSX drops the newline between the name element and the rest, so an unbadged actor ran straight
    // into the verb: "root-adminsuspended trouble".
    stubLog([entry({ actor: { id: 'a1', username: 'root-admin', wasAdmin: false, role: null } })]);

    render(<AuditLogTab active />);

    expect((await findEntryLine()).textContent).toBe('root-admin suspended trouble');
  });

  it('shows what the actor was at the time', async () => {
    stubLog([entry({ actor: { id: 'u1', username: 'wren_hallow', wasAdmin: false, role: 'mod' } })]);

    render(<AuditLogTab active />);

    expect((await findEntryLine()).textContent).toContain('Mod');
  });

  it('still reads as a sentence around the badge', async () => {
    // No space between the name and the badge: that gap is the badge's own margin, not text. The one
    // that has to be text is the one after it, or the badge runs into the verb.
    stubLog([entry({ actor: { id: 'u1', username: 'wren_hallow', wasAdmin: false, role: 'mod' } })]);

    render(<AuditLogTab active />);

    expect((await findEntryLine()).textContent).toBe('wren_hallowMod suspended trouble');
  });

  it('badges nobody on an entry nobody chose', async () => {
    // A quarantine running out has no actor; a badge there would invent one.
    stubLog([entry({ action: 'quarantine_expired', target: { kind: 'world', name: 'Sedge Landing' } })]);

    render(<AuditLogTab active />);

    const line = (await screen.findByText(/quarantine ran out/)).closest('p') as HTMLElement;
    expect(line.textContent).toBe('The quarantine ran out on the world “Sedge Landing” by trouble, and it was deleted');
  });
});
