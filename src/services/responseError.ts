import { DetailedError } from '@/lib/errorDetails';
import { redactUrl } from '@/lib/redactUrl';

/** Server error envelope: this API answers with `error`, older handlers elsewhere read `message`. */
export interface ErrorBody {
  error?: string;
  message?: string;
  code?: unknown;
}

/** The body fields a call site reads its message from, in order. */
export type ReasonFields = readonly ('error' | 'message')[];

const ERROR_FIRST: ReasonFields = ['error', 'message'];

interface Failure {
  body: ErrorBody;
  message: string;
  details: string;
}

/** The body as text, or '' when it can't be read. Read once, so the raw text and any parse agree. */
async function readText(response: Response): Promise<string> {
  try {
    return await response.text();
  } catch {
    return '';
  }
}

function parseErrorBody(text: string): ErrorBody {
  try {
    const parsed: unknown = JSON.parse(text);
    return typeof parsed === 'object' && parsed !== null ? parsed as ErrorBody : {};
  } catch {
    return {};
  }
}

/** Details for a failed response: the redacted route, the status and the body as sent. Headers never enter. */
function responseDetails(response: Response, text: string): string {
  return [
    `Route: ${response.url ? redactUrl(response.url) : 'unknown'}`,
    `Status: ${[response.status, response.statusText].filter(Boolean).join(' ')}`,
    '',
    'Response:',
    text.trim() ? text : '(empty)',
  ].join('\n');
}

/** A failed response whose body was already read as `text`: the parsed body, the reason from `fields` or `fallback`, and the details. */
export function failureFromText(response: Response, text: string, fallback: string, fields = ERROR_FIRST): Failure {
  const body = parseErrorBody(text);
  const reason = fields.map((field) => body[field]).find((value) => typeof value === 'string' && value);
  return { body, message: reason || fallback, details: responseDetails(response, text) };
}

/** Reads a failed response once; see {@link failureFromText}. */
export async function readFailure(response: Response, fallback: string, fields = ERROR_FIRST): Promise<Failure> {
  return failureFromText(response, await readText(response), fallback, fields);
}

/** The error a community call throws on a failed response. */
export async function responseError(response: Response, fallback: string, fields = ERROR_FIRST): Promise<DetailedError> {
  const { message, details } = await readFailure(response, fallback, fields);
  return new DetailedError(message, details);
}

/** A {@link responseError} that also carries the server's refusal `code`, for callers that branch on it. */
export async function codedResponseError(response: Response, fallback: string, fields = ERROR_FIRST): Promise<DetailedError & { code?: string }> {
  const { body, message, details } = await readFailure(response, fallback, fields);
  const failure: DetailedError & { code?: string } = new DetailedError(message, details);
  if (typeof body.code === 'string' && body.code) failure.code = body.code;
  return failure;
}
