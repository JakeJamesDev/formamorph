/** The desktop bridge to the AppData profile (electron/profileMergeSource.cjs). */

/** One AppData record's summary: its id, size, and the fields that stamp and label it. */
export interface SourceSummary {
  id: string;
  size: number;
  name?: string;
  editedAt?: string;
  downloadedAt?: string;
  createdAt?: string;
  /** A save's `currentState.timestamp`. */
  timestamp?: string;
  worldId?: string;
  worldName?: string;
}

export type MergeMarker = 'done' | 'declined';

export interface ProfileMergeBridge {
  /** The categories already merged when the AppData profile holds data and was not declined, else null. */
  offer(): Promise<{ merged: string[] } | null>;
  summaries(categories: string[]): Promise<Record<string, SourceSummary[]>>;
  /** One AppData record, or null when it is gone. */
  record(category: string, id: string): Promise<unknown>;
  /** Close the AppData profile and stop offering until the next start. */
  later(): Promise<void>;
  /** Write the marker: `done` with the categories merged, or `declined`. */
  mark(state: MergeMarker, categories?: string[]): Promise<boolean>;
}

/** The bridge, or null outside the desktop build. */
export const profileMergeBridge = (): ProfileMergeBridge | null =>
  (typeof window !== 'undefined' ? window.formamorphDesktop?.profileMerge : undefined) ?? null;
