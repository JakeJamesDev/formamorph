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

/** What the status row shows for one request. */
export interface RequestStatus {
  /** The request's short name, as "Generating {name}…" shows it. */
  name: string;
  glyph: StatusGlyphKey;
}

/** A complete record, so a new request type fails typecheck until it gets a name and a glyph. */
export const REQUEST_STATUS: Record<AIRequestType, RequestStatus> = {
  thinking: { name: 'Plan', glyph: 'compass' },
  director: { name: 'Cast', glyph: 'masks' },
  character: { name: 'Motivation', glyph: 'masks' },
  storyboard: { name: 'Storyboard', glyph: 'scroll' },
  narration: { name: 'Narration', glyph: 'quill' },
  choices: { name: 'Choices', glyph: 'split' },
  statUpdates: { name: 'Stat Updates', glyph: 'chartColumnIncreasing' },
  locationChange: { name: 'Location', glyph: 'mapPin' },
  entityLocation: { name: 'Entity Location', glyph: 'mapPin' },
  summary: { name: 'Memory', glyph: 'bookOpen' },
  milestoneSelect: { name: 'Memory Select', glyph: 'bookOpen' },
  diary: { name: 'Diary', glyph: 'bookOpen' },
  discoverEntity: { name: 'Character', glyph: 'masks' },
  timePassed: { name: 'Clock', glyph: 'hourglass' },
  openingTime: { name: 'Opening', glyph: 'hourglass' },
  sceneTags: { name: 'Scene Tags', glyph: 'sparkles' },
  descriptionSummary: { name: 'Response', glyph: 'sparkles' },
  descriptionBridge: { name: 'Response', glyph: 'sparkles' },
  imageTags: { name: 'Response', glyph: 'sparkles' },
  help: { name: 'Response', glyph: 'sparkles' },
};

/** A request with no type. */
export const FALLBACK_STATUS: RequestStatus = { name: 'Response', glyph: 'sparkles' };

/** A Tool round. */
export const TOOL_GLYPH: StatusGlyphKey = 'hammer';

/** The running turn request's status. */
export function requestStatus(type: AIRequestType | null | undefined): RequestStatus {
  return type ? REQUEST_STATUS[type] : FALLBACK_STATUS;
}

/** The status row's label for a turn request. */
export function requestLabel(status: RequestStatus): string {
  return `Generating ${status.name}…`;
}

/** Each background pass's label and glyph, in display precedence: the first running pass shows. */
export const BACKGROUND_PASS_STATUS: Record<BackgroundPassKind, { label: string; glyph: StatusGlyphKey }> = {
  digest: { label: 'Summarizing turn…', glyph: REQUEST_STATUS.summary.glyph },
  milestone: { label: 'Selecting memories…', glyph: REQUEST_STATUS.milestoneSelect.glyph },
  diary: { label: 'Writing diary…', glyph: REQUEST_STATUS.diary.glyph },
  discover: { label: 'Describing character…', glyph: REQUEST_STATUS.discoverEntity.glyph },
};
