/** DEV only: serves the Server tab's settings from memory while the route has `fixture=serverSettings`. */
import { getDevRoute } from '@/lib/devRouter';
import ServerSettingsService, { type ServerNumberKey, type ServerSettingKey } from '@/services/ServerSettingsService';

export const DEV_SERVER_SETTINGS_FIXTURE = 'serverSettings';

const flags: Partial<Record<ServerSettingKey, boolean>> = { anonymous_likes: true, listing_review: false, network_kind: true };
const numbers: Record<ServerNumberKey, number> = {
  likes_marker_min_flagged: 5, likes_marker_share: 0.5, burst_size: 8, burst_window_minutes: 15,
};

const STUBBED = ['fetchSetting', 'saveSetting', 'fetchNumber', 'saveNumber'] as const;
let stubbed = false;

/** Shadows the service methods with the stub while the route asks for it; deleting the shadows restores them. */
function sync(): void {
  const wanted = getDevRoute()?.fixture === DEV_SERVER_SETTINGS_FIXTURE;
  if (wanted === stubbed) return;
  if (wanted) {
    Object.assign(ServerSettingsService, {
      fetchSetting: async (key: ServerSettingKey) => flags[key] ?? false,
      saveSetting: async (key: ServerSettingKey, value: boolean) => { flags[key] = value; return value; },
      fetchNumber: async (key: ServerNumberKey) => numbers[key],
      // A Burst Size under 2 is refused, so the refusal state can be checked.
      saveNumber: async (key: ServerNumberKey, value: number) => {
        if (key === 'burst_size' && value < 2) throw new Error('The Burst size must be a whole number of at least 2');
        numbers[key] = value;
        return value;
      },
    });
  } else {
    for (const key of STUBBED) delete (ServerSettingsService as Partial<typeof ServerSettingsService>)[key];
  }
  stubbed = wanted;
}

/** Watches the dev route for `fixture=serverSettings`. A no-op outside DEV. */
export function installDevServerSettingsStub(): void {
  if (!import.meta.env.DEV) return;
  sync();
  window.addEventListener('hashchange', sync);
}
