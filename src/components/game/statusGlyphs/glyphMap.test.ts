import { describe, expect, it } from 'vitest';
import type { AIRequestType } from '@/types';
import { BACKGROUND_PASS_GLYPHS, TOOL_GLYPH, requestGlyph } from './glyphMap';

// The spec's glyph map, written out by hand.
const SPEC: Record<AIRequestType, string> = {
  thinking: 'compass',
  director: 'masks',
  character: 'masks',
  discoverEntity: 'masks',
  narration: 'quill',
  choices: 'split',
  statUpdates: 'chartColumnIncreasing',
  summary: 'bookOpen',
  milestoneSelect: 'bookOpen',
  diary: 'bookOpen',
  storyboard: 'scroll',
  locationChange: 'mapPin',
  entityLocation: 'mapPin',
  timePassed: 'hourglass',
  openingTime: 'hourglass',
  sceneTags: 'sparkles',
  descriptionSummary: 'sparkles',
  descriptionBridge: 'sparkles',
  imageTags: 'sparkles',
  help: 'sparkles',
};

describe('requestGlyph', () => {
  it.each(Object.entries(SPEC))('maps %s to %s', (type, glyph) => {
    expect(requestGlyph(type as AIRequestType)).toBe(glyph);
  });

  it('shows sparkles for a request with no type', () => {
    expect(requestGlyph(null)).toBe('sparkles');
  });

  it('shows the hammer for a Tool round', () => {
    expect(TOOL_GLYPH).toBe('hammer');
  });
});

describe('BACKGROUND_PASS_GLYPHS', () => {
  it.each([
    ['digest', 'bookOpen'],
    ['milestone', 'bookOpen'],
    ['diary', 'bookOpen'],
    ['discover', 'masks'],
  ] as const)('maps %s to %s', (kind, glyph) => {
    expect(BACKGROUND_PASS_GLYPHS[kind]).toBe(glyph);
  });
});
