/** Per-device First-Time Flow records. Each stays out of the world and save exports. */
const FIRST_RUN_STEP_SEEN_KEY = 'FORMAMORPH_firstRunStepSeen';
const DEMO_AI_TURN_COUNT_KEY = 'FORMAMORPH_demoAITurnCount';
const DEMO_AI_CARD_SEEN_KEY = 'FORMAMORPH_demoAICardSeen';

function isSet(key: string): boolean {
  try { return localStorage.getItem(key) !== null; } catch { return false; }
}

function mark(key: string): void {
  try { localStorage.setItem(key, '1'); } catch { /* private mode: the record stays unset */ }
}

export const isFirstRunStepSeen = (): boolean => isSet(FIRST_RUN_STEP_SEEN_KEY);
export const markFirstRunStepSeen = (): void => mark(FIRST_RUN_STEP_SEEN_KEY);

export const isDemoAICardSeen = (): boolean => isSet(DEMO_AI_CARD_SEEN_KEY);
export const markDemoAICardSeen = (): void => mark(DEMO_AI_CARD_SEEN_KEY);

/** Zero with no record, whatever the Demo AI seen key says. */
export function demoAITurnCount(): number {
  try {
    const count = Number(localStorage.getItem(DEMO_AI_TURN_COUNT_KEY));
    return Number.isInteger(count) && count > 0 ? count : 0;
  } catch {
    return 0;
  }
}

export function recordDemoAITurn(): void {
  try {
    localStorage.setItem(DEMO_AI_TURN_COUNT_KEY, String(demoAITurnCount() + 1));
  } catch { /* private mode: the count stays where it is */ }
}
