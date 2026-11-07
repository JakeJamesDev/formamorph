import { useEffect, useRef, useState } from 'react';
import { useAgeGate } from '@/contexts/AgeGateContext';
import { useSettings } from '@/contexts/SettingsContext';
import { createDailySender, type DailySendState } from '@/lib/activeInstalls';

/** Makes the Daily Send on start, when the age gate is passed, and when the app regains focus or becomes visible. */
export function DailyInstallSender() {
  const { dailySendEnabled } = useSettings();
  const { attested } = useAgeGate();
  const state = useRef<DailySendState>({ enabled: dailySendEnabled, attested });
  state.current = { enabled: dailySendEnabled, attested };
  // A send in flight at unmount still finishes: it writes no React state, only the sent day.
  const [attempt] = useState(() => createDailySender(() => state.current));

  useEffect(() => {
    const onFocus = () => { void attempt(); };
    const onVisibility = () => { if (document.visibilityState === 'visible') void attempt(); };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [attempt]);

  useEffect(() => {
    if (attested) void attempt();
  }, [attempt, attested]);

  return null;
}
