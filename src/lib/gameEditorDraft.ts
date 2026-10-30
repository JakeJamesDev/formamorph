import type { EntityCopy, WorldCopy } from '@/lib/gameCopies';
import type { DiscoveredEntity, Entity } from '@/types';
import type { StepLabelParts } from '@/lib/editorHistoryLabels';

/** The Game Editor's id for the player's entry, which is no entity. */
export const GAME_EDITOR_PLAYER = 'player';

/**
 * What the Game Editor holds until Save: edited copies laid over the live game, by id. The live game keeps
 * running under it, so an entity a background job adds while the editor is open shows at once, and Save
 * writes only what the player changed.
 */
export interface GameEditorDraft {
  /** Invented entities as edited, whole, by entity id. */
  entities: Readonly<Record<string, DiscoveredEntity>>;
  /** Ids taken out at Save. */
  removed: readonly string[];
  /** Stat values as edited, by owner id (`player` for the player's stats) and stat id. Absent ⇒ none. */
  stats?: Readonly<Record<string, Readonly<Record<string, number>>>>;
  /** Where world entities now stand, by entity id. */
  positions?: Readonly<Record<string, string>>;
  /** This game's copies as edited, by entity id. `null` goes back to the source at Save. */
  copies?: Readonly<Record<string, EntityCopy | null>>;
  /** This game's copy of the world's descriptions as edited. `null` reads the world's own again at Save. */
  world?: WorldCopy | null;
  /** What the editor's extensions hold, by key. */
  extras?: Readonly<Record<string, unknown>>;
}

export const EMPTY_GAME_EDITOR_DRAFT: GameEditorDraft = { entities: {}, removed: [] };

/** Whether the draft holds anything to save. */
export function draftHasChanges(draft: GameEditorDraft): boolean {
  return Object.keys(draft.entities).length > 0 || draft.removed.length > 0 || Object.keys(draft.stats ?? {}).length > 0
    || Object.keys(draft.positions ?? {}).length > 0
    || Object.keys(draft.copies ?? {}).length > 0 || draft.world !== undefined
    || Object.keys(draft.extras ?? {}).length > 0;
}

/** One owner's stats as the draft shows them: the edited values over the live ones. */
export function draftedStats<S extends { id: string; value: number }>(live: readonly S[], draft: GameEditorDraft, owner: string): S[] {
  const edits = draft.stats?.[owner];
  return edits ? live.map((s) => (s.id in edits ? { ...s, value: edits[s.id] } : s)) : [...live];
}

/** The draft with one stat value set. A value that matches the live one drops out of the draft. */
export function withDraftStat(draft: GameEditorDraft, liveValue: number | undefined, owner: string, statId: string, value: number): GameEditorDraft {
  const own = { ...(draft.stats?.[owner] ?? {}) };
  if (value === liveValue) delete own[statId];
  else own[statId] = value;
  const stats = { ...(draft.stats ?? {}) };
  if (Object.keys(own).length) stats[owner] = own;
  else delete stats[owner];
  return { ...draft, stats };
}

/** The draft with one world entity moved. A move back to where it stands drops out of the draft. */
export function withDraftPosition(draft: GameEditorDraft, live: string | undefined, id: string, locationId: string): GameEditorDraft {
  const positions = { ...(draft.positions ?? {}) };
  if (locationId === live) delete positions[id];
  else positions[id] = locationId;
  return { ...draft, positions };
}

/** The draft with one entity's copy set, or marked to go back to its source by `null`. */
export function withDraftCopy(draft: GameEditorDraft, id: string, copy: EntityCopy | null): GameEditorDraft {
  return { ...draft, copies: { ...(draft.copies ?? {}), [id]: copy } };
}

/** The draft with one extension's slice set, or dropped by `undefined`. */
export function withDraftExtra(draft: GameEditorDraft, key: string, value: unknown): GameEditorDraft {
  const extras = { ...(draft.extras ?? {}) };
  if (value === undefined) delete extras[key];
  else extras[key] = value;
  return { ...draft, extras };
}

/** The live entities as the draft shows them: edits over the live records, the removed ones left out. */
export function draftedEntities(live: readonly DiscoveredEntity[], draft: GameEditorDraft): DiscoveredEntity[] {
  return live
    .filter((d) => !draft.removed.includes(d.entity.id))
    .map((d) => draft.entities[d.entity.id] ?? d);
}

/** The draft with one entity's record replaced. An edit that matches the live record drops out of the draft. */
export function withDraftEntity(draft: GameEditorDraft, live: DiscoveredEntity | undefined, edited: DiscoveredEntity): GameEditorDraft {
  const entities = { ...draft.entities };
  if (live && JSON.stringify(live) === JSON.stringify(edited)) delete entities[edited.entity.id];
  else entities[edited.entity.id] = edited;
  return { ...draft, entities };
}

/** The draft with one entity marked for removal, its pending edits dropped with it. */
export function withDraftRemoved(draft: GameEditorDraft, id: string): GameEditorDraft {
  const entities = { ...draft.entities };
  delete entities[id];
  const stats = { ...(draft.stats ?? {}) };
  delete stats[id];
  return { ...draft, entities, stats, removed: draft.removed.includes(id) ? draft.removed : [...draft.removed, id] };
}

/**
 * An edited record as Save writes it over `live`. A new name takes over and the old one joins Aliases, so the
 * story's earlier word for the entity still finds it and isn't taken for someone new. A blank description
 * keeps the live one.
 */
export function savedRecord(live: DiscoveredEntity, edited: DiscoveredEntity): DiscoveredEntity {
  const oldName = live.entity.name;
  const name = edited.entity.name.trim() || oldName;
  const kept = (edited.entity.aliases ?? []).map((a) => a.trim()).filter((a) => a && a.toLowerCase() !== name.toLowerCase());
  const aliases = name !== oldName && !kept.some((a) => a.toLowerCase() === oldName.toLowerCase()) ? [...kept, oldName] : kept;
  const note = edited.entity.aiDescription?.trim();
  const entity = { ...edited.entity, name, aliases: aliases.length ? aliases : undefined };
  if (!note) entity.aiDescription = live.entity.aiDescription;
  return { ...edited, entity };
}

/** The live entities after Save: edits written over the records still there, the removed ones gone. An
 *  edit to a record a background job removed meanwhile is dropped. */
export function savedEntities(live: readonly DiscoveredEntity[], draft: GameEditorDraft): DiscoveredEntity[] {
  return live
    .filter((d) => !draft.removed.includes(d.entity.id))
    .map((d) => (draft.entities[d.entity.id] ? savedRecord(d, draft.entities[d.entity.id]) : d));
}

/** One edit in the Game Editor's history: the draft after it, its label, and the field it touched. */
export interface DraftStep {
  draft: GameEditorDraft;
  label: StepLabelParts;
  /** The record and field, so typing in one field reads as one step. */
  key: string;
}

/** The draft's history. `cursor` counts the applied steps; 0 is the editor as it opened. */
export interface DraftHistory {
  steps: readonly DraftStep[];
  cursor: number;
}

export const EMPTY_DRAFT_HISTORY: DraftHistory = { steps: [], cursor: 0 };

/** The draft at the history's cursor. */
export function draftAt(history: DraftHistory): GameEditorDraft {
  return history.cursor === 0 ? EMPTY_GAME_EDITOR_DRAFT : history.steps[history.cursor - 1].draft;
}

/** The history with one more step. It drops the undone steps, and an edit to the field the last step
 *  edited replaces that step, so a run of keystrokes is one step. */
export function withStep(history: DraftHistory, step: DraftStep): DraftHistory {
  const kept = history.steps.slice(0, history.cursor);
  const last = kept[kept.length - 1];
  if (last && last.key === step.key) return { steps: [...kept.slice(0, -1), step], cursor: kept.length };
  return { steps: [...kept, step], cursor: kept.length + 1 };
}

/** The fields an entity record can change, with their labels, in panel order. */
const RECORD_FIELDS: readonly [keyof Entity | 'locationId', string][] = [
  ['name', 'Name'], ['aliases', 'Aliases'], ['pronouns', 'Pronouns'], ['images', 'Pictures'],
  ['locationId', 'Location'], ['playerDescription', 'Player-Facing Description'],
  ['aiDescription', 'AI-Facing Description'], ['aiSummary', 'AI-Facing Summary'],
];

/** The label of the field a copy's patch changes. */
export const patchField = (patch: Partial<Entity>): string =>
  RECORD_FIELDS.find(([key]) => key in patch)?.[1] ?? 'Entity';

/** The label of the first field that differs between two versions of an entity's record. */
export function changedField(before: DiscoveredEntity | undefined, after: DiscoveredEntity): string | undefined {
  const read = (record: DiscoveredEntity | undefined, key: string): unknown => {
    if (!record) return undefined;
    return key === 'locationId' ? record.locationId : (record.entity as unknown as Record<string, unknown>)[key];
  };
  return RECORD_FIELDS.find(([key]) => JSON.stringify(read(before, key)) !== JSON.stringify(read(after, key)))?.[1];
}
