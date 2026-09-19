import { describe, expect, it } from 'vitest';
import { sentenceShapeViolation } from '@/test/copyShape';
import { ACTIVATION_INFO, KEYWORDS_INFO } from './DictionaryManager';
import { STARTING_INFO } from './LocationManager';
import { KIND_INFO } from './PlaceholderManager';
import { AVAILABILITY_INFO } from './StatManager';
import { PUBLISH_SIZE_INFO } from '@/components/editor/IssuesInstrument';
import { CAST_WITHOUT_PERSONAS_HINT, PLAYER_SETTING_HINTS } from './WorldOverviewManager';

/** Every World Editor ⓘ body that lives as a constant, by the field it sits beside. */
const TIPS: Record<string, string> = {
  'Trigger Keywords': KEYWORDS_INFO,
  Activation: ACTIVATION_INFO,
  'Starting Location': STARTING_INFO,
  Kind: KIND_INFO,
  Availability: AVAILABILITY_INFO,
  'Publish Size': PUBLISH_SIZE_INFO,
};

/** The lines a reader takes one at a time: each paragraph and each bullet, with the bullet mark dropped. */
const linesOf = (body: string): string[] =>
  body.split('\n').map((line) => line.replace(/^\s*-\s+/, '').trim()).filter(Boolean);

describe('World Editor ⓘ tips', () => {
  it.each(Object.entries(TIPS))('%s follows the help-line period rule on every line', (_field, body) => {
    const failures = linesOf(body)
      .map((line) => ({ line, why: sentenceShapeViolation(line) }))
      .filter(({ why }) => why !== null);
    expect(failures).toEqual([]);
  });

  it.each(Object.entries(TIPS))('%s has no em-dash aside', (_field, body) => {
    expect(body).not.toContain('—');
  });
});

describe('World Editor help lines', () => {
  const LINES = [...Object.values(PLAYER_SETTING_HINTS), CAST_WITHOUT_PERSONAS_HINT];
  it.each(LINES)('"%s" follows the help-line period rule', (line) => {
    expect(sentenceShapeViolation(line)).toBeNull();
  });
});
