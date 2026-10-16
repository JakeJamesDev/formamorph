import { describe, it, expect, afterEach } from 'vitest';
import AuthService from './AuthService';
import { authHeaders, unwrap } from './authRequest';

const json = (body: unknown, status: number): Response =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

afterEach(() => {
  AuthService.token = null;
});

describe('authHeaders', () => {
  it('carries the bearer token when signed in', () => {
    AuthService.token = 'abc';

    expect(authHeaders()).toEqual({ Authorization: 'Bearer abc' });
  });

  it('carries no header at all when signed out', () => {
    AuthService.token = null;

    expect(authHeaders()).toEqual({});
  });

  it('adds the JSON content type for a call with a body, signed in or out', () => {
    AuthService.token = 'abc';
    expect(authHeaders(true)).toEqual({ Authorization: 'Bearer abc', 'Content-Type': 'application/json' });

    AuthService.token = null;
    expect(authHeaders(true)).toEqual({ 'Content-Type': 'application/json' });
  });
});

describe('unwrap', () => {
  it('returns the parsed body of a good response', async () => {
    await expect(unwrap<{ data: number }>(json({ data: 3 }, 200), 'Failed')).resolves.toEqual({ data: 3 });
  });

  it('throws the server text from the error field', async () => {
    await expect(unwrap(json({ error: 'Suspended' }, 403), 'Failed')).rejects.toThrow('Suspended');
  });

  it('reads the message field when the body has no error field', async () => {
    await expect(unwrap(json({ message: 'Too many tries' }, 429), 'Failed')).rejects.toThrow('Too many tries');
  });

  it('falls back to the caller text when the body carries none', async () => {
    await expect(unwrap(json({}, 500), 'Failed to load')).rejects.toThrow('Failed to load');
  });

  it('falls back to the caller text when the error body is not JSON', async () => {
    const page = new Response('<html>Bad Gateway</html>', { status: 502 });

    await expect(unwrap(page, 'Failed to load')).rejects.toThrow('Failed to load');
  });

  it('reads only the listed fields when a call names them', async () => {
    const body = { error: 'Internal detail', message: 'Shown text' };

    await expect(unwrap(json(body, 400), 'Failed', ['message'])).rejects.toThrow('Shown text');
  });
});
