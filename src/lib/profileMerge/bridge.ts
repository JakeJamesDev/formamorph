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

export type ModelFolderField = 'downloadDir' | 'externalDir' | 'searchSubfolders';

/** The model-folder fields a profile sets; an absent field is unset. */
export type ModelFolderFields = Partial<Record<ModelFolderField, string | boolean>>;

/** A model file, partial download or resume sidecar in a models folder. */
export interface ModelFile {
  name: string;
  size: number;
}

export type MergeMarker = 'done' | 'declined';

export interface ProfileMergeBridge {
  /** The categories already merged when the AppData profile holds data and was not declined, else null. */
  offer(): Promise<{ merged: string[] } | null>;
  summaries(categories: string[]): Promise<Record<string, SourceSummary[]>>;
  /** One AppData record, or null when it is gone. */
  record(category: string, id: string): Promise<unknown>;
  /** Every localStorage entry of the AppData profile. */
  settings(): Promise<Record<string, string>>;
  /** The model-folder fields each profile's `model-locations.json` sets. */
  modelFolder(): Promise<{ source: ModelFolderFields; target: ModelFolderFields }>;
  /** Copy one model-folder field into the folder's profile when it lacks it. */
  fillModelFolder(field: ModelFolderField): Promise<void>;
  /** The model files each side holds: the AppData models folder (empty when it is the folder's own) and the folder's. */
  models(): Promise<{ source: ModelFile[]; target: ModelFile[] }>;
  /** Move one model file into the folder's models directory; rejects with the reason it stayed. `onBytes` gets bytes moved so far. */
  moveModel(name: string, onBytes?: (bytes: number) => void): Promise<void>;
  /** Relaunch the app so it reads the settings the merge copied. */
  restart(): Promise<void>;
  /** Close the AppData profile and stop offering until the next start. */
  later(): Promise<void>;
  /** Write the marker: `done` with the categories merged, or `declined`. */
  mark(state: MergeMarker, categories?: string[]): Promise<boolean>;
}

/** The bridge, or null outside the desktop build. */
export const profileMergeBridge = (): ProfileMergeBridge | null =>
  (typeof window !== 'undefined' ? window.formamorphDesktop?.profileMerge : undefined) ?? null;
