import { describe, expect, it } from 'vitest';
import type { AIRequestType } from '@/types';
import { createPendingRequests } from './pendingRequests';

/** A request the test settles by hand. */
function deferred() {
  let resolve!: () => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<void>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('createPendingRequests', () => {
  it('names choices while they run, then the memory passes still running after them', async () => {
    const labels: AIRequestType[] = [];
    const pending = createPendingRequests((type) => labels.push(type));
    const summary = deferred();
    const choices = deferred();
    const diary = deferred();
    void pending.track('summary', () => summary.promise);
    void pending.track('choices', () => choices.promise);
    void pending.track('diary', () => diary.promise);
    expect(labels.at(-1)).toBe('choices');

    choices.resolve();
    await flush();
    expect(labels.at(-1)).toBe('summary');

    summary.resolve();
    await flush();
    expect(labels.at(-1)).toBe('diary');
  });

  it('keeps a type pending until every request of it settles', async () => {
    const labels: AIRequestType[] = [];
    const pending = createPendingRequests((type) => labels.push(type));
    const first = deferred();
    const second = deferred();
    const summary = deferred();
    void pending.track('summary', () => summary.promise);
    void pending.track('diary', () => first.promise);
    void pending.track('diary', () => second.promise);

    summary.resolve();
    first.resolve();
    await flush();
    expect(labels.at(-1)).toBe('diary');
  });

  it('releases a failed request and passes its error through', async () => {
    const labels: AIRequestType[] = [];
    const pending = createPendingRequests((type) => labels.push(type));
    const choices = deferred();
    const summary = deferred();
    const failed = pending.track('choices', () => choices.promise);
    void pending.track('summary', () => summary.promise);

    choices.reject(new Error('refused'));
    await expect(failed).rejects.toThrow('refused');
    expect(labels.at(-1)).toBe('summary');
  });

  it('leaves the last label standing once nothing is pending', async () => {
    const labels: AIRequestType[] = [];
    const pending = createPendingRequests((type) => labels.push(type));
    await pending.track('choices', () => Promise.resolve('ok'));
    expect(labels).toEqual(['choices']);
  });
});
