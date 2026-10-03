import { SAME_AS_ANSWER, type HelpSettings } from './helpSettings';

/**
 * The preset ids each help request tries, in order. The first that names a preset wins; none follows the
 * active endpoint. A pick preset that was deleted falls back to the answer route, as Same as Answer does.
 */
export function helpRoutes({ answerEndpoint, pickEndpoint }: Pick<HelpSettings, 'answerEndpoint' | 'pickEndpoint'>): { answer: string[]; pick: string[] } {
  const answer = answerEndpoint === null ? [] : [answerEndpoint];
  const pick = pickEndpoint === SAME_AS_ANSWER ? answer : pickEndpoint === null ? [] : [pickEndpoint, ...answer];
  return { answer, pick };
}
