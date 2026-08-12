import type { AIRequestType, ChatMessage } from '@/types';
import type { ThinkingMode, ReasoningEffort } from '@/contexts/SettingsContext';
import type { ParagraphLimit } from '@/lib/outputLength';
import {
  reasoningBudgetBody, reasoningEffortBody, resolvePromptReasoning,
  type PromptReasoning, type ReasoningEffortField,
} from '@/lib/reasoningEffort';
import { resolvePromptSampler, type PromptSamplerMap } from '@/lib/promptSamplers';

/** Everything about the endpoint one call resolved to. The probe/cache state producing it stays outside. */
export interface AiEndpointTarget {
  url: string;
  apiToken: string;
  model: string;
  maxTokens: number;
  /** Send the desktop bundled engine's body shape (top_p/top_k/min_p, token-budget reasoning). */
  localEngine: boolean;
  /** Effort literals this target accepts, or null when unprobed — an unprobed target is sent none. */
  supportedReasoningEfforts: readonly ReasoningEffortField[] | null;
}

/** The per-call settings snapshot: plain values plus the endpoint resolver, so nothing here touches React. */
export interface AiSettingsSnapshot {
  resolveTarget: (kind: AIRequestType) => AiEndpointTarget;
  thinkingMode: ThinkingMode;
  /** Global native effort level, folded in by a prompt set to `global`. */
  reasoningEffort: ReasoningEffort;
  /** True when reasoning is engaged anywhere; false suppresses `reasoning_effort` on external endpoints. */
  reasoningEngaged: boolean;
  promptReasoning: Record<string, PromptReasoning>;
  promptReasoningBudget: Partial<Record<AIRequestType, number>>;
  promptSamplers: PromptSamplerMap;
  genTemperature: number;
  genRepetitionPenalty: number;
  genTopP: number;
  genTopK: number;
  genMinP: number;
  paragraphLimit: ParagraphLimit;
  /** Append the `/no_think` soft switch to the system prompt. */
  disableThinking: boolean;
}

/** One AI call as the caller states it, before any settings are applied. */
export interface AiCall {
  systemPrompt: string;
  messages: ChatMessage[];
  requestType: AIRequestType;
  /** Overrides the target's own output cap (also drives the reasoning budget). */
  maxTokensOverride?: number | null;
}

/** The chat-completions body this layer builds. Optional fields are absent, never undefined-valued. */
export interface AiRequestBody {
  model: string;
  messages: ChatMessage[];
  max_tokens: number;
  stream: true;
  top_p?: number;
  top_k?: number;
  min_p?: number;
  temperature?: number;
  repetition_penalty?: number;
  repeat_penalty?: number;
  thinking_budget_tokens?: number;
  reasoning_effort?: ReasoningEffortField;
  stop?: string[];
}

/** A complete request, ready for one fetch. */
export interface AiRequestSpec {
  url: string;
  headers: Record<string, string>;
  body: AiRequestBody;
  target: AiEndpointTarget;
  requestType: AIRequestType;
}

/** The `/no_think` soft switch (Qwen-style) applies to every request type, so a reasoning model's scratchpad
 *  is off wherever the setting is on. */
function resolveSystemPrompt(systemPrompt: string, disableThinking: boolean): string {
  return disableThinking ? `${systemPrompt}\n\n/no_think` : systemPrompt;
}

/** The samplers actually sent for one call. `undefined` means omit the field so the endpoint's own value applies. */
function resolveSamplers(
  snapshot: AiSettingsSnapshot,
  requestType: AIRequestType,
  localEngine: boolean,
): { temperature: number | undefined; repetitionPenalty: number | undefined } {
  return {
    temperature: resolvePromptSampler(requestType, 'temperature', snapshot.promptSamplers, snapshot.genTemperature, localEngine),
    repetitionPenalty: resolvePromptSampler(requestType, 'repetitionPenalty', snapshot.promptSamplers, snapshot.genRepetitionPenalty, localEngine),
  };
}

/**
 * Builds the complete chat-completions body for one call, engine split included.
 *
 * The built-in engine takes its own sampler trio and caps reasoning by a token budget; an external endpoint
 * keeps its own trio and takes the coarse effort hint instead — and only when reasoning is engaged, so a plain
 * endpoint is never sent a field it rejects. The penalty ships under both spellings: `repetition_penalty` for
 * vLLM-family servers and the built-in engine, `repeat_penalty` for LM Studio, which ignores the other.
 */
export function buildRequestBody(snapshot: AiSettingsSnapshot, call: AiCall): AiRequestBody {
  return bodyForTarget(snapshot, call, snapshot.resolveTarget(call.requestType));
}

function bodyForTarget(snapshot: AiSettingsSnapshot, call: AiCall, target: AiEndpointTarget): AiRequestBody {
  const { requestType } = call;
  const localEngine = target.localEngine;
  const maxTokens = call.maxTokensOverride ?? target.maxTokens;
  const { temperature, repetitionPenalty } = resolveSamplers(snapshot, requestType, localEngine);

  return {
    model: target.model,
    messages: buildMessages(snapshot, call),
    max_tokens: maxTokens,
    stream: true,
    ...(localEngine && { top_p: snapshot.genTopP, top_k: snapshot.genTopK, min_p: snapshot.genMinP }),
    ...(temperature !== undefined && { temperature }),
    ...(repetitionPenalty !== undefined && { repetition_penalty: repetitionPenalty, repeat_penalty: repetitionPenalty }),
    ...(localEngine
      ? reasoningBudgetBody(snapshot.thinkingMode, requestType, snapshot.promptReasoningBudget, maxTokens)
      : snapshot.reasoningEngaged
        ? reasoningEffortBody(
            snapshot.thinkingMode,
            resolvePromptReasoning(requestType, snapshot.promptReasoning, snapshot.reasoningEffort),
            target.supportedReasoningEfforts,
          )
        : {}),
    // Single-paragraph stop, but not in inline-thinking mode — the <think> block needs newlines.
    ...(requestType === 'narration' && snapshot.paragraphLimit === 'single' && snapshot.thinkingMode !== 'inline' && { stop: ['\n'] }),
  };
}

/** The wire message list: the resolved system message first, then the caller's. */
function buildMessages(snapshot: AiSettingsSnapshot, call: AiCall): ChatMessage[] {
  return [
    { role: 'system', content: resolveSystemPrompt(call.systemPrompt, snapshot.disableThinking) },
    ...call.messages,
  ];
}

/** Resolves endpoint, samplers and reasoning into one ready-to-send request. */
export function buildAiRequestSpec(snapshot: AiSettingsSnapshot, call: AiCall): AiRequestSpec {
  const target = snapshot.resolveTarget(call.requestType);
  return {
    url: target.url,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${target.apiToken}` },
    body: bodyForTarget(snapshot, call, target),
    target,
    requestType: call.requestType,
  };
}
