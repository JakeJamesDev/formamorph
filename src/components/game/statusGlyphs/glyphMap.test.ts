import { describe, expect, it } from 'vitest';
import type { AIRequestType } from '@/types';
import { BACKGROUND_PASS_STATUS, TOOL_GLYPH, requestLabel, requestStatus } from './glyphMap';

// The spec's glyph map and today's status labels, written out by hand.
const SPEC: Record<AIRequestType, [label: string, glyph: string]> = {
  thinking: ['Generating Plan…', 'compass'],
  director: ['Generating Cast…', 'masks'],
  character: ['Generating Motivation…', 'masks'],
  discoverEntity: ['Generating Character…', 'masks'],
  narration: ['Generating Narration…', 'quill'],
  choices: ['Generating Choices…', 'split'],
  statUpdates: ['Generating Stat Updates…', 'chartColumnIncreasing'],
  summary: ['Generating Memory…', 'bookOpen'],
  milestoneSelect: ['Generating Memory Select…', 'bookOpen'],
  diary: ['Generating Diary…', 'bookOpen'],
  storyboard: ['Generating Storyboard…', 'scroll'],
  locationChange: ['Generating Location…', 'mapPin'],
  entityLocation: ['Generating Entity Location…', 'mapPin'],
  timePassed: ['Generating Clock…', 'hourglass'],
  openingTime: ['Generating Opening…', 'hourglass'],
  sceneTags: ['Generating Scene Tags…', 'sparkles'],
  descriptionSummary: ['Generating Response…', 'sparkles'],
  descriptionBridge: ['Generating Response…', 'sparkles'],
  imageTags: ['Generating Response…', 'sparkles'],
  help: ['Generating Response…', 'sparkles'],
};

describe('requestStatus', () => {
  it.each(Object.entries(SPEC))('shows %s as %j', (type, [label, glyph]) => {
    const status = requestStatus(type as AIRequestType);
    expect([requestLabel(status), status.glyph]).toEqual([label, glyph]);
  });

  it('shows "Generating Response…" with sparkles for a request with no type', () => {
    const status = requestStatus(null);
    expect([requestLabel(status), status.glyph]).toEqual(['Generating Response…', 'sparkles']);
  });

  it('shows the hammer for a Tool round', () => {
    expect(TOOL_GLYPH).toBe('hammer');
  });
});

describe('BACKGROUND_PASS_STATUS', () => {
  it.each([
    ['digest', 'Summarizing turn…', 'bookOpen'],
    ['milestone', 'Selecting memories…', 'bookOpen'],
    ['diary', 'Writing diary…', 'bookOpen'],
    ['discover', 'Describing character…', 'masks'],
  ] as const)('shows %s as %s with %s', (kind, label, glyph) => {
    expect(BACKGROUND_PASS_STATUS[kind]).toEqual({ label, glyph });
  });
});
