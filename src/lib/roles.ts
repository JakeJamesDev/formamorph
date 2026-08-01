/**
 * Who is allowed to do what. Mirrors the server's `config/roles`.
 *
 * The client's copy decides what to *show*; the server's decides what to allow. Both exist on purpose —
 * hiding a control the server would refuse anyway is a courtesy, not a defense.
 */

/** Every account type. `dev` and `mod` are peers with different names, not a rank. */
export const ROLES = ['normal', 'mod', 'dev', 'admin'] as const;
export type Role = (typeof ROLES)[number];

/** The roles carrying moderation powers. */
export const STAFF_ROLES: readonly Role[] = ['mod', 'dev', 'admin'];

/** What an administrator may set somebody to. `admin` is made on the server and nowhere else. */
export const ASSIGNABLE_ROLES: readonly Role[] = ['normal', 'mod', 'dev'];

/** How each role reads in a badge or a dropdown. */
export const ROLE_LABELS: Record<Role, string> = {
  normal: 'User',
  mod: 'Mod',
  dev: 'Dev',
  admin: 'Admin',
};

/** The tint each staff badge carries, so the three read apart at a glance. */
export const ROLE_BADGE_STYLES: Record<Role, string> = {
  normal: 'bg-muted text-muted-foreground',
  mod: 'bg-info/10 text-info',
  dev: 'bg-success/10 text-success',
  admin: 'bg-primary/10 text-primary',
};

/** An account as the client holds it — every shape the server hands back carries `accountType`. */
interface AccountLike {
  accountType?: unknown;
  id?: unknown;
  [key: string]: unknown;
}

/** The role of an account, defaulting to `normal` for anything unrecognized. */
export function roleOf(user: AccountLike | null | undefined): Role {
  const value = user?.accountType;

  return (ROLES as readonly string[]).includes(value as string) ? (value as Role) : 'normal';
}

/** Whether this account carries moderation powers of any kind. */
export const isStaff = (user: AccountLike | null | undefined): boolean =>
  STAFF_ROLES.includes(roleOf(user));

/** Whether this account is an administrator specifically. */
export const isAdmin = (user: AccountLike | null | undefined): boolean => roleOf(user) === 'admin';

/**
 * Whether `actor` may act on `target` as a moderator.
 *
 * Staff moderate the room, not each other: a dev or a mod reaches ordinary accounts only, an admin also
 * reaches dev and mod, and nobody reaches an admin. Your own things are always yours.
 *
 * @param actor - The signed-in user
 * @param target - The account being acted on, or null when the action has no owner
 * @returns Whether to offer the control
 */
export function canModerate(
  actor: AccountLike | null | undefined,
  target?: AccountLike | null
): boolean {
  if (!isStaff(actor)) return false;
  if (!target) return true;
  if (actor?.id !== undefined && actor.id === target.id) return true;
  if (!isStaff(target)) return true;

  return isAdmin(actor) && !isAdmin(target);
}

/** A staff role to badge a feedback reply with, or null for an ordinary one. */
export function badgeRole(role: string | null | undefined): Role | null {
  return role && STAFF_ROLES.includes(role as Role) ? (role as Role) : null;
}
