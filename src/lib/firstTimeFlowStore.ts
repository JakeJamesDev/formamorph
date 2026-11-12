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

const PATREON_PAGE_OPENED_KEY = 'FORMAMORPH_patreonPageOpened';

/** This device opened the Patreon page from the support checklist. */
export const isPatreonPageOpened = (): boolean => isSet(PATREON_PAGE_OPENED_KEY);
export const markPatreonPageOpened = (): void => mark(PATREON_PAGE_OPENED_KEY);

const FUNNEL_SENT_PREFIX = 'FORMAMORPH_funnelSent_';

/** This device already reported the funnel step. */
export const isFunnelStepSent = (step: string): boolean => isSet(FUNNEL_SENT_PREFIX + step);
export const markFunnelStepSent = (step: string): void => mark(FUNNEL_SENT_PREFIX + step);

const SETUP_LEAD_SEEN_KEY = 'FORMAMORPH_setupLeadSeen';

/** The AI setup lead showed on this device. */
export const isSetupLeadSeen = (): boolean => isSet(SETUP_LEAD_SEEN_KEY);
export const markSetupLeadSeen = (): void => mark(SETUP_LEAD_SEEN_KEY);

export const isDemoAICardSeen = (): boolean => isSet(DEMO_AI_CARD_SEEN_KEY);
export const markDemoAICardSeen = (): void => mark(DEMO_AI_CARD_SEEN_KEY);

/** Zero with no record. */
function turnCount(key: string): number {
  try {
    const count = Number(localStorage.getItem(key));
    return Number.isInteger(count) && count > 0 ? count : 0;
  } catch {
    return 0;
  }
}

/** Adds one turn and returns the new count. */
function recordTurn(key: string): number {
  const count = turnCount(key) + 1;
  try {
    localStorage.setItem(key, String(count));
  } catch { /* private mode: the count stays where it is */ }
  return count;
}

export const demoAITurnCount = (): number => turnCount(DEMO_AI_TURN_COUNT_KEY);
export const recordDemoAITurn = (): number => recordTurn(DEMO_AI_TURN_COUNT_KEY);

const ENGINE_TURN_COUNT_KEY = 'FORMAMORPH_engineTurnCount';
const ENGINE_CARD_SEEN_KEY = 'FORMAMORPH_engineCardSeen';

/** The built-in engine card's records, apart from the Demo AI card's. */
export const engineTurnCount = (): number => turnCount(ENGINE_TURN_COUNT_KEY);
export const recordEngineTurn = (): number => recordTurn(ENGINE_TURN_COUNT_KEY);
export const isEngineCardSeen = (): boolean => isSet(ENGINE_CARD_SEEN_KEY);
export const markEngineCardSeen = (): void => mark(ENGINE_CARD_SEEN_KEY);
