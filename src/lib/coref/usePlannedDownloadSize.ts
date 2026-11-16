import { useEffect, useState } from 'react';
import type { CorefModelChoice } from './characterMentions';
import { characterMentions } from './characterMentionsApp';

/** The download size `choice` plans, in bytes; null until read, when unknown, or while `active` is false. */
export function usePlannedDownloadSize(choice: CorefModelChoice, active: boolean): number | null {
  const [size, setSize] = useState<number | null>(null);
  useEffect(() => {
    setSize(null);
    if (!active) return;
    // A later choice's answer wins over a slow earlier one.
    let current = true;
    characterMentions().plannedSize(choice).then(
      (bytes) => { if (current) setSize(bytes); },
      () => { if (current) setSize(null); },
    );
    return () => { current = false; };
  }, [choice, active]);
  return size;
}
