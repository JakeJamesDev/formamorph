/** Help line under the Username field. Doubles as the error text for every rule failure. */
export const USERNAME_RULE_HELP = '3–20 letters, numbers, spaces, _ or -';

/** Shown when the server refuses a name another account already holds, ignoring case. */
export const USERNAME_TAKEN_MESSAGE = 'That username is taken';

/** Shown when a rename fails and the server gave no text. */
export const USERNAME_RENAME_FAILED_MESSAGE = 'Failed to change the username';

/** First clause of the rename screens' intro. The caller adds the current name and the closing sentence. */
export const USERNAME_RULE_INTRO = 'Formamorph has a new username rule';

// The server applies the same rule; `usernameRuleCases.json` is copied from its `tests/fixtures/usernameRuleCases.json`.
const USERNAME_PATTERN = /^[A-Za-z0-9_-]+(?: [A-Za-z0-9_-]+)*$/;
const USERNAME_MIN = 3;
const USERNAME_MAX = 20;

/** A stored name in its link form: each space becomes `_`, capitals stay. Profile links and `@` inserts use it. */
export const usernameLinkForm = (username: string): string => username.replace(/ /g, '_');

/** The site path of a player's profile, `/u/<link form>`. */
export const usernameProfilePath = (username: string): string => `/u/${encodeURIComponent(usernameLinkForm(username))}`;

export type UsernameVerdict =
  | { ok: true; username: string }
  | { ok: false; error: string };

/** Trims the typed name, collapses space runs, then checks it against the rule. `username` is the collapsed name to send. */
export function checkUsername(typed: string): UsernameVerdict {
  const username = typed.trim().replace(/ {2,}/g, ' ');
  if (!username) return { ok: false, error: 'Username is required' };
  const sized = username.length >= USERNAME_MIN && username.length <= USERNAME_MAX;
  if (!sized || !USERNAME_PATTERN.test(username)) return { ok: false, error: USERNAME_RULE_HELP };
  return { ok: true, username };
}
