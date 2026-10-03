import type { DocSection, DocsIndex } from '@/lib/docs/docsIndex';
import { createDocsLinkResolver, sectionWithId } from '@/lib/docs/docsReader';
import { surfaceHelpSection } from '@/lib/surface/surfaceHelp';
import { surfaceLabel } from '@/lib/surface/surfaceLabels';
import type { Surface } from '@/lib/surface/surfaceRegistry';

/** What a help request knows of the screen the player asks from. */
export interface SurfaceHint {
  /** The Surface in player words, such as "Settings dialog, Display tab". */
  where: string;
  /** The docs section that explains it. */
  section: DocSection;
}

/** The open screen or dialog, then the open tabs, by label. The screen is left out under a dialog. */
export function surfaceWords(surface: Surface): string {
  const first = surface.dialog ? `${surfaceLabel(surface.dialog)} dialog` : surface.screen ? `${surfaceLabel(surface.screen)} screen` : '';
  return [first, ...surface.tabs.map((tab) => `${surfaceLabel(tab)} tab`)].filter(Boolean).join(', ');
}

/** The hint for the Surface open now. Null when a surface players never see is open, or no section explains it. */
export function surfaceHint(surface: Surface | undefined, index: DocsIndex): SurfaceHint | null {
  if (!surface) return null;
  const id = surfaceHelpSection(surface, { resolve: createDocsLinkResolver(index) });
  const section = id && sectionWithId(index, id);
  return section ? { where: surfaceWords(surface), section } : null;
}
