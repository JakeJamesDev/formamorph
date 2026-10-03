import { describe, it, expect, vi } from 'vitest';
import { openExternal } from './openExternal';

describe('openExternal', () => {
  it('opens a new window with no opener, which the shells hand to the system browser', () => {
    const open = vi.spyOn(window, 'open').mockReturnValue(null);

    openExternal('https://www.patreon.com/oauth2/authorize');

    expect(open).toHaveBeenCalledWith('https://www.patreon.com/oauth2/authorize', '_blank', 'noopener,noreferrer');
    open.mockRestore();
  });
});
