import type { FeedbackLinkPlace } from '@/components/menu/FeedbackMarkdown';
import type { FeedbackType } from '@/types';
import { feedbackListingPath, feedbackThreadPath } from './feedbackLinks';
import { usernameProfilePath } from './usernameRule';

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
  /** Whether filed threads can be followed on their tab in Feedback. */
  followThreads: boolean;
  /** Whether a failed write is said under its control; off sends it to `notify` alone. */
  inlineNotes: boolean;
  /** The boards `#` suggestions search, or null for every board the reader may read. */
  threadSearchTypes: readonly FeedbackType[] | null;
  /** Where chips lead outside a thread. Absent: the app's addresses. */
  linkPlace?: FeedbackLinkPlace;
}

/** The complete in-app feedback surface. */
export const APP_FEEDBACK_CAPABILITIES: FeedbackCapabilities = {
  boards: ['bug', 'suggestion', 'question'],
  fileTypes: ['bug', 'suggestion', 'question'],
  staffControls: true,
  unreadBadge: true,
  followThreads: true,
  inlineNotes: false,
  threadSearchTypes: null,
};

const VOTABLE_BOARDS: readonly FeedbackType[] = ['suggestion', 'question'];

/** The website board: Votable boards only, no staff powers, no unread marks. */
export const WEBSITE_FEEDBACK_CAPABILITIES: FeedbackCapabilities = {
  boards: VOTABLE_BOARDS,
  fileTypes: VOTABLE_BOARDS,
  staffControls: false,
  unreadBadge: false,
  followThreads: false,
  inlineNotes: true,
  threadSearchTypes: VOTABLE_BOARDS,
  linkPlace: {
    boards: VOTABLE_BOARDS,
    threadHref: feedbackThreadPath,
    listingHref: feedbackListingPath,
    profileHref: usernameProfilePath,
  },
};
