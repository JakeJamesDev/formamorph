import { describe, expect, it } from 'vitest';
import { newBlankWorld } from './blankWorld';
import { worldStripsLinksAndImages } from './stripLinksAndImages';

describe('newBlankWorld', () => {
  it('starts with Strip Links And Images on', () => {
    expect(worldStripsLinksAndImages(newBlankWorld().worldOverview)).toBe(true);
  });
});
