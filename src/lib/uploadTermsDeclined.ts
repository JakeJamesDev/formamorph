/**
 * Whether this browser refused the upload gate, remembered locally as well as on the server.
 *
 * Two surfaces read it: the publish flow shows a short blocked notice instead of the whole wall of terms
 * once refused, and the profile's Terms tab writes it so the two agree. Kept here rather than inside
 * either one — an accept in the profile that left this set would still be met with "you declined these
 * terms" at the next publish.
 */
const DECLINED_KEY = 'FORMAMORPH_uploadTermsDeclined';

/** @returns True when this browser has a refusal on record. */
export function isUploadTermsDeclined(): boolean {
  try {
    return localStorage.getItem(DECLINED_KEY) === '1';
  } catch {
    return false; // private mode — just don't remember it
  }
}

/**
 * Record or clear the refusal.
 * @param declined - True to remember a refusal, false to forget one
 */
export function setUploadTermsDeclined(declined: boolean): void {
  try {
    if (declined) localStorage.setItem(DECLINED_KEY, '1');
    else localStorage.removeItem(DECLINED_KEY);
  } catch { /* private mode — the dialog simply reappears next time */ }
}
