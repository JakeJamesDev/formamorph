import { describe, it, expect } from 'vitest';
import { activeValueKey } from './openValueContext';

/**
 * The rule that decides which open value shows its active form. It lives apart from the chip because the
 * branch it turns on — the field holding the keyboard — cannot be reached in jsdom, where a value's own
 * editing island never takes DOM focus.
 */
describe('activeValueKey', () => {
  it('gives the active form to the value holding the caret', () => {
    expect(activeValueKey('3', true, null)).toBe('3');
  });

  it('lets the caret beat a header press on another value', () => {
    expect(activeValueKey('3', true, '7')).toBe('3');
  });

  it('falls back to the header press where no value holds the caret', () => {
    expect(activeValueKey(null, true, '7')).toBe('7');
  });

  it('falls back to the header press in a field that holds no keyboard', () => {
    // A read-only field never takes a caret, so a press is the only way one of its values reads as active.
    expect(activeValueKey(null, false, '7')).toBe('7');
  });

  it('ignores a caret the field no longer holds', () => {
    expect(activeValueKey('3', false, '7')).toBe('7');
  });

  it('leaves every value compact with neither a caret nor a press', () => {
    expect(activeValueKey(null, true, null)).toBeNull();
    expect(activeValueKey(null, false, null)).toBeNull();
  });
});
