import { describe, it, expect } from 'vitest';
import { DEFAULT_IMAGE_FILE_NAME, imageFilePrefix } from './fileName';

describe('the image file name', () => {
  it('keeps a slash in a name inside its part', () => {
    expect(imageFilePrefix(DEFAULT_IMAGE_FILE_NAME, { world: 'A/B', subject: 'C\\D' })).toBe('formamorph/A-B/C-D');
    expect(imageFilePrefix('{preset}/x', { preset: 'SDXL/Turbo' })).toBe('SDXL-Turbo/x');
  });

  it('never lets a name climb out of the output folder', () => {
    expect(imageFilePrefix(DEFAULT_IMAGE_FILE_NAME, { world: '../..', subject: 'x' })).toBe('formamorph/..-../x');
    expect(imageFilePrefix(DEFAULT_IMAGE_FILE_NAME, { world: '..', subject: '.' })).toBe('formamorph');
  });

  it('renames a Windows device name, with or without an extension', () => {
    expect(imageFilePrefix(DEFAULT_IMAGE_FILE_NAME, { world: 'con', subject: 'Lpt1.png' })).toBe('formamorph/_con/_Lpt1.png');
    expect(imageFilePrefix('nul/{subject}', { subject: 'COM9' })).toBe('_nul/_COM9');
    expect(imageFilePrefix(DEFAULT_IMAGE_FILE_NAME, { world: 'Console', subject: 'COM10' })).toBe('formamorph/Console/COM10');
  });

  it('takes a name with a dollar sign as written', () => {
    expect(imageFilePrefix(DEFAULT_IMAGE_FILE_NAME, { world: "$& $' $1", subject: 'x' })).toBe("formamorph/$& $' $1/x");
  });

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
