import { useEffect, useRef, useState } from 'react';
import { measureJsonBytes, terminateMeasureWorker } from '@/lib/jsonMeasureClient';
import { worldPublishPayload } from '@/lib/publishPayload';
import { APP_VERSION } from '@/lib/version';
import { RULE_DEBOUNCE_MS } from './useFindings';
import type { RuleWorld } from './rules';

/**
 * The world's publish size in bytes: the content a publish of the world as edited would send, measured the
 * way the server measures it.
 * Null until the first result. The first measure starts at mount; later ones wait until the world has been
 * still for the rule pass's interval, and the last figure stays in place while one is pending.
 */
export function usePublishSize(world: RuleWorld): number | null {
  const [bytes, setBytes] = useState<number | null>(null);
  // Only the newest measure may land; a slow one for an older world must not overwrite it.
  const newest = useRef(0);
  const started = useRef(false);

  useEffect(() => {
    const measure = () => {
      const ticket = ++newest.current;
      // Publish sends the stored copy, which carries the version stamp `saveWorld` puts on it.
      measureJsonBytes(worldPublishPayload({ version: APP_VERSION, ...world }).contentData).then(
        (measured) => { if (ticket === newest.current) setBytes(measured); },
        // A failed measure keeps the last figure; the next edit tries again.
        () => {},
      );
    };
    if (!started.current) {
      started.current = true;
      measure();
      return;
    }
    const timer = setTimeout(measure, RULE_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [world]);

  useEffect(() => terminateMeasureWorker, []);

  return bytes;
}
