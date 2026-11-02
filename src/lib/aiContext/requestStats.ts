import type { AiStreamResult } from '@/lib/aiRequest/aiStream';

/** A stream shorter than this arrived in one burst, so its speed says nothing about the model. */
const MIN_SPEED_WINDOW_MS = 100;

/** How one AI reply went, across all its Tool rounds. */
export interface AiRequestStats {
  totalMs: number;
  /** Null where no token arrived. */
  firstTokenMs: number | null;
  /** Time spent generating, without queues or running Tools. */
  generatingMs: number;
  tokens: number;
  /** True where `tokens` counts stream frames, because the endpoint reported no count. */
  tokensEstimated: boolean;
  finishReason: string | null;
}

export function requestStatsOf({ timings, output, finishReason }: AiStreamResult): AiRequestStats {
  return {
    totalMs: timings.endedAt - timings.startedAt,
    firstTokenMs: timings.firstTokenAt === null ? null : timings.firstTokenAt - timings.startedAt,
    generatingMs: output.generatingMs,
    tokens: output.reportedTokens ?? output.frames,
    tokensEstimated: output.reportedTokens === null,
    finishReason,
  };
}

/** Tokens per second, or null where the reply gives no fair measure. */
export function tokensPerSecond({ tokens, generatingMs }: AiRequestStats): number | null {
  return tokens > 0 && generatingMs >= MIN_SPEED_WINDOW_MS ? tokens / (generatingMs / 1000) : null;
}
