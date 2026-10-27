import { maskCode, sigilMayStartAt } from './feedbackLinks';
import { usernameLinkForm } from './usernameRule';

/** What the editor should suggest for the run the caret ends. */
export interface FeedbackSuggestQuery {
  kind: 'user' | 'thread';
  /** The text typed after the sigil. */
  query: string;
  /** Where the sigil sits; a pick replaces from here to the caret. */
  start: number;
}

const USER_RUN = /@([A-Za-z0-9_-]{0,20})$/;
// A number, or title words. Digits then a space is a finished `#N` followed by prose.
const THREAD_RUN = /#([1-9]\d{0,14}|\p{L}[\p{L}\p{N} '-]{0,31})$/u;

/**
 * The `@` or `#` run the caret ends, or null. Never inside a fenced block, a closed code span, or after an
 * unmatched backtick in the same paragraph, which is a span still being typed.
 *
 * @param before - The post's text up to the caret
 */
export function feedbackSuggestQuery(before: string): FeedbackSuggestQuery | null {
  const masked = maskCode(before);
  if (masked.split(/\n[ \t]*\n/).pop()?.includes('`')) return null;
  for (const [pattern, kind] of [[USER_RUN, 'user'], [THREAD_RUN, 'thread']] as const) {
    const match = pattern.exec(masked);
    if (match && sigilMayStartAt(masked, match.index)) return { kind, query: match[1], start: match.index };
  }
  return null;
}

/** The text a pick inserts in place of the typed run. */
export const feedbackSuggestInsert = (kind: FeedbackSuggestQuery['kind'], value: string | number): string =>
  `${kind === 'user' ? `@${usernameLinkForm(String(value))}` : `#${value}`} `;
