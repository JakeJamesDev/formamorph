import type { FeedbackLinkPlace } from '@/components/menu/FeedbackMarkdown';
import { feedbackListingPath, feedbackThreadPath } from './feedbackLinks';
import { WEBSITE_FEEDBACK_CAPABILITIES } from './feedbackCapabilities';
import { usernameProfilePath } from './usernameRule';

/** The actions a Community Creations shell may expose. */
export interface CommunityBrowserCapabilities {
  localLibrary: boolean;
  deviceDownloads: boolean;
  hiddenFilters: boolean;
  likes: boolean;
  /** Whether a guest may like a listing here, rather than being sent to sign-in. */
  guestLikes: boolean;
  comments: boolean;
  authorManagement: boolean;
  moderation: boolean;
  contestParticipation: boolean;
  reports: boolean;
  /** Where chips in a listing comment lead. Absent: the app's addresses, with a listing opening in place. */
  commentLinkPlace?: FeedbackLinkPlace;
}

/** The complete browser game surface. */
export const APP_COMMUNITY_CAPABILITIES: CommunityBrowserCapabilities = {
  localLibrary: true,
  deviceDownloads: false,
  hiddenFilters: true,
  likes: true,
  guestLikes: true,
  comments: true,
  authorManagement: true,
  moderation: true,
  contestParticipation: true,
  reports: true,
};

/**
 * The website catalog permits downloads and Likes; other mutations stay in the game.
 *
 * A guest here is sent to sign-in as they always were. An Install names a copy of the app, and the
 * website is not one.
 */
export const WEBSITE_COMMUNITY_CAPABILITIES: CommunityBrowserCapabilities = {
  localLibrary: false,
  deviceDownloads: true,
  hiddenFilters: false,
  likes: true,
  guestLikes: false,
  comments: false,
  authorManagement: false,
  moderation: false,
  contestParticipation: false,
  reports: false,
  commentLinkPlace: {
    boards: WEBSITE_FEEDBACK_CAPABILITIES.boards,
    threadHref: feedbackThreadPath,
    listingHref: feedbackListingPath,
    profileHref: usernameProfilePath,
  },
};
