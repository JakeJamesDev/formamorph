import { enforcedReasoningBudget } from '@/lib/reasoningDialect';
import type { AiStreamSpec } from './aiStream';

/**
 * Logs a thought that ran past the budget its server should have ended it at, which a llama.cpp build
 * without per-request budgets lets happen. llama.cpp streams one token per frame, so the frames count it.
 */
export function noteReasoningOverrun(spec: AiStreamSpec, reasoningFrames: number): void {
  const dialect = spec.target?.reasoning?.dialect;
  const budget = dialect && enforcedReasoningBudget(dialect, spec.body);
  if (budget === undefined || reasoningFrames <= budget) return;
  console.debug(`${dialect} thought ran ${reasoningFrames} tokens against a budget of ${budget}`);
}
