/**
 * The public face of an account: what a stranger sees when they click a name.
 *
 * Deliberately narrow. The email, the status and the account type belong to the admin table; this is
 * the subset the server will hand to anybody, signed in or not.
 */
export interface PublicProfile {
  id: string;
  username: string;
  /** Their profile image, or null when they have none. Root-relative; see `avatarSrc`. */
  avatarUrl: string | null;
  /** When the account was created, as a server timestamp — see `lib/serverDate`. */
  createdAt: string;
}
