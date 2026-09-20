import { useEffect, useRef, type MutableRefObject } from 'react';

/**
 * Whether the component is still on screen, readable from a callback that outlives it. An async
 * answer or a fired timer that reaches `setState` after unmount is not just a wasted render: in a
 * test the environment is torn down by then, so React reads a `window` that no longer exists and
 * the run reports an unhandled error.
 */
export function useMountedRef(): MutableRefObject<boolean> {
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);
  return mounted;
}
