import type { DebugEndpointInfo } from '@/lib/promptEndpoints';
import { DebugChip } from './DebugChip';

/** The `max_tokens` one captured request sent, drawn beside its reasoning chip in the AI Context viewer. */
export function MaxTokensChip({ endpoint }: { endpoint: DebugEndpointInfo }) {
  const { maxTokens } = endpoint;
  if (maxTokens === undefined) return null;
  return <DebugChip label={`Max Tokens ${maxTokens.toLocaleString()}`} tip={`max_tokens: ${maxTokens}`} />;
}
