/** DEV only: the review fixture's staff viewer, apart from the stub so the browser imports no services for it. */
import { useDevRoute } from '@/lib/devRouter';
import { isStaff } from '@/lib/roles';
import type { WorldRecord } from '@/components/WorldDetails';

export const DEV_REVIEW_FIXTURE = 'review';
/** The review fixture's staff viewer, with the Moderation popover open. */
export const DEV_MODERATION_FIXTURE = 'moderation';

/** The viewer, as an admin while the dev route has `fixture=review` or `fixture=moderation`. Always the viewer outside DEV. */
export function useDevReviewViewer(user: WorldRecord | null): WorldRecord | null {
  const route = useDevRoute();
  const fixture = route?.fixture;
  if (!import.meta.env.DEV || (fixture !== DEV_REVIEW_FIXTURE && fixture !== DEV_MODERATION_FIXTURE) || isStaff(user)) return user;

  return { ...user, id: user?.id ?? 'dev-admin', username: user?.username ?? 'Formamorph Team', accountType: 'admin' };
}

/** Whether the dev route asks for the Moderation popover to start open. Always false outside DEV. */
export function useDevModerationOpen(): boolean {
  const route = useDevRoute();
  return import.meta.env.DEV && route?.fixture === DEV_MODERATION_FIXTURE;
}
