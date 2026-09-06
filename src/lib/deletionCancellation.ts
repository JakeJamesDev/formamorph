/** One navigation-scoped signal that a site sign-in canceled pending account deletion. */
export const DELETION_CANCELLATION_KEY = 'FORMAMORPH_deletionCancellation';

/** Preserve the cancellation until the page reached after sign-in can show it. */
export const recordDeletionCancellation = () => {
  try {
    sessionStorage.setItem(DELETION_CANCELLATION_KEY, 'true');
  } catch { /* A browser may refuse site data. */ }
};

/** Whether the destination still owes the player the cancellation notice. */
export const hasDeletionCancellation = (): boolean => {
  try {
    return sessionStorage.getItem(DELETION_CANCELLATION_KEY) === 'true';
  } catch {
    return false;
  }
};

/** Mark the cancellation notice shown. */
export const clearDeletionCancellation = () => {
  try {
    sessionStorage.removeItem(DELETION_CANCELLATION_KEY);
  } catch { /* A browser may refuse site data. */ }
};
