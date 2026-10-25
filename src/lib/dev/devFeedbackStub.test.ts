// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { devFeedbackFixtures, devFeedbackMethods, searchWords } from './devFeedbackStub';

vi.mock('@/services/AuthService', () => ({ default: { getCurrentUser: vi.fn(() => ({ id: 'me' })) } }));

describe('the dev feedback board', () => {
  it('lists one branch with the filters, scope and sort the screens send', async () => {
    const stub = devFeedbackMethods(devFeedbackFixtures());

    const open = await stub.list({ type: 'question', scope: 'all', status: ['open'], sort: 'votes' });
    expect(open.threads.map((thread) => thread.votes)).toEqual([14, 2]);

    const mine = await stub.list({ type: 'question' });
    expect(mine.threads.map((thread) => thread.id)).toEqual(['dev-question-mine']);

    const found = await stub.list({ type: 'question', scope: 'all', search: 'username' });
    expect(found.total).toBe(1);
  });

  it('searches by words as the server does, best match first', async () => {
    const stub = devFeedbackMethods(devFeedbackFixtures());

    // "a" and "do" drop; "change" and "location" both hit one question, "change" alone the other.
    const found = await stub.list({ type: 'question', scope: 'all', search: 'Can a stat change location do' });
    expect(found.threads.map((thread) => thread.id)).toEqual(['dev-question-open', 'dev-question-mine']);

    expect(searchWords('AI ui Ui the THE')).toEqual(['ai', 'the']);
  });

  it('locks a question staff close, and unlocks it on reopen', async () => {
    const stub = devFeedbackMethods(devFeedbackFixtures());

    expect(await stub.setStatus('dev-question-open', 'closed')).toMatchObject({ status: 'closed', locked: true });
    expect(await stub.setStatus('dev-question-open', 'open')).toMatchObject({ status: 'open', locked: false });
  });

  it('files a question with the asker’s vote and lists it as theirs', async () => {
    const stub = devFeedbackMethods(devFeedbackFixtures());

    const filed = await stub.file({ type: 'question', title: 'Where are saves kept?', category: 'other', body: 'Body.' });

    expect(filed).toMatchObject({ votes: 1, voted: true, reporter: { id: 'me' } });
    expect((await stub.list({ type: 'question' })).threads[0].id).toBe(filed.id);
  });

  it('keeps a reply on the thread it was sent to', async () => {
    const stub = devFeedbackMethods(devFeedbackFixtures());

    await stub.comment('dev-question-open', 'Use a location script.');

    const { thread, comments } = await stub.fetchThread('dev-question-open');
    expect(comments.map((comment) => comment.body)).toEqual(['Use a location script.']);
    expect(thread.commentCount).toBe(1);
  });
});
