/** A dialog that can open on entry to the game view. */
export type EntryDialog = 'aiGate' | 'readme';

export interface EntryDialogState {
  /** The AI is unreachable and the setup gate hasn't shown; null while reachability is unknown. */
  aiGateDue: boolean | null;
  /** The world readme has yet to show in this entry. */
  readmePending: boolean;
}

/** The one dialog to open next on entry: the unreachable gate, then the readme. */
export function nextEntryDialog({ aiGateDue, readmePending }: EntryDialogState): EntryDialog | null {
  if (aiGateDue === true) return 'aiGate';
  return readmePending ? 'readme' : null;
}
