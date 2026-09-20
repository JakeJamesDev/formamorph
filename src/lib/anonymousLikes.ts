/**
 * What an Anonymous Like is addressed by: this copy of the app.
 *
 * An account Like is one account's mark. An Anonymous Like is one **Install's** — a random id made once
 * and kept in local storage, sent in a header. It names a copy of the app and nothing else, which is the
 * whole of why a guest can press the heart without an account.
 *
 * This file mirrors the server's `config/anonymousLikes.js`. The header name and the refusal codes are
 * that file's, copied rather than guessed: a code the client does not recognize reads as an unexplained
 * refusal, and a header the server does not read is no header at all.
 */

/** Where the id lives, under the prefix every other browser-stored value here uses. */
export const INSTALL_STORAGE_KEY = 'FORMAMORPH_installId';

/** The header the id travels in, spelled as the server's CORS allow-list spells it. */
export const INSTALL_HEADER_NAME = 'X-Formamorph-Install';

/**
 * Why a press was refused, so each one gets the answer it deserves.
 *
 * A switched-off server sends the guest where the heart used to send them. A listing that has gone quiet
 * needs no message at all. Only the cap has anything to say, because signing in is a way past it.
 */
export const ANONYMOUS_LIKE_CODES = {
  OFF: 'anonymous_likes_off',
  NOT_VISIBLE: 'listing_not_visible',
  BAD_INSTALL: 'install_header_invalid',
  BAD_LIKED: 'liked_invalid',
  ADDRESS_CAP: 'anonymous_likes_address_cap',
  ACCOUNT_SUSPENDED: 'anonymous_likes_account_suspended',
  ACCOUNT_OWN_LISTING: 'anonymous_likes_account_own_listing',
  ACCOUNT_ALREADY_LIKED: 'anonymous_likes_account_already_liked',
} as const;

/**
 * Whether a signed-out reader may press this heart.
 *
 * A filled heart is always theirs to empty. The privacy text promises that pressing again takes an
 * Anonymous Like back, so somebody who liked before the operator switched the feature off keeps the way
 * out they were promised. Only an empty heart is sent to sign-in.
 *
 * @param guestLikes - Whether this shell and this server both take a guest's like
 * @param liked - Whether this reader already likes the listing
 */
export const guestMayPress = (guestLikes: boolean, liked: boolean | undefined): boolean =>
  guestLikes || liked === true;

/**
 * What the heart does about a refusal.
 *
 * `signIn` hands the press to the guest handler, which is where the heart sent a guest before this
 * feature existed. `cap` is the one refusal worth a message, because signing in is a way past it.
 * `silent` puts the heart back and says nothing: a listing that has gone quiet, a suspension, an
 * author's own listing and a malformed header are each either not the reader's business or the
 * client's own bug. Anything else is `report`, so a server fault reaches the reader as an error
 * rather than a heart that springs back for no stated reason.
 */
export type RefusalAnswer = 'signIn' | 'cap' | 'silent' | 'report';

/**
 * How to answer one refusal code.
 *
 * @param code - The code the server sent, or an empty string when it sent none
 */
export function refusalAnswer(code: string): RefusalAnswer {
  switch (code) {
    case ANONYMOUS_LIKE_CODES.OFF:
      return 'signIn';
    case ANONYMOUS_LIKE_CODES.ADDRESS_CAP:
      return 'cap';
    case ANONYMOUS_LIKE_CODES.NOT_VISIBLE:
    case ANONYMOUS_LIKE_CODES.BAD_INSTALL:
    case ANONYMOUS_LIKE_CODES.BAD_LIKED:
    case ANONYMOUS_LIKE_CODES.ACCOUNT_SUSPENDED:
    case ANONYMOUS_LIKE_CODES.ACCOUNT_OWN_LISTING:
      return 'silent';
    default:
      return 'report';
  }
}

/** A UUID as `crypto.randomUUID()` writes one. The server checks the same shape and refuses anything else. */
const INSTALL_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * The id in hand this session, so a browser that refuses to store keeps one Install for as long as it is
 * open rather than a new one per press.
 */
let held: string | null = null;

/**
 * This copy of the app's Install id, made on first need.
 *
 * A stored value that is not a UUID is replaced rather than sent: the server refuses it, and the column
 * it would be stored in is the key a Claim later moves rows by.
 *
 * @returns The id, which is always a UUID
 */
export function installId(): string {
  if (held) return held;

  try {
    const stored = localStorage.getItem(INSTALL_STORAGE_KEY);
    if (stored && INSTALL_ID.test(stored)) {
      held = stored.toLowerCase();
      return held;
    }
  } catch {
    // A browser that refuses to read still gets an Install; it just gets a new one next launch.
  }

  held = crypto.randomUUID().toLowerCase();
  try {
    localStorage.setItem(INSTALL_STORAGE_KEY, held);
  } catch {
    // Private mode and a full quota both throw. The id above still works for this session.
  }
  return held;
}
