import type { AIRequestType, ChatMessage } from '@/types';
import type { ThinkingMode, ReasoningEffort } from '@/contexts/SettingsContext';
import type { ParagraphLimit } from '@/lib/outputLength';
import {
  reasoningBudgetTokens, reasoningEffortValue, reasoningRuledOut, resolvePromptReasoning,
  type PromptReasoning, type ReasoningCapability, type ReasoningEffortField,
} from '@/lib/reasoningEffort';
import { reasoningDialectBody, type ReasoningBodyFields, type ReasoningWrite } from '@/lib/reasoningDialect';
import { resolvePromptSampler, type PromptSamplerMap } from '@/lib/promptSamplers';
import type { EndpointSampler, EndpointSamplerOverrides } from '@/lib/endpointSamplers';

/** Everything about the endpoint one call resolved to. The probe/cache state producing it stays outside. */
export interface AiEndpointTarget {
  /** Stable endpoint-configuration identity, including the hosted Default. */
  endpointId: string;
  url: string;
  apiToken: string;
  model: string;
  maxTokens: number | undefined;
  /** Send the desktop bundled engine's body shape (top_p/top_k/min_p, token-budget reasoning). */
  localEngine: boolean;
  /** Per-endpoint sampler switches and remembered values. The engine ignores these. */
  samplerOverrides: EndpointSamplerOverrides;
  /** What is known about this target's native reasoning: whether the model reasons, which effort literals the
   *  endpoint accepts, and whether it takes a token budget. An unanswered question sends no field. */
  reasoning: ReasoningCapability;
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

/** The chat-completions body this layer builds. Optional fields are absent, never undefined-valued. The
 *  reasoning fields come from the target dialect's row, so they arrive as a group. */
export interface AiRequestBody extends ReasoningBodyFields {
  model: string;
  messages: ChatMessage[];
  max_tokens?: number;
  stream: true;
  top_p?: number;
  top_k?: number;
  min_p?: number;
  temperature?: number;
  repetition_penalty?: number;
  repeat_penalty?: number;
  stop?: string[];
}

/** A complete request, ready for one fetch. */
export interface AiRequestSpec {
  url: string;
  headers: Record<string, string>;
  body: AiRequestBody;
  target: AiEndpointTarget;
  requestType: AIRequestType;
  /** The effort literal this request carried, whichever field the dialect spelled it in. Absent where it
   *  carried none. Read by the observation, which asks what was in force rather than which key held it. */
  reasoningLevel?: ReasoningEffortField;
  /** Where every emitted sampler value came from, retained for targeted rejection handling. */
  samplerSources: Partial<Record<EndpointSampler, 'prompt' | 'prompt-pin' | 'endpoint' | 'local-engine'>>;
  /** Origin of an emitted output cap, kept apart from the sampler provenance. */
  maxTokensSource?: 'internal' | 'endpoint' | 'local-engine';
}

/** The `/no_think` soft switch (Qwen-style) applies to every request type, so a reasoning model's scratchpad
 *  is off wherever the setting is on. */
function resolveSystemPrompt(systemPrompt: string, disableThinking: boolean): string {
  return disableThinking ? `${systemPrompt}\n\n/no_think` : systemPrompt;
}

/** The samplers actually sent for one call. `undefined` means omit the field so the endpoint's own value applies. */
interface ResolvedSampler {
  value: number | undefined;
  source?: 'prompt' | 'prompt-pin' | 'endpoint' | 'local-engine';
}

function resolveSampler(
  snapshot: AiSettingsSnapshot,
  requestType: AIRequestType,
  localEngine: boolean,
  target: AiEndpointTarget,
  sampler: 'temperature' | 'repetitionPenalty',
): ResolvedSampler {
  const setting = snapshot.promptSamplers[requestType]?.[sampler];
  if (setting?.custom) return { value: setting.value, source: 'prompt' };

  const globalValue = sampler === 'temperature' ? snapshot.genTemperature : snapshot.genRepetitionPenalty;
  const promptValue = resolvePromptSampler(requestType, sampler, {}, globalValue, localEngine);
  if (promptValue !== undefined) return {
    value: promptValue,
    source: localEngine ? 'local-engine' : 'prompt-pin',
  };

  const endpoint = target.samplerOverrides[sampler];
  return endpoint.enabled ? { value: endpoint.value, source: 'endpoint' } : { value: undefined };
}

function resolveSamplers(
  snapshot: AiSettingsSnapshot,
  requestType: AIRequestType,
  target: AiEndpointTarget,
): { temperature: ResolvedSampler; repetitionPenalty: ResolvedSampler } {
  return {
    temperature: resolveSampler(snapshot, requestType, target.localEngine, target, 'temperature'),
    repetitionPenalty: resolveSampler(snapshot, requestType, target.localEngine, target, 'repetitionPenalty'),
  };
}

/**
 * Builds the complete chat-completions body for one call, engine split included.
 *
 * The built-in engine takes its own sampler trio; an external endpoint keeps its own. The capability record
 * decides the reasoning fields, and the two are independent. A target that takes a token budget is capped by
 * one, unless the record rules native reasoning out. The coarse effort hint rides beside the cap on a target
 * whose record lists the literal, and only when reasoning is engaged, so a plain endpoint is never sent a
 * field it rejects. The record's dialect then spells both, so no endpoint's field names live here. The
 * penalty ships under both spellings: `repetition_penalty` for vLLM-family servers and the built-in engine,
 * `repeat_penalty` for LM Studio, which ignores the other.
 */
export function buildRequestBody(snapshot: AiSettingsSnapshot, call: AiCall): AiRequestBody {
  return bodyForTarget(snapshot, call, snapshot.resolveTarget(call.requestType));
}

/** The output cap one call resolves to: its own override, or the target's. */
function capFor(call: AiCall, target: AiEndpointTarget): number | undefined {
  return call.maxTokensOverride ?? target.maxTokens;
}

/**
 * What one call says about reasoning, before the dialect spells it. One resolved choice drives both halves:
 * the effort literal and the on/off of the token budget. The literal is withheld while reasoning is engaged
 * nowhere, so an endpoint that never had a reasoning user is sent nothing at all, and a record that rules the
 * model out licenses no off signal either.
 */
function resolveReasoningWrite(snapshot: AiSettingsSnapshot, call: AiCall, target: AiEndpointTarget): ReasoningWrite {
  const effort = resolvePromptReasoning(call.requestType, snapshot.promptReasoning, snapshot.reasoningEffort, snapshot.thinkingMode);
  const reasons = !reasoningRuledOut(target.reasoning);
  const maxTokens = capFor(call, target);
  return {
    budget: target.reasoning.budget === true && reasons
      ? reasoningBudgetTokens(effort, call.requestType, snapshot.promptReasoningBudget, maxTokens ?? 0)
      : null,
    level: snapshot.reasoningEngaged ? reasoningEffortValue(effort, target.reasoning) : null,
    off: snapshot.reasoningEngaged && effort === 'none' && reasons,
    ...(maxTokens !== undefined && { maxTokens }),
  };
}

function bodyForTarget(snapshot: AiSettingsSnapshot, call: AiCall, target: AiEndpointTarget): AiRequestBody {
  const { requestType } = call;
  const localEngine = target.localEngine;
  const maxTokens = capFor(call, target);
  const { temperature, repetitionPenalty } = resolveSamplers(snapshot, requestType, target);
  const externalOverrides = target.samplerOverrides;

  return {
    model: target.model,
    messages: buildMessages(snapshot, call),
    ...(maxTokens !== undefined && { max_tokens: maxTokens }),
    stream: true,
    ...(localEngine
      ? { top_p: snapshot.genTopP, top_k: snapshot.genTopK, min_p: snapshot.genMinP }
      : {
          ...(externalOverrides.topP.enabled && { top_p: externalOverrides.topP.value }),
          ...(externalOverrides.topK.enabled && { top_k: externalOverrides.topK.value }),
          ...(externalOverrides.minP.enabled && { min_p: externalOverrides.minP.value }),
        }),
    ...(temperature.value !== undefined && { temperature: temperature.value }),
    ...(repetitionPenalty.value !== undefined && { repetition_penalty: repetitionPenalty.value, repeat_penalty: repetitionPenalty.value }),
    // The bundled engine caps by tokens and ignores the literal, so its row names no level field — not even
    // once something answers the levels question for the endpoint whose record it shares.
    ...reasoningDialectBody(target.reasoning.dialect, resolveReasoningWrite(snapshot, call, target)),
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
  const samplers = resolveSamplers(snapshot, call.requestType, target);
  const reasoning = resolveReasoningWrite(snapshot, call, target);
  return {
    url: target.url,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${target.apiToken}` },
    body: bodyForTarget(snapshot, call, target),
    target,
    requestType: call.requestType,
    ...(reasoning.level !== null && { reasoningLevel: reasoning.level }),
    ...(call.maxTokensOverride !== null && call.maxTokensOverride !== undefined
      ? { maxTokensSource: 'internal' as const }
      : target.maxTokens !== undefined
        ? { maxTokensSource: target.localEngine ? 'local-engine' as const : 'endpoint' as const }
        : {}),
    samplerSources: {
      ...(samplers.temperature.source && { temperature: samplers.temperature.source }),
      ...(samplers.repetitionPenalty.source && { repetitionPenalty: samplers.repetitionPenalty.source }),
      ...(target.localEngine
        ? { topP: 'local-engine' as const, topK: 'local-engine' as const, minP: 'local-engine' as const }
        : {
            ...(target.samplerOverrides.topP.enabled && { topP: 'endpoint' as const }),
            ...(target.samplerOverrides.topK.enabled && { topK: 'endpoint' as const }),
            ...(target.samplerOverrides.minP.enabled && { minP: 'endpoint' as const }),
          }),
    },
  };
}
