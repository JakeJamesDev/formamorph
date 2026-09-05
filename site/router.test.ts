import { describe, it, expect } from 'vitest';
import { profileUsername } from './router';

describe('reading a name out of a profile path', () => {
  it('takes the name', () => {
    expect(profileUsername('/u/wren_hallow')).toBe('wren_hallow');
  });

  it('decodes it, since the address bar holds the escaped form', () => {
    expect(profileUsername('/u/wren%20hallow')).toBe('wren hallow');
  });

  it('stops at the next slash, so nothing nested is read as a name', () => {
    expect(profileUsername('/u/wren_hallow/likes')).toBeNull();
  });

  it('is not a name at all for the other routes', () => {
    expect(profileUsername('/login')).toBeNull();
    expect(profileUsername('/profile')).toBeNull();
    expect(profileUsername('/u/')).toBeNull();
    expect(profileUsername('/u')).toBeNull();
  });

  it('answers null for an escape that does not decode, rather than throwing', () => {
    expect(profileUsername('/u/%')).toBeNull();
  });
});
