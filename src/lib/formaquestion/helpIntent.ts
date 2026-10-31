/**
 * The Intent Classifier: one plain request before the answer gives a help question one Intent, which decides
 * the answer request's Help Request Plan. A reply that names no known Intent gets the full request.
 */
import { requestAiText, type AiTextOptions } from '@/lib/aiRequest/aiText';
import type { AiSettingsSnapshot } from '@/lib/aiRequest/aiRequestSpec';
import { followsResponseSchema, schemaRejected, type ResponseSchema } from '@/lib/aiRequest/responseSchema';
import type { HelpRequestOptions } from './helpPresets';

export const INTENTS = ['Chat', 'Help', 'Code', 'World', 'Create'] as const;

/** What a help question asks for, which decides what its answer request carries. */
export type Intent = (typeof INTENTS)[number];

/** The classifier's reading of one question: its Intent, and whether it holds a second ask of another Intent. */
export interface IntentReading {
  readonly intent: Intent;
  readonly secondAsk: boolean;
}

/** The Default preset's cap of a classifier reply in tokens: room for the two lines or the JSON object. */
export const HELP_INTENT_MAX_TOKENS = 40;

/** The strict schema the classifier reply follows where the endpoint accepts schemas. */
export const INTENT_SCHEMA: ResponseSchema = {
  name: 'help_intent',
  schema: {
    type: 'object',
    properties: { intent: { type: 'string', enum: [...INTENTS] }, secondAsk: { type: 'string', enum: ['yes', 'no'] } },
    required: ['intent', 'secondAsk'],
    additionalProperties: false,
  },
};

/** The rider of a question that holds a second ask (Q21). */
export const TWO_ASK_RIDER = 'The player asked for two things in this message. Answer the first one. Then tell the player in one sentence that you can handle one thing at a time for now, and ask them to send the second one next.';

/** The rider of a World question with no world open (Q49). */
export const NO_WORLD_RIDER = 'Tell the player that no world is open, and that a world question needs a world open in the World Editor or in a game.';

const intentOf = (label: string): Intent | undefined => INTENTS.find((intent) => intent.toLowerCase() === label.trim().toLowerCase());

/**
 * The reading of a classifier reply: the schema's JSON object, else an `Intent:` line or a reply that is one
 * label alone. A missing second-ask line or field reads as no. Null when the reply names no known Intent.
 */
export function readIntent(reply: string): IntentReading | null {
  const text = reply.trim();
  if (followsResponseSchema(text, INTENT_SCHEMA.schema, true)) {
    const { intent, secondAsk } = JSON.parse(text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')) as { intent?: Intent; secondAsk?: 'yes' | 'no' };
    return intent ? { intent, secondAsk: secondAsk === 'yes' } : null;
  }
  const labelLine = /^\s*\**intent\**\s*:\s*\**\s*([a-z]+)\**[.!]?\s*$/im.exec(text);
  const intent = intentOf(labelLine ? labelLine[1] : text.replace(/[.*]/g, ''));
  if (!intent) return null;
  return { intent, secondAsk: /^\s*\**second ask\**\s*:\s*\**\s*yes\b/im.test(text) };
}

export interface IntentQuestion {
  question: string;
  /** The Intent Classifier prompt as the request carries it: the active preset's text, chips rendered. */
  prompt: string;
  /** The last exchange, which a short follow-up continues. */
  earlier?: string;
  earlierAnswer?: string;
  /** The open screen, as the answer request names it. */
  where?: string;
}

/** The one user message of a classifier request: the screen, the last exchange, then the question. */
export function intentMessage({ question, earlier, earlierAnswer, where }: Omit<IntentQuestion, 'prompt'>): string {
  return [
    ...(where ? [`The player asks from this screen: ${where}.`] : []),
    ...(earlier ? [`The player's earlier question: ${earlier}`] : []),
    ...(earlierAnswer ? [`The earlier answer:\n${earlierAnswer}`] : []),
    `Message: ${question}`,
  ].join('\n\n');
}

/**
 * Asks the model for the question's Intent, with the schema where the endpoint accepts one. An endpoint that
 * refuses the schema gets the same request once more without it. Null for a reply that names no known Intent.
 * Throws the request pipeline's errors, and an `AbortError` when stopped.
 */
export async function requestIntent(
  ask: IntentQuestion,
  snapshot: AiSettingsSnapshot,
  { temperature, repetitionPenalty, maxTokens }: HelpRequestOptions,
  options: AiTextOptions = {},
): Promise<IntentReading | null> {
  const call = {
    systemPrompt: ask.prompt,
    messages: [{ role: 'user' as const, content: intentMessage(ask) }],
    requestType: 'help' as const,
    maxTokensOverride: maxTokens,
    samplerOverride: { temperature, repetitionPenalty },
  };
  try {
    return readIntent(await requestAiText(snapshot, { ...call, responseSchema: INTENT_SCHEMA }, options));
  } catch (error) {
    if (!schemaRejected(error)) throw error;
    return readIntent(await requestAiText(snapshot, call, options));
  }
}
