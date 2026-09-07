/** The actions a Community Creations shell may expose. */
export interface CommunityBrowserCapabilities {
  localLibrary: boolean;
  hiddenFilters: boolean;
  likes: boolean;
  comments: boolean;
  authorManagement: boolean;
  moderation: boolean;
  contestParticipation: boolean;
  reports: boolean;
}

/** The complete browser game surface. */
export const APP_COMMUNITY_CAPABILITIES: CommunityBrowserCapabilities = {
  localLibrary: true,
  hiddenFilters: true,
  likes: true,
  comments: true,
  authorManagement: true,
  moderation: true,
  contestParticipation: true,
  reports: true,
};

/** The website catalog stays read-only until its action slices land. */
export const WEBSITE_COMMUNITY_CAPABILITIES: CommunityBrowserCapabilities = {
  localLibrary: false,
  hiddenFilters: false,
  likes: false,
  comments: false,
  authorManagement: false,
  moderation: false,
  contestParticipation: false,
  reports: false,
};
