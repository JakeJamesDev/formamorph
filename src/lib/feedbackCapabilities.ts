import type { FeedbackType } from '@/types';

/** Reports a result to the reader; `error` carries the caught failure behind an `error` line. */
export type FeedbackNotify = (message: string, kind: 'success' | 'error', error?: unknown) => void;

/** What a feedback surface may show and do. */
export interface FeedbackCapabilities {
  /** The boards that get a tab, in tab order. */
  boards: readonly FeedbackType[];
  /** The types the filing form offers, in tab order. */
  fileTypes: readonly FeedbackType[];
  /** Whether a staff reader gets staff powers here; off treats them as a player. */
  staffControls: boolean;
  /** Whether unread threads are marked. */
  unreadBadge: boolean;
  /** Whether filed threads can be followed under a profile tab. */
  profileThreads: boolean;
  /** Whether a failed write is said under its control; off sends it to `notify` alone. */
  inlineNotes: boolean;
  /** The boards `#` suggestions search, or null for every board the reader may read. */
  threadSearchTypes: readonly FeedbackType[] | null;
}

/** The complete in-app feedback surface. */
export const APP_FEEDBACK_CAPABILITIES: FeedbackCapabilities = {
  boards: ['bug', 'suggestion', 'question'],
  fileTypes: ['bug', 'suggestion', 'question'],
  staffControls: true,
  unreadBadge: true,
  profileThreads: true,
  inlineNotes: false,
  threadSearchTypes: null,
};

/** The website board: Votable boards only, no staff powers, no unread marks. */
export const WEBSITE_FEEDBACK_CAPABILITIES: FeedbackCapabilities = {
  boards: ['suggestion', 'question'],
  fileTypes: ['suggestion', 'question'],
  staffControls: false,
  unreadBadge: false,
  profileThreads: false,
  inlineNotes: true,
  threadSearchTypes: ['suggestion', 'question'],
};
