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
 * Deliberately coarse. The full string is a fingerprint, and a bug report needs to know "Windows, Chrome",
 * not the exact build of every engine the browser lists.
 *
 * @param userAgent - `navigator.userAgent`
 * @returns Something like `Windows · Chrome`, or `Unknown` when neither is recognizable
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

  const browser =
    // Order matters: Edge and Opera both claim Chrome, and Chrome claims Safari.
    /Edg\//i.test(ua) ? 'Edge'
    : /OPR\/|Opera/i.test(ua) ? 'Opera'
    : /Firefox\//i.test(ua) ? 'Firefox'
    : /Chrome\//i.test(ua) ? 'Chrome'
    : /Safari\//i.test(ua) ? 'Safari'
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
