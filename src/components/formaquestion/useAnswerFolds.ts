import type { HelpSettings, HelpSettingsChange } from '@/lib/formaquestion/helpSettings';
import { useFoldRule } from './useFoldRule';
import type { HelpExchange } from './useHelpChat';

export type Fold = ReturnType<typeof useFoldRule>;

/** The open state of an answer's Thinking block and of its Sources list. */
export interface AnswerFolds {
  readonly thinking: Fold;
  readonly sources: Fold;
}

/** The sections listed under an answer: a flagged answer lists the nearest sections in place of its sources. */
export const answerList = ({ flagged, nearest, sources }: HelpExchange) => (flagged
  ? { listed: nearest, listLabel: 'Nearest Sections' }
  : { listed: sources, listLabel: 'Sources' });

/** The folds of one answer, or of none yet. Each takes its default when its content arrives. */
export function useAnswerFolds(exchange: HelpExchange | undefined, settings: HelpSettings, onSettingsChange: (change: HelpSettingsChange) => void): AnswerFolds {
  const thinking = useFoldRule(!!exchange?.reasoning, settings.thinkingOpen, (thinkingOpen) => onSettingsChange({ thinkingOpen }));
  // Sources and Nearest Sections share one fold, set when the list arrives.
  const sources = useFoldRule(!!exchange && answerList(exchange).listed.length > 0, settings.sourcesOpen, (sourcesOpen) => onSettingsChange({ sourcesOpen }));
  return { thinking, sources };
}
