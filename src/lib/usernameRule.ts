/** Help line under the Username field. Doubles as the error text for every rule failure. */
export const USERNAME_RULE_HELP = '3–20 letters, numbers, _ or -';

/** Shown when the server refuses a name another account already holds, ignoring case. */
export const USERNAME_TAKEN_MESSAGE = 'That username is taken';

const USERNAME_PATTERN = /^[A-Za-z0-9_-]{3,20}$/;

export type UsernameVerdict =
  | { ok: true; username: string }
  | { ok: false; error: string };

/** Trims the typed name, then checks it against the rule. `username` is the trimmed name to send. */
export function checkUsername(typed: string): UsernameVerdict {
  const username = typed.trim();
  if (!username) return { ok: false, error: 'Username is required' };
  if (!USERNAME_PATTERN.test(username)) return { ok: false, error: USERNAME_RULE_HELP };
  return { ok: true, username };
}
