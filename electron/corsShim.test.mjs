import { describe, it, expect } from 'vitest';
import corsShim from './corsShim.cjs';

const { withCorsHeaders, corsResponse, unionAllow, REQUIRED_METHODS } = corsShim;

/** Parse an Electron-shaped allow header value back into a lowercase token set. */
const tokens = (value) =>
  new Set(String(value[0]).split(',').map((t) => t.trim().toLowerCase()));

/** What the community server actually answers a preflight with (verified against the live API). */
const communityServer = {
  'Access-Control-Allow-Origin': ['*'],
  'Access-Control-Allow-Methods': ['GET,POST,PUT,DELETE,OPTIONS'],
  'Access-Control-Allow-Headers': ['Content-Type,Authorization'],
  'Content-Type': ['application/json'],
};

describe('withCorsHeaders: the methods the app sends survive the transform', () => {
  // The regression. Publishing an update (PUT) and deleting a world (DELETE) failed on desktop and worked on
  // web, because the shim replaced the server's correct allow-list with a narrower hardcoded one.
  it.each(REQUIRED_METHODS)('allows %s through against the community server', (method) => {
    const out = withCorsHeaders('https://workshop.fierylion.com/api/worlds/abc', communityServer);
    expect(tokens(out['Access-Control-Allow-Methods'])).toContain(method.toLowerCase());
  });

  it('allows every method through even when the server sends no CORS headers at all', () => {
    // LM Studio with CORS off — the case the shim exists for.
    const out = withCorsHeaders('http://localhost:1234/v1/chat/completions', { 'Content-Type': ['application/json'] });
    for (const method of REQUIRED_METHODS) {
      expect(tokens(out['Access-Control-Allow-Methods'])).toContain(method.toLowerCase());
    }
  });

  it('names Authorization explicitly, which a wildcard would not cover', () => {
    // Per the Fetch spec `Access-Control-Allow-Headers: *` does not authorize Authorization.
    const out = withCorsHeaders('https://api.example.com/x', { 'Access-Control-Allow-Headers': ['*'] });
    expect(tokens(out['Access-Control-Allow-Headers'])).toContain('authorization');
  });
});

describe('withCorsHeaders: never narrower than the server', () => {
  it('keeps a method the server allows that the app does not itself send', () => {
    const out = withCorsHeaders('https://api.example.com/x', {
      'Access-Control-Allow-Methods': ['GET, PATCH'],
    });
    expect(tokens(out['Access-Control-Allow-Methods'])).toContain('patch');
  });

  it('keeps a header the server allows that the app does not itself send', () => {
    const out = withCorsHeaders('https://api.example.com/x', {
      'Access-Control-Allow-Headers': ['X-Api-Key'],
    });
    expect(tokens(out['Access-Control-Allow-Headers'])).toContain('x-api-key');
  });
});

describe('withCorsHeaders: origin and passthrough', () => {
  it('answers exactly one Allow-Origin, replacing a server origin that names its web host', () => {
    const out = withCorsHeaders('https://workshop.fierylion.com/api/worlds', {
      'access-control-allow-origin': ['https://workshop.fierylion.com'],
    });
    // The renderer is app://local, which the server's own origin never names — and a duplicated
    // Allow-Origin fails the check outright, so there must be exactly one value.
    expect(out['Access-Control-Allow-Origin']).toEqual(['*']);
  });

  it('drops Allow-Credentials, which is meaningless beside a wildcard origin', () => {
    const out = withCorsHeaders('https://api.example.com/x', {
      'Access-Control-Allow-Credentials': ['true'],
    });
    expect(Object.keys(out).map((k) => k.toLowerCase())).not.toContain('access-control-allow-credentials');
  });

  it('leaves non-CORS headers untouched', () => {
    const out = withCorsHeaders('https://api.example.com/x', {
      'Content-Type': ['text/event-stream'],
      'Cross-Origin-Resource-Policy': ['cross-origin'],
    });
    expect(out['Content-Type']).toEqual(['text/event-stream']);
    expect(out['Cross-Origin-Resource-Policy']).toEqual(['cross-origin']);
  });

  it('passes app:// asset responses through completely untouched', () => {
    const assets = { 'Content-Type': ['text/html'] };
    expect(withCorsHeaders('app://local/index.html', assets)).toBe(assets);
  });
});

describe('corsResponse: preflight status forcing', () => {
  // The regression this exists for: LM Studio with CORS off answers OPTIONS with a 400 from its chat
  // handler. Headers alone can't save a preflight whose status isn't ok, so desktop failed with
  // "Failed to fetch" until the user enabled CORS server-side.
  it('forces an ok status onto an external OPTIONS response, whatever the server said', () => {
    const out = corsResponse({
      url: 'http://localhost:1234/v1/chat/completions',
      method: 'OPTIONS',
      responseHeaders: { 'Content-Type': ['application/json'] },
    });
    expect(out.statusLine).toBe('HTTP/1.1 204 No Content');
    expect(out.responseHeaders['Access-Control-Allow-Origin']).toEqual(['*']);
  });

  it('leaves the status of non-OPTIONS responses alone', () => {
    const out = corsResponse({
      url: 'http://localhost:1234/v1/chat/completions',
      method: 'POST',
      responseHeaders: { 'Content-Type': ['application/json'] },
    });
    expect(out.statusLine).toBeUndefined();
  });

  it('leaves app:// responses alone entirely', () => {
    const assets = { 'Content-Type': ['text/html'] };
    const out = corsResponse({ url: 'app://local/index.html', method: 'OPTIONS', responseHeaders: assets });
    expect(out.statusLine).toBeUndefined();
    expect(out.responseHeaders).toBe(assets);
  });
});

describe('unionAllow', () => {
  it('does not duplicate a value the server already allows, whatever its casing', () => {
    expect(unionAllow(['get, post'], ['GET', 'POST', 'PUT'])).toBe('get, post, PUT');
  });

  it('handles a header split across multiple values', () => {
    expect(unionAllow(['GET', 'POST'], ['PUT'])).toBe('GET, POST, PUT');
  });

  it('falls back to the required set when the server sent nothing', () => {
    expect(unionAllow(undefined, ['GET', 'POST'])).toBe('GET, POST');
  });
});
