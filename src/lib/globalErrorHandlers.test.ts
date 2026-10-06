// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const bridge = vi.hoisted(() => ({ toast: vi.fn() }));
vi.mock('react-toastify', () => ({ toast: { error: bridge.toast } }));

import { openLatestDetails, toastTexts } from '@/test/toastText';
import { installGlobalErrorHandlers } from './globalErrorHandlers';

let uninstall: () => void;
let log: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  vi.useFakeTimers();
  bridge.toast.mockReset();
  log = vi.spyOn(console, 'error').mockImplementation(() => {});
  uninstall = installGlobalErrorHandlers();
});
afterEach(() => {
  uninstall();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

const reject = (reason: unknown) => {
  const event = new Event('unhandledrejection') as Event & { reason: unknown };
  event.reason = reason;
  window.dispatchEvent(event);
};
const windowError = (init: { message: string; error?: unknown; filename?: string }) =>
  window.dispatchEvent(new ErrorEvent('error', init));

describe('global error handlers', () => {
  it('toasts an unhandled rejection with a View Details link to its full text', () => {
    reject(new Error('Disk is full'));

    expect(toastTexts(bridge.toast)).toEqual(['Disk is full' + 'View Details →']);
    expect(openLatestDetails(bridge.toast)?.details).toContain('Disk is full');
    expect(log).toHaveBeenCalledOnce();
  });

  it('toasts a window error', () => {
    windowError({ message: 'x is not a function', error: new TypeError('x is not a function') });

    expect(toastTexts(bridge.toast)).toEqual(['x is not a function' + 'View Details →']);
  });

  it('shows one toast for the same message ten times within 10 s', () => {
    for (let i = 0; i < 10; i++) {
      reject(new Error('Same failure'));
      vi.advanceTimersByTime(900);
    }

    expect(bridge.toast).toHaveBeenCalledOnce();
    expect(log).toHaveBeenCalledTimes(10);
  });

  it('toasts the same message again once 10 s have passed', () => {
    reject(new Error('Same failure'));
    vi.advanceTimersByTime(10_001);
    reject(new Error('Same failure'));

    expect(bridge.toast).toHaveBeenCalledTimes(2);
  });

  it('logs but shows no toast for a sixth distinct error in a session', () => {
    for (let i = 1; i <= 6; i++) reject(new Error(`Failure ${i}`));

    expect(bridge.toast).toHaveBeenCalledTimes(5);
    expect(log).toHaveBeenCalledTimes(6);
  });

  it.each([
    ['a ResizeObserver loop limit notice', () => windowError({ message: 'ResizeObserver loop limit exceeded' })],
    ['a ResizeObserver undelivered notifications notice', () => windowError({ message: 'ResizeObserver loop completed with undelivered notifications.' })],
    ['an opaque cross-origin script error', () => windowError({ message: 'Script error.' })],
    ['an AbortError rejection', () => reject(new DOMException('The operation was aborted.', 'AbortError'))],
    ['an AbortError window error', () => windowError({ message: 'aborted', error: new DOMException('aborted', 'AbortError') })],
    ['a Chrome extension error', () => windowError({ message: 'boom', filename: 'chrome-extension://abc/content.js' })],
    ['a Firefox extension rejection', () => reject(Object.assign(new Error('boom'), { stack: 'Error: boom\n    at f (moz-extension://abc/content.js:1:1)' }))],
  ])('shows no toast for %s', (_name, raise) => {
    raise();

    expect(bridge.toast).not.toHaveBeenCalled();
  });

  it('does not use up the session cap on an ignored error', () => {
    for (let i = 0; i < 10; i++) windowError({ message: 'Script error.' });
    reject(new Error('Real failure'));

    expect(bridge.toast).toHaveBeenCalledOnce();
  });

  it('stops listening once uninstalled', () => {
    uninstall();
    reject(new Error('Late failure'));

    expect(bridge.toast).not.toHaveBeenCalled();
  });
});
