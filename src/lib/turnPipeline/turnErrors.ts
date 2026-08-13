import { isLikelyConnectionError } from '@/lib/connectionError';

/**
 * Why a turn failed, as a name the view can map to guidance. The HTTP-status and error-shape reading that
 * produces the name lives here, so nothing downstream re-derives it — and nothing has to mutate a flag onto
 * the error object to communicate what it already knows.
 */
export type TurnErrorKind =
  /** The endpoint was unreachable at the network layer — server off, wrong URL, or CORS refused. */
  | 'connection'
  /** HTTP 404: the endpoint URL or the model name does not exist. */
  | 'notFound'
  /** HTTP 400: a rejected body — usually a wrong model name or a context overflow. */
  | 'badRequest'
  /** The model's answer could not be read in the shape the turn needs. */
  | 'parse'
  /** The narration came back blank, so there is no story text to play and the turn cannot advance. */
  | 'emptyNarration'
  /** Anything else. */
  | 'unknown';

/** The message a JSON-shaped answer fails with; kept as a constant so the check can't drift from the throw. */
export const UNPARSEABLE_MESSAGE = 'Unable to parse input';

const statusOf = (error: unknown): number | undefined => {
  const e = error as { response?: { status?: number }; status?: number } | null | undefined;
  return e?.response?.status ?? e?.status;
};

/** Name a thrown error. Nothing here reads or writes anything on the error itself. */
export function classifyTurnError(error: unknown): TurnErrorKind {
  if (isLikelyConnectionError(error)) return 'connection';
  const status = statusOf(error);
  // An answer that carries a status was refused by the endpoint, whatever it said in the body — only an
  // error with no status at all is the model having produced something unreadable.
  if (status !== undefined) return status === 404 ? 'notFound' : status === 400 ? 'badRequest' : 'unknown';
  if ((error as { message?: string } | null | undefined)?.message === UNPARSEABLE_MESSAGE) return 'parse';
  return 'unknown';
}
