import { API_BASE_URL } from '@/lib/apiBase';
import { isFunnelStepSent, markFunnelStepSent } from '@/lib/firstTimeFlowStore';
import { HOSTED_AI_AVAILABLE } from '@/lib/hostedAi/hostedUrls';

/** Every entry point that opens The Road, in report order. */
export const FUNNEL_SOURCES = ['setup', 'demo', 'engine', 'notice', 'locked'] as const;
export type FunnelSource = (typeof FUNNEL_SOURCES)[number];

/** The funnel's steps in order. Each alone is also a source-less name the server accepts from older builds. */
export const FUNNEL_STAGES = ['offer_shown', 'see_levels', 'patreon_click', 'checklist_finished'] as const;
export type FunnelStage = (typeof FUNNEL_STAGES)[number];

/** The steps each source reports. The notice and the locked-preset panel show on every visit, so they report no shown step. */
export const FUNNEL_SOURCE_STAGES = {
  setup: ['offer_shown', 'see_levels', 'patreon_click', 'checklist_finished'],
  demo: ['offer_shown', 'see_levels', 'patreon_click', 'checklist_finished'],
  engine: ['offer_shown', 'see_levels', 'patreon_click', 'checklist_finished'],
  notice: ['see_levels', 'patreon_click', 'checklist_finished'],
  locked: ['see_levels', 'patreon_click', 'checklist_finished'],
} as const satisfies Record<FunnelSource, readonly FunnelStage[]>;

export type FunnelStep = { [S in FunnelSource]: `${S}_${(typeof FUNNEL_SOURCE_STAGES)[S][number]}` }[FunnelSource];

/** Every step a new build sends, by source in report order. */
export const FUNNEL_STEPS: readonly FunnelStep[] = FUNNEL_SOURCES.flatMap((source) =>
  // Each pair comes from its own source's stages, which is what the type requires.
  FUNNEL_SOURCE_STAGES[source].map((stage) => `${source}_${stage}` as FunnelStep));

/**
 * Reports one funnel step to the totals route, once per device. The call carries no header, body or credential.
 * A failed send is dropped and never retried.
 */
export function sendFunnelStep(step: FunnelStep): void {
  if (!HOSTED_AI_AVAILABLE || !API_BASE_URL || isFunnelStepSent(step)) return;
  markFunnelStepSent(step);
  try {
    fetch(`${API_BASE_URL}/funnel/${step}`, { method: 'POST', credentials: 'omit', keepalive: true })
      .catch(() => { /* Dropped on purpose. */ });
  } catch { /* A synchronous refusal is dropped too. */ }
}
