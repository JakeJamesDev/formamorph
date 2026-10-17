import { randomUUID } from '@/lib/uuid';
import type { AIRequestType, RequestMessage, Tool, ToolEnabledMap } from '@/types';
import type { AiRequestRecord } from '@/lib/aiContext/requestRecord';
import { stripReasoning } from '@/lib/aiResponse';
import { trimToLastSentence } from '@/lib/outputLength';
import { toDebugEndpoint } from '@/lib/promptEndpoints';
import type { RequestAnatomy } from '@/lib/requestAnatomy';
import { readStatResponse, type StatRequestSnapshot } from '@/lib/statRequest';
import { snapshotToolExecutor, toolsOfferedTo } from '@/lib/tools/toolOffer';
import type { ToolSnapshot } from '@/lib/tools/toolSnapshot';
import { recordParityRequest, recordParityResponse } from '@/lib/turnPipeline/parityRecorder';
import type { ReasoningEffortField } from '@/lib/reasoningEffort';
import { buildAiRequestSpec, type AiEndpointTarget, type AiSettingsSnapshot } from './aiRequestSpec';
import { ABORTED_FINISH_REASON, LENGTH_FINISH_REASON } from './aiStream';
import { asTextMessage } from './imageParts';
import { rejectedEndpointOverride, type RejectedEndpointOverride } from './rejectedOverride';
import { SchemaRefused, schemaRejected, withTextFallback, type ResponseSchema } from './responseSchema';
import { streamAiToolLoop, type AiToolRound, type ToolExecutor } from './toolLoop';

/**
 * The Request Transport: carries one AI request from its arguments to its final text, outside React. It
 * reports everything it observes through the sink the caller passes with that request, and never touches
 * the screen.
 */

/** One AI call. A Turn Pipeline pass request already has this shape. */
export interface TransportRequest {
  systemPrompt: string;
  messages: RequestMessage[];
  type: AIRequestType;
  /** Absent (or null) leaves the request type's own default cap to apply downstream. */
  maxTokens?: number | null;
  signal?: AbortSignal;
  /** Inspection sidecar for the AI-context viewer. Captured with the request; never sent. */
  anatomy?: RequestAnatomy;
  /** Fails without a toast, and is captured only with the inspection toggle on, onto `attachTurnId`'s turn. */
  silent?: boolean;
  attachTurnId?: string;
  statRequest?: StatRequestSnapshot;
  responseSchema?: ResponseSchema;
  /** What the request sends instead when the endpoint refuses its schema. */
  textFallback?: Partial<TransportRequest>;
  /** Runs this request's Tools; absent, the request builds its own from the context's snapshot. */
  executeTool?: ToolExecutor;
}

/** A resolved endpoint, with the preset it resolved to. */
export type TransportTarget = AiEndpointTarget & { presetId: string | null; presetName: string };

/** What the view hands the transport, read once per request. */
export interface TransportContext {
  settings: AiSettingsSnapshot;
  /** Names each request kind's endpoint: its pinned preset, or the active endpoint it follows. */
  resolveEndpoint: (kind: AIRequestType) => TransportTarget;
  /** The catalog, then the user Tools. */
  tools: readonly Tool[];
  /** The world's own Tools, offered past the preset switches. */
  worldTools: readonly Tool[];
  enabledTools: ToolEnabledMap;
  toolsEnabled: boolean;
  /** Builds the Tool Snapshot a request without its own executor reads. */
  toolSnapshot: () => ToolSnapshot;
  /** Show Silent Requests: capture silent requests and tool rounds. */
  showSilentRequests: boolean;
  noteReasoningReply: (target: { url: string; model: string }, reasoningText: string, content: string, effort: ReasoningEffortField | null) => void;
  noteSchemaRejected: (target: SchemaRefused['target']) => void;
  /** The AI Stream's fetch. Tests pass a fake; production leaves the global. */
  fetchImpl?: typeof fetch;
}

/** A structured rejection of an endpoint override the request carried. */
export interface RejectedOverrideFailure {
  kind: 'rejectedOverride';
  error: unknown;
  override: RejectedEndpointOverride;
  endpointId: string;
  presetName: string;
}

/** A failure the caller must show. A silent request's ordinary failure is not one. */
export type TransportFailure = RejectedOverrideFailure | { kind: 'request'; error: unknown };

/** Everything one request observes, in the order it happens. */
export type TransportEvent =
  /** `attachTo` names the turn a silent request belongs to; null means the current turn. */
  | { type: 'requestCaptured'; record: AiRequestRecord & { id: string }; attachTo: string | null }
  /** The endpoint accepted the request and has a body to stream. */
  | { type: 'opened' }
  /** The running reply, raw, reasoning tags included. */
  | { type: 'delta'; content: string }
  /** The running native reasoning field. */
  | { type: 'reasoning'; text: string }
  /** A round that streamed text ended in Tool calls: that text is not the reply. */
  | { type: 'retract' }
  | { type: 'toolCalls'; names: string[] }
  | { type: 'roundStarted' }
  | { type: 'toolRound'; round: AiToolRound }
  /** The request stopped after it opened. Nothing else follows. */
  | { type: 'canceled' }
  | {
    type: 'responseCaptured';
    id: string;
    attachTo: string | null;
    response: Pick<AiRequestRecord, 'response' | 'reasoning' | 'toolRounds' | 'statDiagnostics'>;
  }
  | { type: 'failure'; failure: TransportFailure }
  /** `text` is the final reply; `raw` is the reply as streamed. */
  | { type: 'done'; text: string; raw: string; reasoningText: string; finishReason: string | null };

export type TransportSink = (event: TransportEvent) => void;

/** Sends `request` and answers its final text, retrying once without the schema when the endpoint refuses it.
 *  A stopped request answers empty text. */
export function transportRequest(request: TransportRequest, context: TransportContext, sink: TransportSink): Promise<string> {
  return withTextFallback(request, (args) => sendOnce(args, context, sink), context.noteSchemaRejected);
}

async function sendOnce(request: TransportRequest, context: TransportContext, sink: TransportSink): Promise<string> {
  const {
    systemPrompt, messages, type: requestType, maxTokens: maxTokensOverride = null, signal, silent = false,
    attachTurnId, anatomy, statRequest, responseSchema, textFallback,
  } = request;
  // Text only, so an attached image never enters the recording.
  const paritySeq = recordParityRequest({ systemPrompt, messages: messages.map(asTextMessage), type: requestType, maxTokens: maxTokensOverride, silent, attachTurnId });

  // Resolved once, so the capture and the body can never disagree about which target answered.
  const target = context.resolveEndpoint(requestType);
  const tools = toolsOfferedTo(requestType, context.tools, context.enabledTools, context.toolsEnabled, context.worldTools);
  const executeTool = tools.length ? request.executeTool ?? snapshotToolExecutor(context.toolSnapshot) : undefined;
  const spec = buildAiRequestSpec({ ...context.settings, resolveTarget: () => target }, {
    systemPrompt, messages, requestType, maxTokensOverride, ...(executeTool && { tools }), ...(responseSchema && { responseSchema }),
  });

  const captured = !silent || (context.showSilentRequests && attachTurnId !== undefined);
  const attachTo = silent ? attachTurnId ?? null : null;
  const captureId = randomUUID();
  // Only token events are guarded: a sink that throws on any other event fails the request.
  const emit = (event: TransportEvent) => {
    try { sink(event); } catch (e) { console.error('Error presenting a streamed token:', e); }
  };

  try {
    if (captured) sink({
      type: 'requestCaptured',
      attachTo,
      record: {
        type: requestType,
        // The wire messages, so the viewer shows exactly what was sent.
        messages: spec.body.messages,
        id: captureId,
        statRequestId: statRequest?.id,
        anatomy,
        endpoint: toDebugEndpoint(target, spec.body, spec.target.reasoning.dialect),
      },
    });

    let content = '';
    let reasoningText = '';
    let finishReason: string | null = null;
    let opened = false;
    const toolRounds: AiToolRound[] = [];
    const events = streamAiToolLoop(spec, { signal, execute: executeTool, captureRounds: context.showSilentRequests, fetchImpl: context.fetchImpl });
    for await (const event of events) {
      if (event.type === 'debug') {
        if (event.debug.kind === 'response') { opened = true; sink({ type: 'opened' }); }
        if (event.debug.kind === 'parse') console.error('Error parsing streaming response:', event.debug.error);
        if (event.debug.kind === 'overrun') {
          const { dialect, tokens, budget } = event.debug;
          console.debug(`${dialect} thought ran ${tokens} tokens against a budget of ${budget}`);
        }
        continue;
      }
      if (event.type === 'toolRound') { toolRounds.push(event.round); sink({ type: 'toolRound', round: event.round }); continue; }
      if (event.type === 'toolCalls') {
        if (content.trim()) { content = ''; sink({ type: 'retract' }); }
        sink({ type: 'toolCalls', names: event.names });
        continue;
      }
      if (event.type === 'roundStarted') { sink({ type: 'roundStarted' }); continue; }
      if (event.type === 'done') {
        // The stream's own finals replace the running values.
        content = event.result.content;
        reasoningText = event.result.reasoningText;
        finishReason = event.result.finishReason;
        break;
      }
      if (event.type === 'reasoning') { reasoningText = event.text; emit({ type: 'reasoning', text: reasoningText }); }
      else { content = event.content; emit({ type: 'delta', content }); }
    }

    // A stop ends the stream gracefully with its partial content; the request still answers nothing.
    if (signal?.aborted || finishReason === ABORTED_FINISH_REASON) {
      if (opened) sink({ type: 'canceled' });
      return '';
    }

    const raw = content.trim();
    context.noteReasoningReply(spec.target, reasoningText, raw, spec.reasoningLevel ?? null);
    let text = stripReasoning(content).trim();
    // A narration cut at the token cap ends on its last complete sentence. Other replies are data.
    if (requestType === 'narration' && finishReason === LENGTH_FINISH_REASON) text = trimToLastSentence(text);
    recordParityResponse(paritySeq, raw);

    if (captured) sink({
      type: 'responseCaptured',
      id: captureId,
      attachTo,
      response: {
        response: raw,
        ...(reasoningText.trim() ? { reasoning: reasoningText } : {}),
        ...(toolRounds.length ? { toolRounds } : {}),
        statDiagnostics: statRequest ? readStatResponse(text, statRequest).diagnostics : undefined,
      },
    });
    sink({ type: 'done', text, raw: content, reasoningText, finishReason });
    return text;
  } catch (error) {
    // The text-pass retry speaks for this failure.
    if (spec.body.response_format && textFallback && schemaRejected(error)) throw new SchemaRefused(spec.target, error);
    // A stop never lands here: the stream turns an aborted fetch or read into a graceful finish.
    console.error('Error in the request transport:', error);
    const override = rejectedEndpointOverride(error, spec);
    // A persisted settings change explains itself even on a silent request.
    if (override) sink({ type: 'failure', failure: { kind: 'rejectedOverride', error, override, endpointId: spec.target.endpointId, presetName: target.presetName } });
    else if (!silent) sink({ type: 'failure', failure: { kind: 'request', error } });
    throw error;
  }
}

