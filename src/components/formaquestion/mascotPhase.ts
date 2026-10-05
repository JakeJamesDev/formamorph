import type { MascotPhase } from '@/lib/formaquestion/mascot';
import type { HelpExchange } from './useHelpChat';

/** The AI's face for the answer, once its content text has started (Q30); a face set before that waits. */
export function mascotFace(last: Pick<HelpExchange, 'answerStarted' | 'face'> | undefined): string | null {
  return last?.answerStarted ? last.face ?? null : null;
}

/**
 * The window's mascot phase. Thinking runs from the send to the answer's first content text, through the
 * pick request and any reasoning text (Q18, Q30). With no exchange, the Initial look shows (Q28).
 */
export function mascotPhase(last: Pick<HelpExchange, 'status' | 'answerStarted'> | undefined): MascotPhase {
  if (!last) return 'initial';
  return last.status === 'writing' && !last.answerStarted ? 'thinking' : 'answering';
}
