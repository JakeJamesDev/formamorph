/**
 * The lines of the Ask tab that name who answers. With the Mascot on they say her name; off, they say
 * "your AI". The name is the active preset's, so a custom card reads as itself.
 */
import type { HelpSettings } from './helpSettings';
import type { HelpStage } from './helpSession';
import { activeMascotPreset } from './mascotPresets';

/** Who answers: the active mascot's name while the Mascot is on, else null for the generic lines. */
export const speakerName = (settings: Pick<HelpSettings, 'mascot' | 'mascotPresets'>): string | null =>
  (settings.mascot ? activeMascotPreset(settings.mascotPresets).name : null);

/** The wait line of each stage, under the question until its answer text starts. */
const STAGE_LINE: Record<HelpStage, string> = {
  checking: 'Checking your AI…',
  searching: 'Searching the guide…',
  picking: 'Searching with your AI…',
  waiting: 'Waiting for your AI…',
  lookingUp: 'Looking up…',
};

/** The wait line of `stage`, with her as the actor of each. The guide search is the app's own work, so it never takes her name. */
export function stageLine(stage: HelpStage, who: string | null): string {
  if (who === null) return STAGE_LINE[stage];
  switch (stage) {
    case 'checking': return `${who} is getting ready…`;
    case 'searching': return STAGE_LINE.searching;
    case 'picking': return `${who} is choosing guide sections…`;
    // The same words as the Thinking header, so a reasoning model's start moves the line, not the text.
    case 'waiting': return `${who} is thinking…`;
    case 'lookingUp': return `${who} is reading the guide…`;
  }
}

/** The line that stands in for an answer that never came, or stopped short. No AI connected is about the endpoint, never her. */
export function fallbackLine(status: 'no-ai' | 'failed', partial: boolean, matched: boolean, who: string | null): string {
  const cause = status === 'no-ai' ? 'No AI is connected'
    : partial ? `${who === null ? 'The answer' : who} did not finish`
    : `${who ?? 'The AI'} did not answer`;
  return matched ? `${cause}. These guide sections match your question.` : `${cause}, and no guide section matches your question`;
}

/** The empty conversation's invitation. */
export const emptyRoomLine = (who: string | null): string => (who === null ? 'Ask how to do something in Formamorph' : `Ask ${who} how to do something in Formamorph`);

/** The Thinking header: while the model reasons, then the time it took. */
export function thinkingLine(active: boolean, ms: number, who: string | null): string {
  const seconds = Math.max(1, Math.round(ms / 1000));
  if (who === null) return active ? 'Thinking…' : `Thought for ${seconds}s`;
  return active ? `${who} is thinking…` : `${who} thought for ${seconds}s`;
}
