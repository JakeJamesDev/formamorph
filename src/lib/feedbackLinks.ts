/**
 * The link grammar of feedback bodies and comments: `#N`, `@username`, and pasted thread and listing URLs.
 * The server parses the same grammar to resolve targets; `feedbackLinkCases.json` is the case table both
 * copies run, copied from the server's `tests/fixtures/feedbackLinkCases.json`.
 */
import { usernameProfilePath } from './usernameRule';

/** The kinds of link a post can hold. */
export type FeedbackLinkKind = 'thread' | 'user' | 'listing';

/** One link in a post, by its UTF-16 offsets in the text as typed. */
export interface FeedbackLink {
  kind: FeedbackLinkKind;
  /** The thread number, `<kind>/<id>` for a listing, or the lower-cased username. */
  ref: string;
  start: number;
  end: number;
}

/** The website's host; a pasted URL links only on it. */
export const FEEDBACK_SITE_HOST = 'formamorph.ai';

/** The website address of one thread. */
export const feedbackThreadUrl = (number: string | number): string => `https://${FEEDBACK_SITE_HOST}/feedback/${number}`;

/** The address a thread chip carries in the app: none for a bug, which the website never serves. */
export const feedbackThreadChipHref = (number: number, type: string): string | undefined =>
  type === 'bug' ? undefined : feedbackThreadUrl(number);

/** The site address of one community listing. */
export const feedbackListingUrl = ({ kind, id }: { kind: string; id: string }): string =>
  `https://${FEEDBACK_SITE_HOST}/community/${kind}/${encodeURIComponent(id)}`;

/** The website address of one player's profile. */
export const feedbackProfileUrl = (username: string): string => `https://${FEEDBACK_SITE_HOST}${usernameProfilePath(username)}`;

/** Listing kinds the website has a page for. A model has none, so its URL is not a link. */
const LISTING_KINDS = ['world', 'entity', 'dictionary', 'prompt'];

// The path ends the URL, or a query or fragment follows: `/feedback/23/comments` is not a link.
const URL_PATTERN = new RegExp(
  `https?://(?:www\\.)?${FEEDBACK_SITE_HOST.replace(/\./g, '\\.')}`
  + `(?:/feedback/([1-9]\\d{0,14})(?![\\w-])|/community/(${LISTING_KINDS.join('|')})/([^\\s/?#<>()\\[\\]]+))`
  + '/?(?=$|[\\s?#<>()\\[\\]]|[.,;:!?]+(?:$|[\\s<>()\\[\\]]))(?:[?#][^\\s<>]*)?',
  'gu',
);
/** Sentence punctuation a pasted URL is usually followed by, never part of it. */
const URL_TRAILING = /[.,;:!?)]+$/;

const THREAD_PATTERN = /#([1-9]\d{0,14})(?![\p{L}\p{N}_])/gu;
const USER_PATTERN = /@([A-Za-z0-9_-]{3,20})(?![A-Za-z0-9_-])/g;
/** A sigil links only at the start or after none of these, so `C#`, `a@b.com` and `&#23;` stay plain. */
const NO_SIGIL_AFTER = /[\p{L}\p{N}_@#&/`]/u;

/** Whether a `#` or `@` at `at` may start a link, by the character before it. */
export const sigilMayStartAt = (text: string, at: number): boolean => at === 0 || !NO_SIGIL_AFTER.test(text[at - 1]);

/** Blank out fenced code blocks and inline code spans, keeping every offset where it was. */
export function maskCode(text: string): string {
  const chars = text.split('');
  const blank = (from: number, to: number) => { for (let i = from; i < to; i += 1) chars[i] = ' '; };

  // Fences, line by line. An unclosed fence runs to the end of the text.
  let offset = 0;
  let fence: string | null = null;
  let fenceStart = 0;
  const prose: [number, number][] = [];
  let proseStart = 0;
  for (const line of text.split('\n')) {
    const end = offset + line.length;
    const marker = /^ {0,3}(`{3,}|~{3,})/.exec(line);
    if (fence) {
      if (marker && marker[1][0] === fence[0] && marker[1].length >= fence.length && /^\s*$/.test(line.slice(marker[0].length))) {
        blank(fenceStart, end);
        fence = null;
        proseStart = end + 1;
      }
    } else if (marker && !(marker[1][0] === '`' && line.slice(marker[0].length).includes('`'))) {
      prose.push([proseStart, offset]);
      fence = marker[1];
      fenceStart = offset;
    }
    offset = end + 1;
  }
  if (fence) blank(fenceStart, text.length);
  else prose.push([proseStart, text.length]);

  // Inline code: a backtick run closes at the next run of the same length; with none, it is literal.
  for (const [from, to] of prose) {
    const runs = [...text.slice(from, to).matchAll(/`+/g)].map((run) => ({ at: from + run.index, size: run[0].length }));
    for (let i = 0; i < runs.length; i += 1) {
      const close = runs.findIndex((run, j) => j > i && run.size === runs[i].size);
      if (close === -1) continue;
      blank(runs[i].at, runs[close].at + runs[close].size);
      i = close;
    }
  }

  return chars.join('');
}

function decodeId(raw: string): string | null {
  try {
    return decodeURIComponent(raw) || null;
  } catch {
    return null;
  }
}

/**
 * Every link in a post, in text order. Repeats are kept: each occurrence has its own position.
 *
 * @param text - A thread body or a comment, never a title
 */
export function parseFeedbackLinks(text: string): FeedbackLink[] {
  if (!text) return [];
  const source = maskCode(text);
  const links: FeedbackLink[] = [];
  const taken: [number, number][] = [];

  for (const match of source.matchAll(URL_PATTERN)) {
    const whole = match[0].replace(URL_TRAILING, '');
    const start = match.index;
    const end = start + whole.length;
    taken.push([start, end]);
    if (match[1]) {
      links.push({ kind: 'thread', ref: match[1], start, end });
    } else {
      const id = decodeId(match[3].replace(URL_TRAILING, ''));
      if (id) links.push({ kind: 'listing', ref: `${match[2]}/${id}`, start, end });
    }
  }

  const inUrl = (at: number) => taken.some(([from, to]) => at >= from && at < to);
  const sigils: [RegExp, FeedbackLinkKind, (name: string) => string][] = [
    [THREAD_PATTERN, 'thread', (name) => name],
    [USER_PATTERN, 'user', (name) => name.toLowerCase()],
  ];
  for (const [pattern, kind, refOf] of sigils) {
    for (const match of source.matchAll(pattern)) {
      if (inUrl(match.index) || !sigilMayStartAt(source, match.index)) continue;
      links.push({ kind, ref: refOf(match[1]), start: match.index, end: match.index + match[0].length });
    }
  }

  return links.sort((a, b) => a.start - b.start);
}
