import { describe, it, expect } from 'vitest';
import { ASSIGNABLE_ROLES, ROLES, badgeRole, canModerate, isAdmin, isStaff, roleOf } from './roles';

/**
 * Who the client offers what to.
 *
 * This decides what is *shown*; the server decides what is allowed. Both exist on purpose — hiding a
 * control the server would refuse anyway is a courtesy, not a defense — so these mirror the server's
 * rules rather than inventing softer ones.
 */

const account = (accountType: string, id = `id-${accountType}`) => ({ id, accountType });

describe('reading a role', () => {
  it('knows staff from ordinary accounts', () => {
    expect(isStaff(account('mod'))).toBe(true);
    expect(isStaff(account('dev'))).toBe(true);
    expect(isStaff(account('admin'))).toBe(true);
    expect(isStaff(account('normal'))).toBe(false);
  });

  it('tells an administrator from the rest of the team', () => {
    expect(isAdmin(account('admin'))).toBe(true);
    expect(isAdmin(account('dev'))).toBe(false);
    expect(isAdmin(account('mod'))).toBe(false);
  });

  it('treats anything unrecognized as ordinary', () => {
    // A role this build has not heard of must never be read as more powerful than it knows.
    expect(roleOf({ accountType: 'owner' })).toBe('normal');
    expect(roleOf({ accountType: 42 })).toBe('normal');
    expect(roleOf(null)).toBe('normal');
    expect(isStaff({ accountType: 'superadmin' })).toBe(false);
  });

  it('never offers to make anybody an administrator', () => {
    // One is made by hand on the server and nowhere else.
    expect(ASSIGNABLE_ROLES).not.toContain('admin');
    expect(ROLES).toContain('admin');
  });
});

describe('who may moderate whom', () => {
  it('lets staff act on ordinary accounts', () => {
    for (const role of ['mod', 'dev', 'admin']) {
      expect(canModerate(account(role), account('normal'))).toBe(true);
    }
  });

  it('stops an ordinary account moderating anybody', () => {
    expect(canModerate(account('normal'), account('normal', 'other'))).toBe(false);
  });

  it('stops staff turning on each other', () => {
    // One compromised moderator account could otherwise suspend the whole team in a night.
    expect(canModerate(account('mod'), account('dev'))).toBe(false);
    expect(canModerate(account('dev'), account('mod'))).toBe(false);
    expect(canModerate(account('mod', 'm1'), account('mod', 'm2'))).toBe(false);
  });

  it('lets an administrator act on a dev or a mod', () => {
    expect(canModerate(account('admin'), account('mod'))).toBe(true);
    expect(canModerate(account('admin'), account('dev'))).toBe(true);
  });

  it('protects an administrator from everybody, including other administrators', () => {
    expect(canModerate(account('mod'), account('admin'))).toBe(false);
    expect(canModerate(account('admin', 'a1'), account('admin', 'a2'))).toBe(false);
  });

  it('leaves everybody able to act on their own things', () => {
    // Not moderation: an admin clearing their own picture is not moderating an admin.
    const owner = account('admin', 'a1');

    expect(canModerate(owner, owner)).toBe(true);
  });

  it('allows an action with nobody on the other end of it', () => {
    // A listing whose author has been deleted still has to be removable.
    expect(canModerate(account('mod'), null)).toBe(true);
  });
});

describe('the reply badge', () => {
  it('names the staff role that wrote it', () => {
    expect(badgeRole('mod')).toBe('mod');
    expect(badgeRole('dev')).toBe('dev');
    expect(badgeRole('admin')).toBe('admin');
  });

  it('is absent on an ordinary reply', () => {
    expect(badgeRole('normal')).toBeNull();
    expect(badgeRole(null)).toBeNull();
    expect(badgeRole(undefined)).toBeNull();
  });

  it('is absent for a role this build does not know', () => {
    expect(badgeRole('overlord')).toBeNull();
  });
});
