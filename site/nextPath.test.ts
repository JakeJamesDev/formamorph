import { describe, it, expect } from 'vitest';
import { safeNextPath, signInTo } from './nextPath';

describe('safeNextPath', () => {
  it('keeps a same-origin absolute path', () => {
    expect(safeNextPath('/account')).toBe('/account');
    expect(safeNextPath('/u/alice')).toBe('/u/alice');
    expect(safeNextPath('/play/')).toBe('/play/');
  });

  it('keeps the query and the fragment', () => {
    expect(safeNextPath('/account?tab=email#verify')).toBe('/account?tab=email#verify');
  });

  it('falls back when nothing was asked for', () => {
    expect(safeNextPath(null)).toBe('/');
    expect(safeNextPath(undefined)).toBe('/');
    expect(safeNextPath('')).toBe('/');
  });

  // The whole point of the filter: a link a stranger wrote must not decide where a signed-in reader
  // lands. Every one of these is absolute to the browser, whatever it looks like.
  it('refuses another origin', () => {
    expect(safeNextPath('https://evil.test/steal')).toBe('/');
    expect(safeNextPath('//evil.test/steal')).toBe('/');
    expect(safeNextPath('/\\evil.test/steal')).toBe('/');
    expect(safeNextPath('\\\\evil.test/steal')).toBe('/');
    expect(safeNextPath('  //evil.test')).toBe('/');
  });

  it('refuses a scheme that is not a page at all', () => {
    expect(safeNextPath('javascript:alert(1)')).toBe('/');
    expect(safeNextPath('data:text/html,<script>')).toBe('/');
  });

  it('refuses a relative path, because only an absolute one is a site route', () => {
    expect(safeNextPath('account')).toBe('/');
    expect(safeNextPath('../account')).toBe('/');
  });

  it('honors a caller-supplied fallback', () => {
    expect(safeNextPath('https://evil.test', '/account')).toBe('/account');
  });
});

describe('sending a reader to sign in and back', () => {
  it('escapes the return path, so it survives the filter on the way back', () => {
    // The trap this closes: a hand-written `?next=/account` arrives with a bare slash, and a page that
    // gets that wrong loses the return path silently — the reader lands on the landing page instead.
    expect(signInTo('/account')).toBe('/login?next=%2Faccount');
    expect(safeNextPath(new URLSearchParams(signInTo('/account').split('?')[1]).get('next')))
      .toBe('/account');
  });

  it('round-trips a path that carries its own query', () => {
    const round = (path: string) =>
      safeNextPath(new URLSearchParams(signInTo(path).split('?')[1]).get('next'));

    expect(round('/u/wren?tab=worlds')).toBe('/u/wren?tab=worlds');
  });
});
