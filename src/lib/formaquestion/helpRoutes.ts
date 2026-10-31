import { SAME_AS_ANSWER, SAME_AS_SEARCH, type HelpSettings } from './helpSettings';

/**
 * The preset ids each help request tries, in order. The first that names a preset wins; none follows the
 * active endpoint. A pick preset that was deleted falls back to the answer route, as Same as Answer does; an
 * Intent Classifier preset that was deleted falls back to the pick route, as Same as Search does.
 */
export function helpRoutes({ answerEndpoint, pickEndpoint, intentEndpoint }: Pick<HelpSettings, 'answerEndpoint' | 'pickEndpoint' | 'intentEndpoint'>): { answer: string[]; pick: string[]; intent: string[] } {
  const answer = answerEndpoint === null ? [] : [answerEndpoint];
  const pick = pickEndpoint === SAME_AS_ANSWER ? answer : pickEndpoint === null ? [] : [pickEndpoint, ...answer];
  const intent = intentEndpoint === SAME_AS_SEARCH ? pick : intentEndpoint === null ? [] : [intentEndpoint, ...pick];
  return { answer, pick, intent };
}
