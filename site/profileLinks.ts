import { usernameProfilePath } from '@/lib/usernameRule';
import { leaveTo } from './leaveSite';

/** A name opens the site's own profile page: the value a page gives `UserProfileContext`. */
export const PROFILE_LINKS = {
  openProfile: (_userId: string | null | undefined, username?: string | null) => {
    if (username) leaveTo(usernameProfilePath(username));
  },
  setListingOpener: () => {},
  profileLeavesPage: true,
};
