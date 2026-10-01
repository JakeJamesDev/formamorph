import type { DocSection, DocsIndex } from '@/lib/docs/docsIndex';
import { createDocsLinkResolver, sectionWithId } from '@/lib/docs/docsReader';
import { surfaceHelpTarget } from '@/lib/surface/surfaceHelp';
import type { Surface } from '@/lib/surface/surfaceRegistry';

/** What a help request knows of the screen the player asks from. */
export interface SurfaceHint {
  /** The Surface in player words, such as "Settings dialog, Display tab". */
  where: string;
  /** The docs section that explains it. */
  section: DocSection;
}

const ACRONYMS = new Set(['ai', 'vrm', 'ui', 'url']);

/** An id's last word group as a label: `tagPrompt` reads "Tag Prompt". */
function label(id: string): string {
  const name = id.slice(id.indexOf('.') + 1);
  return name
    .replace(/([a-z\d])([A-Z])/g, '$1 $2')
    .split(' ')
    .filter(Boolean)
    .map((word) => (ACRONYMS.has(word.toLowerCase()) ? word.toUpperCase() : word[0].toUpperCase() + word.slice(1)))
    .join(' ');
}

/** The open screen or dialog, then the open tabs, by label. The screen is left out under a dialog. */
function surfaceWords(surface: Surface): string {
  const first = surface.dialog ? `${label(surface.dialog)} dialog` : surface.screen ? `${label(surface.screen)} screen` : '';
  return [first, ...surface.tabs.map((tab) => `${label(tab)} tab`)].filter(Boolean).join(', ');
}

/** The hint for the Surface open now. Null when a surface players never see is open, or no section explains it. */
export function surfaceHint(surface: Surface | undefined, index: DocsIndex): SurfaceHint | null {
  const target = surface && surfaceHelpTarget(surface);
  if (!surface || !target) return null;
  const id = createDocsLinkResolver(index)(target.page, `${target.page}#${target.anchor}`);
  const section = id && sectionWithId(index, id);
  return section ? { where: surfaceWords(surface), section } : null;
}
