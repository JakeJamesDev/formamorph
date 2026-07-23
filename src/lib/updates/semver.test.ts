import { describe, it, expect } from 'vitest';
import { parseVersion, compareSemver, isNewer } from './semver';

describe('parseVersion', () => {
  it('parses with and without a leading v, and a prerelease suffix', () => {
    expect(parseVersion('v2.3.1')).toEqual({ major: 2, minor: 3, patch: 1, prerelease: null });
    expect(parseVersion('2.3.1')).toEqual({ major: 2, minor: 3, patch: 1, prerelease: null });
    expect(parseVersion('v2.3.1-beta.2')).toEqual({ major: 2, minor: 3, patch: 1, prerelease: 'beta.2' });
  });

  it('returns null on malformed input', () => {
    expect(parseVersion('not-a-version')).toBeNull();
    expect(parseVersion('2.3')).toBeNull();
  });
});

describe('compareSemver', () => {
  it('treats equal versions as equal (v-prefix tolerant)', () => {
    expect(compareSemver('2.1.0', 'v2.1.0')).toBe(0);
  });

  it('orders by major, then minor, then patch', () => {
    expect(compareSemver('3.0.0', '2.9.9')).toBe(1);
    expect(compareSemver('2.1.0', '2.2.0')).toBe(-1);
    expect(compareSemver('2.1.5', '2.1.4')).toBe(1);
  });

  it('ranks a final release above its prerelease', () => {
    expect(compareSemver('2.1.0', '2.1.0-beta.1')).toBe(1);
    expect(compareSemver('2.1.0-beta.1', '2.1.0')).toBe(-1);
    expect(compareSemver('2.1.0-beta.2', '2.1.0-beta.1')).toBe(1);
  });

  it('orders numeric prerelease identifiers numerically, not lexically', () => {
    // The bug: string compare made 'beta.10' < 'beta.9'. Semver orders these numerically.
    expect(compareSemver('2.1.0-beta.10', '2.1.0-beta.9')).toBe(1);
    expect(compareSemver('2.1.0-beta.9', '2.1.0-beta.10')).toBe(-1);
    expect(isNewer('2.1.0-beta.10', '2.1.0-beta.9')).toBe(true);
  });

  it('follows semver identifier precedence (numeric < alphanumeric, more fields wins)', () => {
    expect(compareSemver('1.0.0-alpha', '1.0.0-alpha.1')).toBe(-1); // fewer fields precede
    expect(compareSemver('1.0.0-alpha.1', '1.0.0-alpha.beta')).toBe(-1); // numeric < alphanumeric
    expect(compareSemver('1.0.0-beta', '1.0.0-alpha')).toBe(1); // ASCII order for alphanumerics
    expect(compareSemver('1.0.0-rc.1', '1.0.0-rc.1')).toBe(0);
  });

  it('compares as equal when either side is unparseable (no false newer)', () => {
    expect(compareSemver('garbage', '2.1.0')).toBe(0);
    expect(compareSemver('2.1.0', 'garbage')).toBe(0);
  });
});

describe('isNewer', () => {
  it('is true only when latest strictly exceeds current', () => {
    expect(isNewer('2.2.0', '2.1.0')).toBe(true);
    expect(isNewer('2.1.0', '2.1.0')).toBe(false);
    expect(isNewer('2.0.0', '2.1.0')).toBe(false);
    expect(isNewer('2.1.0-beta.1', '2.1.0')).toBe(false);
  });
});
