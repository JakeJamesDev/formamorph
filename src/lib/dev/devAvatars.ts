/** DEV only: `avatars=none` and `avatars=lockedMissing` put the dev build in the state of a build that bundles no Avatar. */
import { getDevRoute } from '@/lib/devRouter';
import { clearUserDefaultAvatar, setDevAvatarSet } from '@/lib/defaultAvatar';
import ModelStorageService from '@/services/ModelStorageService';
import type { VrmPick } from '@/types';

/** The pick `avatars=lockedMissing` hands Avatar Customization: a library Avatar that is not there. */
export const DEV_MISSING_PICK: VrmPick = { kind: 'library', id: 'dev-missing-avatar' };

/** Runs before the first render so the library the app lists is the one the route describes: empty. */
export async function installDevAvatars(): Promise<void> {
  const mode = getDevRoute()?.avatars;
  if (mode !== 'none' && mode !== 'lockedMissing') return;
  setDevAvatarSet('none');
  clearUserDefaultAvatar();
  for (const { id } of await ModelStorageService.getModelMetadata()) await ModelStorageService.deleteModel(id);
}
