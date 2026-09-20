import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { markListingPrompted, promptedListings } from './likePromptStore';

beforeEach(() => localStorage.clear());
afterEach(() => vi.restoreAllMocks());

describe('the prompted-listing marks', () => {
  it('starts with nothing asked', () => {
    expect(promptedListings().size).toBe(0);
  });

  it('remembers a listing across reads', () => {
    markListingPrompted('listing-1');
    expect([...promptedListings()]).toEqual(['listing-1']);
  });

  it('keeps every listing it is given', () => {
    markListingPrompted('listing-1');
    markListingPrompted('listing-2');
    expect([...promptedListings()].sort()).toEqual(['listing-1', 'listing-2']);
  });

  it('does not record the same listing twice', () => {
    markListingPrompted('listing-1');
    markListingPrompted('listing-1');
    expect(promptedListings().size).toBe(1);
  });

  it('reads junk in storage as nothing asked', () => {
    localStorage.setItem('FORMAMORPH_likePrompted', '{"not":"an array"}');
    expect(promptedListings().size).toBe(0);
  });

  it('drops non-string entries rather than handing them out', () => {
    localStorage.setItem('FORMAMORPH_likePrompted', '["listing-1",7,null]');
    expect([...promptedListings()]).toEqual(['listing-1']);
  });

  it('survives storage that refuses to write, and simply forgets', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });
    expect(() => markListingPrompted('listing-1')).not.toThrow();
    vi.restoreAllMocks();
    expect(promptedListings().size).toBe(0);
  });
});
