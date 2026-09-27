import { DetailedError } from '@/lib/errorDetails';
import { redactUrl } from '@/lib/redactUrl';

/** Server error envelope: this API answers with `error`, older handlers elsewhere read `message`. */
export interface ErrorBody {
  error?: string;
  message?: string;
  code?: unknown;
}

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

/**
 * Reads a failed response once. `message` is the server's own reason, or `fallback` when the body has
 * none; `details` is what Error Details shows.
 */
export async function readFailure(response: Response, fallback: string): Promise<{ body: ErrorBody; message: string; details: string }> {
  const text = await readText(response);
  const body = parseErrorBody(text);
  return { body, message: body.error || body.message || fallback, details: responseDetails(response, text) };
}

/** The error a community call throws on a failed response. */
export async function responseError(response: Response, fallback: string): Promise<DetailedError> {
  const { message, details } = await readFailure(response, fallback);
  return new DetailedError(message, details);
}

/** A {@link responseError} that also carries the server's refusal `code`, for callers that branch on it. */
export async function codedFailure(response: Response, fallback: string): Promise<DetailedError & { code?: string }> {
  const { body, message, details } = await readFailure(response, fallback);
  const failure: DetailedError & { code?: string } = new DetailedError(message, details);
  if (typeof body.code === 'string' && body.code) failure.code = body.code;
  return failure;
}
