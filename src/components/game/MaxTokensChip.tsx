import type { DebugEndpointInfo } from '@/lib/promptEndpoints';
import { Tip } from '@/components/ui/tooltip';

/** The `max_tokens` one captured request sent, drawn beside its reasoning chip in the AI Context viewer. */
export function MaxTokensChip({ endpoint }: { endpoint: DebugEndpointInfo }) {
  const { maxTokens } = endpoint;
  if (maxTokens === undefined) return null;
  return (
    <Tip tip={`max_tokens: ${maxTokens}`} labelsChild={false}>
      <span className="rounded bg-muted px-1.5 py-0.5 text-meta font-normal text-muted-foreground">
        Max Tokens {maxTokens.toLocaleString('en-US')}
      </span>
    </Tip>
  );
}
