import { API_BASE_URL } from '@/lib/apiBase';
import { INSTALL_HEADER_NAME, keptReaderInstallId } from '@/lib/anonymousLikes';
import { HOSTED_AI_AVAILABLE } from '@/lib/hostedAi/hostedUrls';

/** The one UTC day this install last counted on. Only the latest day is kept. */
export const DAILY_SEND_DAY_KEY = 'FORMAMORPH_dailySendDay';

/** Whether this build has a community server to count it: Formamorph AI's test. A Steam build has none. */
export function dailySendAvailable(): boolean {
  return HOSTED_AI_AVAILABLE && API_BASE_URL !== '';
}

/** What the sender reads at each attempt, so a change takes effect at the next one. */
export interface DailySendState {
  /** The Settings switch. */
  enabled: boolean;
  /** Whether the player has passed the age gate. */
  attested: boolean;
}

/** The UTC day of a moment, as `YYYY-MM-DD`. */
export const utcDay = (now: Date): string => now.toISOString().slice(0, 10);

function sentDay(): string | null {
  try {
    return localStorage.getItem(DAILY_SEND_DAY_KEY);
  } catch {
    return null;
  }
}

function markSent(day: string): void {
  try {
    localStorage.setItem(DAILY_SEND_DAY_KEY, day);
  } catch { /* The next attempt today sends again; the server counts it once. */ }
}

/**
 * Make the Daily Send for one sender: one attempt in flight at a time, at most one success per UTC day.
 *
 * A failed send is dropped. The day is marked only after a 2xx, so the next attempt that day tries again.
 *
 * @param read - The current switch and age-gate state, read at each attempt
 * @param now - The device clock
 * @returns The attempt, which resolves once its send settles or it decides not to send
 */
export function createDailySender(
  read: () => DailySendState,
  now: () => Date = () => new Date(),
): () => Promise<void> {
  let inFlight: Promise<void> | null = null;

  return () => {
    if (inFlight) return inFlight;
    if (!dailySendAvailable()) return Promise.resolve();
    const { enabled, attested } = read();
    if (!enabled || !attested) return Promise.resolve();
    const day = utcDay(now());
    if (sentDay() === day) return Promise.resolve();
    // Last: this makes the id on first need, so nothing is made before every other gate passes.
    const install = keptReaderInstallId();
    if (!install) return Promise.resolve();

    inFlight = (async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/active-installs`, {
          method: 'POST',
          credentials: 'omit',
          headers: { [INSTALL_HEADER_NAME]: install },
        });
        if (response.ok) markSent(day);
      } catch { /* Dropped on purpose. */ } finally {
        inFlight = null;
      }
    })();
    return inFlight;
  };
}
