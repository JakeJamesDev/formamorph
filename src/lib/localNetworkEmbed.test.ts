import { describe, it, expect } from 'vitest';
import {
  classifyEndpointAddress,
  isLocalEndpoint,
  isCrossOriginEmbed,
  shouldOfferPopOut,
  type FrameWindow,
} from './localNetworkEmbed';

describe('classifyEndpointAddress', () => {
  it('calls localhost loopback on any port or protocol', () => {
    expect(classifyEndpointAddress('http://localhost:1234/v1/chat/completions')).toBe('loopback');
    expect(classifyEndpointAddress('http://localhost/v1')).toBe('loopback');
    expect(classifyEndpointAddress('https://localhost:8443/v1')).toBe('loopback');
    expect(classifyEndpointAddress('http://LOCALHOST:1234/v1')).toBe('loopback');
    expect(classifyEndpointAddress('http://api.localhost:1234/v1')).toBe('loopback');
  });

  it('calls the whole 127.0.0.0/8 block loopback', () => {
    expect(classifyEndpointAddress('http://127.0.0.1:1234/v1')).toBe('loopback');
    expect(classifyEndpointAddress('http://127.1.2.3:1234/v1')).toBe('loopback');
    expect(classifyEndpointAddress('http://[::1]:11434/v1')).toBe('loopback');
    expect(classifyEndpointAddress('http://0.0.0.0:1234/v1')).toBe('loopback');
  });

  it('calls the RFC1918 ranges private', () => {
    expect(classifyEndpointAddress('http://192.168.1.100:1234/v1')).toBe('private');
    expect(classifyEndpointAddress('http://10.0.0.7:1234/v1')).toBe('private');
    expect(classifyEndpointAddress('http://172.16.0.1:1234/v1')).toBe('private');
    expect(classifyEndpointAddress('http://172.31.255.254:1234/v1')).toBe('private');
  });

  it('does not over-claim the 172 block at its edges', () => {
    expect(classifyEndpointAddress('http://172.15.0.1:1234/v1')).toBe('public');
    expect(classifyEndpointAddress('http://172.32.0.1:1234/v1')).toBe('public');
  });

  it('calls link-local and unique-local addresses private', () => {
    expect(classifyEndpointAddress('http://169.254.10.5:1234/v1')).toBe('private');
    expect(classifyEndpointAddress('http://[fd00::1]:1234/v1')).toBe('private');
    expect(classifyEndpointAddress('http://[fe80::1]:1234/v1')).toBe('private');
  });

  it('calls mDNS and single-label hosts private', () => {
    expect(classifyEndpointAddress('http://gaming-rig.local:1234/v1')).toBe('private');
    expect(classifyEndpointAddress('http://GAMING-RIG.LOCAL:1234/v1')).toBe('private');
    expect(classifyEndpointAddress('http://desktop:1234/v1')).toBe('private');
  });

  it('calls real domains and routable IPs public', () => {
    expect(classifyEndpointAddress('https://api.lyonade.net/v1/chat/completions')).toBe('public');
    expect(classifyEndpointAddress('https://api.openai.com/v1/chat/completions')).toBe('public');
    expect(classifyEndpointAddress('http://8.8.8.8:1234/v1')).toBe('public');
    expect(classifyEndpointAddress('http://172.217.16.1:1234/v1')).toBe('public');
    expect(classifyEndpointAddress('https://[2606:4700::1111]/v1')).toBe('public');
  });

  it('fails safe to public on anything it cannot parse', () => {
    expect(classifyEndpointAddress('')).toBe('public');
    expect(classifyEndpointAddress('   ')).toBe('public');
    expect(classifyEndpointAddress('not a url')).toBe('public');
    expect(classifyEndpointAddress('localhost:1234')).toBe('public'); // no scheme: not a URL we could call
    expect(classifyEndpointAddress('ftp://localhost:1234/v1')).toBe('public');
  });
});

describe('isLocalEndpoint', () => {
  it('folds loopback and private together, and leaves public out', () => {
    expect(isLocalEndpoint('http://localhost:1234/v1')).toBe(true);
    expect(isLocalEndpoint('http://192.168.1.100:1234/v1')).toBe(true);
    expect(isLocalEndpoint('https://api.lyonade.net/v1')).toBe(false);
  });
});

describe('isCrossOriginEmbed', () => {
  it('is false at the top level', () => {
    const win: FrameWindow = { self: null, top: null };
    win.self = win;
    win.top = win;
    expect(isCrossOriginEmbed(win)).toBe(false);
  });

  it('is true when the window is not its own top', () => {
    const win: FrameWindow = { self: null, top: {} };
    win.self = win;
    expect(isCrossOriginEmbed(win)).toBe(true);
  });

  it('treats a thrown cross-origin access error as embedded', () => {
    const win: FrameWindow = {
      get self(): unknown { return this; },
      get top(): unknown { throw new DOMException('blocked'); },
    };
    expect(isCrossOriginEmbed(win)).toBe(true);
  });

  it('is false when there is no window at all', () => {
    expect(isCrossOriginEmbed(undefined)).toBe(false);
  });
});

describe('shouldOfferPopOut', () => {
  const cases: { embedded: boolean; localEndpoint: boolean; probeFailed: boolean; expected: boolean }[] = [
    { embedded: false, localEndpoint: false, probeFailed: false, expected: false },
    { embedded: false, localEndpoint: false, probeFailed: true, expected: false },
    { embedded: false, localEndpoint: true, probeFailed: false, expected: false },
    { embedded: false, localEndpoint: true, probeFailed: true, expected: false },
    { embedded: true, localEndpoint: false, probeFailed: false, expected: false },
    { embedded: true, localEndpoint: false, probeFailed: true, expected: false },
    { embedded: true, localEndpoint: true, probeFailed: false, expected: false },
    { embedded: true, localEndpoint: true, probeFailed: true, expected: true },
  ];

  it.each(cases)('embedded=$embedded local=$localEndpoint failed=$probeFailed → $expected', (c) => {
    expect(shouldOfferPopOut(c)).toBe(c.expected);
  });
});
