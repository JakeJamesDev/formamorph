import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { validateParityFixture } from './parityRecorder';
import type { AIRequestType } from '@/types';

// Self-check for the recorded fixture (testing/parity/turn-pipeline-parity.json): the later Turn Pipeline
// tickets replay it, so a fixture that has gone stale or lost a pass must fail here rather than quietly
// weaken every parity test built on it. Format and coverage notes: testing/parity/README.md.
const FIXTURE_PATH = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../testing/parity/turn-pipeline-parity.json',
);
const raw: unknown = JSON.parse(readFileSync(FIXTURE_PATH, 'utf8'));
const fixture = () => validateParityFixture(raw);

// Every pass the recorded profile turns on. A pass missing here means the capture no longer exercises it.
const EXPECTED_TYPES: AIRequestType[] = [
  'director', 'character', 'storyboard', 'narration', 'choices', 'statUpdates',
  'locationChange', 'summary', 'milestoneSelect', 'diary', 'timePassed', 'openingTime',
];
// This recording's totals. Re-recording moves them (drainer counts track pacing) — update them with it.
const EXPECTED_TURNS = 7;
const EXPECTED_REQUESTS = 86;

describe('recorded parity fixture', () => {
  it('validates against the recorded format', () => {
    expect(() => fixture()).not.toThrow();
  });

  it('is a recording of the Sedge Landing script', () => {
    const f = fixture();
    expect(f.world).toBe('sedge-landing.json');
    expect(f.turns).toHaveLength(EXPECTED_TURNS);
    expect(f.turns[0].action).toBe('START GAME');
    expect(f.turns.every((t) => t.turnId)).toBe(true);
    expect(f.turns.reduce((n, t) => n + t.requests.length, 0) + f.orphans.length).toBe(EXPECTED_REQUESTS);
  });

  it('covers every pass the parity profile enables', () => {
    const seen = new Set(fixture().turns.flatMap((t) => t.requests.map((r) => r.type)));
    expect([...seen].sort()).toEqual([...EXPECTED_TYPES].sort());
  });

  it('opens each turn with its planning pass and narrates before the post-narration passes', () => {
    for (const turn of fixture().turns) {
      const types = turn.requests.map((r) => r.type);
      // locationChange resolves the move up front, before anything else in the turn.
      const body = types[0] === 'locationChange' ? types.slice(1) : types;
      expect(body[0]).toBe('director');
      const narration = body.indexOf('narration');
      expect(narration).toBeGreaterThan(0);
      // Staged planning all lands before narration; the aux passes all after it.
      expect(body.slice(0, narration).every((t) => t === 'director' || t === 'character' || t === 'storyboard')).toBe(true);
      expect(body.slice(narration + 1).includes('narration')).toBe(false);
    }
  });

  it('carries the payload each request was dispatched with, and the answer it got', () => {
    const requests = fixture().turns.flatMap((t) => t.requests);
    for (const r of requests) {
      expect(r.systemPrompt.length).toBeGreaterThan(0);
      expect(r.messages.length).toBeGreaterThan(0);
      expect(r.messages.every((m) => m.content.length > 0)).toBe(true);
      // A replay feeds these back, so an unanswered request would stall the turn it belongs to.
      expect(r.response).not.toBeNull();
    }
    // Silent passes are the between-turn drainers; each names the turn it attaches to.
    const silent = requests.filter((r) => r.silent);
    expect(silent.length).toBeGreaterThan(0);
    expect(silent.every((r) => typeof r.attachTurnId === 'string')).toBe(true);
    // The narration cap is the request type's own default (null); the short passes pin theirs.
    expect(requests.filter((r) => r.type === 'narration').every((r) => r.maxTokens === null)).toBe(true);
    expect(requests.filter((r) => r.type === 'timePassed').every((r) => typeof r.maxTokens === 'number')).toBe(true);
  });
});
