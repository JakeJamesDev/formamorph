import type { DocSection, DocsIndex } from '@/lib/docs/docsIndex';
import { createDocsLinkResolver, sectionWithId } from '@/lib/docs/docsReader';
import { surfaceHelpSection } from '@/lib/surface/surfaceHelp';
import type { SurfaceLedgerName } from '@/components/ui/surface';
import { surfaceLabel } from '@/lib/surface/surfaceLabels';
import type { Surface } from '@/lib/surface/surfaceRegistry';
import type { HelpFocus, HelpFocusKind } from './helpFocus';

/** What a help request knows of the screen the player asks from. */
export interface SurfaceHint {
  /** The Surface in player words, such as "Settings dialog, Display tab". */
  where: string;
  /** The docs section that explains it. */
  section: DocSection;
}

/** The tab ledgers of the panels that show one item of each kind. */
const FOCUS_PANELS: Record<HelpFocusKind, readonly SurfaceLedgerName[]> = {
  stat: ['worldEditorStat'],
  trait: ['worldEditorTrait'],
  entity: ['worldEditorEntity', 'entityEditorEntity'],
  location: ['worldEditorLocation'],
  entry: ['worldEditorEntry'],
};

const FOCUS_NOUNS: Record<HelpFocusKind, string> = { stat: 'stat', trait: 'trait', entity: 'entity', location: 'location', entry: 'dictionary entry' };

/** The place in `surface.tabs` of the open tab of the focus's panel; -1 when that panel is not open. */
const focusTabAt = (surface: Surface, focus: HelpFocus | undefined): number =>
  (focus ? surface.tabs.findLastIndex((tab) => FOCUS_PANELS[focus.kind].some((ledger) => tab.startsWith(`${ledger}.`))) : -1);

/** The focus while its panel is open, or none. */
export const openFocus = (surface: Surface | null | undefined, focus: HelpFocus | undefined): HelpFocus | undefined =>
  (surface && focusTabAt(surface, focus) !== -1 ? focus : undefined);

/** The focus in player words, such as "stat Courage". */
export const focusWords = ({ kind, name }: HelpFocus): string => `${FOCUS_NOUNS[kind]} ${name}`;

/**
 * The open screen or dialog, then the open tabs, by label. The screen is left out under a dialog. The open tab
 * of the focus's panel names the focus.
 */
export function surfaceWords(surface: Surface, focus?: HelpFocus): string {
  const first = surface.dialog ? `${surfaceLabel(surface.dialog)} dialog` : surface.screen ? `${surfaceLabel(surface.screen)} screen` : '';
  const focusAt = focusTabAt(surface, focus);
  const tabs = surface.tabs.map((tab, at) => `${surfaceLabel(tab)} tab${focus && at === focusAt ? ` of the ${focusWords(focus)}` : ''}`);
  return [first, ...tabs].filter(Boolean).join(', ');
}

/** The hint for the Surface open now. Null when a surface players never see is open, or no section explains it. */
export function surfaceHint(surface: Surface | undefined, index: DocsIndex, focus?: HelpFocus): SurfaceHint | null {
  if (!surface) return null;
  const id = surfaceHelpSection(surface, { resolve: createDocsLinkResolver(index) });
  const section = id && sectionWithId(index, id);
  return section ? { where: surfaceWords(surface, focus), section } : null;
}
