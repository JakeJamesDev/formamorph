import { useSettings } from '@/contexts/SettingsContext';

/** Set when the Demo AI dialog first shows. Never cleared, so the dialog shows once per install. */
export const DEMO_AI_SEEN_KEY = 'FORMAMORPH_demoAIDialogSeen';

export function isDemoAISeen(): boolean {
  try { return localStorage.getItem(DEMO_AI_SEEN_KEY) !== null; } catch { return false; }
}

export function markDemoAISeen(): void {
  try { localStorage.setItem(DEMO_AI_SEEN_KEY, '1'); } catch { /* private mode: the dialog shows again next entry */ }
}

/** Whether the Demo AI dialog is due: narration resolves to the Demo AI and the dialog has never shown. */
export function useDemoAIDialogPending(): boolean {
  const { narrationIsDemoAI } = useSettings();
  return narrationIsDemoAI && !isDemoAISeen();
}
