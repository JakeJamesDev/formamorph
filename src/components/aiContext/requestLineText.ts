import { tokensPerSecond, type AiRequestStats } from '@/lib/aiContext/requestStats';
import type { DebugEndpointInfo } from '@/lib/promptEndpoints';

/** One value on the request line: the short `value` it shows, and the `tip` that spells it out. */
export interface RequestLineText {
  value: string;
  tip: string;
}

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

/** The reasoning fields a request carried. Null when it carried none, which a model that always reasons also sends. */
export function reasoningText({ reasoningFields }: DebugEndpointInfo): RequestLineText | null {
  if (!reasoningFields.length) return null;
  const shown = ({ value }: DebugEndpointInfo['reasoningFields'][number]) => {
    if (typeof value === 'boolean') return value ? 'On' : 'Off';
    return typeof value === 'number' ? value.toLocaleString() : capitalize(value);
  };
  return {
    value: reasoningFields.map(shown).join(' · '),
    tip: reasoningFields.map((field) => `${field.name}: ${field.value}`).join(' · '),
  };
}

/** The samplers a request carried: the first on the line, and all of them in the tip. */
export function samplersText({ samplers }: DebugEndpointInfo): RequestLineText | null {
  if (!samplers.length) return null;
  return { value: String(samplers[0].value), tip: samplers.map(({ name, value }) => `${name}: ${value}`).join(' · ') };
}

/** Whole tokens per second, with one decimal where the speed is slow enough to need it. */
export function speedText(stats: AiRequestStats): RequestLineText | null {
  const speed = tokensPerSecond(stats);
  if (speed === null) return null;
  const rounded = speed < 10 ? speed.toFixed(1) : String(Math.round(speed));
  return stats.tokensEstimated
    ? { value: `~${rounded} t/s`, tip: `About ${rounded} tokens per second, counted from the stream` }
    : { value: `${rounded} t/s`, tip: `${rounded} tokens per second, reported by the endpoint` };
}

export const secondsText = (ms: number) => `${(ms / 1000).toFixed(1)}s`;
