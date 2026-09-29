import type { DebugEndpointInfo } from '@/lib/promptEndpoints';
import { DebugChip } from './DebugChip';
import { reasoningChipText } from './reasoningChipText';

/**
 * The reasoning fields one captured request carried, drawn beside the endpoint that took them in the AI
 * Context viewer. Its own chip, so a long endpoint name does not crowd it out.
 *
 * The chip reads in the settings' own words and the tip names the wire fields, since the viewer is where a
 * player checks what was actually sent.
 */
export function ReasoningChip({ endpoint }: { endpoint: DebugEndpointInfo }) {
  const chip = reasoningChipText(endpoint);
  if (!chip) return null;
  return <DebugChip label={chip.label} tip={chip.tip} />;
}
