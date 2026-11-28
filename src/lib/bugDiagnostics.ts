import { APP_VERSION } from '@/lib/version';
import type { BugDiagnostics } from '@/types';

/** Labels for the diagnostics panel, so the reporter reads what is being sent rather than raw keys. */
export const DIAGNOSTIC_LABELS: Record<keyof BugDiagnostics, string> = {
  version: 'Version',
  platform: 'Platform',
  system: 'System',
};

/**
 * Reduce a user-agent string to the OS and browser worth reporting.
 *
 * Deliberately coarse. The full string is a fingerprint, and a bug report needs to know "Windows, Chrome 131",
 * not the exact build of every engine the browser lists. A Chromium fork also names its Chromium major,
 * which decides how the web platform behaves.
 *
 * @param userAgent - `navigator.userAgent`
 * @returns Something like `Windows · Chrome 131`, or `Unknown` when neither is recognizable
 */
export function summarizeUserAgent(userAgent: string): string {
  const ua = userAgent || '';

  const os =
    /Windows/i.test(ua) ? 'Windows'
    : /Android/i.test(ua) ? 'Android'
    // iOS before macOS: an iPad's user agent says "Macintosh" too.
    : /iPhone|iPad|iPod/i.test(ua) ? 'iOS'
    : /Mac OS X|Macintosh/i.test(ua) ? 'macOS'
    : /Linux/i.test(ua) ? 'Linux'
    : null;

  const major = (pattern: RegExp) => ua.match(pattern)?.[1];
  const chromium = major(/Chrome\/(\d+)/);
  const fork = (name: string, version: string | undefined) =>
    [name, version, chromium && `(Chromium ${chromium})`].filter(Boolean).join(' ');

  const browser =
    // Order matters: Edge, Opera, Samsung Internet and WebViews all claim Chrome, and Chrome claims Safari.
    /Edg\//i.test(ua) ? ['Edge', major(/Edg\/(\d+)/)].filter(Boolean).join(' ')
    : /OPR\/|Opera/i.test(ua) ? fork('Opera', major(/OPR\/(\d+)/))
    : /SamsungBrowser\//i.test(ua) ? fork('Samsung Internet', major(/SamsungBrowser\/(\d+)/))
    : /Android/i.test(ua) && /; wv\)/.test(ua) ? fork('WebView', undefined)
    : /Firefox\//i.test(ua) ? ['Firefox', major(/Firefox\/(\d+)/)].filter(Boolean).join(' ')
    : chromium ? `Chrome ${chromium}`
    : /Safari\//i.test(ua) ? ['Safari', major(/Version\/(\d+)/)].filter(Boolean).join(' ')
    : null;

  const parts = [os, browser].filter(Boolean);
  return parts.length ? parts.join(' · ') : 'Unknown';
}

/**
 * What the client reports about itself with a bug.
 *
 * Only what makes a report reproducible: the build, whether it is the desktop shell, and a coarse
 * OS/browser. Nothing about the playthrough, and nothing the reporter is not shown before sending.
 *
 * @returns The diagnostics block
 */
export function collectDiagnostics(): BugDiagnostics {
  const desktop = typeof window !== 'undefined'
    && Boolean((window as { formamorphDesktop?: unknown }).formamorphDesktop);

  return {
    version: APP_VERSION,
    platform: desktop ? 'Desktop' : 'Browser',
    system: summarizeUserAgent(typeof navigator === 'undefined' ? '' : navigator.userAgent),
  };
}

/** The diagnostics as labeled lines, for text a user copies. Empty values are left out. */
export function formatDiagnostics(diagnostics: BugDiagnostics): string {
  return (Object.keys(DIAGNOSTIC_LABELS) as (keyof BugDiagnostics)[])
    .filter((key) => diagnostics[key])
    .map((key) => `${DIAGNOSTIC_LABELS[key]}: ${diagnostics[key]}`)
    .join('\n');
}
