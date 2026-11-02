import { describe, it, expect } from 'vitest';
import type { AiStreamResult } from '@/lib/aiRequest/aiStream';
import { requestStatsOf, tokensPerSecond } from './requestStats';

const result = (reportedTokens: number | null, firstTokenAt: number | null = 1500): AiStreamResult => ({
  content: 'x', reasoningText: '', reasoningField: null, finishReason: 'length', toolCalls: [],
  timings: { startedAt: 1000, firstTokenAt, firstContentAt: firstTokenAt, endedAt: 3500 },
  output: { frames: 40, reportedTokens, generatingMs: 2000 },
});

describe('requestStatsOf', () => {
  it('prefers the count the endpoint reported', () => {
    expect(requestStatsOf(result(55))).toMatchObject({ tokens: 55, tokensEstimated: false });
  });

  it('falls back to the frames, marked as an estimate', () => {
    expect(requestStatsOf(result(null))).toMatchObject({ tokens: 40, tokensEstimated: true });
  });

  it('measures both times from the start of the request', () => {
    expect(requestStatsOf(result(null))).toMatchObject({ totalMs: 2500, firstTokenMs: 500, finishReason: 'length' });
  });

  it('keeps first token empty where no token arrived', () => {
    expect(requestStatsOf(result(null, null)).firstTokenMs).toBeNull();
  });
});

describe('tokensPerSecond', () => {
  it('divides by the generating time, not the total time', () => {
    expect(tokensPerSecond(requestStatsOf(result(null)))).toBe(20);
  });
});
