import { describe, expect, it } from 'vitest';
import { DEFAULT_AVATAR_ID, PRALINE_AVATAR_ID, pickerStart } from './defaultAvatar';

describe('pickerStart', () => {
  it('starts on the device default', () => {
    expect(pickerStart(['heron', DEFAULT_AVATAR_ID, 'reed'], 'reed')).toBe('reed');
  });

  it('starts on the bundled copy with no device default, or one that is gone', () => {
    expect(pickerStart(['heron', DEFAULT_AVATAR_ID], undefined)).toBe(DEFAULT_AVATAR_ID);
    expect(pickerStart(['heron', DEFAULT_AVATAR_ID], 'reed')).toBe(DEFAULT_AVATAR_ID);
  });

  it('starts on the first library Avatar when the bundled copy is gone too', () => {
    expect(pickerStart(['heron', 'reed'], 'gone')).toBe('heron');
  });

  it('skips Praline when she is simply the newest record, and starts on her when she is all there is or was chosen', () => {
    expect(pickerStart([PRALINE_AVATAR_ID, 'heron'], undefined)).toBe('heron');
    expect(pickerStart([PRALINE_AVATAR_ID, 'heron', DEFAULT_AVATAR_ID], undefined)).toBe(DEFAULT_AVATAR_ID);
    expect(pickerStart([PRALINE_AVATAR_ID], undefined)).toBe(PRALINE_AVATAR_ID);
    expect(pickerStart([PRALINE_AVATAR_ID, 'heron'], PRALINE_AVATAR_ID)).toBe(PRALINE_AVATAR_ID);
  });
});
