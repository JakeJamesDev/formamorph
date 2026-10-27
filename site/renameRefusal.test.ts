// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import AuthService from '@/services/AuthService';
import { watchRenameRefusal } from './renameRefusal';
import { at } from './test/support';

const realFetch = window.fetch;
let stop: () => void = () => {};

/** Install the watcher over a server that answers every request with this refusal code. */
const watchRefusedWith = (code: string) => {
  window.fetch = vi.fn(async () => new Response(JSON.stringify({ error: 'refused', code }), { status: 403 }));
  stop = watchRenameRefusal();
};

beforeEach(() => at('/account'));

afterEach(() => {
  stop();
  window.fetch = realFetch;
  vi.restoreAllMocks();
});

describe('the rename refusal watch', () => {
  it('sends the session to the rename page when a write is refused with the code', async () => {
    watchRefusedWith('USERNAME_RENAME_REQUIRED');

    await window.fetch(`${AuthService.API_URL}/feedback`, { method: 'POST' });

    expect(window.location.pathname).toBe('/rename');
  });

  it('ignores a different refusal code', async () => {
    watchRefusedWith('PRIVACY_POLICY_REQUIRED');

    await window.fetch(`${AuthService.API_URL}/feedback`, { method: 'POST' });

    expect(window.location.pathname).toBe('/account');
  });

  it('stays on the rename page when it is refused there', async () => {
    at('/rename');
    watchRefusedWith('USERNAME_RENAME_REQUIRED');
    const pushes = vi.spyOn(window.history, 'pushState');

    await window.fetch(`${AuthService.API_URL}/auth/username`, { method: 'POST' });

    expect(pushes).not.toHaveBeenCalled();
  });
});
