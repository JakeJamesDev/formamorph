import { describe, expect, it } from 'vitest';
import type { AIRequestType } from '@/types';
import { TOOL_GLYPH, requestGlyph } from './glyphMap';

// The spec's glyph map, written out by hand. Narration, Cast, Motivation, Character and Choices show
// sparkles until ticket 03 adds their own glyphs.
const SPEC: Record<AIRequestType, string> = {
  thinking: 'compass',
  director: 'sparkles',
  character: 'sparkles',
  discoverEntity: 'sparkles',
  narration: 'sparkles',
  choices: 'sparkles',
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
