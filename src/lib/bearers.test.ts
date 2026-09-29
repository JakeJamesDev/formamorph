import { describe, it, expect } from 'vitest';
import {
  PLAYER_BEARER, bearsTraits, editorGateInput, holdsOriginal, inCast, makeLink, originalOf, playsAs, resolveBearers, type BearerWorld,
} from './bearers';
import { remintOwnedTraits } from './ownedTraits';
import { gateOf, gateStates } from './traitGates';
import { isShown } from './traitEffects';
import type { Entity, PersonaRef, Trait, TraitGroup, TraitLink } from '@/types';

const trait = (id: string, extra: Partial<Trait> = {}): Trait => ({ id, name: id, statChanges: [], ...extra });
const group = (id: string, parentId: string | null, order: number, extra: Partial<TraitGroup> = {}): TraitGroup =>
  ({ id, name: id, parentId, order, ...extra });
const link = (id: string, originalId: string, kind: TraitLink['kind'], extra: Partial<TraitLink> = {}): TraitLink =>
  ({ id, originalId, kind, originalName: originalId, groupId: null, order: 0, ...extra });

const NONE: PersonaRef = { source: 'none' };
const AS_ALBUS: PersonaRef = { source: 'world', entityId: 'albus' };
const AS_LIBRARY: PersonaRef = { source: 'library', entityId: 'lib' };

// Root: Brave, the Oaths group (holding Mira's node), Blueprints. Blueprints: Classes (Paladin, Wizard), Smite.
const albus: Entity = {
  id: 'albus', name: 'Albus', persona: true,
  traits: [trait('oath', { name: 'Oath', groupId: null, order: 0 })],
  traitLinks: [link('l-classes', 'classes', 'group', { originalName: 'Classes', order: 1 })],
};
const mira: Entity = {
  id: 'mira', name: 'Mira',
  traits: [trait('vow', { name: 'Vow', groupId: null, order: 0 })],
  traitGroups: [group('g-mira', null, 1, { name: 'Bond' })],
  traitLinks: [link('l-paladin', 'paladin', 'trait', { originalName: 'Paladin', groupId: 'g-mira', order: 0 })],
  traitPlacement: { groupId: 'oaths', order: 0 },
};
const custom: Entity = {
  id: 'custom', name: 'Custom Character', persona: true, personaOnly: true,
  traitLinks: [link('l-smite', 'smite', 'trait')],
};
/** The Custom Persona entity: the player's tree beside the root under None and under a library persona. */
const newcomer: Entity = {
  id: 'cp', name: 'Newcomer', customPersona: true,
  traitLinks: [link('cp-classes', 'classes', 'group')],
};

const world = (extra: Partial<BearerWorld> = {}): BearerWorld => ({
  traits: [
    trait('brave', { name: 'Brave', groupId: null, order: 0 }),
    trait('paladin', { name: 'Paladin', groupId: 'classes', order: 0, isDefault: true }),
    trait('wizard', { name: 'Wizard', groupId: 'classes', order: 1 }),
    trait('smite', { name: 'Smite', groupId: 'blueprints', order: 1, requires: [{ kind: 'trait', id: 'paladin' }] }),
  ],
  traitGroups: [
    group('oaths', null, 1, { name: 'Oaths' }),
    group('blueprints', null, 2, { name: 'Blueprints', system: 'blueprints' }),
    group('classes', 'blueprints', 0, { name: 'Classes', maxPicks: 1 }),
  ],
  entities: [albus, mira, custom],
  ...extra,
});

const bearer = (w: BearerWorld, id: string, persona: PersonaRef = NONE, library: Entity[] = []) => {
  const found = resolveBearers(w, persona, library).bearers.find((b) => b.id === id);
  if (!found) throw new Error(`no bearer ${id}`);
  return found;
};
const ids = (items: readonly { id: string }[]) => items.map((i) => i.id);

describe('resolveBearers: links', () => {
  it('expands a link to a trait at the link’s place and reads the original live', () => {
    const b = bearer(world(), 'mira');
    expect(ids(b.traits)).toEqual(['vow', 'paladin']);
    expect(b.traits[1]).toMatchObject({ name: 'Paladin', groupId: 'g-mira', order: 0 });
    expect(b.linkOf.get('paladin')?.id).toBe('l-paladin');
    expect(b.linkOf.has('vow')).toBe(false);
  });

  it('expands a link to a group with its live subtree, keeping exclusivity and a later-added child', () => {
    const before = bearer(world(), 'albus');
    expect(before.groups).toEqual([expect.objectContaining({ id: 'classes', parentId: null, order: 1, maxPicks: 1 })]);
    expect(ids(before.traits)).toEqual(['oath', 'paladin', 'wizard']);
    expect(before.linkOf.get('classes')?.id).toBe('l-classes');
    expect(before.linkOf.get('wizard')?.id).toBe('l-classes');

    const w = world();
    const grown = world({ traits: [...w.traits, trait('cleric', { name: 'Cleric', groupId: 'classes', order: 2 })] });
    expect(ids(bearer(grown, 'albus').traits)).toEqual(['oath', 'paladin', 'wizard', 'cleric']);
  });

  it('reads default-on from the link when it overrides it, else from the original', () => {
    const plain = bearer(world(), 'albus');
    expect(plain.traits.find((t) => t.id === 'paladin')?.isDefault).toBe(true);
    expect(plain.traits.find((t) => t.id === 'wizard')?.isDefault).toBeFalsy();

    const overrides = { paladin: { isDefault: { value: false, blueprint: true } }, wizard: { isDefault: { value: true, blueprint: false } } };
    const overridden: Entity = { ...albus, traitLinks: [{ ...albus.traitLinks![0], overrides }] };
    const b = bearer(world({ entities: [overridden] }), 'albus');
    expect(b.traits.find((t) => t.id === 'paladin')?.isDefault).toBe(false);
    expect(b.traits.find((t) => t.id === 'wizard')?.isDefault).toBe(true);
  });

  it('resolves the mode per bearer, and an unset override reads the original live', () => {
    const wizardMode = { wizard: { mode: { value: 'hidden' as const, blueprint: 'optional' as const } } };
    const albusHidden: Entity = { ...albus, traitLinks: [{ ...albus.traitLinks![0], overrides: wizardMode }] };
    const w = world({ entities: [albusHidden, newcomer] });
    const modeOf = (bearerId: string, traitId: string) => bearer(w, bearerId).traits.find((t) => t.id === traitId)?.mode;
    expect(modeOf('albus', 'wizard')).toBe('hidden');
    expect(modeOf('cp', 'wizard')).toBeUndefined();
    expect(modeOf('albus', 'paladin')).toBeUndefined();

    // The original's mode change reaches every link that doesn't override it.
    const live = world({
      entities: [albusHidden, newcomer],
      traits: world().traits.map((t) => (t.id === 'paladin' ? { ...t, mode: 'alwaysOn' as const } : t)),
    });
    expect(bearer(live, 'albus').traits.find((t) => t.id === 'paladin')?.mode).toBe('alwaysOn');
    expect(bearer(live, 'cp').traits.find((t) => t.id === 'paladin')?.mode).toBe('alwaysOn');
  });

  it('reads an Optional override over an Always On original as Optional', () => {
    const overrides = { paladin: { mode: { value: 'optional' as const, blueprint: 'alwaysOn' as const } } };
    const w = world({
      entities: [{ ...albus, traitLinks: [{ ...albus.traitLinks![0], overrides }] }, newcomer],
      traits: world().traits.map((t) => (t.id === 'paladin' ? { ...t, mode: 'alwaysOn' as const } : t)),
    });
    expect(bearer(w, 'albus').traits.find((t) => t.id === 'paladin')).not.toHaveProperty('mode');
    expect(bearer(w, 'cp').traits.find((t) => t.id === 'paladin')?.mode).toBe('alwaysOn');
  });

  it("leaves a Hidden override out of that bearer's player-facing list only", () => {
    const wizardMode = { wizard: { mode: { value: 'hidden' as const, blueprint: 'optional' as const } } };
    const albusHidden: Entity = { ...albus, traitLinks: [{ ...albus.traitLinks![0], overrides: wizardMode }] };
    const w = world({ entities: [albusHidden, newcomer] });
    const shown = (id: string) => bearer(w, id).traits.filter((t) => isShown(t, [])).map((t) => t.id);
    expect(shown('albus')).toEqual(['oath', 'paladin']);
    expect(shown('cp')).toEqual(['paladin', 'wizard']);
  });

  it("carries the link's other overrides on the effective traits: requirements, toggle and stat changes", () => {
    const overrides = {
      paladin: {
        requires: { value: [{ kind: 'trait' as const, id: 'brave' }], blueprint: [] },
        playerToggle: { value: true, blueprint: false },
        statChanges: { value: [{ statId: 'zeal', value: 2, type: 'min' as const }], blueprint: [] },
      },
    };
    const b = bearer(world({ entities: [{ ...albus, traitLinks: [{ ...albus.traitLinks![0], overrides }] }] }), 'albus');
    expect(b.traits.find((t) => t.id === 'paladin')).toMatchObject({
      name: 'Paladin', groupId: 'classes', isDefault: true,
      requires: [{ kind: 'trait', id: 'brave' }], playerToggle: true, statChanges: [{ statId: 'zeal', value: 2, type: 'min' }],
    });
    const wizard = b.traits.find((t) => t.id === 'wizard')!;
    expect(wizard.playerToggle).toBeFalsy();
    expect(wizard.statChanges).toEqual([]);
    expect(b.linkOf.get('paladin')?.id).toBe('l-classes');
  });

  it('skips an entity node placed inside a linked group', () => {
    const linksOaths: Entity = { ...albus, traitLinks: [link('l-oaths', 'oaths', 'group', { order: 1 })] };
    const b = bearer(world({ entities: [linksOaths, mira] }), 'albus');
    expect(ids(b.groups)).toEqual(['oaths']);
    expect(ids(b.traits)).toEqual(['oath']);
  });

  it('resolves a link whose original is missing to nothing', () => {
    const dangling: Entity = { ...albus, traitLinks: [link('l-gone', 'gone', 'trait')] };
    const b = bearer(world({ entities: [dangling] }), 'albus');
    expect(ids(b.traits)).toEqual(['oath']);
    expect(b.linkOf.size).toBe(0);
  });

  it('yields an original once per bearer, first in tree order, when a linked group already brings it', () => {
    const both = (paladinOrder: number, classesOrder: number): Entity => ({
      ...albus, traits: [],
      traitLinks: [
        link('l-classes', 'classes', 'group', { order: classesOrder }),
        link('l-paladin', 'paladin', 'trait', { order: paladinOrder }),
      ],
    });
    const first = bearer(world({ entities: [both(0, 1)] }), 'albus');
    expect(ids(first.traits)).toEqual(['paladin', 'wizard']);
    expect(first.traits[0]).toMatchObject({ groupId: null, order: 0 });
    expect(first.linkOf.get('paladin')?.id).toBe('l-paladin');
    expect(first.linkOf.get('wizard')?.id).toBe('l-classes');

    const later = bearer(world({ entities: [both(1, 0)] }), 'albus');
    expect(ids(later.traits)).toEqual(['paladin', 'wizard']);
    expect(later.traits[0]).toMatchObject({ groupId: 'classes' });
    expect(later.linkOf.get('paladin')?.id).toBe('l-classes');
  });

  it('yields a nested linked group once, inside the outer one when that comes first', () => {
    const w = world({
      traitGroups: [...world().traitGroups, group('holy', 'classes', 2, { name: 'Holy' })],
      traits: [...world().traits, trait('bless', { name: 'Bless', groupId: 'holy', order: 0 })],
    });
    const nested: Entity = {
      ...albus, traits: [],
      traitLinks: [link('l-classes', 'classes', 'group', { order: 0 }), link('l-holy', 'holy', 'group', { order: 1 })],
    };
    const b = bearer({ ...w, entities: [nested] }, 'albus');
    expect(ids(b.groups)).toEqual(['classes', 'holy']);
    expect(b.groups[1]).toMatchObject({ parentId: 'classes' });
    expect(ids(b.traits)).toEqual(['paladin', 'wizard', 'bless']);
    expect(b.linkOf.get('bless')?.id).toBe('l-classes');
  });

  it('never expands the Blueprints group itself or an owned item', () => {
    const w = world();
    const bad: Entity = { ...albus, traitLinks: [link('l-t', 'blueprints', 'group'), link('l-vow', 'vow', 'trait')] };
    const b = bearer(world({ entities: [bad, mira] }), 'albus');
    expect(ids(b.groups)).toEqual([]);
    expect(ids(b.traits)).toEqual(['oath']);
    expect(originalOf(w, 'blueprints')).toBeNull();
    expect(originalOf(w, 'vow')).toBeNull();
    expect(originalOf(w, 'classes')).toMatchObject({ kind: 'group', item: { id: 'classes' } });
    expect(originalOf(w, 'brave')).toMatchObject({ kind: 'trait', item: { id: 'brave' } });
  });
});

describe('resolveBearers: the player bearer', () => {
  it('keeps root traits outside Blueprints and hides Blueprints, whatever the persona', () => {
    for (const persona of [NONE, AS_ALBUS]) {
      const b = bearer(world(), PLAYER_BEARER, persona);
      expect(ids(b.traits)).toEqual(['brave']);
      expect(ids(b.groups)).toEqual(['oaths']);
      expect(b.isPlayer).toBe(true);
      expect(b.present).toBe(true);
    }
  });

  it('expands no links itself; the Custom Persona entity is a player bearer under None and a library persona, absent under a world persona', () => {
    const w = world({ entities: [albus, mira, custom, newcomer] });
    const lib: Entity = { id: 'lib', name: 'Lib', persona: true };
    for (const [persona, library] of [[NONE, []], [AS_LIBRARY, [lib]]] as const) {
      const root = bearer(w, PLAYER_BEARER, persona, [...library]);
      expect(ids(root.traits)).toEqual(['brave']);
      expect(ids(root.groups)).toEqual(['oaths']);
      expect(root.linkOf.size).toBe(0);
      const cp = bearer(w, 'cp', persona, [...library]);
      expect(cp).toMatchObject({ isPlayer: true, present: true, entity: newcomer, name: 'Newcomer' });
      expect(ids(cp.groups)).toEqual(['classes']);
      expect(cp.groups[0]).toMatchObject({ parentId: null, order: 0, maxPicks: 1 });
      expect(ids(cp.traits)).toEqual(['paladin', 'wizard']);
      expect(cp.linkOf.get('paladin')?.id).toBe('cp-classes');
    }
    expect(bearer(w, 'cp', AS_ALBUS)).toMatchObject({ isPlayer: false, present: false });
    expect(ids(bearer(w, PLAYER_BEARER, AS_ALBUS).traits)).toEqual(['brave']);
  });

  it('holds a root trait once when the Custom Persona entity also links it, the root winning', () => {
    const doubled: Entity = { ...newcomer, traitLinks: [link('cp-brave', 'brave', 'trait'), link('cp-brave-2', 'brave', 'trait')] };
    const w = world({ entities: [albus, mira, custom, doubled] });
    const root = bearer(w, PLAYER_BEARER);
    expect(ids(root.traits)).toEqual(['brave']);
    expect(root.traits[0]).toMatchObject({ groupId: null, order: 0 });
    const cp = bearer(w, 'cp');
    expect(ids(cp.traits)).toEqual([]);
    expect(cp.linkOf.has('brave')).toBe(false);
  });

  it('is the only player bearer under None; a persona’s bearer joins it when picked, and the Custom Persona entity’s when the world has one', () => {
    const w = world();
    expect(resolveBearers(w, NONE).playerBearerIds).toEqual([PLAYER_BEARER]);
    expect(resolveBearers(w, AS_ALBUS).playerBearerIds).toEqual([PLAYER_BEARER, 'albus']);
    const lib: Entity = { id: 'lib', name: 'Lib', persona: true, traits: [trait('calm')] };
    const r = resolveBearers(w, AS_LIBRARY, [lib]);
    expect(r.playerBearerIds).toEqual([PLAYER_BEARER, 'lib']);
    expect(r.bearers.find((b) => b.id === 'lib')).toMatchObject({ isPlayer: true, present: true, entity: lib });
    const marked = world({ entities: [albus, mira, custom, newcomer] });
    expect(resolveBearers(marked, NONE).playerBearerIds).toEqual([PLAYER_BEARER, 'cp']);
    expect(resolveBearers(marked, AS_LIBRARY, [lib]).playerBearerIds).toEqual([PLAYER_BEARER, 'cp', 'lib']);
    expect(resolveBearers(marked, AS_ALBUS).playerBearerIds).toEqual([PLAYER_BEARER, 'albus']);
  });

  it('keeps the Custom Persona entity out of the cast under every persona, and out of the gate owners under a world persona', () => {
    const marked = world({ entities: [albus, mira, custom, newcomer] });
    const lib: Entity = { id: 'lib', name: 'Lib', persona: true, traits: [trait('calm')] };
    expect(ids(resolveBearers(marked, NONE).cast)).toEqual(['albus', 'mira']);
    expect(ids(resolveBearers(marked, AS_LIBRARY, [lib]).cast)).toEqual(['albus', 'mira']);
    expect(ids(resolveBearers(marked, AS_ALBUS).cast)).toEqual(['mira']);
    expect(resolveBearers(marked, NONE).gate.owners.map((o) => o.id)).toEqual([PLAYER_BEARER, 'albus', 'mira', 'cp']);
    expect(resolveBearers(marked, AS_ALBUS).gate.owners.map((o) => o.id)).toEqual([PLAYER_BEARER, 'albus', 'mira']);
  });
});

describe('resolveBearers: a requirement never names yourself', () => {
  const albusPaladin = { kind: 'trait' as const, id: 'paladin', bearer: { kind: 'entity' as const, id: 'albus' } };
  const squire = trait('squire', { name: 'Squire to Albus', groupId: null, order: 1, requires: [albusPaladin] });
  const sworn = trait('sworn', { name: 'Sworn', groupId: null, order: 2, requires: [albusPaladin, { kind: 'trait', id: 'brave' }] });
  const w = world({ traits: [...world().traits, squire, sworn] });

  it('offers a root trait gated on Albus to everyone but Albus', () => {
    expect(ids(bearer(w, PLAYER_BEARER).traits)).toContain('squire');
    expect(ids(bearer(w, PLAYER_BEARER, AS_LIBRARY, [{ id: 'lib', name: 'Lib', persona: true }]).traits)).toContain('squire');
    expect(ids(bearer(w, PLAYER_BEARER, AS_ALBUS).traits)).not.toContain('squire');
  });

  it('keeps a trait with another way in, minus the requirement that names you', () => {
    const asAlbus = bearer(w, PLAYER_BEARER, AS_ALBUS).traits.find((t) => t.id === 'sworn');
    expect(asAlbus?.requires).toEqual([{ kind: 'trait', id: 'brave' }]);
    expect(bearer(w, PLAYER_BEARER).traits.find((t) => t.id === 'sworn')?.requires).toHaveLength(2);
  });

  it('leaves the played entity’s own tree alone, so Albus can gate on himself there', () => {
    const oath = trait('oath', { name: 'Oath', groupId: null, order: 0, requires: [albusPaladin] });
    const own = world({ entities: [{ ...albus, traits: [oath] }, mira, custom] });
    expect(bearer(own, 'albus', AS_ALBUS).traits.find((t) => t.id === 'oath')?.requires).toEqual([albusPaladin]);
  });

  it('applies to the Custom Persona entity’s links under a library persona, and gates the player’s owner the same way', () => {
    const vow = trait('vow-t', { name: 'Vow', groupId: 'blueprints', order: 2, requires: [{ kind: 'trait', id: 'paladin', bearer: { kind: 'entity', id: 'lib' } }] });
    const lib: Entity = { id: 'lib', name: 'Lib', persona: true };
    const linkedVow = world({
      traits: [...world().traits, vow],
      entities: [albus, mira, { ...newcomer, traitLinks: [link('l-vow', 'vow-t', 'trait')] }],
    });
    // Under None the vow names someone else; under Lib it names the player, so it falls away.
    expect(ids(bearer(linkedVow, 'cp').traits)).toContain('vow-t');
    expect(ids(bearer(linkedVow, 'cp', AS_LIBRARY, [lib]).traits)).not.toContain('vow-t');
    const { gate } = resolveBearers(w, AS_ALBUS);
    expect(gate.owners[0].traits.map((t) => t.id)).not.toContain('squire');
  });
});

describe('resolveBearers: a world persona’s tree', () => {
  it('is its own owned traits and links, marked as the player when picked', () => {
    const picked = bearer(world(), 'albus', AS_ALBUS);
    expect(ids(picked.traits)).toEqual(['oath', 'paladin', 'wizard']);
    expect(picked.isPlayer).toBe(true);
    const unpicked = bearer(world(), 'albus', NONE);
    expect(ids(unpicked.traits)).toEqual(ids(picked.traits));
    expect(unpicked.isPlayer).toBe(false);
  });

  it('drops a link to an original the root already offers while the persona is played, and keeps it as a cast entity', () => {
    // Brave is at the root, and Oaths holds Mira's node; a link to either duplicates what the player holds.
    const doubled: Entity = {
      ...albus,
      traitLinks: [...albus.traitLinks!, link('l-brave', 'brave', 'trait', { order: 2 }), link('l-oaths', 'oaths', 'group', { order: 3 })],
    };
    const w = world({ entities: [doubled, mira] });
    const played = bearer(w, 'albus', AS_ALBUS);
    expect(ids(played.traits)).toEqual(['oath', 'paladin', 'wizard']);
    expect(ids(played.groups)).toEqual(['classes']);
    expect(played.linkOf.has('brave')).toBe(false);
    const cast = bearer(w, 'albus', NONE);
    expect(ids(cast.traits)).toEqual(['oath', 'paladin', 'wizard', 'brave']);
    expect(ids(cast.groups)).toEqual(['classes', 'oaths']);
    expect(cast.linkOf.get('brave')?.id).toBe('l-brave');
  });

  it("drops a played library persona's link to what the root offers, and keeps one the Custom Persona entity also links, each in its own tree", () => {
    const w = world({ entities: [albus, mira, custom, { ...newcomer, traitLinks: [link('cp-wizard', 'wizard', 'trait')] }] });
    const lib: Entity = {
      id: 'lib', name: 'Lib', persona: true,
      traitLinks: [link('l-brave', 'brave', 'trait'), link('l-wizard', 'wizard', 'trait', { order: 1 }), link('l-smite', 'smite', 'trait', { order: 2 })],
    };
    const played = bearer(w, 'lib', AS_LIBRARY, [lib]);
    expect(ids(played.traits)).toEqual(['wizard', 'smite']);
    expect(played.linkOf.has('brave')).toBe(false);
    expect(ids(bearer(w, 'cp', AS_LIBRARY, [lib]).traits)).toEqual(['wizard']);
    expect(ids(bearer(w, PLAYER_BEARER, AS_LIBRARY, [lib]).traits)).toEqual(['brave']);
  });
});

describe('resolveBearers: the cast and persona-only entities', () => {
  it('leaves an unpicked persona-only entity out of the cast and marks its bearer absent', () => {
    const r = resolveBearers(world(), NONE);
    expect(ids(r.cast)).toEqual(['albus', 'mira']);
    expect(r.bearers.find((b) => b.id === 'custom')).toMatchObject({ present: false, isPlayer: false });
    expect(r.gate.owners.map((o) => o.id)).toEqual([PLAYER_BEARER, 'albus', 'mira']);
  });

  it('keeps a picked persona-only entity present and out of the cast like any played persona', () => {
    const r = resolveBearers(world(), { source: 'world', entityId: 'custom' });
    expect(ids(r.cast)).toEqual(['albus', 'mira']);
    expect(r.bearers.find((b) => b.id === 'custom')).toMatchObject({ present: true, isPlayer: true });
    expect(ids(r.bearers.find((b) => b.id === 'custom')!.traits)).toEqual(['smite']);
    expect(r.gate.owners.map((o) => o.id)).toEqual([PLAYER_BEARER, 'albus', 'mira', 'custom']);
  });

  it('reads the persona-only flag only with the Persona mark', () => {
    const plain: Entity = { ...custom, persona: undefined };
    expect(inCast(plain, NONE)).toBe(true);
    expect(inCast(custom, NONE)).toBe(false);
    expect(inCast(custom, { source: 'world', entityId: 'custom' })).toBe(false);
    expect(inCast(albus, AS_ALBUS)).toBe(false);
    expect(inCast(albus, NONE)).toBe(true);
    expect(ids(resolveBearers(world({ entities: [albus, mira, plain] }), NONE).cast)).toEqual(['albus', 'mira', 'custom']);
  });

  it('leaves the Custom Persona entity out of the cast: the player under None, absent under a world persona', () => {
    const w = world({ entities: [albus, mira, newcomer] });
    expect(inCast(newcomer, NONE)).toBe(false);
    expect(inCast(newcomer, AS_ALBUS)).toBe(false);
    const none = resolveBearers(w, NONE);
    expect(ids(none.cast)).toEqual(['albus', 'mira']);
    expect(none.bearers.find((b) => b.id === 'cp')).toMatchObject({ present: true, isPlayer: true });
    expect(none.gate.owners.map((o) => o.id)).toEqual([PLAYER_BEARER, 'albus', 'mira', 'cp']);
    const asAlbus = resolveBearers(w, AS_ALBUS);
    expect(ids(asAlbus.cast)).toEqual(['mira']);
    expect(asAlbus.bearers.find((b) => b.id === 'cp')).toMatchObject({ present: false, isPlayer: false });
    expect(asAlbus.gate.owners.map((o) => o.id)).toEqual([PLAYER_BEARER, 'albus', 'mira']);
  });

  it('plays as the picked world persona, or as the Custom Persona entity under None and a library persona', () => {
    expect(playsAs(albus, AS_ALBUS)).toBe(true);
    expect(playsAs(albus, NONE)).toBe(false);
    expect(playsAs(albus, AS_LIBRARY)).toBe(false);
    expect(playsAs(newcomer, NONE)).toBe(true);
    expect(playsAs(newcomer, undefined)).toBe(true);
    expect(playsAs(newcomer, AS_LIBRARY)).toBe(true);
    expect(playsAs(newcomer, AS_ALBUS)).toBe(false);
  });
});

describe('resolveBearers: the gate input', () => {
  it('has one owner per present bearer, the player first, with each bearer’s expanded lists', () => {
    const r = resolveBearers(world(), AS_ALBUS);
    expect(r.gate.owners.map((o) => o.id)).toEqual([PLAYER_BEARER, 'albus', 'mira']);
    expect(ids(r.gate.owners[1].traits)).toEqual(['oath', 'paladin', 'wizard']);
    expect(r.gate.owners[1].name).toBe('Albus');
    expect(r.gate.owners[2].parentGroupId).toBe('oaths');
    expect(r.gate.entities.map((e) => e.id)).toEqual(['albus', 'mira', 'custom']);
    expect(r.gate.persona).toEqual(AS_ALBUS);
    expect(r.gate.originals).toEqual({ traits: world().traits, groups: world().traitGroups });
  });

  it('names a requirement’s target from the originals when no present bearer holds it', () => {
    // Smite sits under Blueprints and no bearer links it under Albus, yet the gate still reads its name.
    const gated = { ...mira, traits: [trait('vow', { name: 'Vow', requires: [{ kind: 'trait', id: 'smite', bearer: { kind: 'you' } }] })] };
    const r = resolveBearers(world({ entities: [albus, gated] }), AS_ALBUS);
    expect(gateOf(gateStates({ ...r.gate, active: {} }), 'mira', 'vow')?.requirements).toEqual([
      { text: 'You: Smite', holds: false, unresolved: false, hidden: false },
    ]);
  });

  it('gates each bearer on its own set, so a link never unlocks through another bearer', () => {
    // Albus links Smite next to Classes; the player's Paladin is not his.
    const w = world({ entities: [{ ...albus, traitLinks: [...albus.traitLinks!, link('l-smite', 'smite', 'trait', { order: 2 })] }, mira] });
    const gate = (active: Record<string, string[]>) => gateOf(gateStates({ ...resolveBearers(w, NONE).gate, active }), 'albus', 'smite')?.unlocked;
    expect(gate({ [PLAYER_BEARER]: ['paladin'] })).toBe(false);
    expect(gate({ albus: ['paladin'] })).toBe(true);
  });
});

describe('editorGateInput', () => {
  it('reads the whole world as the player, Blueprints included, then each bearer with its links expanded', () => {
    const input = editorGateInput(world({ entities: [albus, mira, custom, { ...newcomer, traitLinks: [link('cp-smite', 'smite', 'trait')] }] }));
    expect(input.owners.map((o) => o.id)).toEqual([PLAYER_BEARER, 'albus', 'mira', 'custom', 'cp']);
    expect(ids(input.owners[0].traits)).toEqual(['brave', 'paladin', 'wizard', 'smite']);
    expect(ids(input.owners[0].groups)).toEqual(['oaths', 'blueprints', 'classes']);
    expect(ids(input.owners[1].traits)).toEqual(['oath', 'paladin', 'wizard']);
    expect(ids(input.owners[4].traits)).toEqual(['smite']);
    expect(input.active).toEqual({});
    expect(input.persona).toEqual(NONE);
    expect(gateOf(gateStates(input), PLAYER_BEARER, 'smite')?.requirements).toEqual([{ text: 'Paladin', holds: false, unresolved: false, hidden: false }]);
  });

  it('reads an entity placement under Blueprints as the top level', () => {
    const under: Entity = { ...mira, traitPlacement: { groupId: 'classes', order: 0 } };
    const r = resolveBearers(world({ entities: [albus, under] }), NONE);
    expect(r.gate.owners.find((o) => o.id === 'mira')?.parentGroupId).toBeNull();
  });
});

describe('holdsOriginal', () => {
  const w = world({ entities: [albus, mira, custom, { ...newcomer, traitLinks: [link('cp-smite', 'smite', 'trait')] }] });

  it.each([
    ['albus', 'paladin', true, 'a trait inside a linked group'],
    ['albus', 'classes', true, 'the linked group itself'],
    ['albus', 'blueprints', false, 'Blueprints is never held'],
    ['albus', 'smite', false, 'a Blueprints trait the bearer has no link to'],
    ['albus', 'oaths', false, 'a root group the bearer has no link to'],
    ['mira', 'paladin', true, 'a trait linked directly'],
    ['mira', 'classes', true, 'the group holding a directly linked trait'],
    ['mira', 'wizard', false, 'a sibling of a directly linked trait'],
    [PLAYER_BEARER, 'brave', true, 'a root trait the player already has'],
    [PLAYER_BEARER, 'oaths', true, 'a root group the player already has'],
    [PLAYER_BEARER, 'smite', false, 'a Blueprints trait the Custom Persona entity links, which the root does not expand'],
    [PLAYER_BEARER, 'paladin', false, 'a Blueprints trait nobody offers the player'],
    ['cp', 'smite', true, 'a Blueprints trait the Custom Persona entity links'],
    ['cp', 'brave', true, 'a root trait the Custom Persona entity holds through the root'],
    ['cp', 'oaths', true, 'a root group the Custom Persona entity holds through the root'],
    ['cp', 'paladin', false, 'a Blueprints trait the Custom Persona entity has no link to'],
  ])('%s holds %s → %s (%s)', (bearerId, originalId, held) => {
    expect(holdsOriginal(w, bearer(w, bearerId), originalId)).toBe(held);
  });

  it('counts the root for the Custom Persona entity under a world persona too, so the editor check never drifts', () => {
    const cp = bearer(w, 'cp', AS_ALBUS);
    expect(cp.present).toBe(false);
    expect(holdsOriginal(w, cp, 'brave')).toBe(true);
    expect(holdsOriginal(w, cp, 'smite')).toBe(true);
    expect(holdsOriginal(w, bearer(w, PLAYER_BEARER, AS_ALBUS), 'smite')).toBe(false);
  });
});

describe('makeLink', () => {
  it('records the original’s kind and name and the place given', () => {
    const w = world();
    expect(makeLink(w, 'classes', 'new', { groupId: null, order: 2 }))
      .toEqual({ id: 'new', originalId: 'classes', kind: 'group', originalName: 'Classes', groupId: null, order: 2 });
    expect(makeLink(w, 'paladin', 'new', { groupId: 'g', order: 0 })).toMatchObject({ kind: 'trait', originalName: 'Paladin', groupId: 'g' });
  });

  it('refuses Blueprints, an owned item and an unknown id', () => {
    const w = world();
    for (const id of ['blueprints', 'vow', 'gone']) expect(makeLink(w, id, 'new', { groupId: null, order: 0 })).toBeNull();
  });
});

describe('bearsTraits', () => {
  it('is true for an entity with owned traits, owned groups, or links only', () => {
    expect(bearsTraits({ id: 'e', name: 'E' })).toBe(false);
    expect(bearsTraits({ id: 'e', name: 'E', traits: [trait('t')] })).toBe(true);
    expect(bearsTraits({ id: 'e', name: 'E', traitGroups: [group('g', null, 0)] })).toBe(true);
    expect(bearsTraits(custom)).toBe(true);
    expect(bearsTraits(newcomer)).toBe(true);
    expect(bearsTraits({ ...newcomer, traitLinks: undefined })).toBe(false);
  });
});

describe('remintOwnedTraits with links', () => {
  it('gives links fresh ids and follows a link into a reminted owned group', () => {
    const copy = remintOwnedTraits(mira);
    const [l] = copy.traitLinks!;
    expect(l.id).not.toBe('l-paladin');
    expect(l.originalId).toBe('paladin');
    expect(l.groupId).toBe(copy.traitGroups![0].id);
    expect(l.groupId).not.toBe('g-mira');
  });
});
