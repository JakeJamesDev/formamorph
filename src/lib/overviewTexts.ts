import { openingTexts } from '@/lib/openings';
import { worldPromptTexts } from '@/lib/worldPrompt';
import type { WorldOverview } from '@/types';

/** Every authored string on the overview that play resolves chips in, blank ones included. Chip scans,
 *  placement letters and priming all read this one list. */
export function overviewTexts(overview: WorldOverview | null | undefined): (string | undefined)[] {
  return [
    overview?.systemPrompt, overview?.readme, overview?.introReadme,
    ...openingTexts(overview), ...worldPromptTexts(overview),
  ];
}
