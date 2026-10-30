import { describe, it, expect } from 'vitest';
import type { DiscoveredEntity } from '@/types';
import {
  EMPTY_DRAFT_HISTORY, EMPTY_GAME_EDITOR_DRAFT, changedField, draftAt, draftHasChanges, draftedEntities, draftedStats, savedEntities, savedRecord,
  withDraftEntity, withDraftExtra, withDraftRemoved, withDraftStat, withStep,
} from './gameEditorDraft';

const suya: DiscoveredEntity = { entity: { id: 's', name: 'Suya', aiDescription: 'A vixen-spirit.' }, locationId: 'hut', sourceTurnId: 't1' };
const guard: DiscoveredEntity = { entity: { id: 'g', name: 'the guard', aiDescription: 'Bored.' }, sourceTurnId: 't2' };
const LIVE = [suya, guard];

describe('the Game Editor draft', () => {
  it('starts empty and shows the live game', () => {
    expect(draftHasChanges(EMPTY_GAME_EDITOR_DRAFT)).toBe(false);
    expect(draftedEntities(LIVE, EMPTY_GAME_EDITOR_DRAFT)).toEqual(LIVE);
  });

  it('lays an edit over the live record, and drops it again when it matches', () => {
    const moved = { ...suya, locationId: 'road' };
    const draft = withDraftEntity(EMPTY_GAME_EDITOR_DRAFT, suya, moved);
    expect(draftHasChanges(draft)).toBe(true);
    expect(draftedEntities(LIVE, draft)[0].locationId).toBe('road');
    expect(draftHasChanges(withDraftEntity(draft, suya, suya))).toBe(false);
  });

  it('shows an entity a background job added while the editor is open', () => {
    const draft = withDraftEntity(EMPTY_GAME_EDITOR_DRAFT, suya, { ...suya, locationId: 'road' });
    const added: DiscoveredEntity = { entity: { id: 'n', name: 'Nell' }, sourceTurnId: 't3' };
    expect(draftedEntities([...LIVE, added], draft).map((d) => d.entity.name)).toEqual(['Suya', 'the guard', 'Nell']);
  });

  it('takes a removed entity out with its pending edits', () => {
    let draft = withDraftEntity(EMPTY_GAME_EDITOR_DRAFT, guard, { ...guard, locationId: 'gate' });
    draft = withDraftRemoved(draft, 'g');
    expect(draft.entities).toEqual({});
    expect(draftedEntities(LIVE, draft).map((d) => d.entity.id)).toEqual(['s']);
    expect(savedEntities(LIVE, draft).map((d) => d.entity.id)).toEqual(['s']);
  });

  it('counts an extension\'s slice as a change until it is dropped', () => {
    const draft = withDraftExtra(EMPTY_GAME_EDITOR_DRAFT, 'mood', 'calm');
    expect(draftHasChanges(draft)).toBe(true);
    expect(draftHasChanges(withDraftExtra(draft, 'mood', undefined))).toBe(false);
  });

  it('lays stat edits over the live values, and drops one set back to the live value', () => {
    const live = [{ id: 'trust', value: 40 }, { id: 'fear', value: 5 }];
    const draft = withDraftStat(EMPTY_GAME_EDITOR_DRAFT, 40, 's', 'trust', 60);
    expect(draftedStats(live, draft, 's')).toEqual([{ id: 'trust', value: 60 }, { id: 'fear', value: 5 }]);
    expect(draftedStats(live, draft, 'g')).toEqual(live);
    expect(draftHasChanges(withDraftStat(draft, 40, 's', 'trust', 40))).toBe(false);
  });
});

describe('savedRecord', () => {
  it('keeps the old name under Aliases after a rename', () => {
    const saved = savedRecord(guard, { ...guard, entity: { ...guard.entity, name: 'Bram' } });
    expect(saved.entity.name).toBe('Bram');
    expect(saved.entity.aliases).toEqual(['the guard']);
  });

  it('keeps the live name and note when the edit left them blank', () => {
    const saved = savedRecord(suya, { ...suya, entity: { ...suya.entity, name: ' ', aiDescription: '  ' } });
    expect(saved.entity.name).toBe('Suya');
    expect(saved.entity.aiDescription).toBe('A vixen-spirit.');
    expect(saved.entity.aliases).toBeUndefined();
  });

  it('does not list the new name as its own alias', () => {
    const saved = savedRecord(guard, { ...guard, entity: { ...guard.entity, name: 'Bram', aliases: ['bram', 'the guard'] } });
    expect(saved.entity.aliases).toEqual(['the guard']);
  });
});

describe('savedEntities', () => {
  it('drops an edit to a record that left the game while the editor was open', () => {
    const draft = withDraftEntity(EMPTY_GAME_EDITOR_DRAFT, guard, { ...guard, locationId: 'gate' });
    expect(savedEntities([suya], draft)).toEqual([suya]);
  });
});

describe('the draft history', () => {
  const step = (locationId: string, key = 's:Location') => ({
    draft: withDraftEntity(EMPTY_GAME_EDITOR_DRAFT, suya, { ...suya, locationId }),
    label: { verb: 'Edit', type: 'Entity', name: 'Suya', field: 'Location' },
    key,
  });

  it('starts at the editor as it opened', () => {
    expect(draftAt(EMPTY_DRAFT_HISTORY)).toBe(EMPTY_GAME_EDITOR_DRAFT);
  });

  it('folds a run of edits to one field into one step', () => {
    const h = withStep(withStep(EMPTY_DRAFT_HISTORY, step('road')), step('gate'));
    expect(h.steps).toHaveLength(1);
    expect(draftAt(h).entities.s.locationId).toBe('gate');
  });

  it('drops the undone steps when a new edit comes', () => {
    const h = withStep(withStep(EMPTY_DRAFT_HISTORY, step('road', 'a')), step('gate', 'b'));
    const undone = { ...h, cursor: 1 };
    expect(draftAt(undone).entities.s.locationId).toBe('road');
    const next = withStep(undone, step('well', 'c'));
    expect(next.steps.map((s) => s.key)).toEqual(['a', 'c']);
    expect(next.cursor).toBe(2);
  });

  it('names the field an edit changed', () => {
    expect(changedField(suya, { ...suya, locationId: 'road' })).toBe('Location');
    expect(changedField(suya, { ...suya, entity: { ...suya.entity, pronouns: 'she/her' } })).toBe('Pronouns');
  });
});
