import type { DebugEndpointInfo } from '@/lib/promptEndpoints';

/**
 * What the AI Context viewer's reasoning chip says about one captured request: `label` in the settings' own
 * words, `tip` under the wire names the target dialect used. `null` when the request carried no reasoning
 * field, which is what a plain endpoint, a non-reasoning model, and a model that always reasons all send.
 */
export function reasoningChipText(endpoint: DebugEndpointInfo): { label: string; tip: string } | null {
  const fields = endpoint.reasoningFields;
  if (!fields.length) return null;
  return {
    label: fields.map((f) => `${f.label} ${f.value}`).join(' · '),
    tip: fields.map((f) => `${f.name}: ${f.value}`).join(' · '),
  };
}
