import { useSettings } from '@/contexts/SettingsContext';
import { useDevRoute } from '@/lib/devRouter';
import { DEV_ATTACH_SAMPLE } from '@/lib/devRoutes';

/** Whether Image Attachments is on: the setting, or in DEV an `attach=sample` route override that is not saved. */
export function useImageAttachments(): boolean {
  const { imageAttachments } = useSettings();
  const devRoute = useDevRoute();
  return imageAttachments || (import.meta.env.DEV && devRoute?.attach === DEV_ATTACH_SAMPLE);
}
