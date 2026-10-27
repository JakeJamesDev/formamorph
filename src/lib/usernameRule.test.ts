import { describe, it, expect } from 'vitest';
import { USERNAME_RULE_HELP, checkUsername } from './usernameRule';

describe('checkUsername', () => {
  const valid: [string, string][] = [
    ['three-character minimum', 'abc'],
    ['twenty-character maximum', 'a'.repeat(20)],
    ['letters, digits, underscore and hyphen', 'Ann_Lee-42'],
    ['digits only', '123'],
  ];
  it.each(valid)('accepts %s', (_label, name) => {
    expect(checkUsername(name)).toEqual({ ok: true, username: name });
  });

  const invalid: [string, string][] = [
    ['two characters', 'ab'],
    ['twenty-one characters', 'a'.repeat(21)],
    ['an inner space', 'ann lee'],
    ['a dot', 'ann.lee'],
    ['an email address', 'ann@example.com'],
    ['a non-ASCII letter', 'Zoë_1'],
    ['the deletion placeholder', '[deleted user]'],
    ['an inner tab', 'ann\tlee'],
  ];
  it.each(invalid)('refuses %s with the help text', (_label, name) => {
    expect(checkUsername(name)).toEqual({ ok: false, error: USERNAME_RULE_HELP });
  });

  it('trims outer whitespace before the check and returns the trimmed name', () => {
    expect(checkUsername('  alice \t')).toEqual({ ok: true, username: 'alice' });
  });

  it('counts the length after trimming', () => {
    expect(checkUsername(` ${'a'.repeat(20)} `)).toEqual({ ok: true, username: 'a'.repeat(20) });
    expect(checkUsername(' ab ')).toEqual({ ok: false, error: USERNAME_RULE_HELP });
  });

  it('reports an empty or blank field as required', () => {
    expect(checkUsername('')).toEqual({ ok: false, error: 'Username is required' });
    expect(checkUsername('   ')).toEqual({ ok: false, error: 'Username is required' });
  });
});
