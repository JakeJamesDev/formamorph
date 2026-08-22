import { describe, it, expect } from 'vitest';
import { serverAssetSrc } from './serverAssets';

/**
 * Where a file the community server stores actually loads from.
 *
 * Every asset kind — profile images, event posters — comes back as a root-relative path, so this one
 * answer is what stands between a server DTO and an `img` that loads.
 */

describe('the asset URL', () => {
  it('hangs the server’s path off the API origin', () => {
    // The server answers with a root-relative path because it does not know which host reached it —
    // the desktop shell and the web build use different ones.
    expect(serverAssetSrc('/api/avatars/abc.webp', 'https://example.test/api'))
      .toBe('https://example.test/api/avatars/abc.webp');
  });

  it('does not double the /api segment', () => {
    expect(serverAssetSrc('/api/event-posters/abc.png', 'https://example.test/api/'))
      .toBe('https://example.test/api/event-posters/abc.png');
  });

  it('leaves an absolute URL alone, in case these ever move to a CDN', () => {
    expect(serverAssetSrc('https://cdn.test/abc.webp', 'https://example.test/api'))
      .toBe('https://cdn.test/abc.webp');
  });

  it('leaves a data URI alone, so a picked image previews before it is uploaded', () => {
    expect(serverAssetSrc('data:image/png;base64,AAAA', 'https://example.test/api'))
      .toBe('data:image/png;base64,AAAA');
  });

  it('is null when there is no asset', () => {
    expect(serverAssetSrc(null, 'https://example.test/api')).toBeNull();
    expect(serverAssetSrc(undefined, 'https://example.test/api')).toBeNull();
    expect(serverAssetSrc('', 'https://example.test/api')).toBeNull();
  });
});
