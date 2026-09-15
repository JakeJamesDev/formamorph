import type { DebugEndpointInfo } from '@/lib/promptEndpoints';
import { Tip } from '@/components/ui/tooltip';
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
  return (
    <Tip tip={chip.tip} labelsChild={false}>
      <span className="rounded bg-muted px-1.5 py-0.5 text-meta font-normal text-muted-foreground">{chip.label}</span>
    </Tip>
  );
}
