import { docTargetId, type DocTarget } from '@/lib/docs/docsLinks';
import { SURFACE_EXCLUSIONS, SURFACE_MAP } from '@/lib/docs/surfaceMap';
import type { Guide } from '@/lib/formaquestion/guide';
import type { Surface } from './surfaceRegistry';

/**
 * The docs heading that explains a Surface: the deepest tab that has one, then the outer tabs, the
 * dialog and the screen. Null when the walk meets a surface players never see.
 */
export function surfaceHelpTarget(
  surface: Surface,
  map: Partial<Record<string, Required<DocTarget>>> = SURFACE_MAP,
  exclusions: Partial<Record<string, string>> = SURFACE_EXCLUSIONS,
): DocTarget | null {
  for (const id of [...surface.tabs].reverse().concat(surface.dialog ?? [], surface.screen ?? [])) {
    if (exclusions[id] !== undefined) return null;
    const target = map[id];
    if (target) return target;
  }
  return null;
}

/** The id of the guide section that explains a Surface, or null when none does. */
export function surfaceHelpSection(surface: Surface, guide: Pick<Guide, 'resolve'>): string | null {
  const target = surfaceHelpTarget(surface);
  return target && guide.resolve(target.page, docTargetId(target));
}
