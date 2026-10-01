import { describe, it, expect } from 'vitest';
import type { Placeholder } from '@/types';
import { phValues } from '@/test/placeholderValues';
import type { PlaceholderOwnerRef, PlaceholderOwners } from './placeholderHomes';
import { placeholderEntryFields } from './statCodeSurface';
import {
  PLACEHOLDER_ENTRY_MEMBERS, isPlaceholderEntryMember, placeholderKeyWinner, placeholderPathAt,
  placeholderPathExpression, placeholderPathLabel, placeholderPathMap, walkPlaceholderPath,
  type PlaceholderPathMap, type PlaceholderPathNode,
} from './statCodePaths';

/** Every distinct node in a map, each once, outermost first. Local because nothing in the app enumerates the
 *  map — the sandbox builds objects from it and every other surface walks one path at a time. */
function everyNode(map: PlaceholderPathMap): PlaceholderPathNode[] {
  const out: PlaceholderPathNode[] = [];
  const seen = new Set<PlaceholderPathNode>();
  const walk = (nodes: readonly PlaceholderPathNode[]) => {
    for (const node of nodes) {
      if (seen.has(node)) continue;
      seen.add(node);
      out.push(node);
      walk(node.children);
    }
  };
  walk(map.top);
  return out;
}

const ph = (id: string, name: string, values: readonly string[] = ['a'], over: Partial<Placeholder> = {}): Placeholder =>
  ({ id, name, values: phValues(values), ...over });

/** A value that is exactly one chip of `id` — what nests one placeholder under another. */
const chip = (id: string) => `{{ph:${id}:world:p-${id}}}`;

const owners = (...pairs: readonly [string, PlaceholderOwnerRef][]): PlaceholderOwners => new Map(pairs);
const entity = (id: string, name: string): PlaceholderOwnerRef => ({ kind: 'entity', id, name });

/** The node `segments` reach under one owner's node, as that owner's entry reads it. */
const ownedAt = (map: PlaceholderPathMap, ownerId: string, segments: readonly string[]) => {
  const owner = map.owners.get(ownerId);
  const { node, rest } = walkPlaceholderPath(map, segments, owner ?? null);
  return owner && rest.length === 0 ? node : null;
};

describe('the top level', () => {
  it('keys a world placeholder by its bare name', () => {
    const map = placeholderPathMap({ list: [ph('p1', 'Hair')] });
    expect(placeholderPathAt(map, ['Hair'])?.placeholder?.id).toBe('p1');
  });

  it('keys only the world’s own rows, and hangs each owner’s rows under its owner node', () => {
    const list = [ph('world', 'Hair'), ph('molly', 'Hair'), ph('anna', 'Hair')];
    const map = placeholderPathMap({
      list, owners: owners(['molly', entity('e-molly', 'Molly')], ['anna', entity('e-anna', 'Anna')]),
    });
    expect(placeholderPathAt(map, ['Hair'])?.placeholder?.id).toBe('world');
    expect(placeholderPathAt(map, ['Molly', 'Hair'])).toBeNull();
    expect(ownedAt(map, 'e-molly', ['Hair'])?.placeholder?.id).toBe('molly');
    expect(ownedAt(map, 'e-anna', ['Hair'])?.placeholder?.id).toBe('anna');
    expect(placeholderKeyWinner(map, 'Hair').count).toBe(1);
  });

  it('keys no owned row by its bare name', () => {
    const list = [ph('molly', 'Hair'), ph('anna', 'Hair')];
    const map = placeholderPathMap({
      list, owners: owners(['molly', entity('e-molly', 'Molly')], ['anna', entity('e-anna', 'Anna')]),
    });
    expect(placeholderPathAt(map, ['Hair'])).toBeNull();
    expect(placeholderKeyWinner(map, 'Hair')).toEqual({ count: 0, node: null });
  });

  it('leaves an owner’s name to a world row of that name', () => {
    const list = [ph('world', 'Molly'), ph('scoped', 'Hair')];
    const map = placeholderPathMap({ list, owners: owners(['scoped', entity('e-molly', 'Molly')]) });
    expect(placeholderPathAt(map, ['Molly'])?.placeholder?.id).toBe('world');
    expect(placeholderKeyWinner(map, 'Molly').count).toBe(1);
    expect(ownedAt(map, 'e-molly', ['Hair'])?.placeholder?.id).toBe('scoped');
  });

  it('reaches a held row only through its holder', () => {
    const list = [ph('hair', 'Hair', [chip('shade')]), ph('shade', 'Shade', ['ash'], { ownerId: 'hair' })];
    const map = placeholderPathMap({ list });
    expect(placeholderPathAt(map, ['Shade'])).toBeNull();
    expect(placeholderPathAt(map, ['Hair', 'Shade'])?.placeholder?.id).toBe('shade');
  });

  it('keys the later of two world rows that share a name, and counts both', () => {
    const map = placeholderPathMap({ list: [ph('first', 'Mood'), ph('later', 'Mood')] });
    expect(placeholderKeyWinner(map, 'Mood')).toMatchObject({ count: 2, node: { placeholder: { id: 'later' } } });
  });
});

describe('the tree', () => {
  it('carries an owner node with the placeholders that owner holds directly', () => {
    const list = [ph('eyes', 'Eyes'), ph('hair', 'Hair')];
    const map = placeholderPathMap({
      list, owners: owners(['eyes', entity('e1', 'Molly')], ['hair', entity('e1', 'Molly')]),
    });
    const molly = map.owners.get('e1');
    expect(molly?.placeholder).toBeNull();
    expect(molly?.name).toBe('Molly');
    expect(molly?.children.map((child) => child.name)).toEqual(['Eyes', 'Hair']);
  });

  it('carries a holder placeholder as an entry that also holds its owned children', () => {
    const list = [ph('hair', 'Hair', [chip('shade')]), ph('shade', 'Shade', ['ash'], { ownerId: 'hair' })];
    const map = placeholderPathMap({ list });
    const hair = placeholderPathAt(map, ['Hair']);
    expect(hair?.placeholder?.id).toBe('hair');
    expect(hair?.children.map((child) => child.name)).toEqual(['Shade']);
    expect(placeholderPathAt(map, ['Hair', 'Shade'])?.placeholder?.id).toBe('shade');
  });

  it('nests as deep as the ownership tree goes, under an owner node', () => {
    const list = [
      ph('hair', 'Hair', [chip('shade')]),
      ph('shade', 'Shade', [chip('tone')], { ownerId: 'hair' }),
      ph('tone', 'Tone', ['warm'], { ownerId: 'shade' }),
    ];
    const map = placeholderPathMap({
      list,
      owners: owners(['hair', entity('e1', 'Molly')], ['shade', entity('e1', 'Molly')], ['tone', entity('e1', 'Molly')]),
    });
    const tone = ownedAt(map, 'e1', ['Hair', 'Shade', 'Tone']);
    expect(tone?.placeholder?.id).toBe('tone');
    expect(tone?.path).toEqual(['Molly', 'Hair', 'Shade', 'Tone']);
    expect(tone?.ownedBy).toBe('entity');
  });

  it('leaves a shared row out of its referrer’s children, since only ownership names a path', () => {
    // Hair holds Shade as a value, but Shade belongs to nobody, so it stays a top-level row.
    const list = [ph('hair', 'Hair', [chip('shade')]), ph('shade', 'Shade', ['ash'])];
    const map = placeholderPathMap({ list });
    expect(placeholderPathAt(map, ['Hair'])?.children).toEqual([]);
    expect(placeholderPathAt(map, ['Shade'])?.placeholder?.id).toBe('shade');
  });

  it('terminates on two placeholders that hold each other, and keys neither', () => {
    const list = [
      ph('a', 'A', [chip('b')], { ownerId: 'b' }),
      ph('b', 'B', [chip('a')], { ownerId: 'a' }),
    ];
    // Each is held, so neither is a row of the world's own: no path reaches the pair.
    const map = placeholderPathMap({ list });
    expect(everyNode(map)).toEqual([]);
    expect(placeholderPathAt(map, ['A'])).toBeNull();
  });

  it('reads an owner’s name through the code-name rule, so a chip in it does not move the path', () => {
    const town = ph('town', 'Town', ['Ashford']);
    const list = [town, ph('mood', 'Mood', ['wary'])];
    const map = placeholderPathMap({
      list, owners: owners(['mood', entity('e1', `${chip('town')} Guard`)]),
    });
    expect(map.owners.get('e1')?.name).toBe('Town Guard');
    expect(ownedAt(map, 'e1', ['Mood'])?.path).toEqual(['Town Guard', 'Mood']);
  });
});

describe('spelling a path', () => {
  it('uses a dot for an identifier and brackets for anything else', () => {
    expect(placeholderPathExpression(['Hair', 'Shade'])).toBe('placeholders.Hair.Shade');
    expect(placeholderPathExpression(['Eye Color'])).toBe('placeholders["Eye Color"]');
  });

  it('starts an owned path at its owner’s entry', () => {
    expect(placeholderPathExpression(['Old Molly', 'Eye Color'], 'entity')).toBe('entities["Old Molly"].placeholders["Eye Color"]');
    expect(placeholderPathExpression(['Weather', 'Sky'], 'dictionary')).toBe('dictionaries.Weather.placeholders.Sky');
    expect(placeholderPathExpression(['persona', 'Eyes'], 'persona')).toBe('persona.placeholders.Eyes');
  });

  it('names a path for a message the way every other editor surface does', () => {
    expect(placeholderPathLabel(['Molly', 'Hair'])).toBe('Molly › Hair');
    expect(placeholderPathLabel(['Hair'])).toBe('Hair');
  });
});

describe('the entry members', () => {
  // The list decides two things at once: which child name loses to a member, and which keys the prelude
  // treats as built-in rather than as a key the run added. A seventh field on an entry that this list missed
  // would report every write to it as a path no placeholder answers, so the two are held together here.
  it('names exactly the members the surface describes, on either kind', () => {
    for (const kind of ['Wildcard', 'Object'] as const) {
      expect([...PLACEHOLDER_ENTRY_MEMBERS].sort())
        .toEqual(placeholderEntryFields(kind).map((field) => field.name).sort());
    }
  });

  it('answers for a member and not for an ordinary name', () => {
    expect(PLACEHOLDER_ENTRY_MEMBERS.every(isPlaceholderEntryMember)).toBe(true);
    expect(isPlaceholderEntryMember('Hair')).toBe(false);
  });
});
