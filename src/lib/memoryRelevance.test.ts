import { describe, it, expect } from 'vitest';
import {
  RELEVANCE_HALF_LIFE_TURNS,
  vectorKey,
  cosineSimilarity,
  relevanceScore,
  buildRelevanceScores,
} from './memoryRelevance';
import type { BandTurn } from './turnBanding';
import type { ChatMessage } from '@/types';

function turn(i: number, summary?: string): BandTurn {
  return {
    index: i * 2 + 1,
    turnId: `t${i}`,
    userMsg: { role: 'user', content: `action ${i}` } as ChatMessage,
    gameText: `narration ${i}`,
    summary,
  };
}

const vec = (...vals: number[]) => new Float32Array(vals);

describe('cosineSimilarity', () => {
  it('is the dot product for normalized vectors: 1 aligned, 0 orthogonal, -1 opposed', () => {
    expect(cosineSimilarity(vec(1, 0), vec(1, 0))).toBe(1);
    expect(cosineSimilarity(vec(1, 0), vec(0, 1))).toBe(0);
    expect(cosineSimilarity(vec(1, 0), vec(-1, 0))).toBe(-1);
  });

  it('scores 0 on length mismatch instead of misreading memory', () => {
    expect(cosineSimilarity(vec(1, 0), vec(1, 0, 0))).toBe(0);
  });
});

describe('relevanceScore', () => {
  it('halves at exactly one half-life and is undiscounted at age 0', () => {
    expect(relevanceScore(0.8, 0)).toBe(0.8);
    expect(relevanceScore(0.8, RELEVANCE_HALF_LIFE_TURNS)).toBeCloseTo(0.4);
    expect(relevanceScore(0.8, RELEVANCE_HALF_LIFE_TURNS * 2)).toBeCloseTo(0.2);
  });

  it('clamps negative ages to no boost', () => {
    expect(relevanceScore(0.5, -10)).toBe(0.5);
  });
});

describe('buildRelevanceScores', () => {
  const query = vec(1, 0);
  const withVectors = (entries: Array<[string, Float32Array]>) =>
    new Map(entries.map(([text, v]) => [vectorKey(text), v] as const));

  it('scores every digest-carrying turn by turnId, discounting older ones', () => {
    const turns = [turn(0, 'old match'), turn(1, undefined), turn(2, 'new miss')];
    const vectors = withVectors([
      ['old match', vec(1, 0)],
      ['new miss', vec(0, 1)],
    ]);
    const scores = buildRelevanceScores(turns, query, vectors);
    expect(scores).not.toBeNull();
    // Two digest-carrying turns: t0 is one step older than t2.
    expect(scores!.get('t0')).toBeCloseTo(relevanceScore(1, 1));
    expect(scores!.get('t2')).toBe(0);
    expect(scores!.has('t1')).toBe(false);
  });

  it('returns null when any digest lacks a cached vector — all-or-nothing', () => {
    const turns = [turn(0, 'cached'), turn(1, 'not cached')];
    const vectors = withVectors([['cached', vec(1, 0)]]);
    expect(buildRelevanceScores(turns, query, vectors)).toBeNull();
  });

  it('returns null when a digest-carrying turn has no turnId', () => {
    const anonymous = { ...turn(0, 'cached'), turnId: undefined };
    const vectors = withVectors([['cached', vec(1, 0)]]);
    expect(buildRelevanceScores([anonymous], query, vectors)).toBeNull();
  });

  it('keys vectors by trimmed digest text', () => {
    const turns = [turn(0, '  padded digest  ')];
    const vectors = withVectors([['padded digest', vec(1, 0)]]);
    const scores = buildRelevanceScores(turns, query, vectors);
    expect(scores?.get('t0')).toBe(1);
  });
});
