/** One navigation-scoped signal that a rename just finished; it holds the new name. */
export const RENAME_NOTICE_KEY = 'FORMAMORPH_usernameRenamed';

/** Keep the new name until the page reached after the rename can show it. */
export const recordRename = (username: string) => {
  try {
    sessionStorage.setItem(RENAME_NOTICE_KEY, username);
  } catch { /* A browser may refuse site data. */ }
};

/** The name the destination still owes the reader a notice for, or null. */
export const readRename = (): string | null => {
  try {
    return sessionStorage.getItem(RENAME_NOTICE_KEY);
  } catch {
    return null;
  }
};

/** Mark the rename notice shown. */
export const clearRename = () => {
  try {
    sessionStorage.removeItem(RENAME_NOTICE_KEY);
  } catch { /* A browser may refuse site data. */ }
};
