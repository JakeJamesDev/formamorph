import { API_BASE_URL } from '@/lib/apiBase';
import { isFunnelStepSent, markFunnelStepSent } from '@/lib/firstTimeFlowStore';
import { HOSTED_AI_AVAILABLE } from '@/lib/hostedAi/hostedUrls';

export type FunnelStep = 'offer_shown' | 'local_offer_shown' | 'see_levels' | 'patreon_click' | 'checklist_finished';

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
