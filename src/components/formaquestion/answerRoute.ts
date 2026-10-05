import type { SurfaceId } from '@/lib/docs/surfaceMap';
import { resolveSurface, type SurfaceRoute } from '@/lib/surface/surfaceRoute';
import type { HelpExchange } from './useHelpChat';

/** What an answer's route reads: how it ended, whether it came from the guide, and its sources. */
export type RoutedAnswer = Pick<HelpExchange, 'status' | 'flagged'> & {
  sources: readonly { id?: string; route?: string; target?: string }[];
  lead?: { id?: string };
};

/**
 * The surface an answer's Take Me There button opens: the route of the first source other than the open
 * screen's lead, else the lead, once the answer is done. The route keeps its target only when the surface
 * registers it.
 * Null for a stopped, failed or flagged answer, a routeless source, or a route that opens nothing.
 */
export function answerRoute({ status, flagged, sources, lead }: RoutedAnswer): SurfaceRoute | null {
  if (status !== 'answered' || flagged) return null;
  const { route, target } = (sources.find((section) => !lead || section.id !== lead.id) ?? sources[0]) ?? {};
  const steps = route ? resolveSurface(route, target) : null;
  if (!steps) return null;
  // resolveSurface accepts only surface ids, so a route it resolves is one.
  const id = route as SurfaceId;
  return steps.target === undefined ? { id } : { id, target: steps.target };
}
