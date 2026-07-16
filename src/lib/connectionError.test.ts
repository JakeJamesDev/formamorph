import { describe, it, expect, afterEach } from 'vitest';
import { isLikelyConnectionError } from './connectionError';

describe('isLikelyConnectionError', () => {
  afterEach(() => {
    delete (window as { formamorphDesktop?: unknown }).formamorphDesktop;
  });

  it('flags a browser fetch network TypeError', () => {
    expect(isLikelyConnectionError(new TypeError('Failed to fetch'))).toBe(true);
  });

  it('ignores HTTP-error Errors (they carry .response, not a TypeError)', () => {
    const err = new Error('HTTP error') as Error & { response?: unknown };
    err.response = { status: 404 };
    expect(isLikelyConnectionError(err)).toBe(false);
  });

  it('ignores abort DOMExceptions', () => {
    expect(isLikelyConnectionError(new DOMException('aborted', 'AbortError'))).toBe(false);
  });

  it('never fires on the desktop build (CORS is shimmed there)', () => {
    (window as { formamorphDesktop?: unknown }).formamorphDesktop = {};
    expect(isLikelyConnectionError(new TypeError('Failed to fetch'))).toBe(false);
  });
});
