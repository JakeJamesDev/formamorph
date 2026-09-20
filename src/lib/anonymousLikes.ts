/**
 * What an Anonymous Like is addressed by: this copy of the app.
 *
 * An account Like is one account's mark. An Anonymous Like is one **Install's** — a random id made once
 * and kept in local storage, sent in a header. It names a copy of the app and nothing else, which is why
 * a guest can press the heart without an account.
 *
 * This file mirrors the server's `config/anonymousLikes.js`. The header name and the refusal codes are
 * copied from it rather than guessed: an unrecognized code reads as an unexplained refusal, and a header
 * the server does not read is no header at all.
 */

/** Where the id lives, under the prefix every other browser-stored value here uses. */
export const INSTALL_STORAGE_KEY = 'FORMAMORPH_installId';

/** The header the id travels in, spelled as the server's CORS allow-list spells it. */
export const INSTALL_HEADER_NAME = 'X-Formamorph-Install';

/** Why a press was refused, so each refusal gets the answer it deserves. */
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
 * How many Anonymous Likes one connection may give one listing. The server holds the same number, and
 * refuses the fourth.
 */
export const ADDRESS_CAP = 3;

/**
 * Whether this reader may press the heart.
 *
 * An account may press any listing but its own. A signed-out reader may press only where this shell
 * takes a guest's like at all, and there they may always empty a heart they filled: the privacy text
 * promises that pressing again takes an Anonymous Like back, so a switch-off must not strand somebody
 * who already liked. A shell that takes none, such as the website, sends every guest press to sign-in.
 *
 * Whether a signed-out reader owns the listing is the server's to answer, from the account that claimed
 * the Install. It refuses that press and the heart goes back.
 *
 * @param reader - Their session, whose listing it is, whether this shell takes a guest's like, whether
 *   the server takes one right now, and whether they already like it
 */
export function mayPressHeart(reader: {
  signedIn: boolean;
  ownListing: boolean;
  guestLikes: boolean;
  serverTakesLikes: boolean;
  liked: boolean | undefined;
}): boolean {
  if (reader.signedIn) return !reader.ownListing;
  return reader.guestLikes && (reader.serverTakesLikes || reader.liked === true);
}

/**
 * What the heart does about a refusal.
 *
 * `signIn` hands the press to the guest handler. `cap` is the one refusal worth a message, because
 * signing in is a way past it. `silent` puts the heart back and says nothing: a listing that has gone
 * quiet, a suspension, an author's own listing and a malformed header are each either not the reader's
 * business or the client's own bug. Anything else is `report`, so a server fault reaches the reader as
 * an error rather than a heart that springs back unexplained.
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
const INSTALL_ID_SHAPE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The id in hand, so a browser that refuses to store keeps one Install for as long as it is open. */
let held: string | null = null;

/**
 * This copy of the app's Install id if it has one already, without making one.
 *
 * For a reader whose question is about the Install rather than addressed by it. A Claim asks whether
 * there are Anonymous Likes to move, and an app that has never needed an id has none: making one to ask
 * would make the very thing the question is about, and would link a fresh Install to the account.
 *
 * A stored value that is not a UUID is no id: the server refuses it, and the column it would be stored
 * in is the key a Claim moves rows by.
 *
 * @returns The id in lower case, or null when this copy of the app has never needed one
 */
export function storedInstallId(): string | null {
  if (held) return held;

  try {
    const stored = localStorage.getItem(INSTALL_STORAGE_KEY);
    if (stored && INSTALL_ID_SHAPE.test(stored)) {
      held = stored.toLowerCase();
      return held;
    }
  } catch {
    // A browser that refuses to read has nothing to answer with.
  }

  return null;
}

/**
 * This copy of the app's Install id, made on first need.
 *
 * @returns The id, which is always a UUID
 */
export function installId(): string {
  const existing = storedInstallId();
  if (existing) return existing;

  held = crypto.randomUUID().toLowerCase();
  try {
    localStorage.setItem(INSTALL_STORAGE_KEY, held);
  } catch {
    // Private mode and a full quota both throw. The id above still works for this session.
  }
  return held;
}
