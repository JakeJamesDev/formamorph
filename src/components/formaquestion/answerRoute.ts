import type { SurfaceId } from '@/lib/docs/surfaceMap';
import { resolveSurface, type SurfaceRoute } from '@/lib/surface/surfaceRoute';
import type { HelpExchange } from './useHelpChat';

/** What an answer's route reads: how it ended, whether it came from the guide, its text and its sources. */
export type RoutedAnswer = Pick<HelpExchange, 'status' | 'flagged'> & Partial<Pick<HelpExchange, 'answer'>> & {
  sources: readonly { id?: string; route?: string; target?: string; markdown?: string }[];
  lead?: { id?: string };
};

/** An answer line shorter than this many words matches too many sections to count. */
const MIN_LINE_WORDS = 4;

/** Lowercase words, without markdown, punctuation or a list marker. */
function plain(text: string): string {
  return text.toLowerCase().replace(/^\s*(?:[-*+]|\d+[.)])\s+/, '').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}

/** How many of the answer's lines the section holds word for word. */
function overlap(lines: readonly string[], markdown: string | undefined): number {
  if (!markdown) return 0;
  const body = ` ${markdown.split('\n').map(plain).join(' ')} `;
  return lines.filter((line) => body.includes(` ${line} `)).length;
}

/**
 * The surface an answer's Take Me There button opens: the route of the source whose lines the answer copies
 * most, else of the first source other than the open screen's lead, else the lead, once the answer is done.
 * The route keeps its target only when the surface registers it.
 * Null for a stopped, failed or flagged answer, a routeless source, or a route that opens nothing.
 */
export function answerRoute({ status, flagged, answer = '', sources, lead }: RoutedAnswer): SurfaceRoute | null {
  if (status !== 'answered' || flagged) return null;
  const others = sources.filter((section) => !lead || section.id !== lead.id);
  const candidates = others.length > 0 ? others : sources;
  const lines = answer.split('\n').map(plain).filter((line) => line.split(' ').length >= MIN_LINE_WORDS);
  let best = candidates[0];
  let bestScore = 0;
  for (const section of candidates) {
    const score = overlap(lines, section.markdown);
    if (score > bestScore) [best, bestScore] = [section, score];
  }
  const { route, target } = best ?? {};
  const steps = route ? resolveSurface(route, target) : null;
  if (!steps) return null;
  // resolveSurface accepts only surface ids, so a route it resolves is one.
  const id = route as SurfaceId;
  return steps.target === undefined ? { id } : { id, target: steps.target };
}
