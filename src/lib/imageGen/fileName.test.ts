import { describe, it, expect } from 'vitest';
import { DEFAULT_IMAGE_FILE_NAME, imageFilePrefix } from './fileName';

describe('the picture file name', () => {
  it('fills the default pattern with the world and the subject', () => {
    expect(imageFilePrefix(DEFAULT_IMAGE_FILE_NAME, { world: 'Kitsune Wood', subject: 'Suya' })).toBe('formamorph/Kitsune Wood/Suya');
  });

  it('takes the preset and the turn where the pattern names them', () => {
    expect(imageFilePrefix('formamorph/{world}/{preset}/turn-{turn}', { world: 'W', turn: 12, preset: 'Z-Image' })).toBe('formamorph/W/Z-Image/turn-12');
  });

  it('makes each part safe and drops a folder that comes out empty', () => {
    expect(imageFilePrefix('formamorph/{world}/{subject}', { subject: 'What? A: "fox"' })).toBe('formamorph/What- A- -fox-');
    expect(imageFilePrefix('{world}/../{subject}', { world: 'W', subject: 'S' })).toBe('W/S');
  });

  it('falls back to a plain name when the pattern leaves nothing', () => {
    expect(imageFilePrefix('{world}', {})).toBe('Formamorph');
  });
});
