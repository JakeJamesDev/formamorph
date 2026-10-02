import type { RequestMessage } from '@/types';
import type { AiToolRound } from '@/lib/aiRequest/toolLoop';
import type { DebugEndpointInfo } from '@/lib/promptEndpoints';
import type { RequestAnatomy } from '@/lib/requestAnatomy';
import type { DictionaryDebug } from '@/lib/turnPipeline/narrationPrompt';
import type { StatUpdateDiagnostic } from '@/lib/statRequest';

/**
 * One AI request as the AI Context viewers show it: what was sent, what came back, and which endpoint
 * served it. The game view captures one per sub-request of a turn; Formaquestion captures one per request
 * of a help question. The fields below `anatomy` only the game fills.
 */
export interface AiRequestRecord {
  /** The request kind, shown in the card title. */
  type: string;
  messages: RequestMessage[];
  response?: string;
  /** The native reasoning field as streamed; inline `<think>` stays in `response`. Never sent back in history. */
  reasoning?: string;
  /** The tool rounds this request ran before its reply. The game captures them only with Show Silent Requests on. */
  toolRounds?: AiToolRound[];
  /** Which endpoint served this request. Absent on turns captured before routing existed. */
  endpoint?: DebugEndpointInfo;
  /** Correlates a captured request to its own response, so concurrent same-type calls each land on the right entry. */
  id?: string;
  /**
   * Which runs of the sent messages are authored prompt text and which are assembled context (see
   * lib/requestAnatomy). Absent on drainer requests, re-rolls, and pre-anatomy captures; the card draws the
   * same region/chat layout either way.
   */
  anatomy?: RequestAnatomy;
  /** Narration only: the dictionary activation behind this turn's injected lore, so the viewer marks real matches. */
  dictionary?: DictionaryDebug;
  statRequestId?: string;
  statDiagnostics?: StatUpdateDiagnostic[];
}
