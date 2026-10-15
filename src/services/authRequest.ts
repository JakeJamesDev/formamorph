import AuthService from './AuthService';
import { responseError, type ReasonFields } from './responseError';

/** Request headers for the community API: the bearer token only when signed in, plus a JSON content type for a body. */
export function authHeaders(withBody = false): Record<string, string> {
  const headers: Record<string, string> = {};
  if (AuthService.token) headers.Authorization = `Bearer ${AuthService.token}`;
  if (withBody) headers['Content-Type'] = 'application/json';
  return headers;
}

/** Parse a response, or throw the server's own message. `fallback` covers a body that carries none. */
export async function unwrap<T>(response: Response, fallback: string, fields?: ReasonFields): Promise<T> {
  if (!response.ok) throw await responseError(response, fallback, fields);
  return (await response.json()) as T;
}
