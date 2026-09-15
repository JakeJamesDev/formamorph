import type { DebugEndpointInfo } from '@/lib/promptEndpoints';

/** One reasoning field as both faces of the chip read it. */
interface ChipField {
  /** What the setting is called in Settings. */
  label: string;
  /** What the chat-completions body calls it. */
  field: string;
  value: string | number;
}

/**
 * What the AI Context viewer's reasoning chip says about one captured request: `label` in the settings' own
 * words, `tip` under the wire names. `null` when the request carried neither field, which is what a plain
 * endpoint and a non-reasoning model both send.
 */
export function reasoningChipText(endpoint: DebugEndpointInfo): { label: string; tip: string } | null {
  const fields: ChipField[] = [];
  if (endpoint.reasoningEffort !== undefined) {
    fields.push({ label: 'Effort', field: 'reasoning_effort', value: endpoint.reasoningEffort });
  }
  if (endpoint.budgetTokens !== undefined) {
    fields.push({ label: 'Budget', field: 'thinking_budget_tokens', value: endpoint.budgetTokens });
  }
  if (!fields.length) return null;
  return {
    label: fields.map((f) => `${f.label} ${f.value}`).join(' · '),
    tip: fields.map((f) => `${f.field}: ${f.value}`).join(' · '),
  };
}
