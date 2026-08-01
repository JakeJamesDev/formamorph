import { describe, it, expect } from 'vitest';
import { categoryForType, changedFields, mayEditAnything, mayEditProse, mayRefile } from './feedbackEditing';
import type { FeedbackThread } from '@/types';

/**
 * Who owns which part of a report.
 *
 * A bug is a work item for the team, so a poorly written one can be made useful. A suggestion is
 * somebody's idea on a public board and stays in their words. The filing is triage either way. This
 * decides what is offered; the server decides the same thing again.
 */

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

const reporter = { id: 'u1', accountType: 'normal' };
const stranger = { id: 'u2', accountType: 'normal' };
const moderator = { id: 'm1', accountType: 'mod' };

describe('rewriting the words', () => {
  it('is the reporter’s on their own report', () => {
    expect(mayEditProse(thread(), reporter)).toBe(true);
  });

  it('is nobody else’s', () => {
    expect(mayEditProse(thread(), stranger)).toBe(false);
    expect(mayEditProse(thread(), null)).toBe(false);
  });

  it('is also the team’s, on a bug', () => {
    // A bug is a work item, not a piece of somebody's writing.
    expect(mayEditProse(thread(), moderator)).toBe(true);
  });

  it('is not the team’s on a suggestion', () => {
    expect(mayEditProse(thread({ type: 'suggestion', category: 'gameplay' }), moderator)).toBe(false);
  });

  it('stops for the reporter once it is locked', () => {
    expect(mayEditProse(thread({ locked: true }), reporter)).toBe(false);
  });

  it('does not stop for the team, who are never locked out of their own queue', () => {
    expect(mayEditProse(thread({ locked: true }), moderator)).toBe(true);
  });
});

describe('re-filing', () => {
  it('is the team’s alone, including on somebody’s own report', () => {
    expect(mayRefile(moderator)).toBe(true);
    expect(mayRefile(reporter)).toBe(false);
  });

  it('leaves an ordinary reader with their own words and nothing else', () => {
    expect(mayEditAnything(thread(), reporter)).toBe(true);
    expect(mayEditAnything(thread({ locked: true }), reporter)).toBe(false);
    expect(mayEditAnything(thread(), stranger)).toBe(false);
  });

  it('still gives the team something to do on a locked suggestion', () => {
    // They cannot touch the words, but the filing is theirs.
    expect(mayEditAnything(thread({ type: 'suggestion', category: 'gameplay', locked: true }), moderator)).toBe(true);
  });
});

describe('what gets sent', () => {
  const all = { prose: true, refile: true };

  it('is only what actually moved', () => {
    // The server writes exactly what it is given, so an untouched field would stamp the thread as
    // edited for nothing.
    const draft = { title: 'IT BROKE', body: 'doesnt work', category: 'crash', type: 'bug' };

    expect(changedFields(draft, thread(), all)).toEqual({});
  });

  it('trims the prose, so trailing space is not a change', () => {
    const draft = { title: '  IT BROKE  ', body: 'doesnt work', category: 'crash', type: 'bug' };

    expect(changedFields(draft, thread(), all)).toEqual({});
  });

  it('carries one field without the other', () => {
    const draft = { title: 'Save button spins forever', body: 'doesnt work', category: 'crash', type: 'bug' };

    expect(changedFields(draft, thread(), all)).toEqual({ title: 'Save button spins forever' });
  });

  it('sends the category on a move even when it is the same word on both lists', () => {
    // The isolating case: `other` exists on both branches, so nothing about the category itself changed
    // — but the server refuses a move that names no category, so it still has to go.
    const draft = { title: 'IT BROKE', body: 'doesnt work', category: 'other', type: 'suggestion' };

    expect(changedFields(draft, thread({ category: 'other' }), all))
      .toEqual({ type: 'suggestion', category: 'other' });
  });

  it('sends the category alongside a type move, even untouched', () => {
    // The two lists share only three values, so the old category is usually not one the new branch has —
    // and the server refuses a move that names none.
    const draft = { title: 'IT BROKE', body: 'doesnt work', category: 'other', type: 'suggestion' };

    expect(changedFields(draft, thread(), all)).toEqual({ type: 'suggestion', category: 'other' });
  });

  it('leaves out what this reader may not change', () => {
    // A reporter's dialog never shows the filing, but a draft that somehow carried it must not send it.
    const draft = { title: 'Save button spins forever', body: 'doesnt work', category: 'editor', type: 'suggestion' };

    expect(changedFields(draft, thread(), { prose: true, refile: false }))
      .toEqual({ title: 'Save button spins forever' });
  });

  it('leaves out the prose for somebody who may only re-file', () => {
    const draft = { title: 'Rewritten', body: 'Rewritten', category: 'editor', type: 'bug' };

    expect(changedFields(draft, thread(), { prose: false, refile: true })).toEqual({ category: 'editor' });
  });
});

describe('the category after a branch move', () => {
  it('keeps one the new branch also has', () => {
    // `editor`, `community` and `other` are on both lists.
    expect(categoryForType('suggestion', 'editor')).toBe('editor');
    expect(categoryForType('bug', 'other')).toBe('other');
  });

  it('replaces one it does not, rather than leaving it invalid', () => {
    // `crash` has no honest answer as a suggestion, and the server refuses a move that names one.
    expect(categoryForType('suggestion', 'crash')).toBe('gameplay');
    expect(categoryForType('bug', 'gameplay')).toBe('crash');
  });

  it('leaves a type it does not recognize alone', () => {
    expect(categoryForType('complaint', 'crash')).toBe('crash');
  });
});
