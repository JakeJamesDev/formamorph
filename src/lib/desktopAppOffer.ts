import { Capacitor } from '@capacitor/core';
import { isDesktop } from '@/lib/imageGen/desktop';

export interface DeviceFacts {
  /** Running in the Capacitor native app. */
  nativeApp: boolean;
  /** Running in the desktop app. */
  desktopApp: boolean;
  userAgent: string;
  /** `navigator.maxTouchPoints`: iPadOS Safari sends a Mac user agent, and only touch support tells them apart. */
  maxTouchPoints: number;
}

/** Whether the user agent is an Android or iOS browser. */
export function isMobileUserAgent(userAgent: string, maxTouchPoints: number): boolean {
  if (/Android|iPhone|iPad|iPod/i.test(userAgent)) return true;
  return /Macintosh/.test(userAgent) && maxTouchPoints > 1;
}

/** Whether this device can run the desktop app: a desktop browser, never a phone, the native app, or the desktop app itself. */
export function canRunDesktopApp(device: DeviceFacts): boolean {
  if (device.nativeApp || device.desktopApp) return false;
  return !isMobileUserAgent(device.userAgent, device.maxTouchPoints);
}

/** {@link canRunDesktopApp} for the running device. */
export function deviceCanRunDesktopApp(): boolean {
  return canRunDesktopApp({
    nativeApp: Capacitor.isNativePlatform(),
    desktopApp: isDesktop(),
    userAgent: typeof navigator === 'undefined' ? '' : navigator.userAgent,
    maxTouchPoints: typeof navigator === 'undefined' ? 0 : navigator.maxTouchPoints ?? 0,
  });
}
