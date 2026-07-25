import { describe, it, expect } from 'vitest';
import { normalizeEndpointUrl, endpointUrlWasCompleted } from './endpointUrl';

describe('normalizeEndpointUrl', () => {
  it('completes a bare origin — the LM Studio "Reachable at" paste', () => {
    expect(normalizeEndpointUrl('http://127.0.0.1:1234')).toBe('http://127.0.0.1:1234/v1/chat/completions');
    expect(normalizeEndpointUrl('http://localhost:11434/')).toBe('http://localhost:11434/v1/chat/completions');
  });

  it('completes a bare /v1 — the OpenAI-SDK base-URL convention', () => {
    expect(normalizeEndpointUrl('http://localhost:1234/v1')).toBe('http://localhost:1234/v1/chat/completions');
    expect(normalizeEndpointUrl('https://api.featherless.ai/v1/')).toBe('https://api.featherless.ai/v1/chat/completions');
  });

  it('leaves an already-complete URL untouched', () => {
    const full = 'https://api.lyonade.net/v1/chat/completions';
    expect(normalizeEndpointUrl(full)).toBe(full);
  });

  it('leaves non-standard paths alone rather than guessing', () => {
    for (const url of [
      'https://gateway.example.com/openai',
      'https://example.com/api/v1',
      'https://example.com/v2',
      'https://example.com/v1/responses',
    ]) {
      expect(normalizeEndpointUrl(url)).toBe(url);
    }
  });

  it('trims whitespace from a paste', () => {
    expect(normalizeEndpointUrl('  http://127.0.0.1:1234  ')).toBe('http://127.0.0.1:1234/v1/chat/completions');
  });

  it('preserves a query string when completing', () => {
    expect(normalizeEndpointUrl('https://example.com/v1?key=abc')).toBe('https://example.com/v1/chat/completions?key=abc');
  });

  it('returns unparseable or non-http input as-is', () => {
    expect(normalizeEndpointUrl('')).toBe('');
    expect(normalizeEndpointUrl('   ')).toBe('');
    expect(normalizeEndpointUrl('127.0.0.1:1234')).toBe('127.0.0.1:1234');
    expect(normalizeEndpointUrl('not a url')).toBe('not a url');
    expect(normalizeEndpointUrl('file:///tmp/x')).toBe('file:///tmp/x');
  });
});

describe('default-endpoint equivalence', () => {
  // The legacy-migration and custom-endpoint-toggle checks compare a stashed endpoint against the shipped
  // default through this function; a legacy install stashed the full URL, the default is now the base URL.
  it('treats the base URL and its full form as the same endpoint', () => {
    expect(normalizeEndpointUrl('https://api.lyonade.net/v1'))
      .toBe(normalizeEndpointUrl('https://api.lyonade.net/v1/chat/completions'));
  });
});

describe('endpointUrlWasCompleted', () => {
  it('is true only when we filled something in', () => {
    expect(endpointUrlWasCompleted('http://127.0.0.1:1234')).toBe(true);
    expect(endpointUrlWasCompleted('http://127.0.0.1:1234/v1')).toBe(true);
    expect(endpointUrlWasCompleted('http://127.0.0.1:1234/v1/chat/completions')).toBe(false);
    expect(endpointUrlWasCompleted('https://gateway.example.com/openai')).toBe(false);
    expect(endpointUrlWasCompleted('')).toBe(false);
    expect(endpointUrlWasCompleted('  http://127.0.0.1:1234/v1/chat/completions  ')).toBe(false);
  });
});
