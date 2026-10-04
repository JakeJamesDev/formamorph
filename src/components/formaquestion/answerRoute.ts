import type { SurfaceId } from '@/lib/docs/surfaceMap';
import { resolveSurface } from '@/lib/surface/surfaceRoute';
import type { HelpExchange } from './useHelpChat';

/** What an answer's route reads: how it ended, whether it came from the guide, and its sources. */
export type RoutedAnswer = Pick<HelpExchange, 'status' | 'flagged'> & {
  sources: readonly { id?: string; route?: string }[];
  lead?: { id?: string };
};

/**
 * The surface an answer's Take Me There button opens: the route of the first source other than the open
 * screen's lead, else the lead, once the answer is done.
 * Null for a stopped, failed or flagged answer, a routeless source, or a route that opens nothing.
 */
export function answerRoute({ status, flagged, sources, lead }: RoutedAnswer): SurfaceId | null {
  if (status !== 'answered' || flagged) return null;
  const route = (sources.find((section) => !lead || section.id !== lead.id) ?? sources[0])?.route;
  // resolveSurface accepts only surface ids, so a route it resolves is one.
  return route && resolveSurface(route) ? (route as SurfaceId) : null;
}
