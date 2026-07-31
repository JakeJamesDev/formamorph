import { describe, it, expect, afterEach, vi } from 'vitest';
import { collectDiagnostics, summarizeUserAgent } from './bugDiagnostics';
import { APP_VERSION } from './version';

const UA = {
  chromeWindows: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  edgeWindows: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Edg/131.0.0.0',
  firefoxLinux: 'Mozilla/5.0 (X11; Linux x86_64; rv:133.0) Gecko/20100101 Firefox/133.0',
  safariMac: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15',
  safariIpad: 'Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
  chromeAndroid: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36',
  operaWindows: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 OPR/117.0.0.0',
};

afterEach(() => {
  delete (window as { formamorphDesktop?: unknown }).formamorphDesktop;
  vi.unstubAllGlobals();
});

describe('summarizing a user agent', () => {
  it('names the OS and the browser', () => {
    expect(summarizeUserAgent(UA.chromeWindows)).toBe('Windows · Chrome');
    expect(summarizeUserAgent(UA.firefoxLinux)).toBe('Linux · Firefox');
  });

  it('does not read Edge or Opera as Chrome', () => {
    // Both claim Chrome in their user agent, so a naive check reports the wrong browser for each.
    expect(summarizeUserAgent(UA.edgeWindows)).toBe('Windows · Edge');
    expect(summarizeUserAgent(UA.operaWindows)).toBe('Windows · Opera');
  });

  it('does not read Chrome as Safari', () => {
    // Chrome's user agent ends in "Safari/537.36".
    expect(summarizeUserAgent(UA.chromeWindows)).toContain('Chrome');
    expect(summarizeUserAgent(UA.safariMac)).toBe('macOS · Safari');
  });

  it('reads an iPad as iOS rather than macOS', () => {
    // An iPad's user agent says "Mac OS X" too, so order of checks is what separates them.
    expect(summarizeUserAgent(UA.safariIpad)).toBe('iOS · Safari');
  });

  it('reads Android as Android rather than Linux', () => {
    // Android user agents say "Linux" as well.
    expect(summarizeUserAgent(UA.chromeAndroid)).toBe('Android · Chrome');
  });

  it('says Unknown rather than nothing when it recognizes neither', () => {
    expect(summarizeUserAgent('')).toBe('Unknown');
    expect(summarizeUserAgent('SomeBot/1.0')).toBe('Unknown');
  });

  it('reports whichever half it does recognize', () => {
    expect(summarizeUserAgent('Mozilla/5.0 (Windows NT 10.0)')).toBe('Windows');
  });
});

describe('what is collected', () => {
  it('reports the build, the platform and the system', () => {
    vi.stubGlobal('navigator', { userAgent: UA.chromeWindows });

    expect(collectDiagnostics()).toEqual({
      version: APP_VERSION,
      platform: 'Browser',
      system: 'Windows · Chrome',
    });
  });

  it('says Desktop inside the Electron shell', () => {
    vi.stubGlobal('navigator', { userAgent: UA.chromeWindows });
    (window as { formamorphDesktop?: unknown }).formamorphDesktop = {};

    expect(collectDiagnostics().platform).toBe('Desktop');
  });

  it('collects nothing about the playthrough', () => {
    // The reporter is shown this block before sending, and it must stay to what it claims to be.
    vi.stubGlobal('navigator', { userAgent: UA.chromeWindows });

    expect(Object.keys(collectDiagnostics()).sort()).toEqual(['platform', 'system', 'version']);
  });
});
