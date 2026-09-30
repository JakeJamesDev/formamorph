import { useCallback, useLayoutEffect, useRef } from 'react';

/**
 * A function whose identity never changes and that always calls the latest `fn`.
 *
 * For event handlers passed to memoized children. The latest `fn` is taken at commit, so a render that
 * React discards never leaks its closure. A child's own effects run first and would see the previous `fn`.
 */
export function useStableCallback<Args extends unknown[], Result>(
  fn: (...args: Args) => Result,
): (...args: Args) => Result {
  const latest = useRef(fn);
  useLayoutEffect(() => { latest.current = fn; });
  return useCallback((...args: Args) => latest.current(...args), []);
}
