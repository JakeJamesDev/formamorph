import { enforcedReasoningBudget, type ReasoningDialect } from '@/lib/reasoningDialect';
import type { AiStreamSpec } from './aiStream';

/** A thought that ran past the budget its server should have ended it at. */
export interface ReasoningOverrun {
  dialect: ReasoningDialect;
  tokens: number;
  budget: number;
}

/**
 * The overrun of a thought its server should have ended at the sent budget, which a llama.cpp build without
 * per-request budgets lets happen; `null` where none. llama.cpp streams one token per frame, so the frames count it.
 */
export function reasoningOverrun(spec: AiStreamSpec, reasoningFrames: number): ReasoningOverrun | null {
  const dialect = spec.target?.reasoning?.dialect;
  const budget = dialect && enforcedReasoningBudget(dialect, spec.body);
  if (!dialect || budget === undefined || reasoningFrames <= budget) return null;
  return { dialect, tokens: reasoningFrames, budget };
}
