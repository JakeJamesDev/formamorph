import AuthService from '@/services/AuthService';
import { readerKey } from '@/lib/anonymousLikes';

/** Who is reading community data right now, from the session this app holds. */
export const currentReader = (): string =>
  readerKey(AuthService.isAuthenticated(), AuthService.currentUser?.id);
