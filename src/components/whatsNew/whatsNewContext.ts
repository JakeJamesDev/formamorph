import { createContext, useContext } from 'react';
import type { UpdateChecker } from '@/hooks/useUpdateChecker';
import { updateBridge } from '@/lib/updates/updateBridge';

export interface WhatsNewContextValue {
  openWhatsNew: () => void;
  /** The update flow on a build with an update bridge, else null. */
  checker: UpdateChecker | null;
}

export const WhatsNewContext = createContext<WhatsNewContextValue | null>(null);

export function useWhatsNew(): WhatsNewContextValue {
  const value = useContext(WhatsNewContext);
  if (!value) throw new Error('useWhatsNew needs a WhatsNewHost');
  return value;
}

/** Android hands the file to the system installer; the desktop shell swaps the build and relaunches. */
export function applyLabel(): string {
  return updateBridge()?.kind === 'android' ? 'Install' : 'Update & Restart';
}
