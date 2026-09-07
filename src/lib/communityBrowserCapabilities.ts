/** The actions a Community Creations shell may expose. */
export interface CommunityBrowserCapabilities {
  localLibrary: boolean;
  deviceDownloads: boolean;
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
  deviceDownloads: false,
  hiddenFilters: true,
  likes: true,
  comments: true,
  authorManagement: true,
  moderation: true,
  contestParticipation: true,
  reports: true,
};

/** The website catalog permits downloads and Likes; other mutations stay in the game. */
export const WEBSITE_COMMUNITY_CAPABILITIES: CommunityBrowserCapabilities = {
  localLibrary: false,
  deviceDownloads: true,
  hiddenFilters: false,
  likes: true,
  comments: false,
  authorManagement: false,
  moderation: false,
  contestParticipation: false,
  reports: false,
};
