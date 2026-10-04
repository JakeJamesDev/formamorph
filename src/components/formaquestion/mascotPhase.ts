import type { MascotPhase } from '@/lib/formaquestion/mascot';
import type { HelpExchange } from './useHelpChat';

/** Module state, so it outlives a remount of the window and ends with the app load. */
let asked = false;

/** A question went out in this app load. That ends the Initial look for good (Q9, Q10, Q36). */
export const appLoadQuestion = {
  asked: () => asked,
  record: () => { asked = true; },
};

/**
 * The window's mascot phase. Thinking runs from the send to the answer's first content text, through the
 * pick request and any reasoning text (Q18, Q30). Before the app load's first question, the Initial look shows.
 */
/** The AI's face for the answer, once its content text has started (Q30); a face set before that waits. */
export function mascotFace(last: Pick<HelpExchange, 'answerStarted' | 'face'> | undefined): string | null {
  return last?.answerStarted ? last.face ?? null : null;
}

export function mascotPhase(last: Pick<HelpExchange, 'status' | 'answerStarted'> | undefined, beforeFirstQuestion: boolean): MascotPhase {
  if (last?.status === 'writing' && !last.answerStarted) return 'thinking';
  return beforeFirstQuestion ? 'initial' : 'answering';
}
