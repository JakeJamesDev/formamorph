import { describe, expect, it } from 'vitest';
import { feedbackListingPath } from '@/lib/feedbackLinks';
import { communityListingPath, communityListingTarget } from './communityListing';

describe('community listing destinations', () => {
  it('encodes a listing kind and opaque id into one canonical website path', () => {
    expect(communityListingPath({ kind: 'entity', id: 'cat / 7' }))
      .toBe('/community/entity/cat%20%2F%207');
  });

  it('writes the address a listing chip carries', () => {
    const listing = { kind: 'entity', id: 'cat / 7' } as const;
    expect(communityListingPath(listing)).toBe(feedbackListingPath(listing));
  });

  it('reads a canonical listing destination', () => {
    expect(communityListingTarget('/community/dictionary/harbor%20terms'))
      .toEqual({ status: 'listing', listing: { kind: 'dictionary', id: 'harbor terms' } });
  });

  it('reads a prompt listing destination', () => {
    expect(communityListingTarget(communityListingPath({ kind: 'prompt', id: 'p-1' })))
      .toEqual({ status: 'listing', listing: { kind: 'prompt', id: 'p-1' } });
  });

  it('keeps the catalog route distinct from a malformed listing destination', () => {
    expect(communityListingTarget('/community')).toEqual({ status: 'catalog' });
    expect(communityListingTarget('/community/world')).toEqual({ status: 'invalid' });
    expect(communityListingTarget('/community/contest/abc')).toEqual({ status: 'invalid' });
    expect(communityListingTarget('/community/world/%')).toEqual({ status: 'invalid' });
  });
});
