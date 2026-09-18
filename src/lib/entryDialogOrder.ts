/** A dialog that can open on entry to the game view. */
export type EntryDialog = 'aiGate' | 'demoAI' | 'readme';

export interface EntryDialogState {
  /** The AI is unreachable and the setup gate hasn't shown; null while reachability is unknown. */
  aiGateDue: boolean | null;
  /** The Demo AI dialog has yet to show in this entry. */
  demoAIPending: boolean;
  /** The world readme has yet to show in this entry. */
  readmePending: boolean;
}

/**
 * The one dialog to open next on entry: the unreachable gate, then the Demo AI dialog, then the readme.
 * The Demo AI dialog waits for reachability, and so does a readme queued behind it.
 */
export function nextEntryDialog({ aiGateDue, demoAIPending, readmePending }: EntryDialogState): EntryDialog | null {
  if (aiGateDue === true) return 'aiGate';
  if (demoAIPending) return aiGateDue === null ? null : 'demoAI';
  return readmePending ? 'readme' : null;
}
