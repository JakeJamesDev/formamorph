import AuthService from './AuthService';
import { responseError } from './responseError';

/** Bearer headers for an authenticated call, with a JSON content type when the call sends a body. */
export function authHeaders(withBody = false): HeadersInit {
  const headers: Record<string, string> = { Authorization: `Bearer ${AuthService.token}` };
  if (withBody) headers['Content-Type'] = 'application/json';
  return headers;
}

/** Parse a response, or throw the server's own message. `fallback` covers a body that carries none. */
export async function unwrap<T>(response: Response, fallback: string): Promise<T> {
  if (!response.ok) throw await responseError(response, fallback);
  return (await response.json()) as T;
}
