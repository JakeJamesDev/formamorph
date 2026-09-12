import { describe, it, expect } from 'vitest';
import type { Placeholder } from '@/types';
import { phValues } from '@/test/placeholderValues';
import type { PlaceholderOwnerRef, PlaceholderOwners } from './placeholderHomes';
import { placeholderEntryFields } from './statCodeSurface';
import {
  PLACEHOLDER_ENTRY_MEMBERS, isPlaceholderEntryMember, placeholderKeyWinner, placeholderPathAt,
  placeholderPathDots, placeholderPathExpression, placeholderPathLabel, placeholderPathMap,
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

/** The segments of every path in a map, as the accessor an author would type. */
const accessors = (list: readonly Placeholder[], owned?: PlaceholderOwners) =>
  everyNode(placeholderPathMap({ list, owners: owned })).map((node) => node.path.join('.'));

describe('the top level', () => {
  it('keys a world placeholder by its bare name', () => {
    const map = placeholderPathMap({ list: [ph('p1', 'Hair')] });
    expect(placeholderPathAt(map, ['Hair'])?.placeholder?.id).toBe('p1');
  });

  it('reaches the world-level one by bare name when each owner has a placeholder of the same name', () => {
    const list = [ph('world', 'Hair'), ph('molly', 'Hair'), ph('anna', 'Hair')];
    const map = placeholderPathMap({
      list, owners: owners(['molly', entity('e-molly', 'Molly')], ['anna', entity('e-anna', 'Anna')]),
    });
    expect(placeholderPathAt(map, ['Hair'])?.placeholder?.id).toBe('world');
    expect(placeholderPathAt(map, ['Molly', 'Hair'])?.placeholder?.id).toBe('molly');
    expect(placeholderPathAt(map, ['Anna', 'Hair'])?.placeholder?.id).toBe('anna');
  });

  it('reaches the last authored by bare name when only the owners carry the name', () => {
    const list = [ph('molly', 'Hair'), ph('anna', 'Hair')];
    const map = placeholderPathMap({
      list, owners: owners(['molly', entity('e-molly', 'Molly')], ['anna', entity('e-anna', 'Anna')]),
    });
    expect(placeholderPathAt(map, ['Hair'])?.placeholder?.id).toBe('anna');
    expect(placeholderKeyWinner(map, 'Hair')).toMatchObject({ count: 2 });
    expect(placeholderKeyWinner(map, 'Hair').node?.path).toEqual(['Anna', 'Hair']);
  });

  it('gives an owner named like a world placeholder one key, the last authored winning', () => {
    const list = [ph('world', 'Molly'), ph('scoped', 'Hair')];
    const map = placeholderPathMap({ list, owners: owners(['scoped', entity('e-molly', 'Molly')]) });
    // The owner node stands where its first placeholder does, which is after the world row.
    expect(placeholderPathAt(map, ['Molly'])?.placeholder).toBeNull();
    expect(placeholderKeyWinner(map, 'Molly').count).toBe(2);
    // The world row keeps its own key nowhere else, so it is only reachable as the loser of the contest.
    expect(placeholderPathAt(map, ['Molly', 'Hair'])?.placeholder?.id).toBe('scoped');
  });

  it('keys an owned child by its bare name too, as the flat map always did', () => {
    const list = [ph('hair', 'Hair', [chip('shade')]), ph('shade', 'Shade', ['ash'], { ownerId: 'hair' })];
    const map = placeholderPathMap({ list });
    expect(placeholderPathAt(map, ['Shade'])?.placeholder?.id).toBe('shade');
  });
});

describe('the tree', () => {
  it('carries an owner node with the placeholders that owner holds directly', () => {
    const list = [ph('eyes', 'Eyes'), ph('hair', 'Hair')];
    const map = placeholderPathMap({
      list, owners: owners(['eyes', entity('e1', 'Molly')], ['hair', entity('e1', 'Molly')]),
    });
    const molly = placeholderPathAt(map, ['Molly']);
    expect(molly?.placeholder).toBeNull();
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
    expect(placeholderPathAt(map, ['Molly', 'Hair', 'Shade', 'Tone'])?.placeholder?.id).toBe('tone');
    expect(placeholderPathAt(map, ['Molly', 'Hair', 'Shade', 'Tone'])?.path).toEqual(['Molly', 'Hair', 'Shade', 'Tone']);
  });

  it('leaves a shared row out of its referrer’s children, since only ownership names a path', () => {
    // Hair holds Shade as a value, but Shade belongs to nobody, so it stays a top-level row.
    const list = [ph('hair', 'Hair', [chip('shade')]), ph('shade', 'Shade', ['ash'])];
    const map = placeholderPathMap({ list });
    expect(placeholderPathAt(map, ['Hair'])?.children).toEqual([]);
    expect(placeholderPathAt(map, ['Shade'])?.placeholder?.id).toBe('shade');
  });

  it('reads one node for a placeholder reached by bare name and by path', () => {
    const list = [ph('hair', 'Hair', [chip('shade')]), ph('shade', 'Shade', ['ash'], { ownerId: 'hair' })];
    const map = placeholderPathMap({ list });
    expect(placeholderPathAt(map, ['Shade'])).toBe(placeholderPathAt(map, ['Hair', 'Shade']));
  });

  it('builds one node apiece when two placeholders hold each other', () => {
    const list = [
      ph('a', 'A', [chip('b')], { ownerId: 'b' }),
      ph('b', 'B', [chip('a')], { ownerId: 'a' }),
    ];
    // Each holds the other, so each path names the other above it. The walk has to terminate and produce
    // one node apiece rather than recursing through the pair forever.
    const map = placeholderPathMap({ list });
    expect(everyNode(map)).toHaveLength(2);
    expect(accessors(list)).toEqual(['B.A', 'A.B']);
    expect(placeholderPathAt(map, ['A'])?.placeholder?.id).toBe('a');
    expect(placeholderPathAt(map, ['A', 'B'])?.placeholder?.id).toBe('b');
  });

  it('reads an owner’s name through the code-name rule, so a chip in it does not move the path', () => {
    const town = ph('town', 'Town', ['Ashford']);
    const list = [town, ph('mood', 'Mood', ['wary'])];
    const map = placeholderPathMap({
      list, owners: owners(['mood', entity('e1', `${chip('town')} Guard`)]),
    });
    expect(placeholderPathAt(map, ['Town Guard', 'Mood'])?.placeholder?.id).toBe('mood');
  });
});

describe('spelling a path', () => {
  it('uses a dot for an identifier and brackets for anything else', () => {
    expect(placeholderPathExpression(['Molly', 'Hair'])).toBe('placeholders.Molly.Hair');
    expect(placeholderPathExpression(['Eye Color'])).toBe('placeholders["Eye Color"]');
    expect(placeholderPathExpression(['Old Molly', 'Eye Color'])).toBe('placeholders["Old Molly"]["Eye Color"]');
  });

  it('names a path for a message the way every other editor surface does', () => {
    expect(placeholderPathLabel(['Molly', 'Hair'])).toBe('Molly › Hair');
    expect(placeholderPathLabel(['Hair'])).toBe('Hair');
  });

  it('offers a dotted insert only where every segment is an identifier', () => {
    expect(placeholderPathDots(['Molly', 'Hair'])).toBe('Molly.Hair');
    expect(placeholderPathDots(['Molly', 'Eye Color'])).toBeNull();
    expect(placeholderPathDots(['Old Molly', 'Hair'])).toBeNull();
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
