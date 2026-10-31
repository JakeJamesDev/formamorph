import type { BackgroundPassKind } from '@/lib/backgroundPassQueue/backgroundPassQueue';
import { REQUEST_LABELS } from '@/lib/promptGroups';
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
  /** The name of the prompt that sends the request, as "Generating {name}…" shows it. */
  name: string;
  glyph: StatusGlyphKey;
}

/** A complete record, so a new request type fails typecheck until it gets a name and a glyph. */
export const REQUEST_STATUS: Record<AIRequestType, RequestStatus> = {
  thinking: { name: REQUEST_LABELS.thinking, glyph: 'compass' },
  director: { name: REQUEST_LABELS.director, glyph: 'masks' },
  character: { name: REQUEST_LABELS.character, glyph: 'masks' },
  storyboard: { name: REQUEST_LABELS.storyboard, glyph: 'scroll' },
  narration: { name: REQUEST_LABELS.narration, glyph: 'quill' },
  choices: { name: REQUEST_LABELS.choices, glyph: 'split' },
  statUpdates: { name: REQUEST_LABELS.statUpdates, glyph: 'chartColumnIncreasing' },
  locationChange: { name: REQUEST_LABELS.locationChange, glyph: 'mapPin' },
  entityLocation: { name: REQUEST_LABELS.entityLocation, glyph: 'mapPin' },
  summary: { name: REQUEST_LABELS.summary, glyph: 'bookOpen' },
  milestoneSelect: { name: REQUEST_LABELS.milestoneSelect, glyph: 'bookOpen' },
  diary: { name: REQUEST_LABELS.diary, glyph: 'bookOpen' },
  discoverEntity: { name: REQUEST_LABELS.discoverEntity, glyph: 'masks' },
  timePassed: { name: REQUEST_LABELS.timePassed, glyph: 'hourglass' },
  openingTime: { name: REQUEST_LABELS.openingTime, glyph: 'hourglass' },
  sceneTags: { name: REQUEST_LABELS.sceneTags, glyph: 'sparkles' },
  inventory: { name: REQUEST_LABELS.inventory, glyph: 'sparkles' },
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
  describeItem: { label: 'Describing item…', glyph: REQUEST_STATUS.inventory.glyph },
};
