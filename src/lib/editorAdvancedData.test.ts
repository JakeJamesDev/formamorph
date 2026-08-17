import { describe, it, expect } from 'vitest';
import { worldUsesAdvancedFeatures } from './editorAdvancedData';
import type { AdvancedDataInput } from './editorAdvancedData';
import type { Dictionary, Entity, GameLocation, Stat, Trait, WorldOverview } from '@/types';

const overview = (over: Partial<WorldOverview> = {}): WorldOverview => ({
  name: 'Sedge Landing', description: '', author: '', thumbnail: null, bgm: null, systemPrompt: '',
  use3DModel: false, tags: [], ...over,
});

/** A world holding nothing Simple mode hides — every case below is this plus one hidden thing. */
const plain = (over: Partial<AdvancedDataInput> = {}): AdvancedDataInput => ({
  worldOverview: overview(),
  stats: [{ id: 's1', name: 'Vigor', type: 'number', description: '', min: 0, max: 100, regen: 0, descriptors: [] } as Stat],
  entities: [{ id: 'e1', name: 'Maren' } as Entity],
  locations: [{ id: 'l1', name: 'Harbor Steps' } as GameLocation],
  traits: [{ id: 't1', name: 'Hardy', statChanges: [] } as Trait],
  dictionaries: [{ id: 'b1', name: 'Book', entries: [{ id: 'd1', name: 'Sedge', key: ['sedge'], value: 'A reed.' }] } as Dictionary],
  placeholders: [],
  ...over,
});

describe('worldUsesAdvancedFeatures', () => {
  it('says no about a world whose every field Simple mode can show', () => {
    expect(worldUsesAdvancedFeatures(plain())).toBe(false);
  });

  it('says yes about a placeholder, which has no Simple tab at all', () => {
    expect(worldUsesAdvancedFeatures(plain({ placeholders: [{ id: 'p1', name: 'Hue', values: ['red'] }] }))).toBe(true);
  });

  it('says yes about a muted book, and about an entry using an Advanced-only option', () => {
    expect(worldUsesAdvancedFeatures(plain({
      dictionaries: [{ id: 'b1', name: 'Book', enabled: false, entries: [] } as Dictionary],
    }))).toBe(true);
    expect(worldUsesAdvancedFeatures(plain({
      dictionaries: [{
        id: 'b1', name: 'Book', entries: [{ id: 'd1', name: 'Sedge', key: ['sedge'], value: 'A reed.', useRegex: true }],
      } as Dictionary],
    }))).toBe(true);
  });

  it('says no about a book carrying no entry list at all — an unmuted book with nothing in it hides nothing', () => {
    // The muted check short-circuits, so only an *unmuted* entry-less book actually reads the list.
    expect(worldUsesAdvancedFeatures(plain({ dictionaries: [{ id: 'b1', name: 'Book' } as Dictionary] }))).toBe(false);
  });

  it('says yes about a stat carrying descriptors, code, or a direction lock', () => {
    const base = plain().stats[0];
    for (const hidden of [
      { descriptors: [{ id: 'd', threshold: 50, description: 'Winded' }] },
      { code: 'return 1;' },
      { noDecrease: true },
    ]) {
      expect(worldUsesAdvancedFeatures(plain({ stats: [{ ...base, ...hidden } as Stat] }))).toBe(true);
    }
  });

  it('says yes about an entity alias and about a trait stat toggle', () => {
    expect(worldUsesAdvancedFeatures(plain({ entities: [{ id: 'e1', name: 'Maren', aliases: ['Wren'] } as Entity] }))).toBe(true);
    expect(worldUsesAdvancedFeatures(plain({
      traits: [{ id: 't1', name: 'Hardy', statChanges: [], statToggles: [{ statId: 's1', enabled: true }] } as Trait],
    }))).toBe(true);
  });

  it('says no about a world whose collections are simply absent, rather than throwing on it', () => {
    // Hand-edited or third-party world JSON can omit an array the types call required, and this runs in the
    // editor's render — so a world with nothing to look through hides nothing rather than blanking the editor.
    expect(worldUsesAdvancedFeatures({} as AdvancedDataInput)).toBe(false);
  });

  it('still finds the hidden field when only the collections around it are absent', () => {
    // The guard has to leave the scan running, not bail on the first missing slice.
    const sparse = { traits: [{ id: 't1', name: 'Hardy', statChanges: [], playerToggle: true, placeholderPins: [{ placeholderId: 'p1', value: 'red' }] } as Trait] };
    expect(worldUsesAdvancedFeatures(sparse as AdvancedDataInput)).toBe(true);
  });
});
