/** DEV only: the review fixture's staff viewer, apart from the stub so the browser imports no services for it. */
import { useDevRoute } from '@/lib/devRouter';
import { isStaff } from '@/lib/roles';
import type { WorldRecord } from '@/components/WorldDetails';

export const DEV_REVIEW_FIXTURE = 'review';

/** The viewer, as an admin while the dev route has `fixture=review`. Always the viewer outside DEV. */
export function useDevReviewViewer(user: WorldRecord | null): WorldRecord | null {
  const route = useDevRoute();
  if (!import.meta.env.DEV || route?.fixture !== DEV_REVIEW_FIXTURE || isStaff(user)) return user;

  return { ...user, id: user?.id ?? 'dev-admin', username: user?.username ?? 'Formamorph Team', accountType: 'admin' };
}
