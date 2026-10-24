import type { AIRequestType } from '@/types';

/** The glyphs the status row can show. */
export type StatusGlyphKey =
  | 'compass'
  | 'chartColumnIncreasing'
  | 'bookOpen'
  | 'scroll'
  | 'mapPin'
  | 'hourglass'
  | 'sparkles'
  | 'hammer';

/** The glyph for each request type. A complete record, so a new request type fails typecheck until it gets one. */
export const REQUEST_GLYPHS: Record<AIRequestType, StatusGlyphKey> = {
  thinking: 'compass',
  director: 'sparkles',
  character: 'sparkles',
  storyboard: 'scroll',
  narration: 'sparkles',
  choices: 'sparkles',
  statUpdates: 'chartColumnIncreasing',
  locationChange: 'mapPin',
  entityLocation: 'mapPin',
  summary: 'bookOpen',
  milestoneSelect: 'bookOpen',
  diary: 'bookOpen',
  discoverEntity: 'sparkles',
  timePassed: 'hourglass',
  openingTime: 'hourglass',
  sceneTags: 'sparkles',
  descriptionSummary: 'sparkles',
  descriptionBridge: 'sparkles',
  imageTags: 'sparkles',
  help: 'sparkles',
};

/** A Tool round. */
export const TOOL_GLYPH: StatusGlyphKey = 'hammer';

/** A request with no type, labeled "Response", and the background pass row. */
export const FALLBACK_GLYPH: StatusGlyphKey = 'sparkles';

/** The glyph for the running turn request. */
export function requestGlyph(type: AIRequestType | null | undefined): StatusGlyphKey {
  return type ? REQUEST_GLYPHS[type] : FALLBACK_GLYPH;
}
