import { describe, expect, it } from 'vitest';
import type { Entity, Placeholder, Stat, Trait } from '@/types';
import { encodePlaceholderToken } from './placeholders';
import { phValues } from '@/test/placeholderValues';
import { planCodeRename } from './statCodeRename';
import { traitHolders } from './statCodeTraits';

const stat = (id: string, code: string): Stat => ({ id, name: id, type: 'number', value: 0, min: 0, max: 100, code } as Stat);

// Mira can be played and owns Scarred; Ash owns his own Scarred; Rook links the world's Brave.
const brave: Trait = { id: 'brave', name: 'Brave', statChanges: [] };
const miraScarred: Trait = { id: 'm-scarred', name: 'Scarred', statChanges: [] };
const ashScarred: Trait = { id: 'a-scarred', name: 'Scarred', statChanges: [] };
const link = { id: 'l1', originalId: 'brave', kind: 'trait' as const, originalName: 'Brave', groupId: null };
const mira: Entity = { id: 'mira', name: 'Mira', persona: true, traits: [miraScarred] };
const ash: Entity = { id: 'ash', name: 'Ash', traits: [ashScarred] };
const rook: Entity = { id: 'rook', name: 'Rook', traitLinks: [link] };
const world = { traits: [brave], traitGroups: [], entities: [mira, ash, rook] };

/** A trait rename of `traitId` from `oldName` to `newName`, planned over one stat's code. */
const renameTrait = (code: string, traitId: string, oldName: string, newName: string) => planCodeRename({
  root: 'traits', oldName, newName, stats: [stat('a', code)], otherNames: [],
  traitHolders: traitHolders(world, [], traitId),
});

describe('a trait rename in entity trait maps', () => {
  it('rewrites an owned trait under its own entity and under persona, and nowhere else', () => {
    const code = `entities.Mira.traits.Scarred.enabled + persona.traits['Scarred'].enabled + entities.Ash.traits.Scarred.enabled + traits.Scarred.enabled`;
    const plan = renameTrait(code, 'm-scarred', 'Scarred', 'Marked');
    expect(plan?.references).toBe(2);
    expect(plan?.edits[0].boxes.after)
      .toBe(`entities.Mira.traits.Marked.enabled + persona.traits['Marked'].enabled + entities.Ash.traits.Scarred.enabled + traits.Scarred.enabled`);
  });

  it('rewrites a cast entity’s owned trait without touching persona', () => {
    const plan = renameTrait('entities["Ash"].traits.Scarred.enabled + persona.traits.Scarred.enabled', 'a-scarred', 'Scarred', 'Burned');
    expect(plan?.edits[0].boxes.after).toBe('entities["Ash"].traits.Burned.enabled + persona.traits.Scarred.enabled');
  });

  it('follows a world trait into the entities that link it', () => {
    const plan = renameTrait('traits.Brave.enabled + entities.Rook.traits.Brave.enabled + entities.Ash.traits.Brave.enabled', 'brave', 'Brave', 'Bold Heart');
    expect(plan?.edits[0].boxes.after)
      .toBe(`traits['Bold Heart'].enabled + entities.Rook.traits['Bold Heart'].enabled + entities.Ash.traits.Brave.enabled`);
  });

  it('keeps today’s rewrite of traits alone without holders', () => {
    const plan = planCodeRename({
      root: 'traits', oldName: 'Scarred', newName: 'Marked', stats: [stat('a', 'traits.Scarred.enabled + persona.traits.Scarred.enabled')], otherNames: [],
    });
    expect(plan?.edits[0].boxes.after).toBe('traits.Marked.enabled + persona.traits.Scarred.enabled');
  });
});

describe('an entity rename in entities', () => {
  it('rewrites entities keys and the owner segment of its placeholder paths together', () => {
    const hair: Placeholder = { id: 'h1', name: 'Hair', values: phValues(['red']) };
    const plan = planCodeRename({
      root: 'placeholders', oldName: 'Mira', newName: 'Old Mira', otherNames: [],
      subject: { kind: 'entity', id: 'mira' },
      placeholders: { list: [hair], owners: new Map([['h1', { kind: 'entity', id: 'mira', name: 'Mira' }]]) },
      stats: [stat('a', `entities.Mira.traits.Scarred.enabled + entities['Mira'].name + entities.Mira.placeholders.Hair.text + entities.Ash.name`)],
      entities: [mira, ash],
    });
    expect(plan?.references).toBe(3);
    expect(plan?.edits[0].boxes.after)
      .toBe(`entities['Old Mira'].traits.Scarred.enabled + entities['Old Mira'].name + entities['Old Mira'].placeholders.Hair.text + entities.Ash.name`);
  });

  it('rewrites an entity that owns no placeholders', () => {
    const plan = planCodeRename({
      root: 'placeholders', oldName: 'Ash', newName: 'Ashen', otherNames: [], subject: { kind: 'entity', id: 'ash' },
      placeholders: { list: [] }, stats: [stat('a', 'entities.Ash.traits.Scarred.enabled')], entities: [mira, ash],
    });
    expect(plan?.edits[0].boxes.after).toBe('entities.Ashen.traits.Scarred.enabled');
  });

  it('follows a placeholder rename into an entity name that carries it as a chip', () => {
    const beast: Placeholder = { id: 'beast', name: 'Beast', values: phValues(['Wolf']) };
    const chip = encodePlaceholderToken({ id: 'beast', mode: 'world', placementId: 'pl1' });
    const plan = planCodeRename({
      root: 'placeholders', oldName: 'Beast', newName: 'Hound', otherNames: [], subject: { kind: 'placeholder', id: 'beast' },
      placeholders: { list: [beast] }, stats: [stat('a', `entities['Beast Rider'].name`)], entities: [{ ...ash, name: `${chip} Rider` }],
    });
    expect(plan?.edits[0].boxes.after).toBe(`entities['Hound Rider'].name`);
  });
});

describe('a trait rename when two playable entities own the old name', () => {
  const kit: Trait = { id: 'k-scarred', name: 'Scarred', statChanges: [] };
  const kira: Entity = { id: 'kira', name: 'Kira', customPersona: true, traits: [kit] };
  const both = { traits: [brave], traitGroups: [], entities: [mira, kira] };
  const rename = (traitId: string) => planCodeRename({
    root: 'traits', oldName: 'Scarred', newName: 'Marked', otherNames: [],
    stats: [stat('a', 'persona.traits.Scarred.enabled + entities.Mira.traits.Scarred.enabled + entities.Kira.traits.Scarred.enabled')],
    traitHolders: traitHolders(both, [], traitId),
  })?.edits[0].boxes.after;

  it('leaves the persona path and rewrites the owner’s own', () => {
    expect(rename('m-scarred')).toBe('persona.traits.Scarred.enabled + entities.Mira.traits.Marked.enabled + entities.Kira.traits.Scarred.enabled');
  });

  it('rewrites the persona path when no other playable entity owns the name', () => {
    const solo = { ...both, entities: [mira, { ...kira, traits: [{ ...kit, name: 'Hurt' }] }] };
    const plan = planCodeRename({
      root: 'traits', oldName: 'Scarred', newName: 'Marked', otherNames: [], stats: [stat('a', 'persona.traits.Scarred.enabled')],
      traitHolders: traitHolders(solo, [], 'm-scarred'),
    });
    expect(plan?.edits[0].boxes.after).toBe('persona.traits.Marked.enabled');
  });

  it('rewrites the persona path for one trait two playable entities both hold', () => {
    const linker: Entity = { ...kira, traits: [], traitLinks: [link] };
    const mirrorMira: Entity = { ...mira, traits: [], traitLinks: [link] };
    const linked = { traits: [brave], traitGroups: [], entities: [mirrorMira, linker] };
    const plan = planCodeRename({
      root: 'traits', oldName: 'Brave', newName: 'Bold', otherNames: [], stats: [stat('a', 'persona.traits.Brave.enabled')],
      traitHolders: traitHolders(linked, [], 'brave'),
    });
    expect(plan?.edits[0].boxes.after).toBe('persona.traits.Bold.enabled');
  });
});
