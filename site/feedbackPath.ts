/** The boards the website lists, by the tab key the board strip uses. */
export type FeedbackBoard = 'suggestions' | 'questions';

/** What a feedback address asks for. */
export type FeedbackTarget =
  | { status: 'board'; board: FeedbackBoard }
  | { status: 'thread'; number: string }
  | { status: 'invalid' };

/** The board a bare `/feedback` opens on, and the one `?board=` names when it names none we list. */
export const DEFAULT_FEEDBACK_BOARD: FeedbackBoard = 'suggestions';

const THREAD_PATH = /^\/feedback\/([^/]+)$/;
/** A thread number as the link grammar writes it: no zero, no padding. */
const THREAD_NUMBER = /^[1-9]\d{0,14}$/;

/**
 * Read a feedback address. A thread segment that is not a thread number is invalid, so it costs no request.
 *
 * @param rawPathname - The path as the address bar holds it; a trailing slash is the same route
 * @param search - The query string, with or without its `?`
 */
export function feedbackTarget(rawPathname: string, search: string): FeedbackTarget {
  const pathname = rawPathname.length > 1 && rawPathname.endsWith('/') ? rawPathname.slice(0, -1) : rawPathname;
  if (pathname === '/feedback') {
    const board = new URLSearchParams(search).get('board');
    return { status: 'board', board: board === 'questions' ? 'questions' : DEFAULT_FEEDBACK_BOARD };
  }

  const number = THREAD_PATH.exec(pathname)?.[1];
  return number && THREAD_NUMBER.test(number) ? { status: 'thread', number } : { status: 'invalid' };
}

/** The address of one board. */
export const feedbackBoardPath = (board: FeedbackBoard): string =>
  board === DEFAULT_FEEDBACK_BOARD ? '/feedback' : `/feedback?board=${board}`;

/** The address of one thread. */
export const feedbackThreadPath = (number: number | string): string => `/feedback/${number}`;
