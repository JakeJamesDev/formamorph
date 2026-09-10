import { useEffect, useRef, useState } from 'react';
import { measureJsonBytes, terminateMeasureWorker } from '@/lib/jsonMeasureClient';
import { worldPublishPayload } from '@/lib/publishPayload';
import { RULE_DEBOUNCE_MS } from './useFindings';
import type { RuleWorld } from './rules';

/**
 * The world's publish size in bytes: the content a publish of the world as edited would send, measured the
 * way the server measures it.
 * Null until the first result. The first measure starts at mount; later ones wait until the world has been
 * still for the rule pass's interval, and the last figure stays in place while one is pending.
 */
export function usePublishSize(world: RuleWorld, delayMs = RULE_DEBOUNCE_MS): number | null {
  const [bytes, setBytes] = useState<number | null>(null);
  // Only the newest measure may land; a slow one for an older world must not overwrite it.
  const latest = useRef(0);

  useEffect(() => {
    const measure = () => {
      const ticket = ++latest.current;
      measureJsonBytes(worldPublishPayload(world).contentData).then(
        (measured) => { if (ticket === latest.current) setBytes(measured); },
        // A failed measure keeps the last figure; the next edit tries again.
        () => {},
      );
    };
    if (latest.current === 0) {
      measure();
      return;
    }
    const timer = setTimeout(measure, delayMs);
    return () => clearTimeout(timer);
  }, [world, delayMs]);

  useEffect(() => terminateMeasureWorker, []);

  return bytes;
}
