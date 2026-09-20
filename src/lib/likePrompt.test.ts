import { describe, it, expect } from 'vitest';
import { DEFAULT_WORLDS } from './defaultWorlds';
import { LIKE_PROMPT_TURNS, listingToAskAbout, type LikePromptWorld } from './likePrompt';

const DOWNLOADED: LikePromptWorld = {
  id: 'local-copy',
  sourceId: 'listing-1',
  downloadedAt: '2026-09-19T12:00:00.000Z',
};

/** The default case: a downloaded world, played past the threshold, online, never asked about. */
function ask(over: Partial<Parameters<typeof listingToAskAbout>[0]> = {}) {
  return listingToAskAbout({
    world: DOWNLOADED,
    turns: LIKE_PROMPT_TURNS,
    online: true,
    prompted: new Set<string>(),
    ...over,
  });
}

describe('listingToAskAbout', () => {
  it('names the listing once every rule is met', () => {
    expect(ask()).toBe('listing-1');
  });

  it('says nothing before a world is loaded', () => {
    expect(ask({ world: null })).toBeNull();
  });

  it('says nothing about a world that came from no listing', () => {
    expect(ask({ world: { id: 'local-copy', downloadedAt: DOWNLOADED.downloadedAt } })).toBeNull();
  });

  it('says nothing about a world that was never downloaded', () => {
    expect(ask({ world: { id: 'local-copy', sourceId: 'listing-1' } })).toBeNull();
  });

  it('says nothing about a bundled world, whatever it claims to have come from', () => {
    const bundled = { ...DOWNLOADED, id: DEFAULT_WORLDS[0].id };
    expect(ask({ world: bundled })).toBeNull();
  });

  it('says nothing about a listing this device has already been asked about', () => {
    expect(ask({ prompted: new Set(['listing-1']) })).toBeNull();
  });

  it('says nothing one turn below the threshold', () => {
    expect(ask({ turns: LIKE_PROMPT_TURNS - 1 })).toBeNull();
  });

  it('keeps asking above the threshold, since a save loaded past it is asked on its next turn', () => {
    expect(ask({ turns: LIKE_PROMPT_TURNS + 40 })).toBe('listing-1');
  });

  it('says nothing offline, where a like could only fail', () => {
    expect(ask({ online: false })).toBeNull();
  });
});
