import type { BackgroundPassKind } from '@/lib/backgroundPassQueue/backgroundPassQueue';
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
  | 'hammer'
  | 'quill'
  | 'masks'
  | 'split';

/** The glyph for each request type. A complete record, so a new request type fails typecheck until it gets one. */
export const REQUEST_GLYPHS: Record<AIRequestType, StatusGlyphKey> = {
  thinking: 'compass',
  director: 'masks',
  character: 'masks',
  storyboard: 'scroll',
  narration: 'quill',
  choices: 'split',
  statUpdates: 'chartColumnIncreasing',
  locationChange: 'mapPin',
  entityLocation: 'mapPin',
  summary: 'bookOpen',
  milestoneSelect: 'bookOpen',
  diary: 'bookOpen',
  discoverEntity: 'masks',
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

/** A request with no type, labeled "Response". */
export const FALLBACK_GLYPH: StatusGlyphKey = 'sparkles';

/** The glyph for each background pass between turns: the glyph of the request it runs. */
export const BACKGROUND_PASS_GLYPHS: Record<BackgroundPassKind, StatusGlyphKey> = {
  digest: REQUEST_GLYPHS.summary,
  milestone: REQUEST_GLYPHS.milestoneSelect,
  diary: REQUEST_GLYPHS.diary,
  discover: REQUEST_GLYPHS.discoverEntity,
};

/** The glyph for the running turn request. */
export function requestGlyph(type: AIRequestType | null | undefined): StatusGlyphKey {
  return type ? REQUEST_GLYPHS[type] : FALLBACK_GLYPH;
}
