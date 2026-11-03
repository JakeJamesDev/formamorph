import { useEffect, useRef, useState } from 'react';
import { useSettings } from '@/contexts/SettingsContext';
import { entryLineDue } from '@/lib/firstTimeFlow';

/** Set when the Demo AI entry line or dialog first shows. Never cleared, so the line shows once per install. */
export const DEMO_AI_SEEN_KEY = 'FORMAMORPH_demoAIDialogSeen';

export function isDemoAISeen(): boolean {
  try { return localStorage.getItem(DEMO_AI_SEEN_KEY) !== null; } catch { return false; }
}

export function markDemoAISeen(): void {
  try { localStorage.setItem(DEMO_AI_SEEN_KEY, '1'); } catch { /* private mode: the line shows again next entry */ }
}

/**
 * Whether the entry line shows in this game view. One decision per entry, made once `aiGateDue` is no longer
 * null, so a later switch to the Demo AI shows nothing.
 */
export function useDemoAIEntryLine(aiGateDue: boolean | null): boolean {
  const { narrationIsDemoAI } = useSettings();
  const [earned, setEarned] = useState(false);
  const decidedRef = useRef(false);

  useEffect(() => {
    if (decidedRef.current || aiGateDue === null) return;
    decidedRef.current = true;
    if (entryLineDue({ narrationIsDemoAI, demoAISeen: isDemoAISeen(), aiGateDue })) {
      markDemoAISeen();
      setEarned(true);
    }
  }, [aiGateDue, narrationIsDemoAI]);

  return earned && narrationIsDemoAI;
}
