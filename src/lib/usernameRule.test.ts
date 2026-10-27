import { describe, it, expect } from 'vitest';
import { USERNAME_RULE_HELP, checkUsername, usernameLinkForm, usernameProfilePath } from './usernameRule';
import cases from './usernameRuleCases.json';

describe('usernameLinkForm', () => {
  it.each([
    ['one inner space', 'Jake James', 'Jake_James'],
    ['every space, keeping capitals', 'Ann Lee Ray', 'Ann_Lee_Ray'],
    ['a name with no space', 'Ann_Lee-42', 'Ann_Lee-42'],
  ])('turns %s into the link form', (_label, name, form) => {
    expect(usernameLinkForm(name)).toBe(form);
  });
});

describe('usernameProfilePath', () => {
  it('builds the profile path from the link form', () => {
    expect(usernameProfilePath('Jake James')).toBe('/u/Jake_James');
  });
});

describe('checkUsername', () => {
  it.each(cases.map((c) => [c.name, c] as const))('%s', (_name, { typed, username }) => {
    expect(checkUsername(typed)).toEqual(username === null ? { ok: false, error: USERNAME_RULE_HELP } : { ok: true, username });
  });

  it('reports an empty or blank field as required', () => {
    expect(checkUsername('')).toEqual({ ok: false, error: 'Username is required' });
    expect(checkUsername('   ')).toEqual({ ok: false, error: 'Username is required' });
  });
});
