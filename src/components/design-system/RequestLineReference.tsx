import { AiContextRequestCard } from '@/components/aiContext/AiContextRequestCard';
import { Meta } from '@/components/ui/typography';
import type { AiRequestRecord } from '@/lib/aiContext/requestRecord';
import type { AiRequestStats } from '@/lib/aiContext/requestStats';
import type { DebugEndpointInfo } from '@/lib/promptEndpoints';

const FOLLOWING: DebugEndpointInfo = {
  preset: 'Custom', routed: false, model: 'default', url: 'https://api.example.com/v1',
  reasoningFields: [], maxTokens: 512, samplers: [{ name: 'temperature', value: 0.8 }, { name: 'repetition_penalty', value: 1 }],
};

const ROUTED: DebugEndpointInfo = {
  ...FOLLOWING, preset: 'Local LM Studio', routed: true, model: 'cydonia-24b-v4.3@q4_k_m', url: 'http://localhost:1234/v1', maxTokens: 1200,
  reasoningFields: [{ label: 'Effort', name: 'reasoning_effort', value: 'high' }, { label: 'Budget', name: 'thinking_budget_tokens', value: 4096 }],
};

const STATS: AiRequestStats = { totalMs: 11400, firstTokenMs: 900, generatingMs: 10500, tokens: 441, tokensEstimated: true, finishReason: 'stop' };

const SAMPLES: { note: string; record: AiRequestRecord; folded?: boolean }[] = [
  { note: 'Following the active endpoint, speed counted from the stream', record: { type: 'narration', messages: [], endpoint: FOLLOWING, stats: STATS } },
  { note: 'Routed endpoint, speed reported by the endpoint', record: { type: 'inventory', messages: [], endpoint: ROUTED, stats: { ...STATS, tokensEstimated: false } } },
  { note: 'Reply reached its Max Output, on a search that found nothing here', folded: true, record: { type: 'discoverEntity', messages: [], endpoint: ROUTED, stats: { ...STATS, finishReason: 'length' } } },
  { note: 'Reply still running, or stopped', record: { type: 'choices', messages: [], endpoint: FOLLOWING } },
];

/** The production request card over sample records, one per state of its line. */
export function RequestLineReference() {
  return (
    <div className="space-y-4 text-meta">
      {SAMPLES.map(({ note, record, folded }, i) => (
        <div key={note} className="space-y-1">
          <Meta>{note}</Meta>
          <AiContextRequestCard record={record} index={i} folded={folded} isOpen={() => false} onOpenChange={() => {}} />
        </div>
      ))}
    </div>
  );
}
