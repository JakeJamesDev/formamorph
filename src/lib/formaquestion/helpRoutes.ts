import { SAME_AS_ANSWER, SAME_AS_SEARCH, type HelpSettings } from './helpSettings';

/**
 * The preset ids each help request tries, in order. The first that names a preset wins; none follows the
 * active endpoint. A pick or Create preset that was deleted falls back to the answer route, as Same as Answer
 * does; an Intent Classifier preset that was deleted falls back to the pick route, as Same as Search does.
 */
export function helpRoutes({ answerEndpoint, pickEndpoint, intentEndpoint, createEndpoint }: Pick<HelpSettings, 'answerEndpoint' | 'pickEndpoint' | 'intentEndpoint' | 'createEndpoint'>): { answer: string[]; pick: string[]; intent: string[]; create: string[] } {
  const answer = answerEndpoint === null ? [] : [answerEndpoint];
  const following = (endpoint: string | null, same: string, base: string[]) => (endpoint === same ? base : endpoint === null ? [] : [endpoint, ...base]);
  const pick = following(pickEndpoint, SAME_AS_ANSWER, answer);
  const intent = following(intentEndpoint, SAME_AS_SEARCH, pick);
  const create = following(createEndpoint, SAME_AS_ANSWER, answer);
  return { answer, pick, intent, create };
}
