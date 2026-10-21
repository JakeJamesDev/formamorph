import { AiStreamError } from './aiStream';

/** The JSON Schema subset a response format may use. It names no `uniqueItems`, which the cloud server rejects. */
export type ResponseSchemaNode =
  | { type: 'integer'; minimum?: number; maximum?: number }
  | { type: 'object'; properties: Record<string, ResponseSchemaNode>; required: string[]; additionalProperties: false };

/** A schema the reply must follow, and the name the request gives it. */
export interface ResponseSchema {
  name: string;
  schema: ResponseSchemaNode;
}

/** The chat-completions `response_format` that carries a schema. */
export interface ResponseFormat {
  type: 'json_schema';
  json_schema: { name: string; strict: true; schema: ResponseSchemaNode };
}

export const responseFormat = ({ name, schema }: ResponseSchema): ResponseFormat =>
  ({ type: 'json_schema', json_schema: { name, strict: true, schema } });

/** A schema request the endpoint refused with a client error, before a text-pass answer proves the schema was why. */
export class SchemaRefused extends Error {
  constructor(readonly target: { url: string; model: string }, cause: unknown) {
    super('The endpoint refused the response schema.', { cause });
    this.name = 'SchemaRefused';
  }
}

/** A call that may carry a schema, and what it sends instead when the schema is refused. */
export interface SchemaCall<TFallback> {
  responseSchema?: ResponseSchema;
  textFallback?: TFallback;
  signal?: AbortSignal;
}

/**
 * Sends `args`, and on a {@link SchemaRefused} sends its text fallback once. Only that answer proves the
 * schema was the cause, so only it calls `onRefused`; a failed or stopped retry marks nothing.
 */
export async function withTextFallback<A extends SchemaCall<Partial<A>>>(
  args: A,
  send: (args: A) => Promise<string>,
  onRefused: (target: SchemaRefused['target']) => void,
): Promise<string> {
  try {
    return await send(args);
  } catch (error) {
    if (!(error instanceof SchemaRefused) || !args.textFallback) throw error;
    const answer = await send({ ...args, ...args.textFallback, responseSchema: undefined, textFallback: undefined });
    if (!args.signal?.aborted) onRefused(error.target);
    return answer;
  }
}

/** Parameter names a server gives when it refuses the response format itself. */
const SCHEMA_PARAMETER = /response_format|json_schema|guided/i;

/**
 * Whether a failed schema request may be the endpoint refusing the schema: a client error that names no
 * other parameter. The caller proves it by retrying without the schema.
 */
export function schemaRejected(error: unknown): boolean {
  if (!(error instanceof AiStreamError) || error.kind !== 'http') return false;
  if (error.status !== 400 && error.status !== 422) return false;
  const parameter = error.serverError?.parameter;
  return !parameter || SCHEMA_PARAMETER.test(parameter);
}
