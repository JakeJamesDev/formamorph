import type { SurfaceId } from '@/lib/docs/surfaceMap';
import { resolveSurface } from '@/lib/surface/surfaceRoute';
import type { HelpExchange } from './useHelpChat';

/** What an answer's route reads: how it ended, whether it came from the guide, and its sources. */
export type RoutedAnswer = Pick<HelpExchange, 'status' | 'flagged'> & { sources: readonly { route?: string }[] };

/**
 * The surface an answer's Take Me There button opens: the top source's route, once the answer is done.
 * Null for a stopped, failed or flagged answer, a routeless top source, or a route that opens nothing.
 */
export function answerRoute({ status, flagged, sources }: RoutedAnswer): SurfaceId | null {
  if (status !== 'answered' || flagged) return null;
  const route = sources[0]?.route;
  // resolveSurface accepts only surface ids, so a route it resolves is one.
  return route && resolveSurface(route) ? (route as SurfaceId) : null;
}
