import { describe, it, expect } from 'vitest';
import originStrip from './originStrip.cjs';

const { httpOrigin, stripOrigin } = originStrip;

/** What Chromium sends from the desktop window to a local ComfyUI. */
const sent = { Origin: 'app://local', 'Sec-Fetch-Site': 'cross-site', 'Content-Type': 'application/json' };
const comfy = httpOrigin('http://127.0.0.1:8188');

describe('httpOrigin', () => {
  it('maps the progress socket onto its server', () => {
    expect(httpOrigin('ws://127.0.0.1:8188/ws?clientId=a')).toBe('http://127.0.0.1:8188');
    expect(httpOrigin('wss://comfy.example:8443/ws')).toBe('https://comfy.example:8443');
  });

  it('drops the path and matches default ports', () => {
    expect(httpOrigin('http://localhost:80/prompt')).toBe('http://localhost');
    expect(httpOrigin('ws://localhost/ws')).toBe('http://localhost');
  });

  it('returns null for other schemes and junk', () => {
    expect(httpOrigin('app://local/index.html')).toBeNull();
    expect(httpOrigin('file:///C:/x')).toBeNull();
    expect(httpOrigin('not a url')).toBeNull();
    expect(httpOrigin(undefined)).toBeNull();
  });
});

describe('stripOrigin', () => {
  it('removes Origin and Sec-Fetch-Site from our requests to ComfyUI and keeps the rest', () => {
    expect(stripOrigin('http://127.0.0.1:8188/prompt', sent, comfy, true)).toEqual({ 'Content-Type': 'application/json' });
  });

  it('matches header names in any case', () => {
    const out = stripOrigin('http://127.0.0.1:8188/prompt', { origin: 'app://local', 'sec-fetch-site': 'cross-site' }, comfy, true);
    expect(out).toEqual({});
  });

  it('covers the progress socket', () => {
    expect(stripOrigin('ws://127.0.0.1:8188/ws?clientId=a', sent, comfy, true)).not.toHaveProperty('Origin');
  });

  it('leaves requests from any other page alone', () => {
    expect(stripOrigin('http://127.0.0.1:8188/prompt', sent, comfy, false)).toBe(sent);
  });

  it('leaves other servers alone, including another port on the same host', () => {
    expect(stripOrigin('http://127.0.0.1:1234/v1/chat/completions', sent, comfy, true)).toBe(sent);
    expect(stripOrigin('http://localhost:8188/prompt', sent, comfy, true)).toBe(sent);
  });

  it('strips nothing while ComfyUI is not the provider', () => {
    expect(stripOrigin('http://127.0.0.1:8188/prompt', sent, null, true)).toBe(sent);
  });
});
