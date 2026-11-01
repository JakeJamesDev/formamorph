import { describe, it, expect } from 'vitest';
import { responseError } from './responseError';

const failed = (body: unknown): Response =>
  ({ ok: false, status: 400, statusText: 'Bad Request', url: 'https://api.test/x', text: async () => JSON.stringify(body) } as unknown as Response);

describe('responseError reasons', () => {
  it('reads the reason from an errors array', async () => {
    const error = await responseError(failed({ errors: [{ msg: 'Thumbnail is required' }] }), 'Failed to publish');
    expect(error.message).toBe('Thumbnail is required');
  });

  it('shows several reasons together', async () => {
    const error = await responseError(
      failed({ errors: [{ msg: 'Thumbnail is required' }, { msg: 'Name is too short' }] }),
      'Failed to publish',
    );
    expect(error.message).toContain('Thumbnail is required');
    expect(error.message).toContain('Name is too short');
  });

  it('keeps error and message ahead of the array', async () => {
    expect((await responseError(failed({ error: 'Nope', errors: [{ msg: 'Other' }] }), 'Fallback')).message).toBe('Nope');
    expect((await responseError(failed({ message: 'Said so' }), 'Fallback', ['message'])).message).toBe('Said so');
  });

  it('keeps the fallback for an empty array or entries without a msg', async () => {
    expect((await responseError(failed({ errors: [] }), 'Fallback')).message).toBe('Fallback');
    expect((await responseError(failed({ errors: [{}, 'x', null] }), 'Fallback')).message).toBe('Fallback');
  });
});
