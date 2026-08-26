const STORAGE_KEY = 'FORMAMORPH_reasoningExpanded';

/** Whether the reasoning block should auto-expand while the model thinks. Defaults to expanded. */
export function reasoningExpandPref(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) !== 'false';
  } catch {
    return true;
  }
}

/** Record the reader's manual toggle as the standing choice for future turns' blocks. */
export function setReasoningExpandPref(expanded: boolean): void {
  try {
    localStorage.setItem(STORAGE_KEY, String(expanded));
  } catch {
    // A blocked localStorage costs only persistence; this session's block already honors the toggle.
  }
}
